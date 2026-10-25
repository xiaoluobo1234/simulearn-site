import {
  ASSEMBLY_DEFAULTS, assembleBars, readAssemblyInputs, solveAssembly,
  type AssemblyModel, type AssemblySolution,
} from '../lib/assembly-lab';

const app = document.querySelector<HTMLElement>('[data-assembly-lab]');
if (app) mountAssemblyLab(app);

function mountAssemblyLab(app: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
  const form = $<HTMLFormElement>('#assembly-form');
  const auth = $('#assembly-auth'), status = $('#assembly-status'), validation = $('#assembly-validation');
  const solveButton = $<HTMLButtonElement>('#assembly-solve'), exportButton = $<HTMLButtonElement>('#assembly-export');
  const resultPanel = $('#assembly-result');
  let selected = 0, step = 1;
  let cell: [number, number] = [0, 0];
  let model: AssemblyModel | null = assembleBars(ASSEMBLY_DEFAULTS);
  let computation: { schemaVersion: 1; execution: Record<string, unknown>; solution: AssemblySolution } | null = null;
  let run = 0, authEpoch = 0;
  let pending: AbortController | null = null;

  function fmt(value: number) {
    if (value === 0 || Object.is(value, -0)) return '0';
    return Number(value.toPrecision(7)).toString();
  }
  function message(text: string, error = false) { status.textContent = text; status.classList.toggle('is-error', error); }
  function renderAuth(loggedIn: boolean, unavailable = false) {
    auth.replaceChildren(document.createTextNode(unavailable ? '登录状态暂不可读；组装仍可查看。点击求解时会重新核对账户。' : loggedIn ? '账户已连接。每次点击求解都会重新核对登录，仅在本页计算，不写入账户或学习状态。' : '当前为匿名浏览，可查看图示与矩阵组装。求解需要登录，不会自动创建账户记录。'));
    if (!loggedIn) {
      const link = document.createElement('a'); link.href = '/login/'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = '在新标签页登录'; auth.append(link);
    }
    solveButton.textContent = loggedIn ? '求解当前分区方程' : '登录后求解方程';
  }
  async function readSession(signal?: AbortSignal): Promise<boolean> {
    const epoch = ++authEpoch;
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error('无法核对登录状态，请稍后重试；尚未求解。');
    const loggedIn = typeof data.user?.userId === 'string' && Boolean(data.user.userId.trim());
    if (epoch === authEpoch) renderAuth(loggedIn);
    return loggedIn;
  }
  function clearResult() {
    run++; pending?.abort(); pending = null;
    computation = null; resultPanel.hidden = true; exportButton.disabled = true; solveButton.disabled = false;
    $('#assembly-result-values').replaceChildren(); $('#assembly-partition').textContent = '';
  }
  function table(matrix: number[][], caption: string, local = false): HTMLTableElement {
    const table = document.createElement('table'); table.className = 'assembly-matrix';
    const cap = document.createElement('caption'); cap.textContent = caption; table.append(cap);
    const head = document.createElement('thead'), header = document.createElement('tr');
    header.append(document.createElement('th'));
    matrix.forEach((_, i) => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = local ? `b${i}` : `u${i}`; header.append(th); });
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    matrix.forEach((row, i) => {
      const tr = document.createElement('tr'), th = document.createElement('th'); th.scope = 'row'; th.textContent = local ? `a${i}` : `u${i}`; tr.append(th);
      row.forEach((value, j) => {
        const td = document.createElement('td'); td.dataset.matrixCell = `${i},${j}`; td.dataset.numeric = String(value);
        const text = document.createElement(local ? 'button' : 'span'); text.textContent = fmt(value);
        if (text instanceof HTMLButtonElement) { text.type = 'button'; text.dataset.localCell = `${i},${j}`; text.setAttribute('aria-label', `局部第 ${i + 1} 行第 ${j + 1} 列，${fmt(value)} N/mm`); }
        td.append(text); tr.append(td);
      }); body.append(tr);
    }); table.append(body); return table;
  }
  function highlightCell() {
    if (!model) return;
    const [row, column] = cell, nodes = model.connectivity[selected];
    $('#assembly-local').querySelectorAll<HTMLElement>('[data-matrix-cell]').forEach(item => {
      const active = item.dataset.matrixCell === `${row},${column}`; item.classList.toggle('is-active', active);
      item.querySelector('button')?.setAttribute('aria-pressed', String(active));
    });
    for (const selector of ['#assembly-contribution', '#assembly-global']) $(selector).querySelectorAll<HTMLElement>('[data-matrix-cell]').forEach(item => item.classList.toggle('is-active', item.dataset.matrixCell === `${nodes[row]},${nodes[column]}`));
    $('#assembly-cell-explanation').textContent = `单元 ${selected + 1}：局部项 [${row}, ${column}] = ${fmt(model.local[selected][row][column])} N/mm，加入总体位置 K[${nodes[row]}, ${nodes[column]}]。局部节点 [0, 1] 映射为总体节点 [${nodes.join(', ')}]。`;
  }
  function renderMatrices() {
    app.querySelectorAll<HTMLElement>('[data-select-element]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.selectElement) === selected)));
    app.querySelectorAll<HTMLElement>('[data-element-shape]').forEach(shape => shape.classList.toggle('is-selected', Number(shape.dataset.elementShape) === selected));
    app.querySelectorAll<HTMLElement>('[data-assembly-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.assemblyStep) === step)));
    if (!model) {
      for (const name of ['#assembly-local', '#assembly-contribution', '#assembly-global']) $(name).replaceChildren();
      $('#assembly-mapping').textContent = '参数尚未有效，未显示旧矩阵。'; $('#assembly-cell-explanation').textContent = '请先修正参数，再观察对应项。'; return;
    }
    const nodes = model.connectivity[selected], k = model.stiffness[selected];
    $('#assembly-local-title').textContent = `单元 ${selected + 1} 的局部刚度`;
    $('#assembly-contribution-title').textContent = `单元 ${selected + 1} 的总体贡献`;
    $('#assembly-mapping').textContent = `单元 ${selected + 1}：k${selected + 1} = EA${selected + 1}/L${selected + 1} = ${fmt(k)} N/mm；节点映射 [0, 1] → [${nodes.join(', ')}]。`;
    $('#assembly-local').replaceChildren(table(model.local[selected], 'kₑ = (EA/L) · [[1, −1], [−1, 1]]', true));
    $('#assembly-contribution').replaceChildren(table(model.contributions[selected], '只在对应的总体行列加入数值'));
    const partial = step === 0 ? [[0, 0, 0], [0, 0, 0], [0, 0, 0]] : step === 1 ? model.contributions[0] : model.K;
    $('#assembly-global').replaceChildren(table(partial, step === 2 ? '完整 K = 单元 1 贡献 + 单元 2 贡献' : step === 1 ? '当前 K = 单元 1 贡献' : '当前 K = 0'));
    $('#assembly-step-description').textContent = step === 0 ? '尚未累加任何单元。' : step === 1 ? '加入单元 1，占用总体节点 0、1 的行列。' : `再加入单元 2；共享项 K[1,1] = ${fmt(model.stiffness[0])} + ${fmt(model.stiffness[1])} = ${fmt(model.K[1][1])} N/mm。`;
    $('[data-fixed-support]').toggleAttribute('hidden', model.inputs.constraint === 'free');
    highlightCell();
  }
  function readModel(): boolean {
    const checked = readAssemblyInputs(Object.fromEntries(new FormData(form)));
    validation.textContent = checked.ok ? '' : checked.errors.join('\n');
    model = checked.ok ? assembleBars(checked.value) : null;
    renderMatrices(); return checked.ok;
  }
  function renderSolution(solution: AssemblySolution) {
    const matrix = (rows: number[][]) => rows.map(row => `[${row.map(fmt).join(', ')}]`).join('\n');
    $('#assembly-partition').textContent = `自由节点：[1, 2]\nKff / (N/mm)：\n${matrix(solution.Kff)}\n\nKfc · uc / N = [${solution.KfcUc.map(fmt).join(', ')}]\nFf − Kfc · uc / N = [${solution.correctedRhs.map(fmt).join(', ')}]\n\n使用原始 K 与 F：R = Ku − F`;
    const dl = document.createElement('dl');
    const add = (key: string, label: string, value: number, unit: string) => {
      const row = document.createElement('div'), term = document.createElement('dt'), description = document.createElement('dd'); term.textContent = label;
      description.textContent = `${fmt(value)} ${unit}`; description.dataset.resultValue = key; description.dataset.numeric = String(value); row.append(term, description); dl.append(row);
    };
    solution.displacement.forEach((value, i) => add(`u${i}`, `节点 ${i} 位移 u${i}`, value, 'mm'));
    solution.reactionAndResidual.forEach((value, i) => add(`R${i}`, i === 0 ? '左端支反力 R₀' : `自由节点 ${i} 方程残差`, value, 'N'));
    add('energy', '应变能 U', solution.strainEnergy, 'N·mm'); add('equilibrium', '整体合力残差 ΣF + ΣR', solution.equilibriumResidual, 'N'); add('free-residual', '自由方程最大绝对残差', solution.maxFreeResidual, 'N');
    $('#assembly-result-values').replaceChildren(dl); resultPanel.hidden = false;
  }
  async function solve() {
    clearResult();
    if (!readModel() || !model) { message('输入无效，旧计算已清除；请按单位和范围修正。', true); return; }
    const inputs = { ...model.inputs }, thisRun = run;
    const controller = new AbortController(); pending = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    solveButton.disabled = true; message('正在重新核对登录；尚未求解。');
    try {
      const loggedIn = await readSession(controller.signal);
      if (thisRun !== run) return;
      if (!loggedIn) { message('请先登录，再点击求解。当前仅展示组装，尚未生成位移、反力或能量。', true); return; }
      const solution = solveAssembly(inputs);
      computation = { schemaVersion: 1, execution: { executor: '当前浏览器 JavaScript 教学计算', runtime: 'JavaScript Number / IEEE 754 float64', executedAt: new Date().toISOString(), reviewStatus: 'AI 辅助编写，待本人复核', notEvidenceOf: ['ANSYS 求解', '在线 CAE 任务', '用户独立复现', '个人学习掌握', '工程安全认证'] }, solution };
      renderSolution(solution); exportButton.disabled = false;
      message('已在当前浏览器实际求解分区方程，并用原矩阵恢复反力。结果仅供教学与初步核查，不写入账户或学习状态。');
      window.dispatchEvent(new CustomEvent('simulearn:activity', { detail: { kind: 'reference-run', page: 'assembly' } }));
    } catch (error) {
      if (thisRun !== run) return;
      const text = error instanceof Error ? error.name === 'AbortError' ? '登录核对超时，尚未求解。请稍后重试。' : error.message : '计算失败，尚未返回结果。'; message(text, true);
    } finally {
      clearTimeout(timeout); if (thisRun === run) { pending = null; solveButton.disabled = false; }
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); void solve(); });
  const edit = () => { clearResult(); readModel(); message('参数或约束已改变，旧求解结果和导出已清除。请重新核对并求解。'); };
  form.addEventListener('input', edit); form.addEventListener('change', edit);
  app.querySelectorAll<HTMLElement>('[data-select-element]').forEach(button => button.addEventListener('click', () => { selected = Number(button.dataset.selectElement); renderMatrices(); }));
  app.querySelectorAll<HTMLElement>('[data-element-shape]').forEach(shape => shape.addEventListener('click', () => { selected = Number(shape.dataset.elementShape); renderMatrices(); }));
  app.querySelectorAll<HTMLElement>('[data-assembly-step]').forEach(button => button.addEventListener('click', () => { step = Number(button.dataset.assemblyStep); renderMatrices(); }));
  const selectCell = (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-local-cell]'); if (!button) return;
    cell = button.dataset.localCell!.split(',').map(Number) as [number, number]; highlightCell();
  };
  $('#assembly-local').addEventListener('click', selectCell); $('#assembly-local').addEventListener('focusin', selectCell);
  exportButton.addEventListener('click', () => {
    if (!computation) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(computation, null, 2)], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'assembly-lab-reference.json'; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('已发起本次计算 JSON 下载。本页不保存到浏览器存储或账户；导出不代表工程验证完成。');
  });
  renderMatrices();
  const initial = new AbortController(), initialTimeout = setTimeout(() => initial.abort(), 10000);
  void readSession(initial.signal).catch(() => { if (authEpoch === 1) renderAuth(false, true); }).finally(() => clearTimeout(initialTimeout));
}
