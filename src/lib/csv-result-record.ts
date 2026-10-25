import csvCode from '../../public/downloads/python-lab/csv_check.py?raw';
import { csvProjectCases, csvProjectVersion, type CsvProjectCase } from './csv-project';
import type { LabResult } from './python-lab';
import { createStudyEvidence, type EvidenceRead, type StudyEvidence } from './study-evidence';

export const MAX_CSV_RESULT_BYTES = 30 * 1024;
const FIELD_LIMIT = 32_000;
// Leave room for the ordinary editor's request envelope below the 128 KiB API cap.
const MAX_INITIAL_REQUEST_BYTES = 120 * 1024;
const encoder = new TextEncoder();
const normalizeLines = (value: string) => value.replace(/\r\n/g, '\n');

export interface CsvResultStudyDraft {
  kind: 'record';
  title: string;
  fields: Record<string, string>;
  sourceIds: [];
  noteIds: [];
  learningStatus: 'not-started';
  reviewStatus: 'draft';
  visibility: 'private';
}

export interface CsvResultDraft {
  evidence: StudyEvidence;
  result: LabResult;
  templateMatch: boolean;
  caseId: CsvProjectCase['id'] | null;
  item: CsvResultStudyDraft;
}

/**
 * Converts a selected, untrusted result into a new private draft only.
 * Validation and hashing do not run Python, authenticate a file's author,
 * confirm its output, or infer personal learning dates and progress.
 */
export async function createCsvResultDraft(bytes: Uint8Array, fileName: string, importedAt: string): Promise<EvidenceRead<CsvResultDraft>> {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > MAX_CSV_RESULT_BYTES) {
    return { ok: false, error: 'Python 结果文件须为非空 UTF-8 JSON，最多 30 KiB；没有裁剪或导入内容。' };
  }
  // Copy before the first await, including when the caller reuses a file buffer.
  const selectedBytes = new Uint8Array(bytes);
  const checked = await createStudyEvidence(selectedBytes, fileName, importedAt);
  if (!checked.ok) return checked;
  if (checked.value.kind !== 'python') return { ok: false, error: '这里只接收站内 Python 结果 JSON；装配实验结果不能作为 CSV 学习记录导入。' };

  // createStudyEvidence has already checked exact JSON fields, safe prototypes,
  // final states, declared environments, timestamps, lengths and strict UTF-8.
  const result = JSON.parse(checked.value.originalText.replace(/^\uFEFF/, '')) as LabResult;
  const templateMatch = normalizeLines(result.code) === normalizeLines(csvCode);
  // An input only identifies a teaching case when the current CSV code matches.
  const selectedCase = templateMatch ? csvProjectCases.find(item => normalizeLines(item.input) === normalizeLines(result.input)) : undefined;
  const caseId = selectedCase?.id ?? null;
  const comparison = !templateMatch
    ? '代码与当前 CSV 检查模板不同；是否属于 CSV 实验待本人核对，未套用固定案例预期。'
    : selectedCase
      ? `代码与当前 CSV 模板一致，输入与固定案例「${selectedCase.title}」一致（仅规范 CRLF）。`
      : '代码与当前 CSV 模板一致，输入与四份固定案例均不同（仅规范 CRLF）。';
  const scope = '这里只核对文件格式及代码、输入文本；未执行代码，未核验作者、输出、运行历史或 CSV 合格性。文件声明 succeeded 只表示所述程序结束，不证明 CSV 检查通过、用户本人运行、本机复现、掌握或工程有效。';
  const evidence: StudyEvidence = {
    ...checked.value,
    // The shared parser also supports the axial-bar guide. This workflow never
    // applies that guide's model comparison to an imported Python/CSV record.
    modelMatch: 'not-determined',
    summary: `文件声明状态：${result.state}；${result.environment ? '文件含 Python 环境声明' : '未提供已加载环境，未确认代码运行'}。${comparison}${scope}`,
  };
  const metadata = {
    schemaVersion: 1,
    kind: 'csv-result-import',
    trust: 'unverified-imported-file',
    fileName: evidence.fileName,
    sha256: evidence.sha256,
    sizeBytes: evidence.sizeBytes,
    importedAt: evidence.importedAt,
    declaredExecutor: result.executor,
    declaredState: result.state,
    declaredEnvironment: result.environment,
    declaredStartedAt: result.startedAt,
    declaredFinishedAt: result.finishedAt,
    declaredElapsedMs: result.elapsedMs,
    comparedInputContractVersion: csvProjectVersion,
    templateMatch,
    caseId,
    comparison,
    scope,
  };
  const item: CsvResultStudyDraft = {
    kind: 'record',
    title: selectedCase ? `CSV 结果归档｜${selectedCase.title}（待本人核对）` : 'Python 结果归档（CSV 关联待本人核对）',
    fields: {
      date: '', organizedDate: '', recordType: '实验',
      project: templateMatch ? '工程参数 CSV 检查器（第一阶段）' : '工程参数 CSV 检查器（关联待本人核对）',
      problem: '', attempts: '', planned: '', expected: '', expectedOutput: '',
      understanding: '', misconceptions: '', uncertainties: '', nextTask: '', doneWhen: '',
      executor: `文件声明执行者：${result.executor}；${result.environment ? `文件声明环境：${result.environment}` : '文件未提供已加载环境'}。待本人确认；未确认用户本机执行。`,
      reproduction: '文件声明待本人核对；未确认本人运行或独立复现。',
      code: result.code,
      input: result.input,
      actualOutput: `以下仅为文件声明的输出，未核验。状态：${result.state}；程序结束不等于 CSV 合格。\n\n[stdout / 文件声明的标准输出]\n${result.stdout}\n\n[stderr / 文件声明的错误输出]\n${result.stderr}\n\n[value / 文件声明的表达式返回值]\n${result.value}`,
      evidence: `已选文件：${evidence.fileName}\n原始字节：${evidence.sizeBytes}\nSHA-256：${evidence.sha256}\n本次导入时间：${evidence.importedAt}\n未核验的文件声明；原始 JSON 保存在 csvResultOriginal，来源元数据保存在 csvResultMetadata。`,
      conditions: templateMatch ? '仅按当前 CSV 教学格式比较代码与输入；固定单位标记不自动转换，未验证工程模型。' : '是否属于 CSV 练习及其输入条件，待本人核对；未应用固定 CSV 案例或轴杆模型假设。',
      untested: '本页未执行导入代码，未重算或验证文件所述输出；本人实际复现和理解尚待另行记录。',
      body: `文件归档草稿，待本人核对。\n\n${comparison}\n\n${scope}\n\n学习日期、实际尝试、个人理解与下一项任务留空，须由本人按实际经历补充。原始文件和元数据随本记录的 JSON 导出保留。`,
      csvResultOriginal: evidence.originalText,
      csvResultMetadata: JSON.stringify(metadata, null, 2),
    },
    sourceIds: [], noteIds: [],
    learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private',
  };
  if (Object.keys(item.fields).length > 48 || Object.values(item.fields).some(value => value.length > FIELD_LIMIT)
    || encoder.encode(JSON.stringify({ item })).byteLength > MAX_INITIAL_REQUEST_BYTES) {
    return { ok: false, error: '结果展开后的学习记录超过保存上限；没有裁剪原文或创建草稿，请保留原文件并缩小实验输出。' };
  }
  return { ok: true, value: { evidence, result, templateMatch, caseId, item } };
}
