import { describe, it, expect } from '@jest/globals';
import { changePasswordSchema, loginSchema } from './auth.schema';

describe('auth schema', () => {
  it('accepts valid login credentials', () => {
    const result = loginSchema.safeParse({
      username: 'manager',
      password: 'password123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects short usernames and passwords', () => {
    const result = loginSchema.safeParse({
      username: 'ab',
      password: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('accepts valid change password payload', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid change password payload when new password is too short', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldPassword123',
      newPassword: 'short',
    });

    expect(result.success).toBe(false);
  });
});


