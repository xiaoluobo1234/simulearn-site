import { datasetLabels, type DatasetSlug } from './dify';

export const mockDatasets = [
  { slug: 'structural', name: datasetLabels.structural, documents: 24, words: 186420, available: 23, updatedAt: '2026-06-27' },
  { slug: 'thermal', name: datasetLabels.thermal, documents: 8, words: 51720, available: 8, updatedAt: '2026-06-26' },
  { slug: 'fluids', name: datasetLabels.fluids, documents: 5, words: 28490, available: 5, updatedAt: '2026-06-24' },
  { slug: 'multiphysics', name: datasetLabels.multiphysics, documents: 7, words: 43600, available: 6, updatedAt: '2026-06-25' },
  { slug: 'chip', name: datasetLabels.chip, documents: 3, words: 18200, available: 3, updatedAt: '2026-06-22' },
  { slug: 'private', name: datasetLabels.private, documents: 12, words: 99040, available: 0, updatedAt: '2026-06-27' },
  { slug: 'review', name: datasetLabels.review, documents: 2, words: 12600, available: 0, updatedAt: '2026-06-27' },
  { slug: 'books', name: datasetLabels.books, documents: 0, words: 0, available: 0, updatedAt: '2026-06-29' },
];

export function mockAnalysis(filename: string) {
  const name = filename.toLowerCase();
  let category: DatasetSlug = 'structural';
  if (/芯片|封装|bga|tcad|chip/.test(name)) category = 'chip';
  else if (/流体|流场|cfd|fluent|冷板/.test(name)) category = 'fluids';
  else if (/传热|温度|热阻|thermal/.test(name)) category = 'thermal';
  else if (/耦合|多物理|fsi|multiphysics/.test(name)) category = 'multiphysics';

  return {
    summary: `这是「${filename}」的本地演示分析。连接 Dify 后，此处将由文档提取器和 DeepSeek 生成真实摘要。`,
    category,
    categoryLabel: datasetLabels[category],
    tags: ['待核对', '仿真资料', category],
    sensitivity: '需要人工确认是否包含项目名称、几何尺寸、载荷或客户信息。',
    copyrightRisk: filename.toLowerCase().endsWith('.pdf')
      ? 'PDF 可能是第三方论文，公开前需确认版权；建议只发布引用、摘要与个人笔记。'
      : '未自动发现明确版权风险，仍需人工审核。',
  };
}
