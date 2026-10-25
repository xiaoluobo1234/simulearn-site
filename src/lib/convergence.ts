export const MAX_CONVERGENCE_BYTES = 256 * 1024;
export const MAX_CONVERGENCE_ROWS = 1000;
export interface CsvIssue { message: string; line: number; column: number }
export type ConvergenceResult<T> = { ok: true; data: T } | { ok: false; error: CsvIssue };
export interface ConvergenceInputRow { line: number; hText: string; valueText: string; h: number; value: number }
export interface ParsedConvergenceCsv { rows: ConvergenceInputRow[]; sortedRows: ConvergenceInputRow[]; wasReordered: boolean }
export interface ConvergenceRow extends ConvergenceInputRow {
  rank: number; adjacentAbsoluteChange: number | null; adjacentRelativeChange: number | null;
  absoluteError: number | null; relativeError: number | null;
}
export interface ConvergenceReport {
  version: 1; target: string; unit: string; hUnit: string; conditions: string;
  reference: number | null; referenceText: string; rawCsv: string;
  originalRows: ConvergenceInputRow[]; rows: ConvergenceRow[]; wasReordered: boolean; logs: string[];
}
export interface ConvergenceRequest { csv: string; target: string; unit: string; reference?: string; hUnit?: string; conditions?: string }
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const issue = (message: string, line = 1, column = 1): { ok: false; error: CsvIssue } => ({ ok: false, error: { message, line, column } });

export function finiteConvergenceNumber(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim() || !DECIMAL.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isFinite(number) ? number : null;
}

/** Small strict CSV dialect: commas, optional quotes, CRLF/LF; numeric fields cannot span lines. */
export function parseConvergenceCsv(raw: string): ConvergenceResult<ParsedConvergenceCsv> {
  if (typeof raw !== 'string' || raw.length > MAX_CONVERGENCE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_CONVERGENCE_BYTES) return issue('CSV 文本不能超过 256 KiB。');
  const input = raw.replace(/^\uFEFF/, '');
  if (!input.trim()) return issue('请提供含 h,value 表头和至少三档网格的 CSV。');
  const records: Array<{ line: number; cells: Array<{ text: string; column: number }> }> = [];
  let cells: Array<{ text: string; column: number }> = [], cell = '', line = 1, column = 1, startColumn = 1, startLine = 1;
  let quoted = false, afterQuote = false, started = false;
  const endCell = () => { cells.push({ text: cell, column: startColumn }); cell = ''; afterQuote = false; started = false; };
  const endRow = () => { endCell(); records.push({ line: startLine, cells }); cells = []; startLine = line + 1; };
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"') { if (input[index + 1] === '"') { cell += '"'; index++; column++; } else { quoted = false; afterQuote = true; } }
      else if (char === '\r' || char === '\n') return issue('h 和 value 字段不能跨行。', line, column);
      else cell += char;
    } else if (char === ',') { endCell(); startColumn = column + 1; }
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[index + 1] === '\n') index++;
      endRow(); line++; column = 0; startColumn = 1;
      if (records.length > MAX_CONVERGENCE_ROWS + 1) return issue('最多支持 1000 行网格数据。', line - 1, 1);
    } else if (afterQuote) {
      if (char !== ' ' && char !== '\t') return issue('结束引号后只能有逗号或行尾。', line, column);
    } else if (char === '"') {
      if (started || cell.length) return issue('引号只能位于字段开头。', line, column);
      quoted = true; started = true;
    } else { cell += char; started = true; }
    column++;
  }
  if (quoted) return issue('CSV 引号未闭合。', line, column);
  if (cells.length || cell.length || started || afterQuote) { endCell(); records.push({ line: startLine, cells }); }
  const header = records[0];
  if (!header || header.cells.length !== 2) return issue('表头必须恰好两列：h,value。', 1, header?.cells[2]?.column || 1);
  for (const [index, name] of ['h', 'value'].entries()) if (header.cells[index].text.trim() !== name) return issue(`第 ${index + 1} 列表头应为 ${name}（区分大小写）。`, 1, header.cells[index].column);
  if (records.length - 1 > MAX_CONVERGENCE_ROWS) return issue('最多支持 1000 行网格数据。', records[MAX_CONVERGENCE_ROWS + 1].line, 1);
  if (records.length < 4) return issue('至少需要三档不同的正网格尺寸 h。', records.at(-1)?.line || 1, 1);
  const rows: ConvergenceInputRow[] = [], seen = new Map<number, number>();
  for (const record of records.slice(1)) {
    if (record.cells.length !== 2) return issue('每行必须恰好两列：h,value。', record.line, record.cells[2]?.column || record.cells.at(-1)?.column || 1);
    const h = finiteConvergenceNumber(record.cells[0].text), value = finiteConvergenceNumber(record.cells[1].text);
    if (h === null || h <= 0) return issue('h 必须是大于零的有限十进制数，可用科学计数。', record.line, record.cells[0].column);
    if (value === null) return issue('value 必须是完整的有限十进制数，不能包含单位、NaN 或 Infinity。', record.line, record.cells[1].column);
    if (seen.has(h)) return issue(`h 重复，与第 ${seen.get(h)} 行相同；不会自动合并。`, record.line, record.cells[0].column);
    seen.set(h, record.line);
    rows.push({ line: record.line, hText: record.cells[0].text, valueText: record.cells[1].text, h, value });
  }
  const sortedRows = [...rows].sort((a, b) => a.h === b.h ? 0 : a.h > b.h ? -1 : 1);
  return { ok: true, data: { rows, sortedRows, wasReordered: sortedRows.some((row, index) => row.line !== rows[index].line) } };
}

