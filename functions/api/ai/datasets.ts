import {
  datasetLabels,
  datasetMap,
  difyJson,
  errorResponse,
  isMock,
  json,
  type DatasetSlug,
  type Env,
} from '../../_shared/dify';
import { mockDatasets } from '../../_shared/mock';

interface DifyDataset {
  document_count?: number;
  total_documents?: number;
  total_available_documents?: number;
  word_count?: number;
  updated_at?: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    if (isMock(env)) return json({ ok: true, mode: 'mock', datasets: mockDatasets });

    const entries = Object.entries(datasetMap(env)).filter(([slug, id]) => slug in datasetLabels && id !== 'REPLACE');
    const datasets = await Promise.all(
      entries.map(async ([slug, id]) => {
        const data = await difyJson<DifyDataset>(env, `/datasets/${id}`, env.DIFY_DATASET_API_KEY);
        return {
          slug,
          name: datasetLabels[slug as DatasetSlug],
          documents: data.total_documents ?? data.document_count ?? 0,
          available: data.total_available_documents ?? 0,
          words: data.word_count ?? 0,
          updatedAt: data.updated_at ? new Date(data.updated_at * 1000).toISOString().slice(0, 10) : null,
        };
      }),
    );
    return json({ ok: true, mode: 'live', datasets });
  } catch (error) {
    return errorResponse(error);
  }
};
