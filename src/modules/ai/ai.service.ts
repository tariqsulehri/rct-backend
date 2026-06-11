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

interface AiChatEvidence {
  label: string;
  value: string;
  detail: string;
  tone: 'danger' | 'warning' | 'success' | 'info' | 'neutral';
}

interface AiChatAction {
  title: string;
  detail: string;
  owner: string;
  timeframe: string;
  priority: Priority;
}

interface AiChatResponse {
  generatedAt: string;
  model: string | null;
  aiEnabled: boolean;
  source: 'openai' | 'deterministic';
  answer: string;
  explanation: string;
  evidence: AiChatEvidence[];
  actions: AiChatAction[];
  relatedPeople: RiskPerson[];
  relatedSkills: SkillAreaInsight[];
  suggestedQuestions: string[];
}

const emptyArray = <T>(value: T[] | undefined): T[] => Array.isArray(value) ? value : [];

function clampText(value: unknown, fallback: string, max = 420): string {
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safePercent(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}%` : 'N/A';
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
  const aiBlockers = emptyArray(value?.blockers).slice(0, 8).map((item: any, index) => ({
    employee: clampText(item?.employee, base.blockers[index]?.employee ?? 'Resource', 100),
    competency: clampText(item?.competency, base.blockers[index]?.competency ?? 'Competency', 140),
    domain: clampText(item?.domain, base.blockers[index]?.domain ?? 'Skill area', 100),
    gapPct: Number.isFinite(Number(item?.gapPct)) ? Number(item.gapPct) : (base.blockers[index]?.gapPct ?? 0),
    action: clampText(item?.action, base.blockers[index]?.action ?? 'Assign a remediation action.', 220),
  })).filter((item) => item.employee && item.competency);
  const blockerKeys = new Set(aiBlockers.map((item) => `${item.employee}|${item.competency}|${item.domain}`));
  const completeBlockers = [
    ...aiBlockers,
    ...base.blockers.filter((item) => !blockerKeys.has(`${item.employee}|${item.competency}|${item.domain}`)),
  ].slice(0, 8);

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
    blockers: completeBlockers.length ? completeBlockers : base.blockers,
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
                    blockers: 'exactly the supplied top 8 critical blockers when 8 are available, each with action',
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

function buildDeterministicChat(question: string, base: AiDashboardResponse): AiChatResponse {
  const q = question.toLowerCase();
  const topBlockers = base.blockers.slice(0, 5);
  const topRiskPeople = base.riskPeople.slice(0, 5);
  const topSkills = base.skillAreas.slice(0, 5);
  const topRecommendation = base.recommendations[0];
  const topSkill = topSkills[0];
  const topPerson = topRiskPeople[0];

  const baseEvidence: AiChatEvidence[] = [
    {
      label: 'Readiness',
      value: safePercent(base.kpis.readinessRatePct),
      detail: `${base.kpis.readyResources} of ${base.kpis.totalResources} people are ready.`,
      tone: base.kpis.readinessRatePct >= 75 ? 'success' : base.kpis.readinessRatePct >= 45 ? 'warning' : 'danger',
    },
    {
      label: 'Critical Gaps',
      value: String(base.kpis.criticalBlockerCount),
      detail: 'Gaps that need management action first.',
      tone: base.kpis.criticalBlockerCount > 0 ? 'danger' : 'success',
    },
    {
      label: 'Average Score',
      value: safePercent(base.kpis.avgAchievedPct),
      detail: base.kpis.avgRequiredPct > 0 ? `Needed score is ${base.kpis.avgRequiredPct}%.` : 'No needed score is set.',
      tone: base.kpis.avgRequiredPct > 0 && base.kpis.avgAchievedPct < base.kpis.avgRequiredPct ? 'warning' : 'success',
    },
  ];

  let answer = base.summary;
  let explanation = 'This answer uses current readiness, skill gap, and assessment data.';
  let evidence = baseEvidence;
  let actions: AiChatAction[] = [];
  let relatedPeople = topRiskPeople;
  let relatedSkills = topSkills;

  if (q.includes('critical') || q.includes('gap') || q.includes('blocker')) {
    answer = topBlockers.length
      ? 'Start with the biggest critical gaps. These are the fastest places for managers to take focused action.'
      : 'No critical gaps are showing right now.';
    explanation = topBlockers.length
      ? 'People below needed score in important skills may slow readiness and delivery. Fix the largest gaps first.'
      : 'The current data does not show blocked skills, but managers should keep assessments updated.';
    evidence = [
      ...baseEvidence,
      ...topBlockers.slice(0, 3).map((item): AiChatEvidence => ({
        label: item.employee,
        value: `-${item.gapPct} pts`,
        detail: `${item.competency} in ${item.domain}`,
        tone: item.gapPct >= 30 ? 'danger' : 'warning',
      })),
    ];
    actions = topBlockers.slice(0, 3).map((item) => ({
      title: `Close ${item.competency}`,
      detail: item.action,
      owner: 'Line manager',
      timeframe: item.gapPct >= 30 ? '14 days' : '30 days',
      priority: priorityFromGap(item.gapPct),
    }));
  } else if (q.includes('weak') || q.includes('skill area') || q.includes('skill')) {
    answer = topSkill
      ? `${topSkill.domain} needs the most attention right now.`
      : 'No weak skill area is available yet.';
    explanation = topSkill
      ? `This area has the lowest score in the current dataset and can affect multiple people.`
      : 'Add or approve more skill checks so the dashboard can find weak areas.';
    evidence = [
      ...baseEvidence,
      ...topSkills.slice(0, 4).map((item): AiChatEvidence => ({
        label: item.domain,
        value: safePercent(item.averagePct),
        detail: `${item.assessed} people assessed. ${item.recommendation}`,
        tone: item.priority === 'critical' ? 'danger' : item.priority === 'warning' ? 'warning' : 'info',
      })),
    ];
    actions = topSkills.slice(0, 3).map((item) => ({
      title: `Improve ${item.domain}`,
      detail: item.recommendation,
      owner: 'Capability lead',
      timeframe: '30 days',
      priority: item.priority,
    }));
  } else if (q.includes('ready') || q.includes('readiness') || q.includes('promotion')) {
    answer = `${base.kpis.readyResources} of ${base.kpis.totalResources} people are ready. Readiness is ${base.kpis.readinessRatePct}%.`;
    explanation = 'To improve readiness quickly, help people who are close to ready first, then work on the largest critical gaps.';
    evidence = baseEvidence;
    actions = [
      {
        title: 'Lift near-ready people first',
        detail: `${base.kpis.nearReadyCount} people look close to ready. Review their remaining gaps and assign focused help.`,
        owner: 'Managers',
        timeframe: 'This week',
        priority: base.kpis.nearReadyCount > 0 ? 'warning' : 'neutral',
      },
      {
        title: 'Review critical gaps',
        detail: 'Use the Critical Gaps list to decide who needs coaching, training, or project exposure.',
        owner: 'Leadership',
        timeframe: '14 days',
        priority: base.kpis.criticalBlockerCount > 0 ? 'critical' : 'neutral',
      },
    ];
  } else if (q.includes('person') || q.includes('people') || q.includes('help') || q.includes('risk')) {
    answer = topPerson
      ? `${topPerson.name} needs help first based on current readiness gap.`
      : 'No high-risk person is listed right now.';
    explanation = topPerson
      ? 'This person has one of the largest gaps against the needed score for the target grade.'
      : 'No person is currently flagged as high risk in the AI dashboard data.';
    evidence = [
      ...baseEvidence,
      ...topRiskPeople.slice(0, 4).map((item): AiChatEvidence => ({
        label: item.name,
        value: `${item.gapPct} pts`,
        detail: `${item.currentGrade} to ${item.targetGrade}; ${item.meets} skills met.`,
        tone: item.gapPct >= 30 ? 'danger' : 'warning',
      })),
    ];
    actions = topRiskPeople.slice(0, 3).map((item) => ({
      title: `Help ${item.name}`,
      detail: item.action,
      owner: 'Line manager',
      timeframe: item.gapPct >= 30 ? '14 days' : '30 days',
      priority: priorityFromGap(item.gapPct),
    }));
  } else {
    answer = topRecommendation?.title ?? base.summary;
    explanation = topRecommendation?.insight ?? 'This is the best available summary from the current dashboard data.';
    actions = base.recommendations.slice(0, 3).map((item) => ({
      title: item.title,
      detail: item.action,
      owner: item.owner,
      timeframe: item.timeframe,
      priority: item.priority,
    }));
  }

  return {
    generatedAt: new Date().toISOString(),
    model: null,
    aiEnabled: false,
    source: 'deterministic',
    answer,
    explanation,
    evidence,
    actions,
    relatedPeople,
    relatedSkills,
    suggestedQuestions: [
      'Who needs help first?',
      'Which gaps should managers fix this week?',
      'Which skill area needs investment?',
      'How can we improve readiness?',
      'What should leadership decide next?',
    ],
  };
}

function coerceAiChatResponse(value: any, fallback: AiChatResponse, model: string): AiChatResponse {
  const evidence = emptyArray(value?.evidence).slice(0, 8).map((item: any, index) => ({
    label: clampText(item?.label, fallback.evidence[index]?.label ?? 'Evidence', 80),
    value: clampText(item?.value, fallback.evidence[index]?.value ?? 'N/A', 40),
    detail: clampText(item?.detail, fallback.evidence[index]?.detail ?? '', 220),
    tone: ['danger', 'warning', 'success', 'info', 'neutral'].includes(item?.tone)
      ? item.tone
      : (fallback.evidence[index]?.tone ?? 'neutral'),
  })).filter((item) => item.label);
  const actions = emptyArray(value?.actions).slice(0, 6).map((item: any, index) => ({
    title: clampText(item?.title, fallback.actions[index]?.title ?? 'Recommended action', 120),
    detail: clampText(item?.detail, fallback.actions[index]?.detail ?? 'Review this item with the team.', 260),
    owner: clampText(item?.owner, fallback.actions[index]?.owner ?? 'Manager', 80),
    timeframe: clampText(item?.timeframe, fallback.actions[index]?.timeframe ?? 'This week', 80),
    priority: ['critical', 'warning', 'positive', 'neutral'].includes(item?.priority)
      ? item.priority
      : (fallback.actions[index]?.priority ?? 'neutral'),
  })).filter((item) => item.title);

  return {
    ...fallback,
    aiEnabled: true,
    source: 'openai',
    model,
    answer: clampText(value?.answer, fallback.answer, 500),
    explanation: clampText(value?.explanation, fallback.explanation, 700),
    evidence: evidence.length ? evidence : fallback.evidence,
    actions: actions.length ? actions : fallback.actions,
    suggestedQuestions: emptyArray(value?.suggestedQuestions).slice(0, 6).map((q) => clampText(q, '', 120)).filter(Boolean).length
      ? emptyArray(value?.suggestedQuestions).slice(0, 6).map((q) => clampText(q, '', 120)).filter(Boolean)
      : fallback.suggestedQuestions,
  };
}

async function callOpenAiChat(question: string, fallback: AiChatResponse, context: unknown): Promise<AiChatResponse> {
  const apiKey = env.OPENAI_API_KEY || env.OPENAI_KEY;
  if (!apiKey) return fallback;

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
                text: 'You are an AI decision assistant for top management and managers. Use only supplied data. Use simple English for non-native speakers. Return only JSON. Do not expose model names. Do not invent people, scores, skills, or owners.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  task: 'Answer the manager question with evidence and clear actions.',
                  question,
                  requiredShape: {
                    answer: 'short direct answer in simple English',
                    explanation: 'why this answer matters for decision making',
                    evidence: '3-8 items with label, value, detail, tone',
                    actions: '1-6 action items with title, detail, owner, timeframe, priority',
                    suggestedQuestions: '4-6 short follow-up questions',
                  },
                  data: context,
                }),
              },
            ],
          },
        ],
        text: { format: { type: 'json_object' } },
      }),
    });

    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      logger.warn({ status: response.status, model, code: body?.error?.code, message: body?.error?.message }, 'OpenAI AI chat request failed');
      continue;
    }

    const text = extractResponseText(body);
    if (!text) continue;
    try {
      return coerceAiChatResponse(JSON.parse(text), fallback, model);
    } catch (error) {
      logger.warn({ error, model }, 'OpenAI AI chat response was not valid JSON');
    }
  }

  return fallback;
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

export async function askAiDashboard(userId: number, employeeId: number, role: RoleCode, question: string, focus: FocusMode = 'executive') {
  const safeQuestion = clampText(question, '', 600);
  const safeFocus: FocusMode = ['executive', 'risk', 'skills', 'readiness'].includes(focus) ? focus : 'executive';
  const [promoRows, compRows, gaps] = await Promise.all([
    promotionReadiness(userId, employeeId, role),
    competencyScores(userId, employeeId, role),
    gapMatrix(userId, employeeId, role),
  ]);

  const base = buildDeterministicDashboard(safeFocus, promoRows, compRows, gaps);
  const payload = buildAiPayload(base, promoRows, compRows, gaps);
  const fallback = buildDeterministicChat(safeQuestion, base);

  try {
    return await callOpenAiChat(safeQuestion, fallback, payload);
  } catch (error) {
    logger.warn({ error }, 'AI chat fell back to deterministic answer');
    return fallback;
  }
}
