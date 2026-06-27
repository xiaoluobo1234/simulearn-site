import {
  ApiError,
  difyJson,
  errorResponse,
  isMock,
  json,
  requireDataset,
  type Env,
} from '../../_shared/dify';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('dataset') || '';
    const batch = url.searchParams.get('batch') || '';
    if (!batch) throw new ApiError('缺少索引批次号。', 400);
    if (isMock(env)) {
      return json({
        ok: true,
        mode: 'mock',
        data: [{ id: 'mock-document', indexingStatus: 'completed', completedSegments: 8, totalSegments: 8, error: null }],
      });
    }
    const datasetId = requireDataset(env, slug);
    const result = await difyJson<{
      data?: Array<{
        id: string;
        indexing_status: string;
        completed_segments: number;
        total_segments: number;
        error?: string | null;
      }>;
    }>(env, `/datasets/${datasetId}/documents/${encodeURIComponent(batch)}/indexing-status`, env.DIFY_DATASET_API_KEY);
    return json({
      ok: true,
      mode: 'live',
      data: (result.data || []).map((item) => ({
        id: item.id,
        indexingStatus: item.indexing_status,
        completedSegments: item.completed_segments,
        totalSegments: item.total_segments,
        error: item.error || null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
