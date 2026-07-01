import {
  ApiError,
  assertSameOrigin,
  difyJson,
  isMock,
  json,
  userId,
  type Env,
} from './dify';
import {
  type BooksBucket,
  requireBooksBucket,
  putJson,
} from './books';
import {
  getDomainPlans,
  getKnowledgePoint,
  knowledgeMarkdown,
  type LearningDomainSlug,
} from '../../src/data/learning-catalog';
import { getOverride } from './content-store';

export interface LearningEnv extends Env {
  BOOKS?: BooksBucket;
  AI_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
}

export async function assertAiRateLimit(env: LearningEnv, uid: string): Promise<void> {
  if (isMock(env)) return;
  if (env.AI_RATE_LIMITER && !(await env.AI_RATE_LIMITER.limit({ key: uid })).success) {
    throw new ApiError('AI 调用过于频繁，请一分钟后再试。', 429);
  }
  const bucket = requireBooksBucket(env);
  const key = `users/${uid}/ai-quota.json`;
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const object = await bucket.get(key);
  const quota = object
    ? await object.json<{ hour: string; hourCount: number; day: string; dayCount: number }>()
    : { hour, hourCount: 0, day, dayCount: 0 };
  if (quota.hour !== hour) { quota.hour = hour; quota.hourCount = 0; }
  if (quota.day !== day) { quota.day = day; quota.dayCount = 0; }
  if (quota.hourCount >= 20) throw new ApiError('本小时 AI 调用已达 20 次，请稍后再试。', 429);
  if (quota.dayCount >= 60) throw new ApiError('今日 AI 调用已达 60 次，请明天再试。', 429);
  quota.hourCount += 1;
  quota.dayCount += 1;
  await putJson(bucket, key, { ...quota, updatedAt: now.toISOString() }, 'no-store');
}

export type LearningLevel = 'low' | 'mid' | 'high';

export interface LearningNode {
  id: string;
  title: string;
  description: string;
  prerequisites: string[];
}

export interface LearningEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'related';
}

export interface LearningPlan {
  domain: string;
  level: LearningLevel;
  nodes: LearningNode[];
  edges: LearningEdge[];
  createdAt: string;
}

export interface NodeProgress {
  status: 'pending' | 'studying' | 'passed';
  passedAt?: string;
  attempts: number;
  conversationId?: string;
}

export interface UserProgress {
  userId: string;
  domain: string;
  level: LearningLevel;
  plan: LearningPlan | null;
  nodes: Record<string, NodeProgress>;
  updatedAt: string;
}

export interface BookRef {
  slug: string;
  title: string;
  author: string;
  chapterTitle?: string;
  chapterId?: string;
}

export interface KnowledgeContent {
  title: string;
  description: string;
  level?: LearningLevel;
  group?: string;
  difficulty?: string;
  tutorialMode?: boolean;
  practiceStatus?: 'collecting';
  bookRefs: BookRef[];
  aiContent: string;
  checkpointQuestion?: string;
  reviewStatus?: 'draft' | 'reviewed';
  relations?: {
    prerequisites: Array<{ id: string; title: string }>;
    next: Array<{ id: string; title: string }>;
    related: Array<{ id: string; title: string }>;
  };
  sources: Array<{
    dataset: string;
    document: string;
    score: number;
    excerpt: string;
  }>;
  conversationId?: string;
}

const VALID_DOMAINS = new Set(['structural', 'thermal', 'fluids', 'multiphysics', 'chip', 'tools']);
const VALID_LEVELS = new Set(['low', 'mid', 'high']);

export function validateDomain(domain: string): void {
  if (!VALID_DOMAINS.has(domain)) throw new ApiError('未知领域。', 400);
}

export function validateLevel(level: string): LearningLevel {
  if (!VALID_LEVELS.has(level)) throw new ApiError('未知等级。', 400);
  return level as LearningLevel;
}

function progressKey(uid: string, domain: string): string {
  return `users/${uid}/progress/${domain}.json`;
}

export async function getProgress(
  env: LearningEnv,
  uid: string,
  domain: string,
): Promise<UserProgress | null> {
  const bucket = requireBooksBucket(env);
  const object = await bucket.get(progressKey(uid, domain));
  if (!object) return null;
  return object.json<UserProgress>();
}

export async function putProgress(
  env: LearningEnv,
  uid: string,
  progress: UserProgress,
): Promise<void> {
  const bucket = requireBooksBucket(env);
  progress.updatedAt = new Date().toISOString();
  await putJson(bucket, progressKey(uid, progress.domain), progress, 'no-store');
}

interface DifyChatResponse {
  answer: string;
  conversation_id: string;
  message_id: string;
  metadata?: {
    usage?: { total_tokens?: number; total_price?: string; currency?: string };
    retriever_resources?: Array<{
      position: number;
      dataset_name: string;
      document_name: string;
      score: number;
      content: string;
    }>;
  };
}

