# Developer Quick Start Guide

## 5-Minute Setup

### Prerequisites
- Node.js 20+ LTS
- Docker & Docker Compose
- Git
- VS Code (recommended) with ESLint + Prettier extensions

### Step 1: Clone & Navigate
```bash
cd devops-carrier-platform
git config user.email "your@email.com"
git config user.name "Your Name"
```

### Step 2: Environment Setup
```bash
# Copy example env
cp .env.example .env

# Edit .env with local values (all defaults work for dev)
# DATABASE_URL=postgresql://devops:devops_secure_pwd@postgres:5432/devops_platform
# JWT_SECRET=dev-secret-change-in-prod
```

### Step 3: Start Services
```bash
# Start all services (Docker Compose)
npm run dev

# In another terminal, initialize database
docker-compose exec api npm run db:migrate
docker-compose exec api npm run db:seed
```

### Step 4: Verify Setup
```bash
# Check API health
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"..."}

# Check Frontend
open https://localhost
# Expected: Login page (use any browser, ignore SSL warning for dev)

# View Swagger API docs
open http://localhost:4000/api/docs
```

### Step 5: Test Login
```bash
# Use these test credentials (created by seed script)
# Username: manager1
# Password: password123
```

---

## Development Workflow

### Working on a Feature

#### 1. Create Feature Branch
```bash
git checkout -b feature/assessment-form
```

#### 2. Understand Monorepo Structure
```
devops-carrier-platform/
├── backend/          # Node.js/Express API
│   ├── src/
│   │   ├── modules/  # Feature modules (auth, employees, assessments)
│   │   ├── middleware/
│   │   ├── config/
│   │   └── scoring/  # Scoring engine (pure functions)
│   └── prisma/       # Database schema & migrations
│
├── frontend/         # React/Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/      # TanStack Query hooks
│   │   └── store/    # Zustand state
│
└── shared/           # Shared types & schemas (no business logic!)
    ├── types/        # TypeScript interfaces
    └── schemas/      # Zod validation schemas
```

#### 3. Backend Development Example

**Scenario: Add a new endpoint to fetch team heatmap**

**File: backend/src/modules/dashboard/dashboard.router.ts**
```typescript
import express from 'express';
import { dashboardController } from './dashboard.controller';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { z } from 'zod';

const router = express.Router();

// GET /api/v1/dashboard/heatmap?managerId=5&domain=SRE
router.get(
  '/heatmap',
  requireRole('MANAGER', 'ADMIN'),
  dashboardController.getTeamHeatmap
);

export default router;
```

**File: backend/src/modules/dashboard/dashboard.controller.ts**
```typescript
import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async getTeamHeatmap(req: Request, res: Response) {
    try {
      const { managerId, domain } = req.query;
      const data = await dashboardService.getTeamHeatmap(
        parseInt(managerId as string),
        domain as string
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch heatmap' });
    }
  },
};
```

**File: backend/src/modules/dashboard/dashboard.service.ts**
```typescript
import { prisma } from '../../config/database';

export const dashboardService = {
  async getTeamHeatmap(managerId: number, domainName?: string) {
    // Query database
    const data = await prisma.competencyScore.findMany({
      where: {
        employee: {
          manager_id: managerId,
          deleted_at: null,
        },
        competency: domainName ? { domain: { name: domainName } } : undefined,
      },
      include: {
        employee: true,
        competency: { include: { domain: true } },
      },
    });

    // Transform to heatmap format
    const heatmap = transformToHeatmap(data);

    return heatmap;
  },
};
```

#### 4. Frontend Development Example

**Scenario: Add team heatmap component**

**File: frontend/src/api/dashboard.ts (TanStack Query Hook)**
```typescript
import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

export function useTeamHeatmap(managerId: number, domain?: string) {
  return useQuery({
    queryKey: ['teamHeatmap', managerId, domain],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/heatmap', {
        params: { managerId, domain },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**File: frontend/src/components/HeatmapGrid.tsx**
```typescript
import React from 'react';
import { useTeamHeatmap } from '@/api/dashboard';
import { useAuthStore } from '@/store/authStore';

