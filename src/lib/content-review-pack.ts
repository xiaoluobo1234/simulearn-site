import type { ContentProvenance } from '../data/content-provenance';

export const REVIEW_REPOSITORY = 'https://github.com/xiaoluobo1234/simulearn-site';
export const REVIEW_SCOPE = '教程模块人工审核草稿；构建参考计算、代码测试、本人学习与人工内容审核分别记录。下载或填写此模板不会批准发布，也不会写入服务器。';
export const REVIEW_AUTOMATION_SCOPE = '构建程序仅重跑三套教材参考，比较端位移、支反力、应变能三项目标量，核对输入 SHA-256 与双方自检状态；未逐项验证全部输出，不代表人工审核、本人复现或在线 CAE 验收。';

export interface ReviewSourceFile {
  path: string;
  sha256: string;
  sizeBytes: number;
  committedSha256: string | null;
  matchesCommit: boolean;
  /** Only populated when these exact bytes exist in the recorded HEAD. */
  commitUrl: string | null;
}
export interface ReviewCheck { id: string; question: string; result: 'not-reviewed'; note: null }
export interface HumanReviewDraft {
  state: 'pending';
  reviewer: null;
  reviewedAt: null;
  conclusion: null;
  notes: null;
  boundContentVersion: string;
  boundFingerprint: string;
}
export interface ContentReviewItem {
  id: string; title: string; href: string; contentVersion: string; sourcePath: string;
  fingerprint: string;
  files: ReviewSourceFile[];
  checks: ReviewCheck[];
  humanReview: HumanReviewDraft;
}
export interface ReviewAutomation {
  status: 'matched-to-current-files' | 'stale' | 'unavailable' | 'invalid';
  generatedAt: string | null;
  sourceCommit: string | null;
  scope: string;
  cases: { id: string; currentFilesMatch: boolean }[];
}
export interface ContentReviewPack {
  schemaVersion: 1;
  kind: 'human-review-draft';
  generatedAt: string;
  repository: string;
  sourceCommit: string;
  workingTree: 'clean' | 'modified';
  scope: string;
  instructions: string[];
  publication: { state: 'pending-human-review'; approved: false };
  stackedPullRequests: { number: number; url: string; scope: string }[];
  items: ContentReviewItem[];
  automatedEvidence: ReviewAutomation;
}

export const REVIEW_INSTRUCTIONS = [
  '这是空白审核模板。请由实际审核人逐项核对后填写 reviewer、reviewedAt、conclusion、notes 以及 checks 的实际结论，不得由下载、测试通过或 AI 自动填为已审核。',
  '审核结论须同时指向条目的 contentVersion、fingerprint 及文件 SHA-256。内容或附件变化后重新生成审核包并复核变化，不将旧结论自动用于新字节。',
  'sourceCommit 是生成时实际 Git HEAD。workingTree 为 modified 或文件 matchesCommit=false 时，当前字节可能尚未提交，也可能只是工作副本行尾不同；此类文件不提供不相符的提交永久链接。Git clean 也不保证工作副本字节与提交一致，逐文件字段为准。',
  '此包包含公开源码路径、公开内容版本与文件指纹，不包含私人学习记录、答案、代码输入、账户身份或浏览事件。请另行核对打算公开的材料权限。',
  '填写后先在本地保存，再通过原有仓库评审流程登记实际审核范围；本页没有自动提交、发布或修改审核状态的功能。',
];

