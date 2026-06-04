# Security Specifications

## Authentication

The backend uses:

- Bcrypt password hashes.
- JWT access tokens.
- JWT refresh tokens stored as hashes in the database.
- httpOnly refresh-token cookie.
- Login-attempt lockout.

## Required Token Behavior

### Access Token

- Short-lived.
- Sent as `Authorization: Bearer <token>`.
- Contains user id, employee id, employee code, role, and username.

### Refresh Token

- Long-lived.
- Stored only in an httpOnly cookie in the browser.
- Hashed with SHA-256 before database persistence.
- Must be validated for signature, stored hash, owner match, revocation, and expiry.

### Future Requirement

Implement refresh rotation:

1. On refresh, revoke old refresh token.
2. Issue new refresh token.
3. Store new hash.
4. Set new cookie.
5. Detect reuse of revoked tokens and revoke all tokens for the user.

## Authorization

### Role-Based Access

Use `requireRole` on every protected route.

### Row-Level Access

For employee-scoped data:

- Admin: all employees.
- Manager: self and direct reports.
- Engineer: self only.

This must apply to:

- Assessment reads/writes.
- Gap analysis.
- Competency scores.
- Matrices.
- History.
- Exports.

## Input Validation

All request bodies must be validated with Zod before reaching controllers.

Validation requirements:

- IDs must be positive integers.
- Employee public identifiers should use `emp_code` where exposed to frontend.
- Enum values must be explicit.
- Formula weights must be in range and should sum to 1.0.
- Pagination inputs must have safe limits.

## Sensitive Data Handling

Never return:

- Password hashes.
- Refresh token hashes.
- Reset tokens.
- Internal security metadata unless specifically needed by admin UI.

## Audit Requirements

Add append-only audit logging for:

- Login failures beyond threshold.
- User create/update/deactivate.
- Employee create/update/delete.
- Assessment create/update/delete/approve.
- Config and matrix changes.
- Export/download actions.

Minimum audit fields:

- actor user id
- actor employee id
- action
- entity type
- entity id
- before JSON
- after JSON
- timestamp
- request id / IP when available

## Security Headers and CORS

Current backend uses Helmet and CORS. Production deployment must confirm:

- Correct `FRONTEND_URL`.
- HTTPS termination.
- Secure cookies.
- Strict same-site policy.
- No wildcard CORS origin.

