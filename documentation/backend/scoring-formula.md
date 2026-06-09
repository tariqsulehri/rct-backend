# DevOps Carrier - Calculation Engine Spec

> **Audience:** Managers, HR admins, engineers, architects, and developers  
> **Purpose:** Explain every calculation in plain language, using the same field names used in the app and database  
> **Source of truth:** `backend/src/scoring/scoring.engine.ts` and `backend/src/scoring/reporting.engine.ts`  
> **Last updated:** 2026-05-17

---

## 1. Big Picture

The system turns an employee's skill assessments into report numbers in four layers.

```text
skill_assessments rows
  fields: type, projects, level, score, status
        |
        v
competency_scores.score
  one score per employee and competency
        |
        v
domain_scores / domain_scores object
  one average score per skill domain
        |
        v
overall_score / final_score
  one weighted score used by dashboards and reports
```

Plain-language version:

1. A manager assesses a technology or skill.
2. That row gets a small numeric `score`.
3. All approved rows inside the same competency are added together.
4. Competencies are averaged into skill domains.
5. Skill domains are averaged, or weighted, into the employee's overall score.

Important rules:

- Only `status = 'approved'` assessments count.
- Engineer self-assessments are `pending` until a manager approves them.
- Reports read stored `competency_scores`; they do not recalculate from raw assessment rows.
- Most scores are stored as decimals: `0.75` means `75%`.

---

## 2. Simple 6-Stage Example For One Resource

This example follows one resource from raw assessment entry to final report output.

Example resource:

```text
Resource: Engineer A
Current grade: G13
Target grade: G14
```

### Stage 1 - Raw Score Capture And Competency Score

The manager assesses individual technologies.

Example input:

| Technology | Competency | Domain | `type` | `projects` | `level` |
|---|---|---|---|---:|---|
| Kubernetes | Containerization | Cloud | `Primary` | `3` | `Expert` |
| Terraform | Infrastructure as Code | Cloud | `Secondary` | `3` | `Advanced` |
| Monitoring | Observability | SRE | `Primary` | `2` | `Proficient` |

Each technology gets a row score.

Simple meaning:

```text
Row score = importance of the skill * project experience credit * skill level
```

Calculation:

```text
Kubernetes = 0.25 * (3 / 3 + 1) * 1.00 = 0.50
Terraform  = 0.15 * (3 / 3 + 1) * 0.80 = 0.24
Monitoring = 0.25 * (2 / 3 + 1) * 0.60 = 0.25
```

Result:

| Technology | Row score |
|---|---:|
| Kubernetes | `0.50` / `50%` |
| Terraform | `0.24` / `24%` |
| Monitoring | `0.25` / `25%` |

Rows inside the same competency are added together.

In this example, each competency has one assessed technology:

| Competency | Row scores used | Competency score |
|---|---|---:|
| Containerization | `0.50` | `0.50` / `50%` |
| Infrastructure as Code | `0.24` | `0.24` / `24%` |
| Observability | `0.25` | `0.25` / `25%` |

If one competency has multiple approved technologies, they are added:

```text
Competency score = approved row 1 + approved row 2 + approved row 3
```

### Stage 2 - Domain Aggregation

Competencies are grouped by domain.

Domain score is the average of scored competencies in that domain.

Example:

| Domain | Competencies used | Domain score |
|---|---|---:|
| Cloud | Containerization `0.50`, Infrastructure as Code `0.24` | `(0.50 + 0.24) / 2 = 0.37` / `37%` |
| SRE | Observability `0.25` | `0.25` / `25%` |

Simple meaning:

```text
Cloud score = average of Cloud competency scores
SRE score = average of SRE competency scores
```

### Stage 3 - Weighted Overall Score

The system combines domain scores into one overall score.

If no domain weights are configured, every scored domain counts equally:

```text
overall_score = (Cloud + SRE) / 2
overall_score = (0.37 + 0.25) / 2
overall_score = 0.31
```

Displayed result:

```text
Achieved % = 31%
```

If domain weights are configured, important domains can count more.

Example weights:

| Domain | Score | Weight |
|---|---:|---:|
| Cloud | `0.37` | `2.0` |
| SRE | `0.25` | `1.0` |

Weighted calculation:

```text
overall_score =
  ((0.37 * 2.0) + (0.25 * 1.0))
  / (2.0 + 1.0)

overall_score = 0.99 / 3.0
overall_score = 0.33
```

Displayed result:

```text
Achieved % = 33%
```

### Stage 4 - Grade Benchmarking

Now the achieved score is compared with the target grade requirement.

Requirements come from `grade_matrix`.

Example target-grade requirements:

| Competency | Required threshold |
|---|---:|
| Containerization | `0.40` / `40%` |
| Infrastructure as Code | `0.30` / `30%` |
| Observability | `0.50` / `50%` |

Check each competency:

| Competency | Score | Required | Result |
|---|---:|---:|---|
| Containerization | `0.50` | `0.40` | Met |
| Infrastructure as Code | `0.24` | `0.30` | Not met |
| Observability | `0.25` | `0.50` | Not met |

Result:

```text
meets_count = 1
total_competencies = 3
promotion_ready = false
```

Average required score:

```text
avg_threshold = (0.40 + 0.30 + 0.50) / 3
avg_threshold = 0.40
```

Displayed result:

```text
Required % = 40%
```

### Stage 5 - Gap Computation

Gap means how far the resource is above or below the requirement.

