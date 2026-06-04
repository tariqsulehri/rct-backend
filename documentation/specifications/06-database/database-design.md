# Database Design

## Database

The project uses PostgreSQL through Prisma.

Primary schema file:

- `backend/prisma/schema.prisma`

## Model Groups

### Reference Data

- `Grade`
- `SkillDomain`
- `SkillDomainGradeWeight`
- `CompetencyCategory`
- `Competency`
- `CompetencyDomainMap`
- `CompetencyLevel`
- `Technology`

### Organization Data

- `Department`
- `DepartmentConfig`
- `DepartmentDomainWeight`
- `Employee`

### Auth Data

- `User`
- `RefreshToken`

### Transactional Data

- `SkillAssessment`

### Computed Data

- `CompetencyScore`
- `DomainScore`

## Important Relationships

- `User.employee_id` is unique and points to `Employee.id`.
- `Employee.manager_id` self-references `Employee.id`.
- `Employee.current_grade_id` and `target_grade_id` point to `Grade`.
- `Competency` belongs to `CompetencyCategory`.
- `Competency` maps to one or more `SkillDomain` records through `CompetencyDomainMap`.
- `Technology` belongs to `Competency`.
- `SkillAssessment` is unique by `employee_id + technology_id`.
- `CompetencyScore` is unique by `employee_id + competency_id`.

## Identifier Strategy

Internal APIs and database records use numeric IDs.

Public frontend employee references should prefer `emp_code` for user-facing workflows.

JWT currently contains both:

- `employeeId`: internal `Employee.id`
- `empCode`: public employee code

## Migration Requirements

Current state:

- Prisma schema exists.
- Migration files are not present.

Required work:

1. Create a baseline migration for the current schema.
2. Validate migration against an empty database.
3. Validate seed script against migrated database.
4. Require every schema change to include a migration.
5. Do not edit applied migrations except during local-only reset work.

## Data Integrity Rules

Required validations:

- Assessment projects must be 0 to 3.
- Assessment type must be `Primary`, `Secondary`, or `Tertiary`.
- Assessment level must be a supported level.
- Department formula weights should sum to 1.0.
- Domain grade weights should be non-negative and intentionally normalized or documented.
- Soft-deleted employees should be excluded from operational reports.

## Future Database Additions

Recommended tables:

- `audit_log`
- `export_jobs`
- `notification_events`
- `assessment_comments`
- `score_recompute_jobs` only if a future async recomputation queue is introduced