export const STACKED_REVIEW_PRS = [
  { number: 7, url: `${REVIEW_REPOSITORY}/pull/7`, scope: '力学与有限元基础：10 篇教学草稿及参考计算。' },
  { number: 8, url: `${REVIEW_REPOSITORY}/pull/8`, scope: '仿真诊断与私人失败复盘：线索、核查、修复建议与复测记录。' },
  { number: 9, url: `${REVIEW_REPOSITORY}/pull/9`, scope: '线性静力项目：6 阶段课程、3 套教学基准、练习与离线代码包。' },
  { number: 10, url: `${REVIEW_REPOSITORY}/pull/10`, scope: '学习实验室、下一项任务、内容版本、构建证据与可选本地活动。' },
  { number: 11, url: `${REVIEW_REPOSITORY}/pull/11`, scope: '首次试学引导、对应版本的反馈与人工内容审核包。' },
  { number: 12, url: `${REVIEW_REPOSITORY}/pull/12`, scope: '私人试学 JSON 恢复与本地实验文件归档。' },
  { number: 13, url: `${REVIEW_REPOSITORY}/pull/13`, scope: '复盘备份恢复、试学观察起稿与另存私人复盘。' },
];

/** Review paths come from this repository's catalog; reject traversal before filesystem access. */
export function assertReviewPath(path: string): void {
  if (!/^(?:src|public|docs|scripts)\/[A-Za-z0-9/_.\[\]-]+$/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid review source path: ${path}`);
  }
}

/** Multiple files bind the visible explanation to its real algorithms, inputs and references. */
export function reviewSourcePaths(item: ContentProvenance): string[] {
  const paths = [item.sourcePath, 'src/data/content-provenance.ts'];
  if (item.id === 'guide:first-study') paths.push(
    'src/data/first-study-guide.ts', 'src/lib/first-study-guide.ts', 'src/scripts/first-study-guide.ts', 'src/styles/first-study-guide.css',
    'src/lib/first-study-backup.ts', 'src/lib/study-evidence.ts',
    'src/pages/failures/review.astro', 'src/lib/failure-review.ts', 'src/lib/failure-review-import.ts', 'src/scripts/failure-review.ts', 'src/styles/diagnostics.css', 'src/data/diagnostics.ts',
    'src/lib/assembly-lab.ts', 'src/lib/python-lab.ts',
    'public/downloads/python-lab/axial_bar.py', 'public/downloads/python-lab/bar-input.json',
    'src/data/linear-static-benchmarks.ts', 'src/lib/project-practice.ts',
    'public/downloads/linear-static/uniform-bar/input.json', 'public/downloads/linear-static/uniform-bar/verify.py', 'public/downloads/linear-static/uniform-bar/reference-results.json',
  );
  else if (item.id === 'project:linear-static') paths.push(
    'src/pages/learning/projects/linear-static.astro', 'src/data/linear-static-benchmarks.ts',
    'src/lib/project-practice.ts', 'src/scripts/project-practice.ts',
    'public/downloads/linear-static-exercises/exercise.py', 'public/downloads/linear-static-exercises/reference_solution.py',
    'public/downloads/linear-static-exercises/run_tests.py', 'public/downloads/linear-static-exercises/fixtures.json',
    'public/downloads/linear-static-exercises/reference-check-results.json', 'public/downloads/linear-static-exercises/README.md',
    'public/downloads/linear-static-exercises/code-practice.zip', 'public/downloads/linear-static-exercises/SHA256SUMS.txt',
  );
  else if (item.id.startsWith('benchmark:')) {
    const slug = item.id.slice('benchmark:'.length);
    if (!['uniform-bar', 'stepped-bar', 'cantilever-beam'].includes(slug)) throw new Error(`Unknown review benchmark: ${slug}`);
    paths.push('src/pages/cases/benchmarks/[slug].astro', 'scripts/verify-learning-evidence.mjs', `public/downloads/linear-static/${slug}.zip`);
    for (const file of ['input.json', 'verify.py', 'reference-results.json', 'README.md']) paths.push(`public/downloads/linear-static/${slug}/${file}`);
  } else if (item.id.startsWith('foundation:')) paths.push(
    'src/data/structural-foundations.ts', 'src/pages/domains/kp.astro',
    'public/downloads/mechanics-foundations/verify_basics.py', 'public/downloads/mechanics-foundations/reference-results.json',
    'public/downloads/mechanics-foundations/verify_extensions.py', 'public/downloads/mechanics-foundations/reference-extensions.json',
    'public/downloads/mechanics-foundations/README.md', 'public/downloads/mechanics-foundations/EXTENSIONS.md',
  );
  else if (item.id.startsWith('diagnostic:')) paths.push(
    'src/pages/diagnostic/[slug].astro', 'src/pages/diagnostic.astro', 'src/scripts/diagnostic-hub.ts',
    'src/pages/failures/review.astro', 'src/lib/failure-review.ts', 'src/scripts/failure-review.ts',
    'src/lib/failure-review-import.ts', 'src/lib/first-study-backup.ts', 'src/lib/first-study-guide.ts', 'src/data/first-study-guide.ts', 'src/lib/study-evidence.ts', 'src/styles/diagnostics.css',
    'src/lib/assembly-lab.ts', 'src/data/linear-static-benchmarks.ts', 'public/downloads/python-lab/axial_bar.py', 'public/downloads/linear-static/uniform-bar/input.json',
  );
  else if (item.id === 'lab:python') paths.push(
    'src/lib/python-lab.ts', 'src/scripts/python-lab.ts', 'src/scripts/python-lab.worker.ts',
    'public/downloads/python-lab/axial_bar.py', 'public/downloads/python-lab/bar-input.json',
    'public/downloads/python-lab/csv_check.py', 'public/downloads/python-lab/sample.csv',
    'public/downloads/python-lab/README.md', 'public/downloads/python-lab/runtime-check.json',
    'public/downloads/python-lab/python-lab.zip', 'public/downloads/python-lab/SHA256SUMS.txt',
    'public/vendor/pyodide/314.0.7/SOURCE.json', 'public/vendor/pyodide/314.0.7/SHA256SUMS.txt',
    'public/vendor/pyodide/314.0.7/pyodide.mjs', 'public/vendor/pyodide/314.0.7/pyodide.asm.mjs',
    'public/vendor/pyodide/314.0.7/pyodide.asm.wasm', 'public/vendor/pyodide/314.0.7/python_stdlib.zip', 'public/vendor/pyodide/314.0.7/pyodide-lock.json',
    'public/vendor/pyodide/314.0.7/LICENSE.pyodide', 'public/vendor/pyodide/314.0.7/LICENSE.python',
    'public/vendor/pyodide/314.0.7/LICENSE.emscripten',
  );
  else if (item.id === 'lab:assembly') paths.push('src/pages/labs/assembly.astro', 'src/scripts/assembly-lab.ts', 'src/styles/assembly-lab.css');
  else if (item.id === 'lab:convergence') paths.push(
    'src/pages/labs/convergence.astro', 'src/scripts/convergence.ts', 'src/styles/convergence.css',
    'public/downloads/convergence/variable-bar.csv', 'public/downloads/convergence/README.md',
    'public/downloads/mechanics-foundations/verify_basics.py', 'public/downloads/mechanics-foundations/reference-results.json',
  );
  else throw new Error(`Missing human review source bundle: ${item.id}`);
  const unique = [...new Set(paths)].sort();
  unique.forEach(assertReviewPath);
  return unique;
}

export function humanReviewChecks(id: string): ReviewCheck[] {
  const checks: [string, string][] = [
    ['engineering-scope', '模型假设、量纲、正方向、软件或运行环境与未验证范围是否准确且完整？'],
    ['sources-and-rights', '引用是否对应实际核对的原始来源、版本和阅读范围；附件、图片与代码是否可按当前方式公开？'],
    ['evidence-and-privacy', '是否区分 AI 参考计算、本人实际操作和拟开展任务；私人记录、账户资料和未授权工程材料是否仍受保护？'],
  ];
  if (id.startsWith('foundation:')) checks.push(['derivation-and-example', '概念推导、单位转换、例题输入与参考输出是否相符；是否避免把特例升级为通用准则？']);
  else if (id.startsWith('diagnostic:')) checks.push(['diagnostic-retest', '现象是否仅作为线索；可能原因、检查证据、修复前提和复测条件是否分开，并保留无法确诊的范围？']);
  else if (id.startsWith('benchmark:') || id === 'project:linear-static') checks.push(['quantities-and-feedback', '同一输入下三项目标量、反力符号、能量单位、容差及代码包是否一致；答案相符是否仍不自动代表掌握、复现或工程验收？']);
  else if (id === 'guide:first-study') checks.push(['first-flow', '固定均匀杆的参数是否在公式、双单元装配及练习中一致；每步是否有可观察输出、下一入口和明确执行环境？']);
  else if (id === 'lab:python') checks.push(['runtime-and-output', '是否真实运行所声明的 Python 版本；登录、失败、停止、超时、输出截断与导出是否明确，且不声称恶意代码隔离？']);
  else if (id === 'lab:assembly') checks.push(['matrix-and-constraints', '共享节点是否累加、非零给定位移是否修正右端项、反力是否用原矩阵恢复；自由系统是否拒绝任意唯一位移？']);
  else if (id === 'lab:convergence') checks.push(['comparison-and-reference', '相邻变化与对参考误差是否分开；零分母、重复网格、排序、原行号和导出是否保留，且不自动宣判收敛？']);
  return checks.map(([key, question]) => ({ id: key, question, result: 'not-reviewed', note: null }));
}

export function serializeContentReviewJson(pack: ContentReviewPack): string { return `${JSON.stringify(pack, null, 2)}\n`; }

/** Untrusted reviewer-facing text cannot become Markdown links, HTML or table columns. */
export function escapeReviewMarkdown(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

export function serializeContentReviewMarkdown(pack: ContentReviewPack): string {
  const text = escapeReviewMarkdown;
  const lines = [
    '# SimuLearn 教学内容人工审核包', '',
    `生成时间：${text(pack.generatedAt)}。源码提交：${pack.sourceCommit}。工作树：${pack.workingTree}。`, '',
    pack.scope, '',
    '**发布状态：待人工审核。审核人、审核日期与结论均未填写。**', '',
    ...pack.instructions.map(instruction => `- ${text(instruction)}`), '',
    '## 已有堆叠 PR 范围', '',
    ...pack.stackedPullRequests.map(pr => `- [PR #${pr.number}](${pr.url})：${text(pr.scope)}`), '',
    '以上为已登记的前序 PR 范围；列入清单不代表相应内容已经审核或发布。当前审核工具自身也不能代替人工审核。', '',
    '## 构建参考证据（独立于人工审核）', '',
    `状态：${pack.automatedEvidence.status}；生成时间：${text(pack.automatedEvidence.generatedAt ?? '未取得')}。`, '',
    pack.automatedEvidence.scope, '',
    '## 逐项人工核对', '',
  ];
  for (const item of pack.items) {
    lines.push(
      `### ${text(item.title)}`, '',
      `- 内容 ID：${text(item.id)}`, `- 页面：[${text(item.href)}](${item.href})`,
      `- 内容版本：${text(item.contentVersion)}`, `- 文件集合 SHA-256：${item.fingerprint}`,
      '- 审核状态：待审核', '- 实际审核人：未填写', '- 实际审核日期：未填写', '- 实际审核结论：未填写', '- 实际审核范围、问题及依据：未填写', '',
      ...item.checks.map(check => `- [ ] ${text(check.question)}（实际结论及依据：未填写）`), '',
      '| 当前文件 | 当前字节 SHA-256 | 与源码提交相同 | 永久链接 |',
      '| --- | --- | --- | --- |',
      ...item.files.map(file => `| ${text(file.path)} | ${file.sha256} | ${file.matchesCommit ? '是' : '否（字节或行尾不同，或尚未入库）'} | ${file.commitUrl ? `[对应提交](${file.commitUrl})` : '当前字节无对应提交链接'} |`), '',
    );
  }
  return `${lines.join('\n')}\n`;
}
