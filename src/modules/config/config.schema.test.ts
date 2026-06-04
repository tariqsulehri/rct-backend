import {
  bulkUpsertDomainWeightsSchema,
  createUserSchema,
  upsertDepartmentConfigSchema,
} from './config.schema';

describe('config schemas', () => {
  it('accepts valid user creation payloads', () => {
    const result = createUserSchema.safeParse({
      username: 'engineer1',
      password: 'password123',
      role: 'ENGINEER',
      employee_id: 1,
    });

    expect(result.success).toBe(true);
  });

  it('rejects unsupported user roles', () => {
    const result = createUserSchema.safeParse({
      username: 'contractor1',
      password: 'password123',
      role: 'CONTRACTOR',
      employee_id: 1,
    });

    expect(result.success).toBe(false);
  });

  it('accepts department scoring weights in range', () => {
    const result = upsertDepartmentConfigSchema.safeParse({
      primary_weight: 0.5,
      secondary_weight: 0.3,
      tertiary_weight: 0.2,
      notes: 'Default scoring weights',
    });

    expect(result.success).toBe(true);
  });

  it('rejects department scoring weights outside range', () => {
    const result = upsertDepartmentConfigSchema.safeParse({
      primary_weight: 1.2,
      secondary_weight: 0.3,
      tertiary_weight: 0.2,
    });

    expect(result.success).toBe(false);
  });

  it('accepts bulk domain weight payloads', () => {
    const result = bulkUpsertDomainWeightsSchema.safeParse({
      weights: [
        { domain_id: 1, weight: 0.5, is_active: true },
        { domain_id: 2, weight: 0.5, is_active: true },
      ],
    });

    expect(result.success).toBe(true);
  });
});