function cleanAnswer(answer: string): string {
  return answer
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

function extractJson(text: string): unknown {
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new ApiError('AI 返回的 JSON 格式无效。', 502);
  }
}

const scopeLabels: Record<string, string> = {
  structural: '结构',
  thermal: '热',
  fluids: '流体',
  multiphysics: '多物理场',
  chip: '芯片仿真',
  tools: '工具脚本',
};

export function getPresetPlan(domain: string, level: LearningLevel): LearningPlan {
  validateDomain(domain);
  const points = getDomainPlans(domain as LearningDomainSlug)[level];
  const ids = new Set(points.map((point) => point.id));
  return {
    domain,
    level,
    nodes: points.map((point) => ({
      id: point.id,
      title: point.title,
      description: point.description,
      prerequisites: [...point.prerequisites],
    })),
    edges: points.flatMap((point) =>
      point.prerequisites
        .filter((prerequisite) => ids.has(prerequisite))
        .map((prerequisite) => ({
          from: prerequisite,
          to: point.id,
          type: 'prerequisite' as const,
        })),
    ),
    createdAt: new Date().toISOString(),
  };
}

export function getPresetNode(domain: string, nodeId: string): LearningNode | null {
  validateDomain(domain);
  const point = getKnowledgePoint(domain as LearningDomainSlug, nodeId);
  return point
    ? {
        id: point.id,
        title: point.title,
        description: point.description,
        prerequisites: [...point.prerequisites],
      }
    : null;
}

export function getPresetLevelForNode(domain: string, nodeId: string): LearningLevel | null {
  validateDomain(domain);
  return getKnowledgePoint(domain as LearningDomainSlug, nodeId)?.level || null;
}

async function callDify(
  env: LearningEnv,
  request: Request,
  query: string,
  conversationId?: string,
): Promise<DifyChatResponse> {
  return difyJson<DifyChatResponse>(
    env,
    '/chat-messages',
    env.DIFY_CHAT_APP_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: {},
        query,
        response_mode: 'blocking',
        conversation_id: conversationId || '',
        user: await userId(request),
        auto_generate_name: true,
      }),
    },
  );
}

export async function generatePlan(
  env: LearningEnv,
  request: Request,
  domain: string,
  level: LearningLevel,
): Promise<LearningPlan> {
  return getPresetPlan(domain, level);
}

export async function generateCheckpointQuestion(
  env: LearningEnv,
  request: Request,
  domain: string,
  node: LearningNode,
  conversationId?: string,
): Promise<{ question: string; conversationId: string }> {
  const presetPoint = getKnowledgePoint(domain as LearningDomainSlug, node.id);
  if (presetPoint) {
    return {
      question: presetPoint.question,
      conversationId: conversationId || '',
    };
  }

  if (isMock(env)) {
    return {
      question: `请解释"${node.title}"的核心概念，并说明其在工程仿真中的应用。`,
      conversationId: conversationId || 'mock-checkpoint',
    };
  }

  const prompt = `你是工程仿真学习检验员。学员正在学习知识点"${node.title}"（${node.description}）。

请出一道开放性检验题，考察学员对该知识点核心概念的理解。要求：
1. 不是选择题，是开放性问答
2. 题目应聚焦核心概念，而非细节记忆
3. 只返回题目文本，不要其他内容`;

  const response = await callDify(env, request, prompt, conversationId);
  return {
    question: cleanAnswer(response.answer),
    conversationId: response.conversation_id,
  };
}

export async function evaluateCheckpointAnswer(
  env: LearningEnv,
  request: Request,
  node: LearningNode,
  question: string,
  answer: string,
  conversationId?: string,
): Promise<{ passed: boolean; feedback: string; conversationId: string }> {
  if (isMock(env)) {
    const passed = answer.length > 20;
    return {
      passed,
      feedback: passed
        ? '回答涵盖了核心要点，理解正确。'
        : '回答较为简略，建议补充核心概念的关键词和工程应用场景。',
      conversationId: conversationId || 'mock-checkpoint',
    };
  }

  const prompt = `你是工程仿真学习检验员。学员正在学习知识点"${node.title}"（${node.description}）。

检验题目：${question}
学员回答：${answer}

请评判学员的回答是否合格。评判标准：核心概念理解正确，关键要点覆盖。
以纯 JSON 格式返回，不要 markdown 标记：{"passed":true/false,"feedback":"评判反馈"}`;

  const response = await callDify(env, request, prompt, conversationId);
  const parsed = extractJson(cleanAnswer(response.answer)) as { passed: boolean; feedback: string };

  return {
    passed: Boolean(parsed.passed),
    feedback: String(parsed.feedback || '').trim() || '评判完成。',
    conversationId: response.conversation_id,
  };
}