const HeatmapGrid: React.FC = () => {
  const { user } = useAuthStore();
  const { data, isLoading, error } = useTeamHeatmap(user!.employeeId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-21 gap-1">
      {data?.map((cell) => (
        <div
          key={`${cell.engineerId}-${cell.competencyId}`}
          className="aspect-square rounded bg-gray-200"
          style={{
            backgroundColor: getColorForScore(cell.score),
          }}
          title={`${cell.engineerName} - ${cell.competencyName}: ${cell.score?.toFixed(2)}`}
        />
      ))}
    </div>
  );
};

function getColorForScore(score: number | null): string {
  if (score === null) return '#f3f4f6';
  if (score < 0.2) return '#fca5a5';
  if (score < 0.4) return '#fda34b';
  if (score < 0.6) return '#fcd34d';
  if (score < 0.8) return '#a3e635';
  return '#22c55e';
}

export default HeatmapGrid;
```

---

## Common Commands

### Backend
```bash
# Development server with hot-reload
npm run dev -w backend

# Run tests
npm run test -w backend

# Run tests in watch mode
npm run test:watch -w backend

# Check code coverage
npm run test:coverage -w backend

# Lint code
npm run lint -w backend

# Database migrations
npm run db:migrate -w backend        # Create new migration
npm run db:seed -w backend           # Seed data
npm run db:studio -w backend         # Prisma Studio (visual DB editor)
```

### Frontend
```bash
# Development server with HMR
npm run dev -w frontend

# Build for production
npm run build -w frontend

# Preview production build
npm run preview -w frontend

# Run tests
npm run test -w frontend

# Type check
npm run type-check -w frontend
```

### Docker
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f api

# Access PostgreSQL
docker-compose exec postgres psql -U devops -d devops_platform

# Stop and remove volumes (reset database)
docker-compose down -v
```

---

## Testing Guidelines

### Backend Tests

**Unit Test Example:**
```typescript
// backend/src/scoring/scoringEngine.test.ts
import { calcTechScore, calcCompetencyScore } from './scoringEngine';

describe('Scoring Engine', () => {
  describe('calcTechScore', () => {
    test('should calculate primary tech score correctly', () => {
      expect(calcTechScore('Primary', 0)).toBe(0);
      expect(calcTechScore('Primary', 1)).toBe(0.1667);
      expect(calcTechScore('Primary', 2)).toBe(0.3334);
      expect(calcTechScore('Primary', 3)).toBe(0.5);
    });

    test('should cap secondary tech score at 0.3', () => {
      expect(calcTechScore('Secondary', 3)).toBe(0.3);
    });
  });

  describe('calcCompetencyScore', () => {
    test('should return null for empty array', () => {
      expect(calcCompetencyScore([])).toBeNull();
    });

    test('should normalize scores to 4 decimal places', () => {
      const result = calcCompetencyScore([0.1667, 0.3]);
      expect(result).toBe(0.4667);
    });
  });
});
```

**Integration Test Example:**
```typescript
// backend/src/modules/assessments/assessments.test.ts
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../config/database';

describe('Assessment API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  test('should submit assessment and queue scoring job', async () => {
    const response = await request(app)
      .post('/api/v1/employees/1/assessments')
      .set('Authorization', 'Bearer valid-token')
      .send({
        competencyId: 1,
        entries: [
          { technologyId: 1, type: 'Primary', projects: 2 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('jobId');
  });
});
```

### Frontend Tests

**Component Test Example:**
```typescript
// frontend/src/__tests__/components/ScoreBar.test.tsx
import { render, screen } from '@testing-library/react';
import ScoreBar from '@/components/charts/ScoreBar';

describe('ScoreBar', () => {
  test('should display score and stars', () => {
    render(<ScoreBar score={0.75} label="Advanced" />);
    expect(screen.getByText('★★★★')).toBeInTheDocument();
    expect(screen.getByText('0.75')).toBeInTheDocument();
  });

  test('should handle null score gracefully', () => {
    render(<ScoreBar score={null} label="No Assessment" />);
    expect(screen.getByText('No Assessment')).toBeInTheDocument();
  });
});
```

