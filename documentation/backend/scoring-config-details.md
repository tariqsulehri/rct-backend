# Scoring Config Details

> **Purpose:** Explain the scoring configuration tables in simple language.  
> **Audience:** Admins, managers, architects, and developers.  
> **Related file:** `scoring-formula.md`

---

## Big Picture

The scoring setup is split into four small configuration areas:

1. **Types** - how important the assessed technology is.
2. **Levels** - how strong the employee is at that technology.
3. **Statuses** - whether an assessment row should count.
4. **Projects** - how much real project experience the employee has.

Together, these values help calculate one assessment row score:

```text
assessment score =
  type weight
  * (project credit + base credit)
  * level weight
```

The app stores the result in:

```text
skill_assessments.score
```

---

## 1. Type Config

Database table:

```text
assessment_type_configs
```

Types describe how important a technology is for a skill.

Current seeded types:

| Type | Weight | Description | Calculation effect |
|---|---:|---|---|
| Primary | `0.25` | Main technology for the skill. | Highest type multiplier. |
| Secondary | `0.15` | Supporting technology. | Medium type multiplier. |
| Tertiary | `0.10` | Related or optional technology. | Lowest type multiplier. |

Simple rule:

```text
Higher type weight = higher row score
```

Columns:

| Column | Affects calculation? | Easy meaning |
|---|---|---|
| `code` | Yes | Must match the assessment row type, such as `Primary`. |
| `weight` | Yes | Multiplier used in the assessment score formula. |
| `label` | No | Text shown in the UI. |
| `description` | No | Help text for admins/users. |
| `sort_order` | No | Controls display order in the UI. |
| `is_active` | Yes | Inactive rows are ignored and default values are used. |

Example:

```text
Primary counts more than Secondary.
Secondary counts more than Tertiary.
```

---

## 2. Level Config

Database table:

```text
assessment_level_configs
```

Levels describe how strong the employee is at a technology.

Current seeded levels:

| Level | Weight | Threshold | Simple meaning |
|---|---:|---:|---|
| Expert | `1.00` | `0.80` | Full credit for this technology. |
| Advanced | `0.80` | `0.60` | Strong skill. |
| Proficient | `0.60` | `0.40` | Working skill. |
| Foundational | `0.40` | `0.20` | Basic skill. |
| Beginner | `0.40` | `0.20` | Early-stage skill. |
| Awareness | `0.20` | `0.01` | Light exposure. |
| Unset | `0.00` | `0.00` | No level selected. |

### Weight vs Threshold

`weight` and `threshold` are different.

`weight` is used in the assessment score calculation.

```text
level weight = multiplier for the row score
```

`threshold` is a reference boundary for interpreting scores.

```text
threshold = score boundary for reports, labels, or future rules
```

Example:

```text
Expert weight    = 1.00
Expert threshold = 0.80
```

This means:

- `1.00` is the multiplier when someone selects `Expert`.
- `0.80` can be used as the score boundary for calling something expert-level.

Current calculation uses `weight`. Thresholds are available for reporting and future rule wiring.

Columns:

| Column | Affects calculation? | Easy meaning |
|---|---|---|
| `code` | Yes | Must match the selected assessment level, such as `Expert`. |
| `weight` | Yes | Multiplier used in the assessment score formula. |
| `threshold` | Not in row score | Boundary for interpreting/reporting score levels. |
| `label` | No | Text shown in the UI. |
| `description` | No | Help text for admins/users. |
| `sort_order` | No | Controls display order in the UI. |
| `is_active` | Yes | Inactive rows are ignored and default values are used. |

The two important numeric columns are:

```text
weight    = calculation multiplier
threshold = reporting/classification boundary
```

---

## 3. Status Config

Database table:

```text
assessment_status_configs
```

Statuses describe where an assessment row is in the workflow.

Current seeded statuses:

| Status | Counts toward score | Terminal | Description | Calculation effect |
|---|---|---|---|---|
| approved | Yes | Yes | Manager-approved row. | Included in competency scores. |
| pending | No | No | Waiting for manager approval. | Ignored by scoring. |
| rejected | No | Yes | Review is complete, but row does not count. | Ignored by scoring. |
| draft | No | No | In progress or not submitted. | Ignored by scoring. |

### Counts Toward Score

This controls calculation.