export async function assembleKnowledgeContent(
  env: LearningEnv,
  request: Request,
  domain: string,
  nodeSlug: string,
): Promise<KnowledgeContent> {
  validateDomain(domain);
  const point = getKnowledgePoint(domain as LearningDomainSlug, nodeSlug);
  if (!point) throw new ApiError('知识点不存在。', 404);
  const allPoints = getDomainPlans(domain as LearningDomainSlug);
  const flattened = [...allPoints.low, ...allPoints.mid, ...allPoints.high];
  const ref = (id: string) => {
    const item = flattened.find((candidate) => candidate.id === id);
    return item ? { id: item.id, title: item.title } : null;
  };
  const prerequisites = point.prerequisites.map(ref).filter((item): item is { id: string; title: string } => Boolean(item));
  const next = flattened.filter((item) => item.prerequisites.includes(point.id)).slice(0, 6).map((item) => ({ id: item.id, title: item.title }));
  const excluded = new Set([point.id, ...point.prerequisites, ...next.map((item) => item.id)]);
  const related = flattened.filter((item) => item.group === point.group && !excluded.has(item.id)).slice(0, 6).map((item) => ({ id: item.id, title: item.title }));

  // Check for admin content overrides in R2
  let overrideTitle: string | undefined;
  let overrideDescription: string | undefined;
  let overrideAiContent: string | undefined;
  try {
    const override = await getOverride(env, domain, nodeSlug);
    if (override) {
      overrideTitle = override.title || undefined;
      overrideDescription = override.description || undefined;
      overrideAiContent = override.aiContent || undefined;
    }
  } catch {
    // R2 read failure should not block page load — fall back to static content
  }

  return {
    title: overrideTitle || point.title,
    description: overrideDescription || point.description,
    level: point.level,
    group: point.group,
    difficulty: point.difficulty,
    tutorialMode: Boolean(point.tutorialMarkdown),
    practiceStatus: point.practiceStatus,
    bookRefs: [],
    aiContent: overrideAiContent || knowledgeMarkdown(point),
    checkpointQuestion: point.question,
    reviewStatus: 'draft',
    relations: { prerequisites, next, related },
    sources: [],
  };
}

export async function expandKnowledgePoint(
  env: LearningEnv,
  request: Request,
  domain: string,
  node: LearningNode,
  conversationId?: string,
): Promise<{ answer: string; conversationId: string; sources: KnowledgeContent['sources'] }> {
  if (isMock(env)) {
    return {
      answer: `「${node.title}」的 AI 拓展处于演示模式。正式环境会补充推导思路、工程案例和适用边界。`,
      conversationId: conversationId || 'mock-expand',
      sources: [],
    };
  }

  const scopeLabel = scopeLabels[domain] || domain;
  const prompt = `[用户指定检索范围：${scopeLabel}] 学员正在学习知识点「${node.title}」（${node.description}）。
请在预设教材内容之外进行拓展，按“推导或机制、工程案例、适用边界、进一步学习建议”四部分回答。明确区分知识库证据与一般工程推断，不确定时直接说明。`;
  const response = await callDify(env, request, prompt, conversationId);
  return {
    answer: cleanAnswer(response.answer),
    conversationId: response.conversation_id,
    sources: (response.metadata?.retriever_resources || []).map((source) => ({
      dataset: source.dataset_name,
      document: source.document_name,
      score: source.score,
      excerpt: source.content.slice(0, 360),
    })),
  };
}

export async function chatAboutNode(
  env: LearningEnv,
  request: Request,
  domain: string,
  node: LearningNode,
  query: string,
  conversationId?: string,
): Promise<{ answer: string; conversationId: string; sources: KnowledgeContent['sources'] }> {
  if (isMock(env)) {
    return {
      answer: `这是关于「${node.title}」的回答（演示模式）。连接 Dify 后，AI 将根据知识库内容回答你的问题。`,
      conversationId: conversationId || 'mock-chat',
      sources: [],
    };
  }

  const scopeLabel = scopeLabels[domain] || domain;
  const prompt = `[用户指定检索范围：${scopeLabel}] 学员正在学习知识点「${node.title}」（${node.description}）。学员提问：${query}`;
  const response = await callDify(env, request, prompt, conversationId);
  return {
    answer: cleanAnswer(response.answer),
    conversationId: response.conversation_id,
    sources: (response.metadata?.retriever_resources || []).map((s) => ({
      dataset: s.dataset_name,
      document: s.document_name,
      score: s.score,
      excerpt: s.content.slice(0, 360),
    })),
  };
}

export { assertSameOrigin, json, userId, ApiError };