---

## Debugging Tips

### Backend Debugging
```bash
# Add debug logs
LOG_LEVEL=debug npm run dev -w backend

# VS Code Debugger (add .vscode/launch.json)
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Backend",
      "program": "${workspaceFolder}/backend/src/server.ts",
      "preLaunchTask": "tsc: build - backend",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
    }
  ]
}
```

### Frontend Debugging
```bash
# React DevTools extension recommended
# Vite provides source maps in development
# Console logs preserved (not minified in dev)
```

### Database Debugging
```bash
# Use Prisma Studio for visual inspection
npm run db:studio -w backend

# Or connect directly to PostgreSQL
docker-compose exec postgres psql -U devops -d devops_platform
# Then: SELECT * FROM employees LIMIT 5;
```

---

## Code Style & Standards

### ESLint Rules
- Enforced: no unused variables, strict null checks, async/await patterns
- Pre-commit hooks will reject non-compliant code

### Prettier Formatting
```bash
# Format all files
npm run format

# Format specific file
prettier --write src/modules/auth/auth.controller.ts
```

### TypeScript Strictness
- `strict: true` in tsconfig.json
- No `any` types (use `unknown` and narrow types)
- All function parameters and returns must be typed

### Commit Messages
```
feat: add assessment form component
^--^  ^--^
|     |__ Subject (imperative, lowercase)
|________ Type: feat, fix, docs, style, refactor, test, chore
```

---

## Common Issues & Solutions

### Issue: Docker port already in use
```bash
# Find and kill process using port 5432
lsof -i :5432
kill -9 <PID>

# Or use different port in docker-compose
ports:
  - "5433:5432"  # Change external port
```

### Issue: Node modules not installing
```bash
# Clear npm cache
npm cache clean --force

# Reinstall from scratch
rm -rf node_modules package-lock.json
npm install
```

### Issue: Database migrations fail
```bash
# Reset development database
npm run db:reset -w backend

# Or manually
docker-compose down -v
docker-compose up -d postgres
npm run db:migrate -w backend
npm run db:seed -w backend
```

### Issue: Hot-reload not working
```bash
# Restart dev server
npm run dev

# Check file watcher limits (macOS)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
```

---

## IDE Setup (VS Code)

### Recommended Extensions
- ESLint
- Prettier - Code formatter
- Thunder Client (API testing)
- PostgreSQL (database)
- Docker
- Tailwind CSS IntelliSense
- REST Client

### .vscode/settings.json
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### .vscode/launch.json (for debugging)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Backend Debug",
      "program": "${workspaceFolder}/backend/src/server.ts",
      "preLaunchTask": "tsc: build - backend/tsconfig.json",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Performance Profiling

### Database Query Analysis
```bash
# Enable query logging
QUERY_LOG=true npm run dev -w backend

# Then check slow-query log
docker-compose exec postgres tail -f /var/log/postgresql.log
```

### Frontend Performance
```bash
# Build analysis
npm run build -w frontend
# Check dist/ folder size

# Use Chrome DevTools:
# - Performance tab: Record and analyze user interactions
# - Lighthouse: Run performance audit
# - Network: Check bundle sizes and load times
```

---

## Next Steps

1. **Read the full [documentation/roadmap/implementation-plan.md](../roadmap/implementation-plan.md)** for detailed feature breakdown
2. **Check [documentation/database/schema-reference.md](../database/schema-reference.md)** for database structure details
3. **Review existing code** in backend/src/modules/auth for patterns
4. **Write tests** as you develop (TDD approach recommended)
5. **Ask questions** in team Slack or comment PRs

---

**Happy coding! 🚀**

For questions: Contact your team lead
Architecture Issues: Open an issue on GitHub
Security Concerns: Report to security@company.com

Last Updated: March 2026
