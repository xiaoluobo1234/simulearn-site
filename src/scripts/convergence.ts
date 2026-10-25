import { analyzeConvergence, convergenceCsv, convergenceJson, MAX_CONVERGENCE_BYTES, type ConvergenceReport, type ConvergenceRow } from '../lib/convergence';

const app = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-convergence-tool]');
if (app) initialize(app);
/** Changing labels/reference conditions does not change the provenance of CSV content. */
export function editConvergenceSource(source: string, previousCsv: string, nextCsv: string): string {
  if (previousCsv === nextCsv) return source;
  return source.startsWith('教学') ? '教学参考示例的 CSV 经本页编辑；仅作数据比较，不代表新增运行证据。' : '用户在本页编辑的 CSV，已不同于先前读取的文件内容；来源与执行状态尚未核验。';
}
function initialize(app: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
  const form = $<HTMLFormElement>('#convergence-form'), status = $('#convergence-status');
  const buttons = [$<HTMLButtonElement>('#convergence-export-csv'), $<HTMLButtonElement>('#convergence-export-json')];
  let report: ConvergenceReport | null = null, source = '用户提供的本页输入，来源与执行状态尚未核验。';
  let fileGeneration = 0;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  let csvSnapshot = field('csv').value;
  const format = (value: number | null, percent = false) => {
    if (value === null) return '不可计算';
    const displayed = percent ? value * 100 : value;
    return Number.isFinite(displayed) ? `${Number(displayed.toPrecision(10))}${percent ? '%' : ''}` : `比值 ${value.toExponential(8)}（百分数超出显示范围）`;
  };
  function message(text: string, error = false) { status.textContent = text; status.classList.toggle('is-error', error); }
  function invalidate(cancelPendingFile = true) {
    if (cancelPendingFile) fileGeneration++;
    report = null; buttons.forEach(button => { button.disabled = true; });
    $('#convergence-chart').replaceChildren(); $('#convergence-table').replaceChildren(); $('#convergence-log').replaceChildren();
    $('#convergence-point').textContent = '输入已变化，请重新计算；旧图表与比较结果已清除。';
    $('#convergence-source').textContent = source;
  }
  function userEdit() {
    const nextCsv = field('csv').value, csvChanged = nextCsv !== csvSnapshot;
    source = editConvergenceSource(source, csvSnapshot, nextCsv); csvSnapshot = nextCsv;
    invalidate(csvChanged); message('输入已修改，请显式点击计算重新比较。');
  }
  form.addEventListener('input', userEdit);
  form.addEventListener('submit', event => {
    event.preventDefault(); invalidate();
    const result = analyzeConvergence({ csv: field('csv').value, target: field('target').value, unit: field('unit').value, hUnit: field('hUnit').value, reference: field('reference').value, conditions: field('conditions').value });
    if (result.ok === false) { message(`第 ${result.error.line} 行，第 ${result.error.column} 列：${result.error.message}`, true); return; }
    report = result.data; renderTable(report); renderChart(report);
    for (const log of [source, ...report.logs]) { const item = document.createElement('li'); item.textContent = log; $('#convergence-log').append(item); }
    $('#convergence-source').textContent = source;
    buttons.forEach(button => { button.disabled = false; });
    message(`已比较 ${report.rows.length} 档。${report.wasReordered ? '已按 h 从粗到细排序，原始顺序与行号保留在导出中。' : '数据已按 h 从粗到细排列。'}没有自动作出收敛或工程可信判定。`);
    window.dispatchEvent(new CustomEvent('simulearn:activity', { detail: { kind: 'practice-check', page: 'convergence' } }));
  });
  $<HTMLInputElement>('#convergence-file').addEventListener('change', async event => {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    invalidate(); const generation = fileGeneration;
    if (file.size > MAX_CONVERGENCE_BYTES) { message('文件超过 256 KiB，未读取；原文本保留。', true); return; }
    try {
      const bytes = await file.arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (generation !== fileGeneration) return;
      field('csv').value = text; csvSnapshot = field('csv').value; source = `用户选择的本地文件：${file.name}；只读取文本，未上传或核验执行者。`;
      invalidate(); message('本地文件已读入，请填写目标量和单位后点击计算。');
    } catch { if (generation === fileGeneration) message('文件无法按 UTF-8 读取；原文本保留，请核对编码。', true); }
  });
  $('#convergence-example').addEventListener('click', () => {
    try {
      const example = JSON.parse(document.getElementById('convergence-example-data')?.textContent || 'null');
      if (!example || ['csv', 'target', 'unit', 'hUnit', 'reference', 'conditions', 'source'].some(key => typeof example[key] !== 'string')) throw new Error();
      invalidate(); for (const name of ['csv', 'target', 'unit', 'hUnit', 'reference', 'conditions']) field(name).value = example[name];
      csvSnapshot = field('csv').value; source = example.source; $('#convergence-source').textContent = source;
      message('教学参考示例已载入，尚未分析；不是你的运行经历。点击计算查看既有数据的比较。');
    } catch { message('教学示例暂不可读，请继续使用自己的 CSV。', true); }
  });
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    if (!report) return;
    const content = index ? convergenceJson(report, source) : convergenceCsv(report, source);
    const url = URL.createObjectURL(new Blob([content], { type: index ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `convergence-comparison.${index ? 'json' : 'csv'}`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('已发起本地导出；没有保存到账户，也没有生成运行或收敛证明。');
  }));
  function renderTable(data: ConvergenceReport) {
    const table = document.createElement('table'); const caption = document.createElement('caption');
    caption.textContent = `${data.target} / ${data.unit}；按 h 从大到小。相对量以百分数显示。`;
    const head = document.createElement('thead'), header = document.createElement('tr');
    for (const label of ['档', '原行', `h${data.hUnit ? ` / ${data.hUnit}` : '（单位未提供）'}`, `${data.target} / ${data.unit}`, `相邻绝对变化 / ${data.unit}`, '相邻相对变化', `对参考绝对误差 / ${data.unit}`, '对参考相对误差']) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; header.append(cell); }
    head.append(header); const body = document.createElement('tbody');
    for (const row of data.rows) {
      const tr = document.createElement('tr'); tr.dataset.convergenceRow = String(row.rank);
      const values = [row.rank, row.line, row.hText, row.valueText, row.rank === 1 ? '—（首档）' : format(row.adjacentAbsoluteChange), row.rank === 1 ? '—（首档）' : format(row.adjacentRelativeChange, true), data.reference === null ? '—（无参考）' : format(row.absoluteError), data.reference === null ? '—（无参考）' : format(row.relativeError, true)];
      for (const [index, value] of values.entries()) { const cell = document.createElement(index ? 'td' : 'th'); if (!index) (cell as HTMLTableCellElement).scope = 'row'; cell.textContent = String(value); tr.append(cell); } body.append(tr);
    }
    table.append(caption, head, body); $('#convergence-table').replaceChildren(table);
  }
  function renderChart(data: ConvergenceReport) {
    const ns = 'http://www.w3.org/2000/svg';
    const element = (tag: string, attributes: Record<string, string>, text?: string) => { const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); if (text !== undefined) node.textContent = text; return node; };
    const svg = element('svg', { viewBox: '0 0 880 340', role: 'group', 'aria-label': `${data.target}曲线，横轴 log10(h)，从粗到细；可聚焦数据点，等价数据见表格。` });
    const values = data.rows.map(row => row.value); if (data.reference !== null) values.push(data.reference);
    const scale = Math.max(...values.map(value => Math.abs(value))) || 1;
    const lo = Math.min(...values.map(value => value / scale)), hi = Math.max(...values.map(value => value / scale));
    const range = hi - lo || 1; const y = (value: number) => hi === lo ? 160 : 265 - ((value / scale - lo) / range) * 210;
    const maxLog = Math.log10(data.rows[0].h), minLog = Math.log10(data.rows.at(-1)!.h);
    const x = (row: ConvergenceRow, index: number) => 92 + (maxLog === minLog ? index / (data.rows.length - 1) : (maxLog - Math.log10(row.h)) / (maxLog - minLog)) * 730;
    svg.append(element('path', { d: 'M92 40V275H830', class: 'convergence-axis' }));
    svg.append(element('text', { x: '92', y: '23' }, `${data.target} / ${data.unit}`), element('text', { x: '450', y: '326', 'text-anchor': 'middle' }, maxLog === minLog ? 'h 数值过近，对数不可分辨；改按档序显示（粗 → 细）' : `log10(h) · 粗 → 细${data.hUnit ? ` · h单位 ${data.hUnit}` : ' · h单位未提供'}`));
    for (const value of [...new Set([lo * scale, hi * scale])]) svg.append(element('text', { x: '84', y: String(y(value) + 4), 'text-anchor': 'end' }, format(value)));
    if (data.reference !== null) svg.append(element('path', { d: `M92 ${y(data.reference)}H822`, class: 'convergence-reference', 'aria-label': `解析参考 ${data.reference} ${data.unit}` }));
    svg.append(element('polyline', { points: data.rows.map((row, index) => `${x(row, index)},${y(row.value)}`).join(' '), class: 'convergence-curve' }));
    const show = (row: ConvergenceRow) => {
      $('#convergence-point').textContent = `第 ${row.rank} 档，原第 ${row.line} 行：h=${row.hText}${data.hUnit ? ` ${data.hUnit}` : ''}，${data.target}=${row.valueText} ${data.unit}；相邻绝对变化 ${row.rank === 1 ? '首档不适用' : format(row.adjacentAbsoluteChange)}，相邻相对变化 ${row.rank === 1 ? '首档不适用' : format(row.adjacentRelativeChange, true)}。`;
      $('#convergence-table').querySelectorAll<HTMLElement>('[data-convergence-row]').forEach(tr => tr.classList.toggle('is-active', tr.dataset.convergenceRow === String(row.rank)));
    };
    for (const [index, row] of data.rows.entries()) {
      const point = element('circle', { cx: String(x(row, index)), cy: String(y(row.value)), r: '5', tabindex: '0', role: 'img', 'data-convergence-point': String(row.rank), 'aria-label': `第${row.rank}档 h=${row.hText}，${data.target}=${row.valueText} ${data.unit}` });
      point.addEventListener('mouseenter', () => show(row)); point.addEventListener('focus', () => show(row)); svg.append(point);
      if (index === 0 || index === data.rows.length - 1) svg.append(element('text', { x: String(x(row, index)), y: '296', 'text-anchor': 'middle' }, row.hText));
    }
    $('#convergence-chart').replaceChildren(svg); $('#convergence-point').textContent = '悬停或用 Tab 聚焦曲线点，读取对应数据；完整数据与误差同时列在下表。';
  }
}