function finiteDifference(a: number, b: number): number | null { const value = Math.abs(a - b); return Number.isFinite(value) ? value : null; }
function finiteRatio(a: number | null, denominator: number): number | null {
  if (a === null || denominator === 0) return null;
  const ratio = a / Math.abs(denominator); return Number.isFinite(ratio) ? ratio : null;
}
export function analyzeConvergence(input: ConvergenceRequest): ConvergenceResult<ConvergenceReport> {
  for (const [label, value, limit, required] of [['目标量名称', input.target, 120, true], ['目标量单位', input.unit, 40, true], ['h 单位', input.hUnit || '', 40, false], ['比较条件', input.conditions || '', 2000, false]] as const) {
    if (typeof value !== 'string' || value.length > limit || (required && !value.trim()) || /[\u0000-\u001f\u007f]/.test(value)) return issue(`请显式填写 ${limit} 字以内的${label}；未知单位不作猜测或自动换算。`);
  }
  const parsed = parseConvergenceCsv(input.csv); if (parsed.ok === false) return parsed;
  const referenceText = (input.reference || '').trim();
  const reference = referenceText ? finiteConvergenceNumber(referenceText) : null;
  if (referenceText && reference === null) return issue('解析参考值必须是有限十进制数；没有可靠参考时请留空。');
  const rows = parsed.data.sortedRows.map((row, index): ConvergenceRow => {
    const adjacentAbsoluteChange = index ? finiteDifference(row.value, parsed.data.sortedRows[index - 1].value) : null;
    const absoluteError = reference === null ? null : finiteDifference(row.value, reference);
    return { ...row, rank: index + 1, adjacentAbsoluteChange, adjacentRelativeChange: finiteRatio(adjacentAbsoluteChange, row.value), absoluteError, relativeError: reference === null ? null : finiteRatio(absoluteError, reference) };
  });
  const logs = [
    `输入 ${rows.length} 档；保留原始行号与字符串。${parsed.data.wasReordered ? '已按 h 从大到小重新排序，原顺序另行保留。' : '原输入已按 h 从大到小排序。'}`,
    `目标量：${input.target.trim()}；单位按输入原样记录：${input.unit.trim()}；未检查量纲一致性，未自动换算。`,
    input.hUnit?.trim() ? `h 单位：${input.hUnit.trim()}；需自行确保 h 定义、单位和加密方式一致。` : 'h 单位未提供；不得据此猜测物理尺度，需自行保证各行口径一致。',
    '相邻绝对变化 = abs(细档值−上一粗档值)；相邻相对变化 = abs(细档值−上一粗档值)/abs(细档值)。细档值为 0 时相对变化不可计算。',
    reference === null ? '未提供解析参考值；不计算对参考的误差。' : reference === 0 ? '解析参考值为 0；仅计算绝对误差，相对误差不可计算。' : `对参考绝对误差 = abs(value−${referenceText})；相对误差 = abs(value−参考)/abs(参考)。`,
    '首档没有相邻变化；超出浮点可计算范围的差或比值标为不可计算，不伪造为 0。',
    '本工具不估计误差阶、不设置统一百分比阈值，也不判断已经收敛、工程可信或用户已掌握。',
    `用户填写的比较条件：${input.conditions?.trim() || '未提供；应核对模型、单位、载荷、支承、求解设置与目标量提取位置。'}`,
  ];
  return { ok: true, data: { version: 1, target: input.target.trim(), unit: input.unit.trim(), hUnit: input.hUnit?.trim() || '', conditions: input.conditions?.trim() || '', reference, referenceText, rawCsv: input.csv, originalRows: parsed.data.rows, rows, wasReordered: parsed.data.wasReordered, logs } };
}

const quote = (value: string | number | null) => {
  if (value === null) return '';
  // Preserve numeric signs; prevent nonnumeric metadata becoming spreadsheet formulas.
  const string = typeof value === 'string' && /^[\s]*[=+@-]/.test(value) && finiteConvergenceNumber(value) === null ? `'${value}` : String(value);
  return `"${string.replace(/"/g, '""')}"`;
};
/** A rectangular CSV with explicit numeric units, original values and sort provenance. */
export function convergenceCsv(report: ConvergenceReport, source = ''): string {
  const header = ['sorted_rank', 'original_line', 'h_raw', 'value_raw', 'h', 'value', 'h_unit', 'target', 'unit', 'reference', 'adjacent_absolute_change', 'adjacent_relative_change_fraction', 'absolute_error', 'relative_error_fraction', 'conditions', 'source', 'analysis_log'];
  return header.join(',') + '\r\n' + report.rows.map(row => [row.rank, row.line, row.hText, row.valueText, row.h, row.value, report.hUnit, report.target, report.unit, report.referenceText, row.adjacentAbsoluteChange, row.adjacentRelativeChange, row.absoluteError, row.relativeError, report.conditions, source, report.logs.join('\n')].map(quote).join(',')).join('\r\n') + '\r\n';
}
export function convergenceJson(report: ConvergenceReport, source: string): string {
  return JSON.stringify({ format: 'simulearn-convergence-v1', source, report }, null, 2);
}