For each competency:

```text
gap = score - required
```

Example:

| Competency | Score | Required | Gap |
|---|---:|---:|---:|
| Containerization | `0.50` | `0.40` | `+0.10` / `+10 points` |
| Infrastructure as Code | `0.24` | `0.30` | `-0.06` / `-6 points` |
| Observability | `0.25` | `0.50` | `-0.25` / `-25 points` |

Overall gap:

```text
overall_gap = achieved score - required score
overall_gap = 0.33 - 0.40
overall_gap = -0.07
```

Displayed result:

```text
Overall Gap = -7 percentage points
```

### Stage 6 - Report Generation

The report returns clean fields for dashboards, tables, charts, and exports.

Example report values:

```text
Resource: Engineer A
Achieved %: 33%
Required %: 40%
Gap: -7 percentage points
Meets: 1 / 3 competencies
Promotion ready: No
Cloud score: 37%
SRE score: 25%
```

Simple summary:

```text
Engineer A has achieved 33%.
The target requirement is 40%.
Engineer A is 7 percentage points below target.
Only 1 of 3 required competencies is currently met.
```

---

## 3. Simple Team Example With Multiple Resources

This example shows how single-resource results become team or department totals.

Simple idea:

```text
First calculate each resource.
Then average the resources together.
```

Example team:

| Resource | Achieved % | Required % | Gap | Meets | Ready? |
|---|---:|---:|---:|---:|---|
| Engineer A | `33%` | `40%` | `-7 points` | `1 / 3` | No |
| Engineer B | `55%` | `50%` | `+5 points` | `3 / 3` | Yes |
| Engineer C | `20%` | `40%` | `-20 points` | `0 / 3` | No |

### Team Achieved

Team achieved means:

```text
What did the team actually score on average?
```

Calculation:

```text
team_achieved =
  (Engineer A achieved + Engineer B achieved + Engineer C achieved)
  / total resources

team_achieved =
  (0.33 + 0.55 + 0.20) / 3

team_achieved =
  1.08 / 3

team_achieved =
  0.36
```

Displayed result:

```text
Team Achieved % = 36%
```

### Team Required

Team required means:

```text
What score was expected from the team on average?
```

Calculation:

```text
team_required =
  (Engineer A required + Engineer B required + Engineer C required)
  / total resources

team_required =
  (0.40 + 0.50 + 0.40) / 3

team_required =
  1.30 / 3

team_required =
  0.433
```

Displayed result:

```text
Team Required % = 43%
```

### Team Gap

Team gap means:

```text
Is the team above or below the required target?
```

Calculation:

```text
team_gap =
  team_achieved - team_required

team_gap =
  0.36 - 0.433

team_gap =
  -0.073
```

Displayed result:

```text
Team Gap = -7 percentage points
```

Simple meaning:

```text
The team is 7 percentage points below the required target.
```

### Requirement Completion

Requirement completion means:

```text
How much of the required target has the team covered?
```

Calculation:

```text
requirement_completion =
  team_achieved / team_required

requirement_completion =
  0.36 / 0.433

requirement_completion =
  0.831
```

Displayed result:

```text
Requirement Completion % = 83%
```

Simple meaning:

```text
The team has covered 83% of the required target.
```

### Resources Ready

Resources ready means:

```text
How many people individually meet their own requirement?
```

In this example:

| Resource | Achieved | Required | Ready? |
|---|---:|---:|---|
| Engineer A | `33%` | `40%` | No |
| Engineer B | `55%` | `50%` | Yes |
| Engineer C | `20%` | `40%` | No |

Result:

```text
Resources Ready = 1 / 3
```

### Readiness Rate

Readiness rate means:

```text
What percentage of people are ready?
```

Calculation:

```text
readiness_rate =
  ready resources / total resources

readiness_rate =
  1 / 3

readiness_rate =
  0.333
```

Displayed result:

```text
Readiness Rate = 33%
```

### Team Summary

Final team result:

```text
Team Achieved: 36%
Team Required: 43%
Team Gap: -7 percentage points
Requirement Completion: 83%
Resources Ready: 1 / 3
Readiness Rate: 33%
```

Plain-language summary:

```text
The team achieved 36%.
The team was expected to reach 43%.
The team is 7 percentage points below target.
Only 1 of 3 resources is individually ready.
```

---

## 4. Field Names In Simple Words

| Field name | Where it appears | Simple meaning |
|---|---|---|
| `employee_id` | `skill_assessments`, reports | The employee being assessed. API responses may show employee code, while database rows use internal numeric id. |
| `technology_id` | `skill_assessments` | The specific tool, technology, or skill item being assessed. |
| `type` | `skill_assessments` | How important that technology is for the competency: `Primary`, `Secondary`, or `Tertiary`. |
| `projects` | `skill_assessments` | How many real projects used this skill. The engine supports `0` to `3`; values below 0 become 0 and above 3 become 3. |
| `level` | `skill_assessments` | The assessed proficiency: `Expert`, `Advanced`, `Proficient`, `Foundational`, `Beginner`, `Awareness`, or `Unset`. |
| `score` | `skill_assessments` | The calculated score for one assessment row. |
| `status` | `skill_assessments` | Whether the row is `approved` or `pending`. Only approved rows count. |
| `competency_scores.score` | `competency_scores` | Total score for one employee in one competency. |
| `domain_scores` | report response | Average score for each skill domain, such as Cloud, SRE, or Security. |
| `overall_score` | reports | Weighted average of domain scores. Usually shown as Achieved %. |
| `final_score` | skills summary report | Same kind of calculation as `overall_score`, named differently in that report. |
| `threshold` | `grade_matrix` | Required score for a competency at the employee's target grade. |
| `meets_count` | promotion/gap reports | How many thresholded competencies the employee meets. |
| `total_competencies` | promotion readiness report | How many competencies have a requirement for the target grade. |
| `promotion_ready` | promotion/gap reports | `true` only when all required competencies are met. |

