import {
  ApiError,
  assertSameOrigin,
  datasetLabels,
  difyJson,
  errorResponse,
  isMock,
  json,
  userId,
  validateFile,
  type DatasetSlug,
  type Env,
} from '../../_shared/dify';
import { mockAnalysis } from '../../_shared/mock';

interface UploadResponse {
  id: string;
}

interface WorkflowResponse {
  data?: {
    status?: string;
    outputs?: Record<string, unknown>;
    error?: string | null;
  };
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, 12);
  if (typeof value === 'string') return value.split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 12);
  return [];
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const file = validateFile(form.get('file'), env);
    if (isMock(env)) return json({ ok: true, mode: 'mock', analysis: mockAnalysis(file.name) });

    const user = await userId(request);
    const uploadForm = new FormData();
    uploadForm.set('file', file, file.name);
    uploadForm.set('user', user);
    const uploaded = await difyJson<UploadResponse>(
      env,
      '/files/upload',
      env.DIFY_REVIEW_APP_API_KEY,
      { method: 'POST', body: uploadForm },
    );

    const inputName = env.DIFY_REVIEW_FILE_INPUT || 'documents';
    const workflow = await difyJson<WorkflowResponse>(
      env,
      '/workflows/run',
      env.DIFY_REVIEW_APP_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: {
            [inputName]: [
              {
                type: 'document',
                transfer_method: 'local_file',
                upload_file_id: uploaded.id,
              },
            ],
            filename: file.name,
          },
          response_mode: 'blocking',
          user,
        }),
      },
    );

    if (workflow.data?.status !== 'succeeded') {
      throw new ApiError(workflow.data?.error || '文档整理工作流未成功完成。', 502);
    }
    const outputs = workflow.data.outputs || {};
    const category = String(outputs.category || 'review') as DatasetSlug;
    return json({
      ok: true,
      mode: 'live',
      analysis: {
        summary: String(outputs.summary || '工作流未返回摘要。'),
        category: category in datasetLabels ? category : 'review',
        categoryLabel: category in datasetLabels ? datasetLabels[category] : datasetLabels.review,
        tags: normalizeTags(outputs.tags),
        sensitivity: String(outputs.sensitivity || '需要人工检查敏感信息。'),
        copyrightRisk: String(outputs.copyright_risk || outputs.copyrightRisk || '需要人工检查版权状态。'),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
