# DevOps Platform - Complete Prisma Schema

## Overview
This is the complete database schema for the DevOps Career Progression & Skill Assessment Platform. The schema follows PostgreSQL best practices with:
- ACID compliance for transaction integrity
- JSONB for flexible data structures
- Strategic indexing for hot-path queries
- Soft deletes for historical data preservation
- Clear separation between reference, transactional, and computed data

---

## Prisma Schema (backend/prisma/schema.prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// REFERENCE TABLES - Seed once, rarely change
// ============================================================================

model Grade {
  id                  Int      @id @default(autoincrement())
  code                String   @unique  // 'G13' .. 'G21'
  title               String            // 'Associate DevOps Engineer', 'Senior Engineer', etc.
  level               Int               // 13..21 for ordering
  experience_years    Int               // Minimum years of experience for this grade
  performance_note    String?           // Performance expectations for this grade

  // Relations
  currentGradeEmployees  Employee[]    @relation('CurrentGrade')
  targetGradeEmployees   Employee[]    @relation('TargetGrade')
  gradeMatrices         GradeMatrix[]

  @@index([level])
  @@map('grades')
}

model SkillDomain {
  id            Int           @id @default(autoincrement())
  name          String        @unique  // 'Core DevOps', 'Cloud', 'SRE', 'SysOps', 'DevSecOps', 'FinOps', 'Networking'
  description   String?       // Domain description
  weight        Float         @default(0.142857)  // 1/7 equal default weight for final score calculation

  // Relations
  competencies  Competency[]
  domainScores  DomainScore[]

  @@map('skill_domains')
}

model Competency {
  id              Int               @id @default(autoincrement())
  name            String            @unique  // e.g., 'Kubernetes', 'CI/CD Pipelines', 'Terraform'
  category        String            // 'Technical' | 'Behavioral'
  description     String
  is_critical     Boolean           @default(false)  // Critical for promotion decision

  domain_id       Int
  domain          SkillDomain       @relation(fields: [domain_id], references: [id], onDelete: Cascade)

  // Relations
  levels          CompetencyLevel[]
  technologies    Technology[]
  gradeMatrices   GradeMatrix[]
  competencyScores CompetencyScore[]
  gapReports      GapReport[]

  @@index([domain_id])
  @@map('competencies')
}

model CompetencyLevel {
  id            Int     @id @default(autoincrement())
  competency_id Int
  level         Int     // 1..5

  // JSONB descriptor with flexible structure
  descriptor    Json    // {
                        //   summary: "Expert level description",
                        //   kpis: ["KPI 1", "KPI 2"],
                        //   okrs: ["OKR 1"],
                        //   behaviours: ["Behavior 1"],
                        //   tools: ["Tool 1", "Tool 2"],
                        //   certs: ["Certification 1"],
                        //   roles: ["Role 1"]
                        // }

  competency    Competency @relation(fields: [competency_id], references: [id], onDelete: Cascade)

  @@unique([competency_id, level])
  @@map('competency_levels')
}

model Technology {
  id              Int               @id @default(autoincrement())
  name            String            // 'Kubernetes', 'Docker', 'Terraform', etc.
  competency_id   Int
  default_type    String            // 'Primary' | 'Secondary' | 'Tertiary'

  competency      Competency        @relation(fields: [competency_id], references: [id], onDelete: Cascade)
  skillAssessments SkillAssessment[]

  @@unique([name, competency_id])
  @@index([competency_id])
  @@map('technologies')
}

// ============================================================================
// CONFIGURATION TABLES
// ============================================================================

model GradeMatrix {
  id              Int        @id @default(autoincrement())
  grade_id        Int
  competency_id   Int

  // Required score [0.0 - 1.0] for engineer to be considered for this grade
  threshold       Float

  grade           Grade      @relation(fields: [grade_id], references: [id], onDelete: Cascade)
  competency      Competency @relation(fields: [competency_id], references: [id], onDelete: Cascade)

  @@unique([grade_id, competency_id])
  @@index([grade_id])
  @@index([competency_id])
  @@map('grade_matrix')
}

