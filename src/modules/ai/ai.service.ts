import env from '../../config/env';
import logger from '../../config/logger';
import { RoleCode } from '../../types/rbac';
import { promotionReadiness, competencyScores, gapMatrix } from '../reports/reports.service';

type FocusMode = 'executive' | 'risk' | 'skills' | 'readiness';
type Priority = 'critical' | 'warning' | 'positive' | 'neutral';

interface Recommendation {
  title: string;
  insight: string;
  action: string;
  priority: Priority;
  owner: string;
  timeframe: string;
}

interface RiskPerson {
  name: string;
  empCode: string;
  currentGrade: string;
  targetGrade: string;
  gapPct: number;
  meets: string;
  action: string;
}

interface SkillAreaInsight {
  domain: string;
  averagePct: number;
  assessed: number;
  priority: Priority;
  recommendation: string;
}

interface Blocker {
  employee: string;
  competency: string;
  domain: string;
  gapPct: number;
  action: string;
}

interface Strength {
  domain: string;
  averagePct: number;
  recommendation: string;
}

interface AiDashboardResponse {
  generatedAt: string;
  model: string | null;
  aiEnabled: boolean;
  source: 'openai' | 'deterministic';
  focus: FocusMode;
  summary: string;
  executiveNarrative: string;
  focusAnswer: string;
  kpis: {
    totalResources: number;
    readyResources: number;
    readinessRatePct: number;
    avgAchievedPct: number;
    avgRequiredPct: number;
    nearReadyCount: number;
    criticalBlockerCount: number;
  };
  recommendations: Recommendation[];
  riskPeople: RiskPerson[];
  skillAreas: SkillAreaInsight[];
  blockers: Blocker[];
  strengths: Strength[];
  suggestedQuestions: string[];
}

const emptyArray = <T>(value: T[] | undefined): T[] => Array.isArray(value) ? value : [];

