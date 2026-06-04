import { loginSchema } from './auth.schema';

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
});

