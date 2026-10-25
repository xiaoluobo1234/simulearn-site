import normalInput from '../../public/downloads/csv-checker/normal.csv?raw';
import missingFieldInput from '../../public/downloads/csv-checker/missing-field.csv?raw';
import nonNumericInput from '../../public/downloads/csv-checker/non-numeric.csv?raw';
import missingUnitInput from '../../public/downloads/csv-checker/missing-unit.csv?raw';

/** Fixed public teaching inputs. None represents a learner's completed run. */
export const csvProjectVersion = 'csv-checker-v1';
export const csvProjectCases = [
  {
    id: 'normal', title: '字段与数值正常',
    description: '明确列名、四个参数和约定单位，先区分原始字符串与解析后的数值。',
    input: normalInput, href: '/downloads/csv-checker/normal.csv',
    expected: ['显示表头与前三条原始数据。', '读取 4 行；检查发现 0 项问题。', '程序完成并不证明工程模型有效。'],
  },
  {
    id: 'missing-field', title: '缺少必填字段',
    description: '整个文件没有 unit 列；与某一行单位为空分别处理。',
    input: missingFieldInput, href: '/downloads/csv-checker/missing-field.csv',
    expected: ['抛出 ValueError，指出缺少表头 unit。', '本机进程退出非零；浏览器运行状态为 error。'],
  },
  {
    id: 'non-numeric', title: '数值列出现文本',
    description: 'A 的 value 为 abc，保留原文并指出对应物理行。',
    input: nonNumericInput, href: '/downloads/csv-checker/non-numeric.csv',
    expected: ['读取 4 行；检查发现 1 项问题。', "第 3 行: value='abc' 无法解析为有限数值。", '检查程序正常结束，数据仍有问题；浏览器可能显示 succeeded。'],
  },
  {
    id: 'missing-unit', title: '一行单位缺失',
    description: 'unit 列存在，但 E 行的单位为空；不自行猜测或补齐。',
    input: missingUnitInput, href: '/downloads/csv-checker/missing-unit.csv',
    expected: ['读取 4 行；检查发现 1 项问题。', "第 2 行: 单位 '' 不符合本练习约定，不自动换算。", '检查程序正常结束，数据仍有问题；浏览器可能显示 succeeded。'],
  },
] as const;

export type CsvProjectCase = (typeof csvProjectCases)[number];

/** Select public fixtures only; query input/code never becomes file contents. */
export function readCsvProjectCase(search: string): CsvProjectCase | null {
  const query = new URLSearchParams(search);
  const template = query.getAll('template');
  const selected = query.getAll('case');
  if (template.length !== 1 || template[0] !== 'csv' || selected.length !== 1) return null;
  return csvProjectCases.find(item => item.id === selected[0]) ?? null;
}
