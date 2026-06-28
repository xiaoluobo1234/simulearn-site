import { errorResponse, json, assertSameOrigin, readJson, userId, type Env } from '../../_shared/dify';
import {
  getProgress,
  getPresetLevelForNode,
  getPresetPlan,
  putProgress,
  validateDomain,
  type LearningEnv,
} from '../../_shared/learning';

interface ProgressUpdate {
  domain?: string;
  nodeId?: string;
  status?: 'pending' | 'studying' | 'passed';
  conversationId?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain') || '';
    validateDomain(domain);
    const learningEnv: LearningEnv = { ...env, BOOKS: (env as unknown as { BOOKS?: LearningEnv['BOOKS'] }).BOOKS };
    const uid = await userId(request);
    const progress = await getProgress(learningEnv, uid, domain);
    return json({ ok: true, progress });
  } catch (error) {
    return errorResponse(error);
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    assertSameOrigin(request);
    const body = await readJson<ProgressUpdate>(request);
    const domain = String(body.domain || '').trim();
    const nodeId = String(body.nodeId || '').trim();
    validateDomain(domain);
    if (!nodeId) throw new Error('节点 ID 不能为空。');

    const learningEnv: LearningEnv = { ...env, BOOKS: (env as unknown as { BOOKS?: LearningEnv['BOOKS'] }).BOOKS };
    const uid = await userId(request);
    let progress = await getProgress(learningEnv, uid, domain);
    if (!progress) {
      const level = getPresetLevelForNode(nodeId) || 'low';
      progress = {
        userId: uid,
        domain,
        level,
        plan: domain === 'structural' ? getPresetPlan(level) : null,
        nodes: {},
        updatedAt: new Date().toISOString(),
      };
    }

    const node = progress.nodes[nodeId] || { status: 'pending', attempts: 0 };
    if (body.status) node.status = body.status;
    if (body.status === 'passed') {
      node.passedAt = new Date().toISOString();
      node.attempts += 1;
    }
    if (body.conversationId) node.conversationId = body.conversationId;
    progress.nodes[nodeId] = node;

    await putProgress(learningEnv, uid, progress);
    return json({ ok: true, progress });
  } catch (error) {
    return errorResponse(error);
  }
};