---

## 5. Assessment Row Score

**Code:** `computeAssessmentScore(type, projects, level, weights)`

This calculates the `skill_assessments.score` for one assessed technology.

```text
Assessment Row Score = ((Skill Importance Value * Projects / 3) + Skill Importance Value) * Level Weight
```

Same formula, easier to read:

```text
score =
  skill importance weight
  * (project count used / maximum projects + base credit)
  * skill level weight

Where:
skill importance weight = chosen from `type`
project count used      = value from `projects`, limited between 0 and 3
maximum projects        = 3
base credit             = 1
skill level weight      = chosen from `level`
```

Then the result is rounded to 2 decimal places.

### 5.1 Skill Importance Values

| `type` | Default importance value | Simple meaning |
|---|---:|---|
| `Primary` | `0.25` | Main technology for the competency. Gives highest credit. |
| `Secondary` | `0.15` | Supporting technology. Gives medium credit. |
| `Tertiary` | `0.10` | Related technology. Gives lower credit. |

These values are configured as individual assessment type rows:

```text
assessment_type_configs.code
assessment_type_configs.weight
```

The configuration UI lists the type rows separately from departments. If a type row is missing or inactive, the default value above is used.

### 5.2 Level Weights

| `level` | Weight |
|---|---:|
| `Expert` | `1.00` |
| `Advanced` | `0.80` |
| `Proficient` | `0.60` |
| `Foundational` | `0.40` |
| `Beginner` | `0.40` |
| `Awareness` | `0.20` |
| `Unset` | `0.00` |

These values are configured as individual assessment level rows:

```text
assessment_level_configs.code
assessment_level_configs.weight
assessment_level_configs.threshold
```

If a level row is missing or inactive, the default value above is used.

### 5.3 Project Count Rule

| Input `projects` | Used as | Why |
|---:|---:|---|
| `-1` | `0` | Less than zero is not allowed. |
| `0` | `0` | No project experience, but still gets base credit if level is selected. |
| `1` | `1` | One-third project credit. |
| `2` | `2` | Two-thirds project credit. |
| `3` | `3` | Full project credit. |
| `4` or more | `3` | Score is capped at three projects. |

Project options are configured as individual project rows:

```text
assessment_project_configs.project_count
assessment_project_configs.credit
assessment_project_configs.duration_months_min
assessment_project_configs.duration_months_max
assessment_project_configs.threshold
```

The seeded project credits mirror the current formula: `0`, `1/3`, `2/3`, and `1`.

### 5.4 Examples

#### Example 1 - Strong primary skill

Input fields:

| Field | Value |
|---|---|
| `type` | `Primary` |
| `projects` | `3` |
| `level` | `Expert` |

Calculation:

```text
Field/value mapping:
`type` = Primary  -> skill importance weight = 0.25
`projects` = 3    -> project count used = 3
max projects      -> maximum projects = 3
base credit       -> base credit = 1
`level` = Expert  -> skill level weight = 1.00

Formula using field names:
score =
  skill importance weight
  * (project count used / maximum projects + base credit)
  * skill level weight

Formula with actual values:
score = 0.25 * (3 / 3 + 1) * 1.00
score = 0.25 * 2 * 1.00
score = 0.50
```

Result:

```text
skill_assessments.score = 0.50
Displayed as 50%
```

#### Example 2 - Good secondary skill

Input fields:

| Field | Value |
|---|---|
| `type` | `Secondary` |
| `projects` | `3` |
| `level` | `Advanced` |

Calculation:

```text
Field/value mapping:
`type` = Secondary -> skill importance weight = 0.15
`projects` = 3     -> project count used = 3
max projects       -> maximum projects = 3
base credit        -> base credit = 1
`level` = Advanced -> skill level weight = 0.80

Formula using field names:
score =
  skill importance weight
  * (project count used / maximum projects + base credit)
  * skill level weight

Formula with actual values:
score = 0.15 * (3 / 3 + 1) * 0.80
score = 0.15 * 2 * 0.80
score = 0.24
```

Result:

```text
skill_assessments.score = 0.24
Displayed as 24%
```

#### Example 3 - Awareness of tertiary skill

Input fields:

| Field | Value |
|---|---|
| `type` | `Tertiary` |
| `projects` | `3` |
| `level` | `Awareness` |

Calculation:

```text
Field/value mapping:
`type` = Tertiary  -> skill importance weight = 0.10
`projects` = 3     -> project count used = 3
max projects       -> maximum projects = 3
base credit        -> base credit = 1
`level` = Awareness -> skill level weight = 0.20

Formula using field names:
score =
  skill importance weight
  * (project count used / maximum projects + base credit)
  * skill level weight

Formula with actual values:
score = 0.10 * (3 / 3 + 1) * 0.20
score = 0.10 * 2 * 0.20
score = 0.04
```

Result:

```text
skill_assessments.score = 0.04
Displayed as 4%
```

---

