# Testing Strategy

## Current State

- Backend has Jest configuration but no discovered tests.
- Frontend has Vitest configuration but no discovered tests.
- Type-checks currently pass for backend and frontend.

## Test Pyramid

### Unit Tests

Backend:

- Scoring formula.
- Level and star mapping.
- Domain/overall aggregation.
- Access-policy helpers.
- Zod schema validation.

Frontend:

- Data transformation hooks.
- Utility functions.
- Critical component state transitions.

### Integration Tests

Backend integration tests should cover:

- Login success/failure/lockout.
- Refresh token success/failure/revoked/expired.
- Manager cannot access non-report employee.
- Engineer cannot access other engineer data.
- Assessment create/update/delete recomputes scores.
- Report endpoints return scoped rows.
- Config endpoints reject non-admin roles.

### End-to-End Tests

Recommended Playwright flows:

- Admin login and config read.
- Manager login, view team, create assessment, view report update.
- Engineer login, view own data, blocked from other employee.
- Expired access token refresh behavior.

## Minimum Regression Suite Before New Features

1. Auth service unit/integration tests.
2. Assessment service scoring tests.
3. Report scoping tests.
4. Config admin-only tests.
5. Frontend login and protected route tests.

## Test Data Strategy

Use deterministic seed fixtures:

- One admin.
- One manager.
- Two direct reports.
- One unrelated employee under another manager.
- One engineer user.
- Minimal grades/domains/competencies/technologies.

Avoid depending on full production-like seed data for core integration tests.

## CI Quality Gate

Every pull request should run:

```bash
cd backend && npm run type-check
cd backend && npm test
cd frontend && npm run type-check
cd frontend && npm test
```

Add build checks once test setup is stable:

```bash
cd backend && npm run build
cd frontend && npm run build
```

