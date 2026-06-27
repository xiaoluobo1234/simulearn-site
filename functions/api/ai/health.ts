import { allowedExtensions, isMock, json, type Env } from '../../_shared/dify';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const mode = isMock(env) ? 'mock' : 'live';
  return json({
    ok: true,
    mode,
    configured: {
      chat: Boolean(env.DIFY_API_URL && env.DIFY_CHAT_APP_API_KEY),
      review: Boolean(env.DIFY_API_URL && env.DIFY_REVIEW_APP_API_KEY),
      datasets: Boolean(env.DIFY_API_URL && env.DIFY_DATASET_API_KEY && env.DIFY_DATASETS_JSON),
    },
    allowedExtensions,
    maxUploadMb: Number(env.MAX_UPLOAD_MB || 15),
  });
};
