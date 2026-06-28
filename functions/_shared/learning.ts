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
  type BookCatalogItem,
  requireBooksBucket,
  putJson,
} from './books';
import {
  getStructuralKnowledgePoint,
  structuralKnowledgeMarkdown,
  structuralPlans,
  type StructuralLearningLevel,
} from '../../src/data/structural-learning';

export interface LearningEnv extends Env {
  BOOKS?: BooksBucket;
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
  bookRefs: BookRef[];
  aiContent: string;
  checkpointQuestion?: string;
  sources: Array<{
    dataset: string;
    document: string;
    score: number;
    excerpt: string;
  }>;
  conversationId?: string;
}

const VALID_DOMAINS = new Set(['structural', 'thermal', 'fluids', 'multiphysics', 'chip']);
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
};

export function getPresetPlan(level: LearningLevel): LearningPlan {
  const points = structuralPlans[level as StructuralLearningLevel];
  const ids = new Set(points.map((point) => point.id));
  return {
    domain: 'structural',
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

export function getPresetNode(nodeId: string): LearningNode | null {
  const point = getStructuralKnowledgePoint(nodeId);
  return point
    ? {
        id: point.id,
        title: point.title,
        description: point.description,
        prerequisites: [...point.prerequisites],
      }
    : null;
}

export function getPresetLevelForNode(nodeId: string): LearningLevel | null {
  return getStructuralKnowledgePoint(nodeId)?.level || null;
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
  if (domain === 'structural') {
    return getPresetPlan(level);
  }

  if (isMock(env)) {
    return {
      domain, level,
      nodes: [
        { id: 'topic-1', title: '基础概念', description: '掌握本领域的基础概念。', prerequisites: [] },
        { id: 'topic-2', title: '核心原理', description: '理解核心原理和数学描述。', prerequisites: ['topic-1'] },
        { id: 'topic-3', title: '数值方法', description: '学习数值实现和计算流程。', prerequisites: ['topic-2'] },
        { id: 'topic-4', title: '验证与实践', description: '通过案例验证计算结果。', prerequisites: ['topic-3'] },
        { id: 'topic-5', title: '综合应用', description: '将所学应用于工程问题。', prerequisites: ['topic-4'] },
      ],
      edges: [
        { from: 'topic-1', to: 'topic-2', type: 'prerequisite' },
        { from: 'topic-2', to: 'topic-3', type: 'prerequisite' },
        { from: 'topic-3', to: 'topic-4', type: 'prerequisite' },
        { from: 'topic-4', to: 'topic-5', type: 'prerequisite' },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  const scopeLabel = scopeLabels[domain] || domain;
  const levelLabel = level === 'low' ? '初级' : level === 'mid' ? '中级' : '高级';
  const prompt = `你是工程仿真学习顾问。请为"${scopeLabel}"领域的${levelLabel}学习者生成一个知识图谱学习计划。

要求：
1. 生成 5-8 个知识点节点
2. 每个节点包含：id（英文短横线slug）、title（中文标题）、description（1-2句描述）、prerequisites（前置节点id数组，没有则为空数组）
3. 节点之间有依赖关系，形成有向无环图
4. 以纯 JSON 格式返回，不要 markdown 标记，不要其他文字
5. JSON 格式：{"nodes":[{"id":"","title":"","description":"","prerequisites":[]}],"edges":[{"from":"","to":"","type":"prerequisite"}]}`;

  const response = await callDify(env, request, prompt);
  const parsed = extractJson(cleanAnswer(response.answer)) as { nodes: LearningNode[]; edges: LearningEdge[] };

  if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new ApiError('AI 生成的学习计划无效。', 502);
  }

  return {
    domain, level,
    nodes: parsed.nodes.map((n) => ({
      id: String(n.id || '').trim(),
      title: String(n.title || '').trim(),
      description: String(n.description || '').trim(),
      prerequisites: Array.isArray(n.prerequisites) ? n.prerequisites.map(String) : [],
    })),
    edges: Array.isArray(parsed.edges) ? parsed.edges.map((e) => ({
      from: String(e.from || '').trim(),
      to: String(e.to || '').trim(),
      type: 'prerequisite' as const,
    })) : [],
    createdAt: new Date().toISOString(),
  };
}

export async function generateCheckpointQuestion(
  env: LearningEnv,
  request: Request,
  node: LearningNode,
  conversationId?: string,
): Promise<{ question: string; conversationId: string }> {
  const presetPoint = getStructuralKnowledgePoint(node.id);
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
  if (domain === 'structural') {
    const point = getStructuralKnowledgePoint(nodeSlug);
    if (!point) throw new ApiError('知识点不存在。', 404);
    return {
      title: point.title,
      description: point.description,
      level: point.level,
      group: point.group,
      bookRefs: [],
      aiContent: structuralKnowledgeMarkdown(point),
      checkpointQuestion: point.question,
      sources: [],
    };
  }

  const bucket = requireBooksBucket(env);

  // 1. Search book catalog for matching chapters
  const catalogObject = await bucket.get('books/catalog.json');
  const catalog = catalogObject ? await catalogObject.json<BookCatalogItem[]>() : [];
  const bookRefs: BookRef[] = [];
  const needle = nodeSlug.replace(/-/g, ' ').toLowerCase();

  for (const book of catalog) {
    const haystack = [book.title, book.description, ...book.toc.map((t) => t.title)].join(' ').toLowerCase();
    if (haystack.includes(needle) || haystack.includes(nodeSlug.toLowerCase())) {
      const matchingChapter = book.toc.find((t) =>
        t.title.toLowerCase().includes(needle) ||
        t.title.toLowerCase().includes(nodeSlug.toLowerCase()),
      );
      bookRefs.push({
        slug: book.slug,
        title: book.title,
        author: book.author,
        chapterTitle: matchingChapter?.title,
        chapterId: matchingChapter?.id,
      });
    }
  }

  // 2. Call Dify for knowledge retrieval
  let aiContent = '';
  let sources: KnowledgeContent['sources'] = [];
  let conversationId: string | undefined;

  if (isMock(env)) {
    aiContent = `这是关于"${nodeSlug}"的知识点内容（演示模式）。连接 Dify 后，AI 将从知识库检索相关内容并展示在此。`;
    sources = [
      {
        dataset: '结构',
        document: '有限元基础教程.md',
        score: 0.89,
        excerpt: '有限元方法通过将连续体离散为有限个单元，在每个单元内用近似函数表示位移，再通过变分原理建立求解方程。',
      },
    ];
  } else {
    const scopeLabel = scopeLabels[domain] || domain;
    const query = `[用户指定检索范围：${scopeLabel}] 请详细解释知识点"${nodeSlug}"，包括定义、核心公式、物理意义和工程应用。`;
    const response = await callDify(env, request, query);
    aiContent = cleanAnswer(response.answer);
    conversationId = response.conversation_id;
    sources = (response.metadata?.retriever_resources || []).map((s) => ({
      dataset: s.dataset_name,
      document: s.document_name,
      score: s.score,
      excerpt: s.content.slice(0, 360),
    }));
  }

  return { title: nodeSlug, description: '', bookRefs, aiContent, sources, conversationId };
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