function clampText(value: unknown, fallback: string, max = 420): string {
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function priorityFromGap(gapPct: number): Priority {
  if (gapPct >= 30) return 'critical';
  if (gapPct >= 12) return 'warning';
  return 'neutral';
}

function buildDeterministicDashboard(
  focus: FocusMode,
  promoRows: Awaited<ReturnType<typeof promotionReadiness>>,
  compRows: Awaited<ReturnType<typeof competencyScores>>,
  gapData: Awaited<ReturnType<typeof gapMatrix>>,
): AiDashboardResponse {
  const assessedRows = promoRows.filter((r) => r.overall_score > 0);
  const readyCount = promoRows.filter((r) => r.promotion_ready).length;
  const avgAchieved = assessedRows.length
    ? assessedRows.reduce((sum, r) => sum + r.overall_score, 0) / assessedRows.length
    : 0;
  const thresholdRows = promoRows.filter((r) => r.avg_threshold > 0);
  const avgRequired = thresholdRows.length
    ? thresholdRows.reduce((sum, r) => sum + r.avg_threshold, 0) / thresholdRows.length
    : 0;
  const readinessRate = promoRows.length ? readyCount / promoRows.length : 0;

  const domainNames = compRows.length > 0 ? Object.keys(compRows[0].domain_scores) : [];
  const domainAverages = domainNames.map((domain) => {
    const values = compRows.map((r) => r.domain_scores[domain] ?? 0).filter((score) => score > 0);
    const avg = values.length ? values.reduce((sum, score) => sum + score, 0) / values.length : 0;
    return { domain, avg, assessed: values.length };
  }).filter((d) => d.assessed > 0);

  const weakestDomains = [...domainAverages].sort((a, b) => a.avg - b.avg).slice(0, 6);
  const strongestDomains = [...domainAverages].sort((a, b) => b.avg - a.avg).slice(0, 4);
  const riskRows = [...promoRows]
    .filter((r) => !r.promotion_ready && r.total_competencies > 0)
    .map((r) => ({
      ...r,
      gap: Math.max(0, (r.avg_threshold || 0) - r.overall_score),
      meetsRate: r.meets_count / Math.max(1, r.total_competencies),
    }))
    .sort((a, b) => b.gap - a.gap);
  const nearReady = riskRows.filter((r) => r.meetsRate >= 0.7).slice(0, 5);

  const blockers = gapData.employees.flatMap((employee) =>
    Object.entries(employee.competency_gaps ?? {})
      .filter(([, gap]) => gap.threshold > 0 && !gap.meets)
      .map(([competency, gap]) => ({
        employee: employee.full_name,
        competency,
        domain: gap.domain,
        gapPct: Math.round(Math.abs(gap.gap) * 100),
        action: `Assign targeted work or mentoring for ${competency}.`,
      })),
  ).sort((a, b) => b.gapPct - a.gapPct).slice(0, 8);

  const topRiskPeople: RiskPerson[] = riskRows.slice(0, 6).map((r) => ({
    name: r.full_name,
    empCode: r.emp_code,
    currentGrade: r.current_grade,
    targetGrade: r.target_grade,
    gapPct: Math.round(r.gap * 100),
    meets: `${r.meets_count}/${r.total_competencies}`,
    action: r.gap >= 0.25
      ? 'Create a 30-day recovery plan with weekly skill checkpoints.'
      : 'Use focused mentoring to close the remaining target-grade gaps.',
  }));

  const skillAreas: SkillAreaInsight[] = weakestDomains.map((d) => {
    const averagePct = Math.round(d.avg * 100);
    return {
      domain: d.domain,
      averagePct,
      assessed: d.assessed,
      priority: averagePct < 45 ? 'critical' : averagePct < 60 ? 'warning' : 'neutral',
      recommendation: `Prioritize enablement, project exposure, and assessment refreshes for ${d.domain}.`,
    };
  });

  const strengths: Strength[] = strongestDomains.map((d) => ({
    domain: d.domain,
    averagePct: Math.round(d.avg * 100),
    recommendation: `Use strong performers in ${d.domain} as mentors for adjacent skill areas.`,
  }));

  const criticalBlockerCount = blockers.filter((b) => b.gapPct >= 30).length;
  const weakest = skillAreas[0];
  const highestRisk = topRiskPeople[0];
  const summary = promoRows.length === 0
    ? 'No readiness dataset is available yet.'
    : `${readyCount} of ${promoRows.length} resources are ready for next grade. Average achieved score is ${Math.round(avgAchieved * 100)}% against ${avgRequired > 0 ? `${Math.round(avgRequired * 100)}% required` : 'no configured benchmark'}.`;

  const focusAnswers: Record<FocusMode, string> = {
    executive: `${summary} The immediate management story is readiness risk, skill-area consistency, and focused intervention.`,
    risk: highestRisk
      ? `${highestRisk.name} has the largest readiness gap at ${highestRisk.gapPct} points and should be reviewed first.`
      : 'No high-risk resources are visible in the current dataset.',
    skills: weakest
      ? `${weakest.domain} is currently the weakest assessed skill area at ${weakest.averagePct}%. Build enablement around that gap first.`
      : 'No assessed skill-area data is available yet.',
    readiness: nearReady.length > 0
      ? `${nearReady.length} resources are near-ready. Focus on the highest meets-rate people to create quick promotion wins.`
      : 'No near-ready cohort was detected yet; start with the highest-risk blockers first.',
  };

  return {
    generatedAt: new Date().toISOString(),
    model: null,
    aiEnabled: false,
    source: 'deterministic',
    focus,
    summary,
    executiveNarrative: `${summary} Treat this as an intervention dashboard: reduce the largest individual gaps, lift the weakest skill areas, and reuse high-performing domains as mentoring capacity.`,
    focusAnswer: focusAnswers[focus],
    kpis: {
      totalResources: promoRows.length,
      readyResources: readyCount,
      readinessRatePct: Math.round(readinessRate * 100),
      avgAchievedPct: Math.round(avgAchieved * 100),
      avgRequiredPct: Math.round(avgRequired * 100),
      nearReadyCount: nearReady.length,
      criticalBlockerCount,
    },
    recommendations: [
      {
        title: `${Math.round(readinessRate * 100)}% next-grade readiness`,
        insight: summary,
        action: 'Review target-grade gaps by person and assign accountable skill owners.',
        priority: readinessRate >= 0.75 ? 'positive' : readinessRate >= 0.45 ? 'warning' : 'critical',
        owner: 'Leadership',
        timeframe: 'This week',
      },
      ...(weakest ? [{
        title: `Lowest skill area: ${weakest.domain}`,
        insight: `${weakest.domain} averages ${weakest.averagePct}% across ${weakest.assessed} assessed resources.`,
        action: weakest.recommendation,
        priority: weakest.priority,
        owner: 'Capability lead',
        timeframe: '30 days',
      }] : []),
      ...(highestRisk ? [{
        title: `Highest readiness gap: ${highestRisk.name}`,
        insight: `${highestRisk.name} is ${highestRisk.gapPct} points below the current required benchmark and meets ${highestRisk.meets} required skills.`,
        action: highestRisk.action,
        priority: priorityFromGap(highestRisk.gapPct),
        owner: 'Line manager',
        timeframe: '14 days',
      }] : []),
    ],
    riskPeople: topRiskPeople,
    skillAreas,
    blockers,
    strengths,
    suggestedQuestions: [
      'What is the overall readiness story?',
      'Who needs immediate intervention?',
      'Which skill areas are weakest?',
      'Who can become ready fastest?',
    ],
  };
}

function buildAiPayload(
  base: AiDashboardResponse,
  promoRows: Awaited<ReturnType<typeof promotionReadiness>>,
  compRows: Awaited<ReturnType<typeof competencyScores>>,
  gapData: Awaited<ReturnType<typeof gapMatrix>>,
) {
  return {
    focus: base.focus,
    kpis: base.kpis,
    deterministicSummary: base.summary,
    riskPeople: base.riskPeople,
    weakestSkillAreas: base.skillAreas,
    criticalBlockers: base.blockers.slice(0, 6),
    strengths: base.strengths,
    employees: promoRows.slice(0, 12).map((r) => ({
      name: r.full_name,
      empCode: r.emp_code,
      currentGrade: r.current_grade,
      targetGrade: r.target_grade,
      achievedPct: Math.round(r.overall_score * 100),
      requiredPct: Math.round(r.avg_threshold * 100),
      meets: `${r.meets_count}/${r.total_competencies}`,
      ready: r.promotion_ready,
    })),
    domains: compRows[0] ? Object.keys(compRows[0].domain_scores) : [],
    totalGapEmployees: gapData.employees.length,
  };
}

function extractResponseText(response: any): string {
  if (typeof response?.output_text === 'string') return response.output_text;
  const parts = response?.output?.flatMap((item: any) => item?.content ?? []) ?? [];
  const text = parts.map((part: any) => part?.text ?? '').filter(Boolean).join('\n');
  return text;
}

function coerceAiResponse(value: any, base: AiDashboardResponse, model: string): AiDashboardResponse {
  const recommendations = emptyArray(value?.recommendations).slice(0, 5).map((item: any, index) => ({
    title: clampText(item?.title, base.recommendations[index]?.title ?? 'Recommended action', 120),
    insight: clampText(item?.insight, base.recommendations[index]?.insight ?? base.summary, 360),
    action: clampText(item?.action, base.recommendations[index]?.action ?? 'Review this area with the leadership team.', 260),
    priority: ['critical', 'warning', 'positive', 'neutral'].includes(item?.priority) ? item.priority : (base.recommendations[index]?.priority ?? 'neutral'),
    owner: clampText(item?.owner, base.recommendations[index]?.owner ?? 'Leadership', 80),
    timeframe: clampText(item?.timeframe, base.recommendations[index]?.timeframe ?? 'This week', 80),
  }));

  return {
    ...base,
    aiEnabled: true,
    source: 'openai',
    model,
    summary: clampText(value?.summary, base.summary, 360),
    executiveNarrative: clampText(value?.executiveNarrative, base.executiveNarrative, 700),
    focusAnswer: clampText(value?.focusAnswer, base.focusAnswer, 500),
    recommendations: recommendations.length ? recommendations : base.recommendations,
    riskPeople: emptyArray(value?.riskPeople).slice(0, 6).map((item: any, index) => ({
      name: clampText(item?.name, base.riskPeople[index]?.name ?? 'Resource', 100),
      empCode: clampText(item?.empCode, base.riskPeople[index]?.empCode ?? '', 30),
      currentGrade: clampText(item?.currentGrade, base.riskPeople[index]?.currentGrade ?? '', 30),
      targetGrade: clampText(item?.targetGrade, base.riskPeople[index]?.targetGrade ?? '', 30),
      gapPct: Number.isFinite(Number(item?.gapPct)) ? Number(item.gapPct) : (base.riskPeople[index]?.gapPct ?? 0),
      meets: clampText(item?.meets, base.riskPeople[index]?.meets ?? '0/0', 30),
      action: clampText(item?.action, base.riskPeople[index]?.action ?? 'Review readiness blockers.', 220),
    })).filter((item) => item.name) || base.riskPeople,
    skillAreas: emptyArray(value?.skillAreas).slice(0, 6).map((item: any, index) => ({
      domain: clampText(item?.domain, base.skillAreas[index]?.domain ?? 'Skill area', 100),
      averagePct: Number.isFinite(Number(item?.averagePct)) ? Number(item.averagePct) : (base.skillAreas[index]?.averagePct ?? 0),
      assessed: Number.isFinite(Number(item?.assessed)) ? Number(item.assessed) : (base.skillAreas[index]?.assessed ?? 0),
      priority: ['critical', 'warning', 'positive', 'neutral'].includes(item?.priority) ? item.priority : (base.skillAreas[index]?.priority ?? 'neutral'),
      recommendation: clampText(item?.recommendation, base.skillAreas[index]?.recommendation ?? 'Prioritize focused enablement.', 240),
    })).filter((item) => item.domain) || base.skillAreas,
    blockers: emptyArray(value?.blockers).slice(0, 8).map((item: any, index) => ({
      employee: clampText(item?.employee, base.blockers[index]?.employee ?? 'Resource', 100),
      competency: clampText(item?.competency, base.blockers[index]?.competency ?? 'Competency', 140),
      domain: clampText(item?.domain, base.blockers[index]?.domain ?? 'Skill area', 100),
      gapPct: Number.isFinite(Number(item?.gapPct)) ? Number(item.gapPct) : (base.blockers[index]?.gapPct ?? 0),
      action: clampText(item?.action, base.blockers[index]?.action ?? 'Assign a remediation action.', 220),
    })).filter((item) => item.employee && item.competency) || base.blockers,
    strengths: emptyArray(value?.strengths).slice(0, 4).map((item: any, index) => ({
      domain: clampText(item?.domain, base.strengths[index]?.domain ?? 'Skill area', 100),
      averagePct: Number.isFinite(Number(item?.averagePct)) ? Number(item.averagePct) : (base.strengths[index]?.averagePct ?? 0),
      recommendation: clampText(item?.recommendation, base.strengths[index]?.recommendation ?? 'Reuse this strength through mentoring.', 220),
    })).filter((item) => item.domain) || base.strengths,
    suggestedQuestions: emptyArray(value?.suggestedQuestions).slice(0, 6).map((q) => clampText(q, '', 120)).filter(Boolean).length
      ? emptyArray(value?.suggestedQuestions).slice(0, 6).map((q) => clampText(q, '', 120)).filter(Boolean)
      : base.suggestedQuestions,
  };
}

async function callOpenAi(base: AiDashboardResponse, payload: unknown): Promise<AiDashboardResponse> {
  const apiKey = env.OPENAI_API_KEY || env.OPENAI_KEY;
  if (!apiKey) return base;

  const candidates = Array.from(new Set([
    env.OPENAI_MODEL,
    'gpt-5.4-mini',
    'gpt-4o-mini',
    'gpt-4o',
  ].filter(Boolean)));

  for (const model of candidates) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: 'You are an AI talent intelligence analyst for a DevOps capability platform. Return only concise, practical JSON. Be specific, action-oriented, and management-safe. Do not invent people, scores, or domains outside the supplied data.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  task: 'Generate a full AI dashboard response for leadership.',
                  requiredShape: {
                    summary: 'one sentence',
                    executiveNarrative: '2-3 sentences',
                    focusAnswer: 'answer for selected focus',
                    recommendations: 'up to 5 items with title, insight, action, priority, owner, timeframe',
                    riskPeople: 'up to 6 people with action',
                    skillAreas: 'up to 6 weakest skill areas with recommendation',
                    blockers: 'up to 8 critical blockers with action',
                    strengths: 'up to 4 strengths to reuse',
                    suggestedQuestions: '4-6 short follow-up questions',
                  },
                  data: payload,
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_object',
          },
        },
      }),
    });

    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      logger.warn({ status: response.status, model, code: body?.error?.code, message: body?.error?.message }, 'OpenAI AI dashboard request failed');
      continue;
    }

    const text = extractResponseText(body);
    if (!text) continue;
    try {
      return coerceAiResponse(JSON.parse(text), base, model);
    } catch (error) {
      logger.warn({ error, model }, 'OpenAI AI dashboard response was not valid JSON');
    }
  }

  return base;
}

export async function getAiDashboard(userId: number, employeeId: number, role: RoleCode, focus: FocusMode = 'executive') {
  const safeFocus: FocusMode = ['executive', 'risk', 'skills', 'readiness'].includes(focus) ? focus : 'executive';
  const [promoRows, compRows, gaps] = await Promise.all([
    promotionReadiness(userId, employeeId, role),
    competencyScores(userId, employeeId, role),
    gapMatrix(userId, employeeId, role),
  ]);

  const base = buildDeterministicDashboard(safeFocus, promoRows, compRows, gaps);
  const payload = buildAiPayload(base, promoRows, compRows, gaps);

  try {
    return await callOpenAi(base, payload);
  } catch (error) {
    logger.warn({ error }, 'AI dashboard fell back to deterministic analysis');
    return base;
  }
}
