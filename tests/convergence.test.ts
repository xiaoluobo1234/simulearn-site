import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { editConvergenceSource } from '../src/scripts/convergence';
import {
  analyzeConvergence, convergenceCsv, convergenceJson, finiteConvergenceNumber,
  MAX_CONVERGENCE_BYTES, parseConvergenceCsv, type ConvergenceReport,
} from '../src/lib/convergence';

const csv = 'h,value\n4,0.30\n2,0.32\n1,0.33\n';
function report(input: Record<string, string> = {}): ConvergenceReport {
  const result = analyzeConvergence({ csv, target: '端位移', unit: 'mm', hUnit: 'mm', ...input });
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

describe('CSV provenance survives metadata changes', () => {
  it('retains the uploaded filename when only target, unit or reference conditions change', () => {
    const original = '用户选择的本地文件：local-grid.csv；只读取文本，未上传或核验执行者。';
    expect(editConvergenceSource(original, csv, csv)).toBe(original);
    const edited = editConvergenceSource(original, csv, csv.replace('0.33', '0.34'));
    expect(edited).not.toContain('local-grid.csv'); expect(edited).toContain('本页编辑的 CSV');
    expect(editConvergenceSource(edited, 'new CSV', 'new CSV')).toBe(edited);
  });
  it('retains the actual teaching reference provenance for metadata edits and labels changed CSV as derived data', () => {
    const original = '教学示例：Codex AI执行环境中的Python参考计算；CPython 3.12.14；不是用户运行。';
    expect(editConvergenceSource(original, csv, csv)).toBe(original);
    const edited = editConvergenceSource(original, csv, csv + '\n');
    expect(edited).toContain('教学参考示例的 CSV 经本页编辑'); expect(edited).toContain('不代表新增运行证据');
    expect(edited).not.toContain('用户已运行');
  });
});

describe('strict local convergence CSV', () => {
  it('parses real quoted CSV, BOM/CRLF and scientific notation, retaining original strings and line positions', () => {
    const result = parseConvergenceCsv('\uFEFF"h","value"\r\n4e0,"3.0e-1"\r\n2e0,.32\r\n1e0,+.33\r\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows).toHaveLength(3);
      expect(result.data.rows[0]).toEqual({ line: 2, hText: '4e0', valueText: '3.0e-1', h: 4, value: 0.3 });
      expect(result.data.wasReordered).toBe(false);
    }
    for (const raw of ['', ' ', 'NaN', 'Infinity', '-Infinity', '0x10', '0b10', '2 mm', '1,000', '2e', '1e309', '--1', '1.2junk']) expect(finiteConvergenceNumber(raw)).toBeNull();
    expect(finiteConvergenceNumber(' -1.5e+2 ')).toBe(-150);
  });
  it('reports malformed headers and exact bad numeric row/column, never silently skipping data', () => {
    const cases = [
      ['H,value\n4,1\n2,2\n1,3', 1, 1], ['h,wrong\n4,1\n2,2\n1,3', 1, 3],
      ['h,value,extra\n4,1\n2,2\n1,3', 1, 9], ['h,value\n4,1\n2,2\n1,NaN', 4, 3],
      ['h,value\n4,1\n2,2\n1,', 4, 3], ['h,value\n4,1\n2,2\n0,3', 4, 1],
      ['h,value\n4,1\n2,2\n-1,3', 4, 1], ['h,value\n4,1\n2,2\n1,3,4', 4, 5],
      ['h,value\n4,1\n2,2\n1,"3"x', 4, 6], ['h,value\n4,1\n2,2\n1,"3\n4"', 4, 5],
    ] as const;
    for (const [raw, line, column] of cases) expect(parseConvergenceCsv(raw)).toMatchObject({ ok: false, error: { line, column } });
    expect(parseConvergenceCsv('h,value\n4,1\n2,2\n1,"3')).toMatchObject({ ok: false });
    expect(parseConvergenceCsv('h,value\n4,1\n2,2')).toMatchObject({ ok: false, error: { message: expect.stringContaining('至少') } });
  });
  it('rejects numerically duplicate h and sorts coarse to fine without losing the original order', () => {
    expect(parseConvergenceCsv('h,value\n4,1\n2,2\n2e0,3')).toMatchObject({ ok: false, error: { line: 4, column: 1, message: expect.stringContaining('重复') } });
    const result = parseConvergenceCsv('h,value\n1,3\n4,1\n2,2');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows.map(row => row.h)).toEqual([1, 4, 2]);
      expect(result.data.sortedRows.map(row => row.h)).toEqual([4, 2, 1]);
      expect(result.data.sortedRows.map(row => row.line)).toEqual([3, 4, 2]);
      expect(result.data.wasReordered).toBe(true);
    }
  });
  it('enforces both UTF8 byte limits and a thousand data rows', () => {
    expect(parseConvergenceCsv('数'.repeat(MAX_CONVERGENCE_BYTES / 2))).toMatchObject({ ok: false, error: { message: expect.stringContaining('256 KiB') } });
    const thousand = 'h,value\n' + Array.from({ length: 1000 }, (_, index) => `${1000 - index},${index}`).join('\n');
    expect(parseConvergenceCsv(thousand).ok).toBe(true);
    expect(parseConvergenceCsv(thousand + '\n0.5,1001')).toMatchObject({ ok: false, error: { message: expect.stringContaining('1000') } });
  });
});

