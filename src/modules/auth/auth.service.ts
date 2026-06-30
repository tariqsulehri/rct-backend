import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { generateAccessToken, generateRefreshToken } from '../../middleware/authenticate';
import logger from '../../config/logger';
import env from '../../config/env';
import { LoginRequest, LoginResponse } from './auth.schema';

type LoginResult = LoginResponse & { refreshToken: string };
type CurrentUserResult = LoginResponse['user'];

export const authService = {
  async getCurrentUser(userId: number): Promise<CurrentUserResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          include: {
            current_grade: true,
            target_grade: true,
          },
        },
      },
    });

    if (!user || !user.is_active || user.employee.deleted_at) {
      throw {
        statusCode: 401,
        code: 'USER_NOT_FOUND',
        message: 'User not found or inactive',
      };
    }

    return {
      id: user.id,
      employeeId: user.employee_id,
      empCode: user.employee.emp_code,
      username: user.username,
      role: user.role,
      employeeName: user.employee.full_name,
      department: user.employee.department,
      currentGrade: user.employee.current_grade.code,
      currentGradeTitle: user.employee.current_grade.title,
      targetGrade: user.employee.target_grade.code,
      targetGradeTitle: user.employee.target_grade.title,
    };
  },

  async login(request: LoginRequest): Promise<LoginResult> {
    const { username, password } = request;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        employee: {
          include: {
            current_grade: true,
            target_grade: true,
          },
        },
      },
    });

    if (!user) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      };
    }

    if (!user.is_active || user.employee.deleted_at) {
      throw {
        statusCode: 401,
        code: 'USER_NOT_FOUND',
        message: 'User not found or inactive',
      };
    }

    // Check account lock (brute-force protection)
    if (user.locked_until && user.locked_until > new Date()) {
      throw {
        statusCode: 401,
        code: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to multiple failed login attempts',
      };
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);

    if (!isPasswordValid) {
      const failedUser = await prisma.user.update({
        where: { id: user.id },
        data: { login_attempts: { increment: 1 } },
        select: { login_attempts: true },
      });
      const newAttempts = failedUser.login_attempts;
      const lockedUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      if (lockedUntil) {
        await prisma.user.update({
          where: { id: user.id },
          data: { locked_until: lockedUntil },
        });
      }

      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      };
    }

    // Reset login attempts on successful login
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        login_attempts: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      id: updatedUser.id,
      employeeId: updatedUser.employee_id,
      empCode: user.employee.emp_code,
      role: updatedUser.role,
      username: updatedUser.username,
    });

    const refreshToken = generateRefreshToken(updatedUser.id);

    // Save refresh token hash to database
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.refreshToken.create({
      data: {
        user_id: updatedUser.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    logger.info(`User ${user.username} logged in successfully`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: updatedUser.id,
        employeeId: updatedUser.employee_id,
        empCode: user.employee.emp_code,
        username: updatedUser.username,
        role: updatedUser.role,
        employeeName: user.employee.full_name,
        department: user.employee.department,
        currentGrade: user.employee.current_grade.code,
        currentGradeTitle: user.employee.current_grade.title,
        targetGrade: user.employee.target_grade.code,
        targetGradeTitle: user.employee.target_grade.title,
      },
    };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let decoded: { userId: number };
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: number };
    } catch {
      throw {
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      };
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
    });

    if (
      !storedToken ||
      storedToken.user_id !== decoded.userId ||
      storedToken.revoked ||
      storedToken.expires_at <= new Date()
    ) {
      throw {
        statusCode: 401,
        code: 'REFRESH_TOKEN_REVOKED',
        message: 'Refresh token is not valid',
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { employee: true },
    });

    if (!user || !user.is_active || user.employee.deleted_at) {
      throw {
        statusCode: 401,
        code: 'USER_NOT_FOUND',
        message: 'User not found or inactive',
      };
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      id: user.id,
      employeeId: user.employee_id,
      empCode: user.employee.emp_code,
      role: user.role,
      username: user.username,
    });

    // TODO: Optionally rotate refresh token here

    return { accessToken };
  },

  async logout(userId: number): Promise<void> {
    // Revoke all refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { user_id: userId },
      data: { revoked: true },
    });

    logger.info(`User ${userId} logged out`);
  },
};
