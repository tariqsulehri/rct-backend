# Coding Standards

## General Principles

- Prefer existing project patterns.
- Keep backend modules organized by feature.
- Keep frontend API calls inside hooks.
- Avoid business logic in React components.
- Use TypeScript types derived from validation where practical.
- Keep identifiers consistent: internal `Employee.id`, public `emp_code`.

## Backend Standards

### Module Layout

Each backend module should use:

```text
module/
  module.router.ts
  module.controller.ts
  module.service.ts
  module.schema.ts
```

### Routing

Routes must declare:

1. Authentication.
2. Role authorization.
3. Request validation.
4. Controller handler.

### Controllers

Controllers should:

- Parse request parameters.
- Enforce route-specific access checks when needed.
- Call service functions.
- Return stable response shapes.
- Avoid large business logic.

### Services

Services should:

- Own business behavior.
- Use Prisma for persistence.
- Avoid Express request/response types.
- Be testable without HTTP.

### Errors

Use errors with:

- `statusCode`
- `code`
- `message`

Avoid returning raw database errors to clients.

## Frontend Standards

### Data Access

- Use `apiClient`.
- Wrap reads in TanStack Query hooks.
- Wrap writes in mutation hooks.
- Invalidate specific query keys after mutation.

### Components

Components should:

- Render loading, empty, error, and data states.
- Keep table/grid dimensions stable.
- Respect role-based UI visibility.
- Avoid duplicating API logic.

### State

Use Zustand only for:

- Auth.
- Theme.
- Other cross-route or cross-feature app state.

Use local state for form and transient UI state.

## Naming Standards

- Backend roles: `ADMIN`, `MANAGER`, `ENGINEER`.
- Frontend should use the same role casing.
- Employee public field: `emp_code` in backend responses, `empCode` in auth store where already established.
- Assessment type: `Primary`, `Secondary`, `Tertiary`.
- Assessment level: `Expert`, `Advanced`, `Proficient`, `Foundational`, `Awareness`, `Unset`.

## Documentation Standards

When a feature changes behavior:

- Update API contracts.
- Update roadmap status.
- Update security specs if access or token behavior changes.
- Update database design if schema changes.

