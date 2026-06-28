import {
  ApiError,
  assertSameOrigin,
  difyJson,
  errorResponse,
  isMock,
  json,
  readJson,
  userId,
  type Env,
} from '../../_shared/dify';

interface ChatRequest {
  query?: string;
  scope?: string;
  conversationId?: string;
}

const scopeLabels: Record<string, string> = {
  structural: '结构',
  thermal: '热',
  fluids: '流体',
  multiphysics: '多物理场',
  chip: '芯片仿真',
};

interface DifyChatResponse {
  answer: string;
  conversation_id: string;
  message_id: string;
  metadata?: {
    usage?: {
      total_tokens?: number;
      total_price?: string;
      currency?: string;
    };
    retriever_resources?: Array<{
      position: number;
      dataset_name: string;
      document_name: string;
      score: number;
      content: string;
    }>;
  };
}

function publicAnswer(answer: string): string {
  return answer
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    assertSameOrigin(request);
    const body = await readJson<ChatRequest>(request);
    const query = body.query?.trim();
    if (!query) throw new ApiError('请输入问题。', 400);
    if (query.length > 4000) throw new ApiError('单次问题不能超过 4000 字。', 400);

    if (isMock(env)) {
      return json({
        ok: true,
        mode: 'mock',
        answer: '当前处于演示模式。连接 Dify 后，我会检索结构、热、流体、多物理场和芯片仿真知识库，并只依据检索到的资料回答。',
        conversationId: 'mock-conversation',
        messageId: 'mock-message',
        sources: [
          {
            position: 1,
            dataset: '结构',
            document: '有限元结果验证清单.md',
            score: 0.92,
            excerpt: '先检查单位、边界条件、能量平衡与网格收敛，再解释局部峰值。',
          },
        ],
        usage: { totalTokens: 0, totalPrice: '0', currency: 'CNY' },
      });
    }

    const scopeLabel = body.scope ? scopeLabels[body.scope] : undefined;
    const scopedQuery = scopeLabel ? `[用户指定检索范围：${scopeLabel}] ${query}` : query;
    const response = await difyJson<DifyChatResponse>(
      env,
      '/chat-messages',
      env.DIFY_CHAT_APP_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: {},
          query: scopedQuery,
          response_mode: 'blocking',
          conversation_id: body.conversationId || '',
          user: await userId(request),
          auto_generate_name: true,
        }),
      },
    );

    return json({
      ok: true,
      mode: 'live',
      answer: publicAnswer(response.answer),
      conversationId: response.conversation_id,
      messageId: response.message_id,
      sources: (response.metadata?.retriever_resources || []).map((source) => ({
        position: source.position,
        dataset: source.dataset_name,
        document: source.document_name,
        score: source.score,
        excerpt: source.content.slice(0, 360),
      })),
      usage: {
        totalTokens: response.metadata?.usage?.total_tokens || 0,
        totalPrice: response.metadata?.usage?.total_price || '0',
        currency: response.metadata?.usage?.currency || 'CNY',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