```text
counts_toward_score = true
```

means rows with this status are included in competency scores.

Right now, the seeded countable status is:

```text
approved
```

### Terminal

`terminal` means the status is an end state.

```text
is_terminal = true
```

means normal workflow is complete.

Examples:

- `approved` is terminal because review is done.
- `rejected` is terminal because review is done.
- `pending` is not terminal because it still needs manager action.
- `draft` is not terminal because it is still in progress.

Important:

```text
terminal does not mean counts toward score
```

Scoring is controlled by `counts_toward_score`.

Columns:

| Column | Affects calculation? | Easy meaning |
|---|---|---|
| `code` | Yes | Must match the assessment row status, such as `approved`. |
| `counts_toward_score` | Yes | Decides whether rows with this status are included in scores. |
| `is_terminal` | No | Workflow flag showing whether the review state is final. |
| `label` | No | Text shown in the UI. |
| `description` | No | Help text for admins/users. |
| `sort_order` | No | Controls display order in the UI. |
| `is_active` | Yes | Inactive statuses are ignored by dynamic scoring rules. |

The two important boolean columns are:

```text
counts_toward_score = calculation rule
is_terminal         = workflow rule
```

---

## 4. Project Config

Database table:

```text
assessment_project_configs
```

Project config describes real project experience.

Current seeded project options:

| Projects | Credit | Threshold | Duration guidance | Simple meaning |
|---:|---:|---:|---|---|
| 0 | `0.00` | `0.00` | `0` months | No project experience yet. |
| 1 | `0.33` | `0.25` | `1-3` months | Used in one project. |
| 2 | `0.67` | `0.50` | `3-6` months | Used in two projects. |
| 3+ | `1.00` | `0.75` | `6+` months | Used in three or more projects. |

The formula still has base credit, so even `0` projects can receive some score if a level is selected.

Simple rule:

```text
Higher project credit = more experience credit
```

Project config can also store duration guidance:

```text
duration_months_min
duration_months_max
```

Example:

```text
1 project = 1 to 3 months
2 projects = 3 to 6 months
3+ projects = 6+ months
```

These duration fields help explain project levels in the UI. The score calculation uses `credit`.

Columns:

| Column | Affects calculation? | Easy meaning |
|---|---|---|
| `project_count` | Yes | Must match the assessment row project count, such as `2`. |
| `credit` | Yes | Project experience value used in the score formula. |
| `threshold` | Not in row score | Reference boundary for reports or future rules. |
| `duration_months_min` | No | UI guidance for minimum experience duration. |
| `duration_months_max` | No | UI guidance for maximum experience duration. |
| `label` | No | Text shown in the UI. |
| `description` | No | Help text for admins/users. |
| `sort_order` | No | Controls display order in the UI. |
| `is_active` | Yes | Inactive rows are ignored and default project credit is used. |

The two important numeric columns are:

```text
credit    = calculation value
threshold = reporting/classification boundary
```

---

## 5. What Updates Affect

When an admin changes config values:

| Config change | Affects new calculations? | Affects old saved scores immediately? |
|---|---|---|
| Type weight | Yes | No |
| Level weight | Yes | No |
| Project credit | Yes | No |
| Status counts toward score | Yes, during recompute | No |
| Labels/descriptions | UI only | Not score-related |

Old assessment rows already have stored scores.

To apply new config values to old rows, run the backfill/recompute script.

---

## 6. Safe Admin Guidance

Use these rules when changing scoring config:

- Keep weights between `0` and `1`.
- Keep only `approved` counting toward score unless the workflow intentionally changes.
- Do not deactivate required values like `Primary`, `Expert`, or `approved` unless the code is also updated.
- After changing calculation values, recompute existing scores if reports should reflect the new rules.

---

## 7. Source Files

| Area | File |
|---|---|
| Database models | `backend/prisma/schema.prisma` |
| Config API | `backend/src/modules/config` |
| Assessment scoring | `backend/src/modules/assessment/assessment.service.ts` |
| Scoring functions | `backend/src/scoring/scoring.engine.ts` |
| Frontend config UI | `frontend/src/components/config/ConfigSection.tsx` |
| Frontend config hooks | `frontend/src/hooks/useConfig.ts` |
| Formula explanation | `backend/documentation/backend/scoring-formula.md` |