describe('explicit definitions and no automatic engineering judgment', () => {
  it('uses the finer value denominator, distinct from optional error to reference', () => {
    const data = report({ reference: '0.34' });
    expect(data.rows[0].adjacentAbsoluteChange).toBeNull();
    expect(data.rows[1].adjacentAbsoluteChange).toBeCloseTo(0.02, 14);
    expect(data.rows[1].adjacentRelativeChange).toBeCloseTo(0.02 / 0.32, 14);
    expect(data.rows[2].absoluteError).toBeCloseTo(0.01, 14);
    expect(data.rows[2].relativeError).toBeCloseTo(0.01 / 0.34, 14);
    expect(data.rows[2].adjacentRelativeChange).not.toBe(data.rows[2].relativeError);
  });
  it('leaves relative values unavailable for zero denominators and all reference errors absent when no reference', () => {
    const zero = report({ csv: 'h,value\n4,2\n2,-1\n1,0', reference: '0' });
    expect(zero.rows[2].adjacentAbsoluteChange).toBe(1);
    expect(zero.rows[2].adjacentRelativeChange).toBeNull();
    expect(zero.rows[2].absoluteError).toBe(0);
    expect(zero.rows.every(row => row.relativeError === null)).toBe(true);
    expect(report().rows.every(row => row.absoluteError === null && row.relativeError === null)).toBe(true);
  });
  it('handles negative references and overflowing differences without inventing zero or Infinity metrics', () => {
    const negative = report({ csv: 'h,value\n4,-2\n2,-2.5\n1,-3', reference: '-4' });
    expect(negative.rows[2].absoluteError).toBe(1); expect(negative.rows[2].relativeError).toBe(0.25);
    const extreme = report({ csv: 'h,value\n1e308,-1e308\n1e1,1e308\n1e-308,1', reference: '0' });
    expect(extreme.rows[1].adjacentAbsoluteChange).toBeNull();
    expect(extreme.rows[1].adjacentRelativeChange).toBeNull();
    expect(extreme.rows[2].adjacentRelativeChange).toBe(1e308);
    expect(convergenceJson(extreme, '用户输入')).not.toContain('Infinity');
  });
  it('requires the target and unit explicitly, validates references and never declares convergence', () => {
    for (const input of [{ target: '' }, { unit: '' }, { reference: '0 mm' }, { reference: 'NaN' }, { reference: '1e309' }]) expect(analyzeConvergence({ csv, target: '位移', unit: 'mm', ...input }).ok).toBe(false);
    const constant = report({ csv: 'h,value\n4,1\n2,1\n1,1', unit: '自定义单位（未核验）' });
    expect(constant.rows[2].adjacentRelativeChange).toBe(0);
    expect(constant).not.toHaveProperty('converged'); expect(constant).not.toHaveProperty('passed'); expect(constant).not.toHaveProperty('order');
    expect(constant.logs.join(' ')).toContain('不设置统一百分比阈值');
    expect(constant.unit).toBe('自定义单位（未核验）');
  });
  it('exports raw values, original ordering, unit/reference/condition logs and neutralizes spreadsheet formulas', () => {
    const data = report({ csv: 'h,value\n1,+.33\n4,3.0e-1\n2,.32', reference: '.34', conditions: '同一模型与提取位置', target: '=HYPERLINK("https://example.com")' });
    const json = JSON.parse(convergenceJson(data, '未核验用户输入'));
    expect(json.report.originalRows[0].valueText).toBe('+.33');
    expect(json.report.rows[0].line).toBe(3); expect(json.report.wasReordered).toBe(true);
    expect(json.report.conditions).toBe('同一模型与提取位置'); expect(json.report.logs).toHaveLength(8);
    const exported = convergenceCsv(data, '未核验用户输入');
    expect(exported).toContain('h_raw,value_raw'); expect(exported).toContain('analysis_log');
    expect(exported).toContain('"\'=HYPERLINK'); expect(exported).toContain('"+.33"');
    expect(exported).toContain('同一模型与提取位置');
  });
  it('uses the existing actual Python variable-bar reference unchanged and independently checks its comparison', () => {
    const reference = JSON.parse(readFileSync(new URL('../public/downloads/mechanics-foundations/reference-results.json', import.meta.url), 'utf8'));
    const sample = readFileSync(new URL('../public/downloads/convergence/variable-bar.csv', import.meta.url), 'utf8');
    const data = report({ csv: sample, reference: String(reference.variable_area_bar.exact_tip_mm) });
    expect(data.rows.map(row => row.value)).toEqual(reference.variable_area_bar.meshes.map((row: any) => row.tip_mm));
    expect(data.rows.map(row => row.h)).toEqual([1000, 500, 250, 125, 62.5]);
    expect(data.rows[1].adjacentRelativeChange).toBeCloseTo(1 / 36, 13);
    expect(data.rows.at(-1)!.relativeError).toBeCloseTo(0.000175960073697, 14);
    expect(reference.execution.python_version).toBe('3.12.14');
    expect(data).not.toHaveProperty('executor');
  });
});
