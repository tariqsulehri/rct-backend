# System Architecture

## Architecture Style

The project is a modular monolith with separately deployable frontend and backend artifacts.

```text
Browser
  |
  v
React SPA
  |
  v
NGINX / Vite Proxy
  |
  v
Express API
  |
  v
PostgreSQL
```

## Backend Layers

### Route Layer

Routers define paths and attach:

- Authentication middleware.
- Role middleware.
- Request validation.
- Controller handlers.

### Controller Layer

Controllers:

- Translate request parameters.
- Perform route-specific access checks.
- Call service functions.
- Return API response envelopes.

### Service Layer

Services:

- Contain business logic.
- Query Prisma.
- Compute scores and reports.
- Apply transactional updates where needed.

### Data Layer

Prisma models define persistence. All direct database access should go through Prisma.

## Frontend Layers

### API Client

`frontend/src/lib/api.ts` centralizes Axios configuration:

- Base URL selection.
- Authorization header injection.
- 401 refresh handling.
- Redirect to login on refresh failure.

### Hooks

Hooks in `frontend/src/hooks` encapsulate API calls and TanStack Query keys.

### Components

UI components consume hooks and store state. New feature UI should prefer:

- Data hooks for server communication.
- Local component state for transient UI.
- Zustand only for cross-cutting state.

## Scoring Architecture

Canonical scoring model:

- Assessment row score = `formula1(type, projects, departmentWeights) * levelWeight`.
- Competency score = sum of approved assessment row scores for employee and competency.
- Domain score = average of scored competencies in primary domain.
- Overall score = weighted average of scored domains using target grade domain weights.

Required future standardization:

- Extract scoring constants and formulas from service/worker duplication into `backend/src/scoring`.
- Add unit tests for formula boundaries and edge cases.
- Add a backfill/recompute command using the same scoring module.

## Access-Control Architecture

Access decisions should be centralized around:

- Role: `ADMIN`, `MANAGER`, `ENGINEER`.
- Employee identity: `req.user.employeeId`.
- Manager relationship: `employees.manager_id`.

Recommended policy:

- Admin can access all non-deleted employees.
- Manager can access self and direct reports.
- Engineer can access self only.

If recursive management hierarchy is required later, it should be explicit and tested.
