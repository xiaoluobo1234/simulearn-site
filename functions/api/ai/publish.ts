import {
  ApiError,
  assertSameOrigin,
  datasetLabels,
  difyJson,
  errorResponse,
  isMock,
  json,
  requireDataset,
  validateFile,
  type DatasetSlug,
  type Env,
} from '../../_shared/dify';

interface CreateDocumentResponse {
  document?: { id?: string; name?: string; indexing_status?: string };
  batch?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const file = validateFile(form.get('file'), env);
    const slug = String(form.get('dataset') || '');
    if (!(slug in datasetLabels)) throw new ApiError('请选择目标知识库。', 400);

    if (isMock(env)) {
      return json({
        ok: true,
        mode: 'mock',
        document: { id: 'mock-document', name: file.name, indexingStatus: 'indexing' },
        batch: `mock-${Date.now()}`,
        dataset: { slug, name: datasetLabels[slug as DatasetSlug] },
      });
    }

    const datasetId = requireDataset(env, slug);
    const upload = new FormData();
    upload.set('file', file, file.name);
    upload.set(
      'data',
      JSON.stringify({
        indexing_technique: 'high_quality',
        doc_form: 'text_model',
        doc_language: 'Chinese',
        process_rule: { mode: 'automatic' },
      }),
    );
    const created = await difyJson<CreateDocumentResponse>(
      env,
      `/datasets/${datasetId}/document/create-by-file`,
      env.DIFY_DATASET_API_KEY,
      { method: 'POST', body: upload },
    );
    if (!created.batch) throw new ApiError('Dify 未返回索引批次号。', 502);

    return json({
      ok: true,
      mode: 'live',
      document: {
        id: created.document?.id,
        name: created.document?.name || file.name,
        indexingStatus: created.document?.indexing_status || 'indexing',
      },
      batch: created.batch,
      dataset: { slug, name: datasetLabels[slug as DatasetSlug] },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
