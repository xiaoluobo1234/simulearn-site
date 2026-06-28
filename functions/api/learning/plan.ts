import { errorResponse, json, assertSameOrigin, readJson, userId, type Env } from '../../_shared/dify';
import {
  generatePlan,
  getProgress,
  putProgress,
  validateDomain,
  validateLevel,
  type LearningEnv,
  type UserProgress,
} from '../../_shared/learning';

interface PlanRequest {
  domain?: string;
  level?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    assertSameOrigin(request);
    const body = await readJson<PlanRequest>(request);
    const domain = String(body.domain || '').trim();
    const level = String(body.level || '').trim();
    validateDomain(domain);
    const validatedLevel = validateLevel(level);

    const learningEnv: LearningEnv = { ...env, BOOKS: (env as unknown as { BOOKS?: LearningEnv['BOOKS'] }).BOOKS };
    const uid = await userId(request);

    // Generate plan via AI
    const plan = await generatePlan(learningEnv, request, domain, validatedLevel);

    // Load existing progress or create new
    let progress = await getProgress(learningEnv, uid, domain);
    if (!progress) {
      progress = {
        userId: uid,
        domain,
        level: validatedLevel,
        plan: null,
        nodes: {},
        updatedAt: new Date().toISOString(),
      };
    }

    // Update plan and reset node statuses for new plan
    progress.plan = plan;
    progress.level = validatedLevel;
    // Keep existing node progress for nodes that still exist in the new plan
    const newNodeIds = new Set(plan.nodes.map((n) => n.id));
    const updatedNodes: typeof progress.nodes = {};
    for (const [nodeId, nodeProgress] of Object.entries(progress.nodes)) {
      if (newNodeIds.has(nodeId)) {
        updatedNodes[nodeId] = nodeProgress;
      }
    }
    // Initialize new nodes as pending
    for (const node of plan.nodes) {
      if (!updatedNodes[node.id]) {
        updatedNodes[node.id] = { status: 'pending', attempts: 0 };
      }
    }
    progress.nodes = updatedNodes;
    await putProgress(learningEnv, uid, progress);

    return json({ ok: true, plan, progress });
  } catch (error) {
    return errorResponse(error);
  }
};
