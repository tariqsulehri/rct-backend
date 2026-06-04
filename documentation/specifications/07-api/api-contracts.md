# API Contracts

## General Contract Rules

Base path:

```text
/api/v1
```

Common success shape:

```json
{
  "success": true,
  "data": {}
}
```

Auth login and refresh currently return direct token payloads for frontend compatibility:

```json
{
  "accessToken": "...",
  "user": {}
}
```

Common error shape:

```json
{
  "error": "Message",
  "code": "ERROR_CODE"
}
```

Global error handler may also include:

```json
{
  "path": "/api/v1/example",
  "timestamp": "..."
}
```

## Auth APIs

### POST `/auth/login`

Body:

```json
{
  "username": "manager",
  "password": "password123"
}
```

Response:

```json
{
  "accessToken": "...",
  "user": {
    "id": 1,
    "empCode": "1001",
    "username": "manager",
    "role": "MANAGER",
    "employeeName": "Manager Name"
  }
}
```

Side effect:

- Sets `refreshToken` httpOnly cookie.

### POST `/auth/refresh`

Authentication:

- Uses `refreshToken` cookie.
- Does not require bearer access token.

Response:

```json
{
  "accessToken": "..."
}
```

### POST `/auth/logout`

Authentication:

- Bearer access token.

Behavior:

- Revokes refresh tokens for current user.
- Clears refresh cookie.

## Assessment APIs

### POST `/assessments/skill-assessments`

Roles:

- `ADMIN`
- `MANAGER`
- `ENGINEER` for self only

Body:

```json
{
  "employee_id": "1818",
  "technology_id": 1,
  "type": "Primary",
  "projects": 3,
  "level": "Expert"
}
```

Rules:

- Engineers cannot set `level`; server strips it.
- Engineers can create only for their own `empCode`.
- Managers can create only for self/direct reports.

### PATCH `/assessments/skill-assessments/:id`

Roles:

- `ADMIN`
- `MANAGER`
- `ENGINEER` for own assessment only

Body:

```json
{
  "type": "Secondary",
  "projects": 2,
  "level": "Advanced"
}
```

### PATCH `/assessments/skill-assessments/:id/approve`

Roles:

- `ADMIN`
- `MANAGER`

Body:

```json
{
  "level": "Proficient",
  "type": "Primary",
  "projects": 3
}
```

### DELETE `/assessments/skill-assessments/:id`

Roles:

- `ADMIN`
- `MANAGER`
- `ENGINEER` for own assessment only

### GET `/assessments/employees/:empCode/assessments`

Roles:

- Admin: all.
- Manager: self/direct reports.
- Engineer: self.

### GET `/assessments/team-roster`

Roles:

- `ADMIN`
- `MANAGER`

Query:

- `department` optional.

### GET `/assessments/employees`

Roles:

- `ADMIN`

## Config APIs

Base:

```text
/config
```

Admin-only resources:

- `/departments`
- `/departments/:id/config`
- `/departments/:id/domain-weights`
- `/users`
- `/employees`
- `/grades`
- `/skill-domains`
- `/domain-grade-weights`
- `/competencies`
- `/competency-categories`

Shared read:

- `GET /config/technologies` for admin, manager, engineer.

## Report APIs

Base:

```text
/reports
```

### GET `/reports/gap-analysis/:empCode`

Roles:

- Admin: all.
- Manager: self/direct reports.
- Engineer: self.

### GET `/reports/promotion-readiness`

Roles:

- Admin.
- Manager.

### GET `/reports/competency-scores`

Roles:

- Admin.
- Manager.
- Engineer gets self-scoped result.

### GET `/reports/competency-matrix`

Roles:

- Admin.
- Manager.

### GET `/reports/gap-matrix`

Roles:

- Admin.
- Manager.
- Engineer gets self-scoped result.

### GET `/reports/skills-summary`

Roles:

- Admin.
- Manager.

### GET `/reports/assessment-history`

Roles:

- Admin.
- Manager.

Query:

- `page`
- `limit`

### GET `/reports/gap-report/download`

Roles:

- Admin.
- Manager.

Current behavior:

- Runs Python script and streams generated XLSX.

Required hardening:

- Replace fixed output file with request-scoped temp file or export job.

