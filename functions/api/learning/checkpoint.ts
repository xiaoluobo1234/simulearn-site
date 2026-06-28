import { errorResponse, json, assertSameOrigin, readJson, userId, type Env } from '../../_shared/dify';
import {
  chatAboutNode,
  generateCheckpointQuestion,
  evaluateCheckpointAnswer,
  getProgress,
  putProgress,
  validateDomain,
  type LearningEnv,
  type LearningNode,
} from '../../_shared/learning';

interface CheckpointRequest {
  domain?: string;
  nodeId?: string;
  mode?: 'question' | 'evaluate' | 'chat';
  question?: string;
  answer?: string;
  query?: string;
  conversationId?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    assertSameOrigin(request);
    const body = await readJson<CheckpointRequest>(request);
    const domain = String(body.domain || '').trim();
    const nodeId = String(body.nodeId || '').trim();
    const mode = body.mode || 'question';
    validateDomain(domain);
    if (!nodeId) throw new Error('节点 ID 不能为空。');

    const learningEnv: LearningEnv = { ...env, BOOKS: (env as unknown as { BOOKS?: LearningEnv['BOOKS'] }).BOOKS };
    const uid = await userId(request);

    // Find the node in the user's plan
    let progress = await getProgress(learningEnv, uid, domain);
    if (!progress || !progress.plan) {
      throw new Error('请先生成学习计划。');
    }
    const node = progress.plan.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error('知识点节点不存在。');
    }

    if (mode === 'question') {
      const result = await generateCheckpointQuestion(learningEnv, request, node, body.conversationId);

      // Save conversation ID
      const nodeProgress = progress.nodes[nodeId] || { status: 'pending', attempts: 0 };
      nodeProgress.conversationId = result.conversationId;
      nodeProgress.status = 'studying';
      progress.nodes[nodeId] = nodeProgress;
      await putProgress(learningEnv, uid, progress);

      return json({ ok: true, question: result.question, conversationId: result.conversationId });
    }

    if (mode === 'evaluate') {
      const question = String(body.question || '').trim();
      const answer = String(body.answer || '').trim();
      if (!question || !answer) throw new Error('题目和回答不能为空。');

      const result = await evaluateCheckpointAnswer(
        learningEnv,
        request,
        node,
        question,
        answer,
        body.conversationId,
      );

      return json({
        ok: true,
        passed: result.passed,
        feedback: result.feedback,
        conversationId: result.conversationId,
      });
    }

    if (mode === 'chat') {
      const userQuery = String(body.query || '').trim();
      if (!userQuery) throw new Error('问题不能为空。');
      if (userQuery.length > 4000) throw new Error('单次问题不能超过 4000 字。');

      const result = await chatAboutNode(
        learningEnv,
        request,
        domain,
        node,
        userQuery,
        body.conversationId,
      );

      const nodeProgress = progress.nodes[nodeId] || { status: 'pending', attempts: 0 };
      nodeProgress.conversationId = result.conversationId;
      if (nodeProgress.status === 'pending') nodeProgress.status = 'studying';
      progress.nodes[nodeId] = nodeProgress;
      await putProgress(learningEnv, uid, progress);

      return json({
        ok: true,
        answer: result.answer,
        conversationId: result.conversationId,
        sources: result.sources,
      });
    }

    throw new Error('不支持的检验模式。');
  } catch (error) {
    return errorResponse(error);
  }
};