## 6. Assessment Type Configuration

**Code:** `getConfiguredScoringValues()` plus `computeAssessmentScore(...)`

Admins configure `Primary`, `Secondary`, and `Tertiary` as individual type rows. These values are global scoring inputs, not department-specific values.

Default weights:

```text
Primary   = 0.25
Secondary = 0.15
Tertiary  = 0.10
```

Example configured values:

```text
Primary   = 0.50
Secondary = 0.30
Tertiary  = 0.20
```

### 6.1 Examples

#### Example 1 - Primary uses configured type value

Input fields:

| Field | Value |
|---|---|
| `type` | `Primary` |
| `projects` | `3` |
| `level` | `Expert` |
| `Primary.weight` | `0.50` |

Calculation:

```text
Field/value mapping:
`type` = Primary       -> skill importance weight = `Primary.weight` = 0.50
`projects` = 3         -> project count used = 3
max projects           -> maximum projects = 3
base credit            -> base credit = 1
`level` = Expert       -> skill level weight = 1.00

Formula using field names:
score =
  skill importance weight
  * (project count used / maximum projects + base credit)
  * skill level weight

Formula with actual values:
score = 0.50 * (3 / 3 + 1) * 1.00
score = 0.50 * 2 * 1.00
score = 1.00
```

Result:

```text
skill_assessments.score = 1.00
Displayed as 100%
```

#### Example 2 - Secondary with zero projects

Input fields:

| Field | Value |
|---|---|
| `type` | `Secondary` |
| `projects` | `0` |
| `level` | `Proficient` |
| `Secondary.weight` | `0.30` |

Calculation:

```text
Field/value mapping:
`type` = Secondary     -> skill importance weight = `Secondary.weight` = 0.30
`projects` = 0         -> project count used = 0
max projects           -> maximum projects = 3
base credit            -> base credit = 1
`level` = Proficient   -> skill level weight = 0.60

Formula using field names:
score =
  skill importance weight
  * (project count used / maximum projects + base credit)
  * skill level weight

Formula with actual values:
score = 0.30 * (0 / 3 + 1) * 0.60
score = 0.30 * 1 * 0.60
score = 0.18
```

Result:

```text
skill_assessments.score = 0.18
Displayed as 18%
```

---

## 7. Competency Score

**Code:** `computeCompetencyScore(assessments, weights)`

This calculates `competency_scores.score`.

Plain-language rule:

```text
Competency Score = sum of approved skill_assessments.score rows
```

The engine prefers the stored `skill_assessments.score`. If an old row has stored score `0`, the engine recalculates that row from `type`, `projects`, and `level`.

Status rules:

- Rows count when their status config has `counts_toward_score = true`.
- The seeded countable status is `approved`.
- Pending assessments do not count by default.
- The score is rounded to 2 decimal places.
- There is no hard cap at `1.00`; a competency can go above 100% if it has many strong technologies.

### 7.1 Examples

#### Example 1 - Two approved technologies in one competency

Input assessment rows:

| Row | `type` | `projects` | `level` | `status` | Row `score` |
|---:|---|---:|---|---|---:|
| 1 | `Primary` | `3` | `Expert` | `approved` | `0.50` |
| 2 | `Secondary` | `3` | `Expert` | `approved` | `0.30` |

Calculation:

```text
competency_scores.score = 0.50 + 0.30
competency_scores.score = 0.80
```

Result:

```text
Competency Score = 0.80
Displayed as 80%
Level Label = L4 Expert
Competency Stars = 4
```

#### Example 2 - Pending row is ignored

Input assessment rows:

| Row | `type` | `projects` | `level` | `status` | Row `score` |
|---:|---|---:|---|---|---:|
| 1 | `Primary` | `3` | `Expert` | `approved` | `0.50` |
| 2 | `Secondary` | `3` | `Expert` | `pending` | `0.30` |

Calculation:

```text
competency_scores.score = 0.50
```

Result:

```text
Competency Score = 0.50
Displayed as 50%
Pending 0.30 is not included until approval.
```

#### Example 3 - No approved assessment

Input assessment rows:

| Row | `type` | `projects` | `level` | `status` | Row `score` |
|---:|---|---:|---|---|---:|
| 1 | `Primary` | `2` | `Proficient` | `pending` | `0.25` |

Calculation:

```text
No approved rows
```

Result:

```text
competency_scores.score = null
Displayed as no score / 0 depending on report screen
```

---

## 8. Competency Stars

**Code:** `scoreToStarRating(score)`

This converts `competency_scores.score` into stars for competency-level views.

| `competency_scores.score` | Stars |
|---:|---:|
| `0.00` to `< 0.20` | `1` |
| `0.20` to `< 0.40` | `2` |
| `0.40` to `< 0.65` | `3` |
| `0.65` to `< 0.95` | `4` |
| `0.95` and above | `5` |

### 8.1 Examples

| Input `competency_scores.score` | Result |
|---:|---|
| `0.18` | `1` star |
| `0.40` | `3` stars |
| `0.95` | `5` stars |

---

## 9. Competency Level Label

**Code:** `scoreToLevelLabel(score)`

This converts `competency_scores.score` into a plain label.

| `competency_scores.score` | Label |
|---:|---|
| `0.00` | `L0 Developing` |
| `> 0.00` to `< 0.40` | `L1 Beginner` |
| `0.40` to `< 0.60` | `L2 Intermediate` |
| `0.60` to `< 0.80` | `L3 Proficient` |
| `0.80` and above | `L4 Expert` |