model SystemConfig {
  key         String  @id  // 'domain_weights', 'critical_competencies', 'scoring_params', etc.
  value       Json         // Flexible structure based on key
  updated_by  Int?         // User ID who made the update
  updated_at  DateTime     @updatedAt

  @@map('system_config')
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

enum Role {
  ADMIN
  MANAGER
  ENGINEER
}

model User {
  id                   Int            @id @default(autoincrement())
  employee_id          Int            @unique
  username             String         @unique
  password_hash        String         // bcrypt with cost factor 12
  role                 Role           // ADMIN | MANAGER | ENGINEER

  is_active            Boolean        @default(true)
  login_attempts       Int            @default(0)
  locked_until         DateTime?      // Account locked until this time (brute-force protection)
  last_login_at        DateTime?

  // Password reset token
  password_reset_token String?        @unique
  reset_token_expires  DateTime?

  created_at           DateTime       @default(now())
  updated_at           DateTime       @updatedAt

  // Relations
  employee             Employee       @relation(fields: [employee_id], references: [id], onDelete: Cascade)
  refreshTokens        RefreshToken[]

  @@index([employee_id])
  @@index([username])
  @@map('users')
}

model RefreshToken {
  id          Int      @id @default(autoincrement())
  user_id     Int

  // SHA-256 hash of the actual refresh token (never store plaintext)
  token_hash  String   @unique

  expires_at  DateTime
  revoked     Boolean  @default(false)  // Set on logout
  created_at  DateTime @default(now())

  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map('refresh_tokens')
}

// ============================================================================
// TRANSACTIONAL DATA - Core facts table
// ============================================================================

model Employee {
  id              Int               @id @default(autoincrement())
  emp_code        String            @unique  // HR system employee ID
  full_name       String
  department      String
  email           String?

  current_grade_id Int
  target_grade_id  Int
  manager_id       Int?              // Self-referencing: employees report to another employee (manager)

  deleted_at       DateTime?         // Soft delete: null = active, date = deleted (historical data preserved)
  created_at       DateTime         @default(now())
  updated_at       DateTime         @updatedAt

  // Relations
  currentGrade     Grade            @relation('CurrentGrade', fields: [current_grade_id], references: [id])
  targetGrade      Grade            @relation('TargetGrade', fields: [target_grade_id], references: [id])
  manager          Employee?        @relation('Reports', fields: [manager_id], references: [id])
  reports          Employee[]       @relation('Reports')  // Direct reports of this employee

  user             User?
  skillAssessments SkillAssessment[]
  competencyScores CompetencyScore[]
  domainScores     DomainScore[]
  gapReports       GapReport[]
  promotionReadiness PromotionReadiness?

  @@index([manager_id])
  @@index([current_grade_id])
  @@index([deleted_at])
  @@map('employees')
}

model SkillAssessment {
  id              Int        @id @default(autoincrement())
  employee_id     Int
  technology_id   Int

  // Type: how the engineer uses this technology
  type            String     // 'Primary' | 'Secondary' | 'Tertiary'

  // Number of projects: 0, 1, 2, or 3
  projects        Int        // SCR-01 uses this to calculate tech score

  // Who assessed: manager user ID
  assessed_by     Int
  assessed_at     DateTime   @default(now())
  updated_at      DateTime   @updatedAt

  // Relations
  employee        Employee   @relation(fields: [employee_id], references: [id], onDelete: Cascade)
  technology      Technology @relation(fields: [technology_id], references: [id], onDelete: Cascade)

  // Upsert key: (employee_id, technology_id, type) ensures one assessment per tech per type
  @@unique([employee_id, technology_id, type])
  @@index([employee_id])
  @@index([technology_id])
  @@map('skill_assessments')
}

// ============================================================================
// COMPUTED DATA - Populated synchronously after assessment changes
// ============================================================================

// SCR-02: Competency Score = normalized sum of all technology scores for a competency
model CompetencyScore {
  id              Int        @id @default(autoincrement())
  employee_id     Int
  competency_id   Int

  score           Float?     // [0.0 - 1.0], NULL if no assessments for this competency
  level_label     String?    // 'L0 Developing' .. 'L4 Expert', derived from score
  star_rating     Int?       // 1..5 stars, derived from score (SCR-04)

  updated_at      DateTime   @updatedAt

  // Relations
  employee        Employee   @relation(fields: [employee_id], references: [id], onDelete: Cascade)
  competency      Competency @relation(fields: [competency_id], references: [id], onDelete: Cascade)

  @@unique([employee_id, competency_id])
  @@index([employee_id])
  @@index([competency_id])
  @@map('competency_scores')
}

// SCR-05: Domain Score = mean of competency scores in domain
model DomainScore {
  id              Int         @id @default(autoincrement())
  employee_id     Int
  domain_id       Int

  score           Float?      // [0.0 - 1.0], NULL if no competencies in domain
  updated_at      DateTime    @updatedAt

  // Relations
  employee        Employee    @relation(fields: [employee_id], references: [id], onDelete: Cascade)
  domain          SkillDomain @relation(fields: [domain_id], references: [id], onDelete: Cascade)

  @@unique([employee_id, domain_id])
  @@index([employee_id])
  @@map('domain_scores')
}

// Gap Analysis: Current vs Target
model GapReport {
  id              Int        @id @default(autoincrement())
  employee_id     Int
  competency_id   Int

  current_score   Float?     // Current competency score
  target_score    Float?     // Required score from grade_matrix at employee's target grade
  gap_pct         Float?     // (target - current) / target × 100

  // Status: 'MEETS_GRADE' | 'SKILLS_GAP' | 'ABOVE_GRADE'
  status          String

  updated_at      DateTime   @updatedAt

  // Relations
  employee        Employee   @relation(fields: [employee_id], references: [id], onDelete: Cascade)
  competency      Competency @relation(fields: [competency_id], references: [id], onDelete: Cascade)

  @@unique([employee_id, competency_id])
  @@index([employee_id])
  @@index([competency_id])
  @@map('gap_reports')
}

// Promotion Readiness: Single record per employee
model PromotionReadiness {
  id              Int      @id @default(autoincrement())
  employee_id     Int      @unique

  // 'READY' | 'CLOSE' | 'NOT_READY'
  status          String

  final_score     Float?   // SCR-06 weighted final score
  avg_star_rating Float?   // Average of all competency star ratings
  critical_gaps   Int      @default(0)  // Count of critical competencies with gaps

  updated_at      DateTime @updatedAt

  // Relations
  employee        Employee @relation(fields: [employee_id], references: [id], onDelete: Cascade)

  @@map('promotion_readiness')
}

// ============================================================================
// AUDIT & COMPLIANCE (V2.0 - scaffolded in V1.0)
// ============================================================================

model AuditLog {
  id          BigInt   @id @default(autoincrement())
  user_id     Int

  action      String   // 'CREATE_ASSESSMENT' | 'UPDATE_GRADE' | 'DELETE_USER' | etc.
  entity      String   // Table name: 'SkillAssessment', 'Employee', 'User'
  entity_id   Int

  before      Json?    // Previous state (for updates)
  after       Json?    // New state

  created_at  DateTime @default(now())

  @@index([user_id])
  @@index([entity, entity_id])
  @@index([created_at])
  @@map('audit_log')
}
```

---

## Database Initialization & Migrations

### Step 1: Create Initial Migration
```bash
cd backend
npx prisma migrate dev --name init
```

### Step 2: Seed Reference Data

#### backend/prisma/seed/seed.ts
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed in order of dependencies
  await seedGrades();
  await seedSkillDomains();
  await seedCompetencies();
  await seedTechnologies();
  await seedCompetencyLevels();
  await seedGradeMatrix();
  await seedEmployees();
  await seedUsers();
  await seedAssessments();

  console.log('✅ Seeding complete!');
}

async function seedGrades() {
  const grades = [
    { code: 'G13', title: 'Associate DevOps Engineer', level: 13, experience_years: 1 },
    { code: 'G14', title: 'DevOps Engineer', level: 14, experience_years: 2 },
    { code: 'G15', title: 'Senior DevOps Engineer', level: 15, experience_years: 4 },
    // ... remaining grades (G16-G21)
  ];

  for (const grade of grades) {
    await prisma.grade.upsert({
      where: { code: grade.code },
      update: grade,
      create: grade,
    });
  }
  console.log('✅ Grades seeded');
}

// Additional seed functions...
// seedSkillDomains()
// seedCompetencies()
// seedTechnologies()
// seedCompetencyLevels()
// seedGradeMatrix()
// seedEmployees()
// seedUsers()
// seedAssessments()

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Database Indexes

Strategic indexes for optimal query performance:

| Table | Column(s) | Type | Purpose |
|-------|-----------|------|---------|
| grades | level | B-tree | Grade ordering/filtering |
| skill_domains | name | UNIQUE | Prevent duplicate domains |
| competencies | domain_id | B-tree | Filter by domain |
| competencies | name | UNIQUE | Prevent duplicates |
| technologies | competency_id | B-tree | Technology lookup by competency |
| technologies | (name, competency_id) | UNIQUE | Prevent duplicate tech/competency pairs |
| employees | manager_id | B-tree | Manager team scoping |
| employees | current_grade_id | B-tree | Filter by grade |
| employees | deleted_at | B-tree | Soft-delete queries |
| users | username | UNIQUE | Login lookup |
| users | employee_id | UNIQUE | 1:1 user/employee relation |
| refresh_tokens | user_id | B-tree | Find tokens by user |
| refresh_tokens | token_hash | UNIQUE | Prevent duplicate tokens |
| skill_assessments | employee_id | B-tree | All assessments per engineer |
| skill_assessments | technology_id | B-tree | Technology-based aggregations |
| skill_assessments | (employee_id, technology_id, type) | UNIQUE | Upsert conflict target |
| competency_scores | employee_id | B-tree | Dashboard score fetches |
| competency_scores | competency_id | B-tree | Competency-based queries |
| gap_reports | employee_id | B-tree | Per-engineer gap reports |
| gap_reports | competency_id | B-tree | Competency gap queries |
| audit_log | (entity, entity_id) | B-tree | Audit history per record |
| audit_log | created_at | B-tree | Time-based queries |

---

## Query Performance Patterns

### Hot-Path Queries

#### 1. Get All Scores for an Engineer
```sql
-- Single query for dashboard
SELECT
  cs.competency_id,
  c.name,
  cs.score,
  cs.level_label,
  cs.star_rating,
  ds.domain_id,
  d.name as domain_name,
  ds.score as domain_score
FROM competency_scores cs
JOIN competencies c ON cs.competency_id = c.id
JOIN skill_domains d ON c.domain_id = d.id
LEFT JOIN domain_scores ds ON ds.employee_id = cs.employee_id AND ds.domain_id = c.domain_id
WHERE cs.employee_id = $1
ORDER BY d.id, c.name;
```

#### 2. Heatmap Query (All Engineers × Competencies)
```sql
-- Use read replica, cache result for 5 minutes
SELECT
  e.id,
  e.full_name,
  e.current_grade_id,
  c.id as competency_id,
  c.name,
  cs.score,
  cs.star_rating
FROM employees e
CROSS JOIN competencies c
LEFT JOIN competency_scores cs
  ON e.id = cs.employee_id AND c.id = cs.competency_id
WHERE e.deleted_at IS NULL
ORDER BY e.id, c.id;
```

#### 3. Manager's Team with Readiness
```sql
-- Manager's direct reports with scores
SELECT
  e.id,
  e.full_name,
  e.current_grade_id,
  g.code as current_grade,
  g.title as grade_title,
  pr.status as promotion_status,
  pr.final_score,
  COALESCE(pr.critical_gaps, 0) as critical_gaps
FROM employees e
JOIN grades g ON e.current_grade_id = g.id
LEFT JOIN promotion_readiness pr ON e.id = pr.employee_id
WHERE e.manager_id = $1 AND e.deleted_at IS NULL
ORDER BY e.full_name;
```

---

## Data Integrity Constraints

### Soft Delete
- Employees are never hard-deleted
- `deleted_at = NULL` for active employees
- Include `WHERE deleted_at IS NULL` in all queries

### Upsert Pattern
- Technology assessments use (employee_id, technology_id, type) as unique key
- Updates on conflict maintain historical assessment_at timestamp

### Cascading Updates
- When competency is updated, related CompetencyLevels are updated
- No hard delete of competencies (marks deleted instead)

### Transaction Safety
- All scoring writes happen in single Prisma transaction
- Ensures consistent state for multiple inserts/updates

---

## Scaling Considerations

### For V2.0+

1. **Read Replica**
   - All SELECT queries route to `DATABASE_READ_URL`
   - Writes go to primary `DATABASE_URL`
   - Falls back to primary if replica unavailable

2. **Partitioning**
   - skill_assessments: Partition by employee_id
   - audit_log: Partition by created_at (monthly)

3. **Materialized Views**
   - OrgHeatmap: All engineers × competencies
   - Refresh hourly for reporting dashboard

4. **Archive Strategy**
   - Soft-deleted employees → archive table
   - Assessments > 2 years old → archive table

---

## Environment Setup

### .env Example
```bash
# PostgreSQL
DATABASE_URL="postgresql://devops:password@localhost:5432/devops_platform"
DATABASE_READ_URL="postgresql://devops:password@localhost:5433/devops_platform"  # Replica (same in dev)

# Prisma
DATABASE_SHADOW_DATABASE_URL="postgresql://devops:password@localhost:5434/devops_shadow"
```

### Running Migrations
```bash
# Create and run migration
npx prisma migrate dev --name add_column_name

# Run pending migrations (production)
npx prisma migrate deploy

# Rollback (dev only)
npx prisma migrate resolve --rolled-back add_column_name
```

---

**Last Updated:** March 2026
**Version:** 1.0.0
**Status:** Approved for Development
