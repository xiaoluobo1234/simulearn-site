import { appendLabOutput, createLabResult, hasLabSession, requestedPythonTemplate, LAB_AUTH_MS, LAB_EXECUTION_MS, LAB_LOAD_MS, LAB_TEXT_LIMIT, pythonLabTemplates, type LabResult, type LabState, type LabWorkerMessage } from '../lib/python-lab';
import { readCsvProjectCase } from '../lib/csv-project';

const root = document.querySelector<HTMLElement>('[data-python-lab]');
if (root) {
  const code = root.querySelector<HTMLTextAreaElement>('#lab-code')!;
  const input = root.querySelector<HTMLTextAreaElement>('#lab-input')!;
  const template = root.querySelector<HTMLSelectElement>('#lab-template')!;
  const run = root.querySelector<HTMLButtonElement>('[data-lab-run]')!;
  const stop = root.querySelector<HTMLButtonElement>('[data-lab-stop]')!;
  const load = root.querySelector<HTMLButtonElement>('[data-lab-load-template]')!;
  const status = root.querySelector<HTMLElement>('[data-lab-status]')!;
  const environment = root.querySelector<HTMLElement>('[data-lab-environment]')!;
  const stdout = root.querySelector<HTMLElement>('[data-lab-stdout]')!;
  const stderr = root.querySelector<HTMLElement>('[data-lab-stderr]')!;
  const value = root.querySelector<HTMLElement>('[data-lab-value]')!;
  const exportResult = root.querySelector<HTMLButtonElement>('[data-lab-export="result"]')!;
  const login = root.querySelector<HTMLAnchorElement>('[data-lab-login]')!;
  const fallback = root.querySelector<HTMLElement>('[data-lab-fallback]')!;
  const projectCase = root.querySelector<HTMLElement>('[data-lab-project-case]')!;
  const projectCaseBody = root.querySelector<HTMLElement>('[data-lab-project-case-body]')!;
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let auth: AbortController | null = null;
  let result: LabResult | null = null;
  let activeId = '';
  let clockStart = 0;
  let busy = false;
  let selected = pythonLabTemplates[0] as typeof pythonLabTemplates[number];

  function clearTimer() { if (timer) clearTimeout(timer); timer = null; }
  function setBusy(next: boolean) {
    busy = next; run.disabled = next; stop.disabled = !next; load.disabled = next;
    code.readOnly = next; input.readOnly = next; template.disabled = next;
    root!.setAttribute('aria-busy', String(next));
    exportResult.disabled = next || !result?.finishedAt;
  }
  function report(state: string, message: string) { root!.dataset.labState = state; status.textContent = message; }
  function renderOutput() {
    stdout.textContent = result?.stdout || '（暂无标准输出）';
    stderr.textContent = result?.stderr || '（暂无错误输出）';
    value.textContent = result?.value ? `表达式返回值：${result.value}` : '';
  }
  function finish(state: LabState, message: string) {
    clearTimer(); worker?.terminate(); worker = null;
    if (result) { result.state = state; result.finishedAt = new Date().toISOString(); result.elapsedMs = Math.round(performance.now() - clockStart); }
    activeId = ''; setBusy(false); renderOutput(); report(state, message);
  }
  function saveFile(name: string, text: string, mime: string) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  function validateEditor() {
    if (!code.value.trim()) { report('idle', '请先填写要运行的 Python 代码。'); code.focus(); return false; }
    if (code.value.length > LAB_TEXT_LIMIT || input.value.length > LAB_TEXT_LIMIT) {
      report('idle', `代码和输入各限 ${LAB_TEXT_LIMIT.toLocaleString()} 个字符，请缩小练习。`); return false;
    }
    return true;
  }

  const requestedTemplate = requestedPythonTemplate(location.search);
  if (requestedTemplate) {
    selected = requestedTemplate; template.value = selected.id;
    code.value = selected.code; input.value = selected.input;
    root.querySelector<HTMLElement>('[data-lab-template-description]')!.textContent = selected.description;
    report('idle', `已选择「${selected.title}」，尚未加载 Python 或运行代码。请核对输入后显式运行。`);
  }
  // Only a known, repository-owned fixture can be selected from the URL. No
  // query value is evaluated or adopted as code, arbitrary input, or a result.
  const requestedCase = readCsvProjectCase(location.search);
  if (requestedTemplate?.id === 'csv' && requestedCase) {
    input.value = requestedCase.input;
    projectCase.hidden = false;
    projectCase.dataset.caseState = 'original';
    projectCaseBody.textContent = `已载入教学样例「${requestedCase.title}」。当前代码与输入来自项目预设；以下只是预期，不是你的实际结果：${requestedCase.expected.join('；')}。`;
    report('idle', `已选择 CSV 教学样例「${requestedCase.title}」，尚未加载 Python 或运行代码。请核对输入后显式运行。`);
  }
  function markCaseEdited() {
    if (projectCase.hidden) return;
    projectCase.dataset.caseState = 'edited';
    projectCaseBody.textContent = '代码或输入已编辑，当前内容不再标作原教学样例。项目卡片的预期只适用于原样例；请根据本次代码与输入重新预测，再查看实际输出。';
  }
  code.addEventListener('input', markCaseEdited);
  input.addEventListener('input', markCaseEdited);

  load.addEventListener('click', () => {
    const next = pythonLabTemplates.find(item => item.id === template.value);
    if (!next || busy) return;
    if ((code.value !== selected.code || input.value !== selected.input) && !window.confirm('载入模板会替换当前编辑区；请先导出需要保留的修改。继续载入？')) return;
    selected = next; code.value = next.code; input.value = next.input;
    projectCase.hidden = true; projectCase.dataset.caseState = 'cleared';
    root!.querySelector<HTMLElement>('[data-lab-template-description]')!.textContent = next.description;
    report('idle', `已载入「${next.title}」，尚未运行。已有结果属于上一次执行；导出结果包含当次代码和输入。`);
  });
  run.addEventListener('click', async () => {
    if (busy || !validateEditor()) return;
    // Snapshot exactly what the learner chose to execute, before any await.
    const codeSnapshot = code.value, inputSnapshot = input.value;
    result = null; environment.textContent = '尚未加载运行环境'; renderOutput();
    login.hidden = true; fallback.hidden = true; setBusy(true);
    report('auth', '正在核对登录状态；尚未加载 Python，也未执行代码。');
    const controller = new AbortController(); auth = controller;
    const authTimer = setTimeout(() => controller.abort(), LAB_AUTH_MS);
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('登录服务暂不可用，请稍后重试或下载到本机运行。');
      const session: unknown = await response.json();
      if (auth !== controller) return;
      const isAnonymous = !!session && typeof session === 'object' && (session as { ok?: unknown }).ok === true && (session as { user?: unknown }).user === null;
      if (!isAnonymous && !hasLabSession(session)) throw new Error('登录状态响应不完整，尚未执行。');
      if (!hasLabSession(session)) {
        login.hidden = false; fallback.hidden = false; setBusy(false);
        report('anonymous', '登录后才能在站内运行。你仍可编辑、导出代码和输入，或下载到本机运行；尚未执行。');
        return;
      }
    } catch (error) {
      if (auth !== controller) return;
      fallback.hidden = false; setBusy(false);
      report('auth-error', error instanceof Error && error.name === 'AbortError' ? '登录核对超时，尚未加载 Python 或执行代码。可重试或下载到本机。' : '登录核对失败，尚未加载 Python 或执行代码。可重试或下载到本机。');
      return;
    } finally { clearTimeout(authTimer); if (auth === controller) auth = null; }
    activeId = crypto.randomUUID();
    result = createLabResult(codeSnapshot, inputSnapshot, new Date().toISOString()); clockStart = performance.now();
    report('loading', '正在从本站加载 Python（首次约 13.5 MB）。只支持已附带的标准库；可随时停止。');
    try {
      // Runtime is never requested until the explicit run passes the login check.
      worker = new Worker(new URL('./python-lab.worker.ts', import.meta.url), { type: 'module', name: 'simulearn-python-lab' });
      const thisWorker = worker, thisId = activeId;
      timer = setTimeout(() => {
        fallback.hidden = false; finish('timeout', 'Python 环境加载超过 45 秒，已终止 Worker；未确认代码运行。可重试或使用本机下载包。');
      }, LAB_LOAD_MS);
      worker.onerror = event => {
        if (worker !== thisWorker) return;
        event.preventDefault();
        if (result) result.stderr = appendLabOutput(result.stderr, `Worker 加载或执行失败：${event.message || '请检查浏览器与网络'}\n`);
        fallback.hidden = false; finish('error', '运行环境或 Worker 发生错误，已停止。可重试或下载到本机运行。');
      };
      worker.onmessage = (event: MessageEvent<LabWorkerMessage>) => {
        if (worker !== thisWorker || !event.data || event.data.id !== thisId || !result) return;
        const message = event.data;
        if (message.type === 'ready' && result.state === 'loading') {
          result.environment = message.environment; result.state = 'running'; environment.textContent = message.environment;
          clearTimer(); timer = setTimeout(() => finish('timeout', '执行超过 8 秒，已终止 Worker；本次未完成。下一次运行会建立全新环境。'), LAB_EXECUTION_MS);
          report('running', '正在浏览器 Worker 中执行 Python。最长 8 秒，可立即停止。');
        } else if (message.type === 'stream' && typeof message.text === 'string') {
          if (message.stream === 'stdout') result.stdout = appendLabOutput(result.stdout, message.text);
          else result.stderr = appendLabOutput(result.stderr, message.text);
          renderOutput();
        } else if (message.type === 'done') {
          result.value = message.value;
          finish('succeeded', '本次浏览器 Python 执行完成。请核对实际输出；执行完成不代表工程验证或本机复现完成。');
          window.dispatchEvent(new CustomEvent('simulearn:activity', { detail: { kind: 'reference-run', page: 'python' } }));
        } else if (message.type === 'error') {
          result.stderr = appendLabOutput(result.stderr, `${message.error}\n`);
          if (!result.environment) fallback.hidden = false;
          finish('error', result.environment ? 'Python 返回错误，已结束本次执行。请按下方实际错误修改后重试。' : 'Python 环境加载失败，未确认代码运行。可重试或下载到本机运行。');
        }
      };
      worker.postMessage({ type: 'run', id: activeId, code: codeSnapshot, input: inputSnapshot });
    } catch (error) {
      if (result) result.stderr = appendLabOutput(result.stderr, `${error instanceof Error ? error.message : String(error)}\n`);
      fallback.hidden = false; finish('error', '浏览器无法启动 Python Worker；请使用支持 WebAssembly 的现代浏览器，或下载到本机运行。');
    }
  });
  stop.addEventListener('click', () => {
    if (!busy) return;
    if (auth) { const pending = auth; auth = null; pending.abort(); setBusy(false); report('stopped', '已取消登录核对，尚未加载 Python 或执行代码。'); }
    else finish('stopped', '已终止本次 Worker；本次执行未完成。下一次运行会建立全新环境。');
  });
  root.querySelector<HTMLButtonElement>('[data-lab-export="code"]')!.addEventListener('click', () => saveFile(selected.codeFile, code.value, 'text/x-python;charset=utf-8'));
  root.querySelector<HTMLButtonElement>('[data-lab-export="input"]')!.addEventListener('click', () => saveFile(selected.inputFile, input.value, 'text/plain;charset=utf-8'));
  exportResult.addEventListener('click', () => { if (result?.finishedAt && !busy) saveFile('simulearn-python-result.json', JSON.stringify(result, null, 2) + '\n', 'application/json;charset=utf-8'); });
  window.addEventListener('pagehide', () => {
    if (auth) { const pending = auth; auth = null; pending.abort(); setBusy(false); report('stopped', '离开页面时已取消登录核对；尚未执行代码。'); }
    else if (busy) finish('stopped', '离开页面时已停止本次 Worker；执行未完成，可返回后重新运行。');
    else { clearTimer(); worker?.terminate(); worker = null; }
  });
}