### 9.1 Examples

| Input `competency_scores.score` | Result |
|---:|---|
| `0.00` | `L0 Developing` |
| `0.40` | `L2 Intermediate` |
| `0.80` | `L4 Expert` |

---

## 10. Primary Domain Selection

**Code:** `getPrimaryDomain(competency_domains)`

Each competency may be mapped to one or more domains. For reports, the system picks one domain.

Rule:

```text
Use the domain where is_primary = true.
If none is marked primary, use the first mapped domain.
If no domain exists, use "Unknown".
```

### 10.1 Examples

#### Example 1 - Primary domain exists

Input:

| Domain | `is_primary` |
|---|---|
| Cloud | `false` |
| SRE | `true` |

Result:

```text
Primary domain = SRE
```

#### Example 2 - No primary flag

Input:

| Domain | `is_primary` |
|---|---|
| Cloud | `false` |
| SRE | `false` |

Result:

```text
Primary domain = Cloud
```

#### Example 3 - No domain mapping

Input:

```text
competency_domains = []
```

Result:

```text
Primary domain = Unknown
```

---

## 11. Domain Score

**Code:** `buildDomainScores(competencyScores, competencies, domainNames)`

This calculates the `domain_scores` object used in reports.

Plain-language rule:

```text
Domain Score = average of scored competency scores in that domain
```

Formula:

```text
domain_scores[domainName] = sum(competency scores greater than 0) / count(competency scores greater than 0)
```

Rules:

- A competency score of `0`, missing, or `null` is excluded.
- A domain with no scored competencies returns `0`.
- Each competency contributes to its primary domain only.

### 11.1 Examples

#### Example 1 - Cloud has two scored competencies

Input:

| Competency | Primary domain | Score |
|---|---|---:|
| Kubernetes | Cloud | `0.60` |
| Terraform | Cloud | `0.80` |

Calculation:

```text
Cloud = (0.60 + 0.80) / 2
Cloud = 0.70
```

Result:

```text
domain_scores.Cloud = 0.70
Displayed as 70%
```

#### Example 2 - Zero score is excluded

Input:

| Competency | Primary domain | Score |
|---|---|---:|
| Kubernetes | Cloud | `0.60` |
| Terraform | Cloud | `0.00` |

Calculation:

```text
Cloud = 0.60 / 1
Cloud = 0.60
```

Result:

```text
domain_scores.Cloud = 0.60
The 0.00 row is not counted in the average.
```

#### Example 3 - No scored competencies

Input:

| Competency | Primary domain | Score |
|---|---|---:|
| Kubernetes | Cloud | `0.00` |
| Terraform | Cloud | missing |

Result:

```text
domain_scores.Cloud = 0
```

---

## 12. Overall Score / Final Score

**Code:** `weightedOverall(domainScores, weights)`

This calculates:

- `overall_score` in promotion readiness, competency scores, competency matrix, gap reports.
- `final_score` in the skills summary report.

Plain-language rule:

```text
Overall Score = weighted average of scored domain scores
```

Formula:

```text
overall_score = sum(domain score * domain weight) / sum(domain weights)
```

Rules:

- Domains with score `0` are excluded.
- If no weights are configured, every scored domain gets equal weight.
- If some domain is missing from the weight config, that domain uses weight `1.0`.
- The weight comes from `skill_domain_grade_weights` for the employee's `target_grade`.

### 12.1 Examples

#### Example 1 - No configured weights

Input:

| Domain | Score |
|---|---:|
| Cloud | `0.60` |
| SRE | `0.30` |
| DataOps | `0.00` |

Calculation:

```text
overall_score = (0.60 + 0.30) / 2
overall_score = 0.45
```

Result:

```text
overall_score = 0.45
Displayed as 45%
DataOps is excluded because score is 0.
```

#### Example 2 - Cloud is weighted twice as important

Input:

| Domain | Score | Weight |
|---|---:|---:|
| Cloud | `0.60` | `2.0` |
| SRE | `0.30` | `1.0` |

Calculation:

```text
overall_score = ((0.60 * 2.0) + (0.30 * 1.0)) / (2.0 + 1.0)
overall_score = (1.20 + 0.30) / 3.0
overall_score = 0.50
```

Result:

```text
overall_score = 0.50
Displayed as 50%
```

#### Example 3 - Missing domain weight defaults to 1.0

Input:

| Domain | Score | Configured weight |
|---|---:|---:|
| Cloud | `0.90` | `2.0` |
| Security | `0.60` | missing |

Calculation:

```text
Security weight defaults to 1.0

overall_score = ((0.90 * 2.0) + (0.60 * 1.0)) / (2.0 + 1.0)
overall_score = (1.80 + 0.60) / 3.0
overall_score = 0.80
```

Result:

```text
overall_score = 0.80
Displayed as 80%
```

---

## 13. Grade Threshold Stats

**Code:** `buildThresholdStats(competencies, competencyScores, thresholds)`

This produces:

- `avg_threshold`
- `total_competencies`
- `meets_count`

Plain-language rules:

```text
Only competencies with threshold > 0 are counted.
avg_threshold = average of those thresholds
meets_count = number of counted competencies where score >= threshold
total_competencies = number of competencies where threshold > 0
```

### 13.1 Examples

#### Example 1 - One met, one not met, one ignored

Input:

| Competency | Score | Threshold |
|---|---:|---:|
| Cloud Basics | `0.80` | `0.75` |
| SRE Basics | `0.40` | `0.50` |
| DataOps Basics | `0.20` | `0.00` |

Calculation:

```text
avg_threshold = (0.75 + 0.50) / 2 = 0.625
total_competencies = 2
meets_count = 1
```

Result:

```text
avg_threshold = 0.625
total_competencies = 2
meets_count = 1
```

#### Example 2 - All requirements met

Input:

| Competency | Score | Threshold |
|---|---:|---:|
| Cloud Basics | `0.80` | `0.75` |
| SRE Basics | `0.60` | `0.50` |

Result:

```text
avg_threshold = 0.625
total_competencies = 2
meets_count = 2
```

#### Example 3 - No thresholded competencies

Input:

| Competency | Score | Threshold |
|---|---:|---:|
| Cloud Basics | `0.80` | `0.00` |
| SRE Basics | `0.60` | missing |

Result:

```text
avg_threshold = 0
total_competencies = 0
meets_count = 0
```

---

## 14. Gap Calculations

There are two gap styles in the backend. They answer different questions.

### 14.1 Gap Analysis Shortfall

**Code:** `gapAnalysis(employeeId)`

This endpoint shows how much the employee is still missing.

Formula:

```text
gap = max(0, threshold - score)
```

Plain-language meaning:

- `0` means the employee meets or exceeds the requirement.
- A positive number means how much more is needed.
- It never shows a negative number.

#### Examples

| Score | Threshold | Calculation | Result |
|---:|---:|---|---:|
| `0.40` | `0.75` | `max(0, 0.75 - 0.40)` | `0.35` |
| `0.75` | `0.75` | `max(0, 0.75 - 0.75)` | `0.00` |
| `0.90` | `0.75` | `max(0, 0.75 - 0.90)` | `0.00` |

### 14.2 Gap Matrix Signed Gap

**Code:** `gapMatrix(managerId, role, employeeId?)`

This report shows whether the employee is above or below the requirement.

Formula:

```text
gap = score - threshold
```

Plain-language meaning:

- Positive gap means above requirement.
- Zero gap means exactly meets requirement.
- Negative gap means below requirement.

#### Examples

| Score | Threshold | Calculation | Result |
|---:|---:|---|---:|
| `0.40` | `0.75` | `0.40 - 0.75` | `-0.35` |
| `0.75` | `0.75` | `0.75 - 0.75` | `0.00` |
| `0.90` | `0.75` | `0.90 - 0.75` | `0.15` |

### 14.3 Domain Gap In Gap Matrix

**Code:** `gapMatrix(...)`

Domain gaps average competency scores and thresholds inside the domain.

Formula:

```text
domain score = average competency score in the domain
domain threshold = average competency threshold in the domain
domain gap = domain score - domain threshold
```

The domain average includes competencies where either `score > 0` or `threshold > 0`.

#### Examples

##### Example 1 - Below domain requirement

Input:

| Competency | Score | Threshold |
|---|---:|---:|
| Cloud Basics | `0.60` | `0.75` |
| Terraform | `0.40` | `0.50` |

Calculation:

```text
domain score = (0.60 + 0.40) / 2 = 0.50
domain threshold = (0.75 + 0.50) / 2 = 0.625
domain gap = 0.50 - 0.625 = -0.125
```

Result:

```text
domain_gaps.Cloud.gap = -0.125
```

##### Example 2 - Meets domain requirement

Input:

| Competency | Score | Threshold |
|---|---:|---:|
| Cloud Basics | `0.80` | `0.75` |
| Terraform | `0.60` | `0.50` |

Result:

```text
domain score = 0.70
domain threshold = 0.625
domain gap = 0.075
meets = true
```

---

## 15. Overall Threshold And Overall Gap

**Code:** `gapMatrix(...)`

This is used in the gap matrix report.

Formula:

```text
overall_threshold = weighted average of domain thresholds
overall_gap = overall_score - overall_threshold
```

Rules:

- Only domains with threshold greater than `0` are included.
- The same target-grade domain weights are used.

### 15.1 Examples

#### Example 1 - Equal weights

Input:

| Domain | Domain score | Domain threshold |
|---|---:|---:|
| Cloud | `0.70` | `0.60` |
| SRE | `0.50` | `0.70` |

Calculation:

```text
overall_score = (0.70 + 0.50) / 2 = 0.60
overall_threshold = (0.60 + 0.70) / 2 = 0.65
overall_gap = 0.60 - 0.65 = -0.05
```

Result:

```text
overall_gap = -0.05
Displayed as 5 percentage points below target
```

#### Example 2 - Weighted Cloud domain

Input:

| Domain | Domain score | Domain threshold | Weight |
|---|---:|---:|---:|
| Cloud | `0.80` | `0.70` | `2.0` |
| SRE | `0.50` | `0.60` | `1.0` |

Calculation:

```text
overall_score = ((0.80 * 2) + (0.50 * 1)) / 3 = 0.70
overall_threshold = ((0.70 * 2) + (0.60 * 1)) / 3 = 0.667
overall_gap = 0.70 - 0.667 = 0.033
```

Result:

```text
overall_gap = 0.033
Displayed as about 3 percentage points above target
```

---

## 16. Promotion Readiness

**Code:** `promotionReadiness(managerId, role)` and `gapAnalysis(employeeId)`

Formula:

```text
promotion_ready = total_competencies > 0 AND meets_count == total_competencies
```

