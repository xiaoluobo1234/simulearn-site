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

    // Structural plans are preset; other domains retain the existing generator until migrated.
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

    // Keep progress from every level and legacy AI nodes. The UI only renders preset IDs.
    progress.plan = plan;
    progress.level = validatedLevel;
    for (const node of plan.nodes) {
      if (!progress.nodes[node.id]) {
        progress.nodes[node.id] = { status: 'pending', attempts: 0 };
      }
    }
    await putProgress(learningEnv, uid, progress);

    return json({ ok: true, plan, progress });
  } catch (error) {
    return errorResponse(error);
  }
};