Plain-language meaning:

An employee is promotion-ready only when every competency with a target-grade requirement is met.

### 16.1 Examples

#### Example 1 - Ready

Input:

```text
meets_count = 21
total_competencies = 21
```

Result:

```text
promotion_ready = true
```

#### Example 2 - Not ready

Input:

```text
meets_count = 18
total_competencies = 21
```

Result:

```text
promotion_ready = false
```

#### Example 3 - No target requirements

Input:

```text
meets_count = 0
total_competencies = 0
```

Result:

```text
promotion_ready = false
```

---

## 17. Promotion Star Rating

**Code:** `scoreToPromotionStarRating(score)`

Used in the promotion readiness report.

| `overall_score` | Stars |
|---:|---:|
| `< 0.40` | `1` |
| `0.40` to `< 0.60` | `2` |
| `0.60` to `< 0.75` | `3` |
| `0.75` to `< 0.95` | `4` |
| `0.95` and above | `5` |

### 17.1 Examples

| Input `overall_score` | Displayed percent | Result |
|---:|---:|---|
| `0.39` | `39%` | `1` star |
| `0.60` | `60%` | `3` stars |
| `0.95` | `95%` | `5` stars |

---

## 18. Skills Summary Star Rating

**Code:** `scoreToSkillSummaryStarRating(score)`

Used in the skills summary report. It converts `final_score` to stars.

| `final_score` | Percent | Stars |
|---:|---:|---:|
| `< 0.60` | `< 60%` | `1` |
| `0.60` to `< 0.75` | `60%` to `74%` | `2` |
| `0.75` to `< 0.90` | `75%` to `89%` | `3` |
| `0.90` to `< 0.95` | `90%` to `94%` | `4` |
| `0.95` and above | `95%+` | `5` |

### 18.1 Examples

| Input `final_score` | Displayed percent | Result |
|---:|---:|---|
| `0.59` | `59%` | `1` star |
| `0.60` | `60%` | `2` stars |
| `0.95` | `95%` | `5` stars |

---

## 19. Readiness Rate And Near Ready

These are dashboard/report display calculations built from promotion readiness rows.

### 19.1 Readiness Rate

Formula:

```text
Readiness Rate = promotion_ready employees / total employees * 100
```

Examples:

| Ready employees | Total employees | Result |
|---:|---:|---:|
| `4` | `10` | `40%` |
| `7` | `7` | `100%` |
| `0` | `8` | `0%` |

### 19.2 Near Ready

Formula:

```text
Near Ready = promotion_ready is false AND meets_count / total_competencies >= 0.75
```

Examples:

| `promotion_ready` | `meets_count` | `total_competencies` | Result |
|---|---:|---:|---|
| `false` | `16` | `21` | Near ready, because `16 / 21 = 76%` |
| `false` | `14` | `21` | Not near ready, because `14 / 21 = 67%` |
| `true` | `21` | `21` | Ready, not near-ready |

---

## 20. Team Accumulated Result

This pattern is for team-level dashboard totals across all resources/employees.

Use this when the UI needs to answer:

- What did the team actually achieve?
- What was the team required to achieve?
- How much of the requirement is completed?
- How many resources are individually ready?

Important rule:

```text
Team Achieved % should show actual achieved score.
Team Required % should show actual required score.
Requirement Completion % is the only value that can become 100% when achieved equals required.
```

So if a resource has:

```text
Achieved = 30%
Required = 30%
```

The UI should show:

```text
Achieved = 30%
Required = 30%
Requirement Completion = 100%
Meets = true
```

It should not replace Achieved with 100%.

### 20.1 Recommended UI Fields

| UI label | Formula | Meaning |
|---|---|---|
| `Team Achieved` | average or weighted average of resource achieved scores | Actual team score. |
| `Team Required` | average or weighted average of resource required scores | Target score expected from the team. |
| `Requirement Completion` | `Team Achieved / Team Required * 100` | How much of the required target is covered. |
| `Team Gap` | `Team Achieved - Team Required` | Positive means above target; negative means below target. |
| `Resources Ready` | count of resources where `Achieved >= Required` | Number of people meeting their own target. |
| `Readiness Rate` | `Resources Ready / Total Resources * 100` | Percentage of people meeting their own target. |

### 20.2 Simple Average Pattern

Use this when every resource should count equally.

Field-level formula:

```text
team_achieved =
  sum(resource_achieved_score for all resources)
  / total_resources

team_required =
  sum(resource_required_score for all resources)
  / total_resources

requirement_completion =
  team_achieved / team_required

team_gap =
  team_achieved - team_required

resources_ready =
  count(resource_achieved_score >= resource_required_score)

readiness_rate =
  resources_ready / total_resources
```

Display formula:

```text
Team Achieved % = team_achieved * 100
Team Required % = team_required * 100
Requirement Completion % = requirement_completion * 100
Team Gap percentage points = team_gap * 100
Readiness Rate % = readiness_rate * 100
```

### 20.3 Simple Average Example

Input resources:

| Resource | `resource_achieved_score` | `resource_required_score` | Meets? |
|---|---:|---:|---|
| Engineer A | `0.30` | `0.30` | yes |
| Engineer B | `0.40` | `0.50` | no |
| Engineer C | `0.80` | `0.70` | yes |

Calculation:

```text
team_achieved = (0.30 + 0.40 + 0.80) / 3
team_achieved = 1.50 / 3
team_achieved = 0.50

team_required = (0.30 + 0.50 + 0.70) / 3
team_required = 1.50 / 3
team_required = 0.50

requirement_completion = 0.50 / 0.50
requirement_completion = 1.00

team_gap = 0.50 - 0.50
team_gap = 0.00

resources_ready = 2
total_resources = 3
readiness_rate = 2 / 3
readiness_rate = 0.667
```

UI result:

```text
Team Achieved: 50%
Team Required: 50%
Requirement Completion: 100%
Team Gap: 0 percentage points
Resources Ready: 2 / 3
Readiness Rate: 66.7%
```

### 20.4 Weighted Team Pattern

Use this when resources should not count equally, for example when some resources have a higher allocation, higher grade weight, or stronger business importance.

Field-level formula:

```text
team_achieved =
  sum(resource_achieved_score * resource_weight)
  / sum(resource_weight)

team_required =
  sum(resource_required_score * resource_weight)
  / sum(resource_weight)

requirement_completion =
  team_achieved / team_required

team_gap =
  team_achieved - team_required
```

### 20.5 Weighted Team Example

Input resources:

| Resource | `resource_achieved_score` | `resource_required_score` | `resource_weight` |
|---|---:|---:|---:|
| Engineer A | `0.30` | `0.30` | `1.0` |
| Engineer B | `0.40` | `0.50` | `2.0` |
| Engineer C | `0.80` | `0.70` | `1.0` |

Calculation:

```text
team_achieved =
  ((0.30 * 1.0) + (0.40 * 2.0) + (0.80 * 1.0))
  / (1.0 + 2.0 + 1.0)

team_achieved = (0.30 + 0.80 + 0.80) / 4.0
team_achieved = 1.90 / 4.0
team_achieved = 0.475

team_required =
  ((0.30 * 1.0) + (0.50 * 2.0) + (0.70 * 1.0))
  / (1.0 + 2.0 + 1.0)

team_required = (0.30 + 1.00 + 0.70) / 4.0
team_required = 2.00 / 4.0
team_required = 0.50

requirement_completion = 0.475 / 0.50
requirement_completion = 0.95

team_gap = 0.475 - 0.50
team_gap = -0.025
```

UI result:

```text
Team Achieved: 47.5%
Team Required: 50%
Requirement Completion: 95%
Team Gap: -2.5 percentage points
```

### 20.6 Zero Required Score Rule

If `team_required = 0`, do not divide by zero.

Recommended display:

```text
Team Achieved: actual team achieved value
Team Required: 0%
Requirement Completion: N/A
Team Gap: Team Achieved - 0
```

Example:

```text
team_achieved = 0.40
team_required = 0

Requirement Completion = N/A
Team Gap = 0.40
```

UI result:

```text
Team Achieved: 40%
Team Required: 0%
Requirement Completion: N/A
Team Gap: +40 percentage points
```

---

## 21. Display Conversion Rules

Most report fields are decimal values. The UI often shows them as percentages.

| Stored value | Display value |
|---:|---:|
| `0` | `0%` |
| `0.45` | `45%` |
| `0.80` | `80%` |
| `1.00` | `100%` |

Common display formula:

```text
display_percent = score * 100
```

Some UI screens round to whole numbers for readability.

Examples:

| Field | Raw value | Display |
|---|---:|---:|
| `overall_score` | `0.846` | `85%` when rounded |
| `domain_scores.Cloud` | `0.694` | `69%` when rounded |
| `gap` | `-0.125` | `-13 percentage points` when rounded |
| `requirement_completion` | `1.00` | `100%` |

---

## 22. Consistency Checklist

Use this checklist when changing or reviewing calculation code.

| Rule | Must stay true |
|---|---|
| Assessment row score | Uses `type`, clamped `projects`, `level`, and formula weights. |
| Project range | Less than `0` becomes `0`; greater than `3` becomes `3`. |
| Approved-only scoring | Only `status = 'approved'` rows contribute to `competency_scores.score`. |
| Competency score | Sum of approved assessment row scores. |
| Domain score | Average only competencies with score greater than `0`. |
| Overall score | Weighted average only domains with score greater than `0`. |
| Missing domain weight | Defaults to `1.0`. |
| Promotion readiness | Requires all thresholded competencies to be met and at least one threshold. |
| Gap Analysis gap | Uses shortfall: `max(0, threshold - score)`. |
| Gap Matrix gap | Uses signed value: `score - threshold`. |
| Team achieved | Shows actual accumulated achieved score, not requirement completion. |
| Team required | Shows actual accumulated target score. |
| Requirement completion | Shows `achieved / required`; this is where `100%` means target fully covered. |
| Stored reports | Reports read `competency_scores`; they do not recompute from raw assessments. |

---

## 23. Source Files

| Concern | File |
|---|---|
| Assessment score, competency score, competency stars, level labels | `backend/src/scoring/scoring.engine.ts` |
| Domain score, overall score, threshold stats, report stars | `backend/src/scoring/reporting.engine.ts` |
| Assessment save/update/recompute flow | `backend/src/modules/assessment/assessment.service.ts` |
| Reports using the calculation engine | `backend/src/modules/reports/reports.service.ts` |
| Frontend preview for unsaved assessment rows | `frontend/src/lib/scoringPreview.ts` |
| Backend calculation tests | `backend/src/scoring/scoring.engine.test.ts`, `backend/src/scoring/reporting.engine.test.ts` |
