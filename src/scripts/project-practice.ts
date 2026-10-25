import type { StudyItem } from '../data/study-schema';
import {
  PRACTICE_QUANTITIES, blankProjectPractice, checkProjectPractice, isPracticeRecordId,
  projectPracticeJson, projectPracticeMarkdown, readPracticeCatalog, readPracticeStudyItem,
  toPracticeStudyItem, validateProjectPractice, type PracticeCatalog, type ProjectPractice,
} from '../lib/project-practice';

const app = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-project-practice]');
if (app) initProjectPractice(app);

/** Only explicit numeric comparisons and account saves. No code, solver, AI or local log storage. */
function initProjectPractice(app: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector);
  const form = $<HTMLFormElement>('#project-practice-form');
  const auth = $('#practice-auth'); const status = $('#practice-status');
  const list = $('#practice-list'); const feedback = $('#practice-feedback');
  const saveButton = $<HTMLButtonElement>('#practice-save');
  if (!form || !auth || !status || !list || !feedback || !saveButton) return;
  const editor = form, authTarget = auth, statusTarget = status, listTarget = list, feedbackTarget = feedback, save = saveButton;
  let catalog: PracticeCatalog;
  try {
    const raw = document.getElementById('project-benchmarks-data')?.textContent || '';
    if (raw.length > 128_000) throw new Error('项目参考目录过大。');
    const result = readPracticeCatalog(JSON.parse(raw));
    if (result.ok === false) throw new Error(result.error);
    catalog = result.value;
  } catch {
    statusTarget.textContent = '项目参考目录暂不可读，未进行数值判定或账户写入。请刷新页面后重试。';
    editor.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
    return;
  }
  const requested = new URLSearchParams(location.search);
  let current: StudyItem | null = null, currentOwner = '', userId = '';
  let items: StudyItem[] = [];
  let busy = false, connecting = false, blocked = false, dirty = false, hasFeedback = false;
  let requestedOpened = false;
  let lastCaseSlug = catalog.cases[0].slug;

  function controls(name: string): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
    return Array.from(editor.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]')).filter(input => input.name === name);
  }
  function value(name: string): string {
    const fields = controls(name);
    return fields.some(field => field instanceof HTMLInputElement && field.type === 'radio')
      ? (fields.find(field => field instanceof HTMLInputElement && field.checked)?.value || '') : fields[0]?.value || '';
  }
  function put(name: string, next: string) {
    for (const input of controls(name)) {
      if (input instanceof HTMLInputElement && input.type === 'radio') input.checked = input.value === next;
      else input.value = next;
    }
  }
  function message(text: string, error = false, id?: string) {
    statusTarget.textContent = text;
    statusTarget.classList.toggle('is-error', error);
    if (id && isPracticeRecordId(id)) {
      const link = document.createElement('a'); link.href = `/learning/records/?id=${encodeURIComponent(id)}`; link.textContent = '到原学习工作台查看';
      statusTarget.append(document.createTextNode(' '), link);
    }
  }
  function clearFeedback() {
    hasFeedback = false;
    feedbackTarget.replaceChildren();
  }
  function updateUnits() {
    const selected = catalog.cases.find(item => item.slug === value('caseSlug'));
    if (!selected) return;
    for (const quantity of selected.quantities) {
      app.querySelectorAll<HTMLElement>(`[data-practice-quantity-label="${quantity.id}"]`).forEach(label => { label.textContent = quantity.label; });
      app.querySelectorAll<HTMLElement>(`[data-practice-unit="${quantity.id}"]`).forEach(unit => { unit.textContent = quantity.unit; });
    }
  }
  function collect(): ProjectPractice {
    const draft = blankProjectPractice(value('caseSlug'));
    for (const id of PRACTICE_QUANTITIES) draft.answers[id] = value(id);
    const result = validateProjectPractice({ ...draft, concept: value('concept'), observation: value('observation'), executor: value('executor'), reproduction: value('reproduction'), evidence: value('evidence') }, catalog);
    if (result.ok === false) throw new Error(result.error);
    return result.value;
  }
  function renderFeedback(practice: ProjectPractice) {
    const result = checkProjectPractice(practice, catalog);
    clearFeedback();
    for (const quantity of result.quantities) {
      const row = document.createElement('div'); row.className = 'practice-feedback-item'; row.dataset.practiceResult = quantity.id;
      const heading = document.createElement('strong'); heading.textContent = `${quantity.label}：${quantity.message}`;
      const detail = document.createElement('p');
      detail.textContent = `输入：${quantity.input || '未填写'} ${quantity.unit}；参考：${quantity.expected} ${quantity.unit}；绝对误差：${quantity.absoluteError === null ? '无法计算' : `${quantity.absoluteError} ${quantity.unit}`}；容差：${quantity.tolerance} ${quantity.unit}。`;
      const basis = document.createElement('p'); basis.textContent = `依据：abs(输入−参考) <= max(绝对容差, 相对容差 × abs(参考))。${quantity.explanation}`;
      row.append(heading, detail, basis); feedbackTarget.append(row);
    }
    const concept = document.createElement('div'); concept.dataset.practiceConceptResult = '';
    const heading = document.createElement('strong'); heading.textContent = `概念选择：${result.concept.matches ? '选择相符' : result.concept.answered ? '需要修正理解' : '尚未选择'}`;
    const explanation = document.createElement('p'); explanation.textContent = result.concept.explanation; concept.append(heading, explanation);
    const summary = document.createElement('p'); summary.className = 'practice-feedback-summary';
    summary.textContent = `${result.allMatch ? '全部参考对照相符' : '仍有待检查项'}。这只是练习对照，并非工程验证完成，也不代表用户已经运行 CAE 或掌握知识。`;
    feedbackTarget.append(concept, summary); hasFeedback = true;
  }
  function fill(practice: ProjectPractice, item: StudyItem | null = null, showFeedback = false) {
    editor.reset();
    put('caseSlug', practice.caseSlug);
    lastCaseSlug = practice.caseSlug;
    for (const id of PRACTICE_QUANTITIES) put(id, practice.answers[id]);
    for (const key of ['concept', 'observation', 'executor', 'reproduction', 'evidence'] as const) put(key, practice[key]);
    current = item; currentOwner = item ? userId : ''; blocked = false; dirty = false;
    save.disabled = busy;
    clearFeedback(); updateUnits();
    if (showFeedback) renderFeedback(practice);
    const records = $<HTMLAnchorElement>('#practice-records');
    if (records) records.href = item ? `/learning/records/?id=${encodeURIComponent(item.id)}` : '/learning/records/';
    renderList();
  }
  function markDirty() {
    dirty = true; clearFeedback(); updateUnits();
    if (!blocked && !busy) message('输入已修改，旧判定已清除。请点击检查重新对照；未保存内容只留在本页。');
  }
  function canLeave() { return !busy && (!dirty || window.confirm('当前修改尚未保存。确认放弃并切换？可取消后先导出。')); }
  function switchCase() {
    const next = value('caseSlug');
    if (next === lastCaseSlug) return;
    if (!catalog.cases.some(item => item.slug === next)) {
      put('caseSlug', lastCaseSlug);
      message('所选案例不在公开目录中，已恢复原案例；没有新建或保存任何记录。', true);
      return;
    }
    if (!canLeave()) { put('caseSlug', lastCaseSlug); return; }
    requestedOpened = true;
    fill(blankProjectPractice(next));
    const url = new URL(location.href); url.search = ''; url.searchParams.set('case', next);
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    message('已新建此案例的空白练习，后台原记录保留。此案例尚未执行；答案、观察与证据已清空，执行和复现均为未运行。');
  }
  function setBusy(next: boolean) {
    busy = next; editor.inert = next; save.disabled = next || blocked; save.textContent = next ? '正在处理…' : '保存私人练习草稿';
    $<HTMLButtonElement>('#practice-new')?.toggleAttribute('disabled', next); renderList();
  }
  async function api(path: string, init: RequestInit = {}): Promise<Record<string, any>> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const headers = new Headers(init.headers);
      if (init.method && init.method !== 'GET') {
        const response = await fetch('/api/auth/csrf-token', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        const csrf = await response.json().catch(() => null);
        if (!response.ok || !csrf?.ok || typeof csrf.token !== 'string' || !csrf.token) throw new Error('无法取得安全令牌；输入仍保留，请稍后重试。');
        headers.set('X-CSRF-Token', csrf.token); headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        if (response.status === 401) throw new Error('登录已失效，请先导出输入，再登录并重新读取账户。');
        if (response.status === 409) throw new Error('保存冲突：记录已在其他页面更新。当前输入完整保留，请先导出，再打开最新版本合并。');
        throw new Error(typeof data?.error === 'string' ? data.error : `请求失败（${response.status}），输入仍保留。`);
      }
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('请求超时，保存结果尚未确认。请先导出，再重新读取账户核对，避免重复新建。');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function renderList() {
    listTarget.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p'); empty.textContent = userId ? '暂无项目练习记录。可先保存未完成的私人草稿。' : '登录并读取账户后，在这里查看已保存练习。'; listTarget.append(empty); return;
    }
    for (const item of [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      const row = document.createElement('div'); row.className = 'practice-list-item';
      const title = document.createElement('strong'); title.textContent = item.title;
      const meta = document.createElement('span'); meta.textContent = `修订 ${item.revision} · ${item.visibility === 'private' ? '私人' : item.visibility === 'pending' ? '待公开' : '已公开'}`;
      const open = document.createElement('button'); open.type = 'button'; open.className = 'btn btn-ghost btn-sm'; open.textContent = current?.id === item.id ? '重新读取' : '打开'; open.dataset.practiceOpen = item.id; open.disabled = busy || connecting;
      open.addEventListener('click', () => { if (canLeave()) void openItem(item.id); }); row.append(title, meta, open); listTarget.append(row);
    }
  }
  function renderAuth(text: string) {
    authTarget.textContent = text;
    if (!userId) {
      const link = document.createElement('a'); link.href = '/login/'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = '在新标签页登录'; authTarget.append(document.createTextNode(' '), link);
    }
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn-ghost btn-sm'; retry.textContent = '重新读取账户'; retry.disabled = busy || connecting;
    retry.onclick = () => { if (!busy && !connecting) void loadAccount(); }; authTarget.append(document.createTextNode(' '), retry);
  }
  async function openItem(id: string) {
    if (busy || !isPracticeRecordId(id)) return;
    setBusy(true); message('正在读取最新私人练习…');
    try {
      const response = await api(`/api/study/items/${encodeURIComponent(id)}`);
      const result = readPracticeStudyItem(response.item, catalog);
      if (result.ok === false) { blocked = true; message(result.error, true, id); return; }
      fill(result.value.practice, result.value.item, true);
      const url = new URL(location.href); url.search = ''; url.searchParams.set('id', id); history.replaceState(null, '', `${url.pathname}${url.search}`);
      message(`已读取私人练习 · 修订 ${result.value.item.revision}。反馈已按当前参考目录重算；没有自动更改复现或学习状态。`);
    } catch (error) { message(error instanceof Error ? error.message : '读取失败，输入仍保留。', true); }
    finally { setBusy(false); }
  }
  async function loadAccount() {
    if (busy || connecting) return;
    connecting = true; authTarget.textContent = '正在核对账户…'; renderList();
    try {
      const session = await api('/api/auth/me'); userId = typeof session.user?.userId === 'string' ? session.user.userId : ''; items = [];
      if (userId) {
        const collected: StudyItem[] = [], cursors = new Set<string>(); let cursor = '';
        do {
          const data = await api(`/api/study/items?kind=record${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
          if (!Array.isArray(data.items) || data.items.length > 200) throw new Error('账户列表格式无效，请重试。');
          for (const item of data.items) if (item?.kind === 'record' && item.fields?.recordType === '项目练习' && isPracticeRecordId(item.id) && typeof item.title === 'string' && typeof item.updatedAt === 'string' && Number.isSafeInteger(item.revision)) collected.push(item);
          cursor = typeof data.cursor === 'string' ? data.cursor : '';
          if (cursor && (cursor.length > 2048 || cursors.has(cursor))) throw new Error('账户分页异常，未继续读取。');
          if (cursor) cursors.add(cursor);
        } while (cursor);
        items = collected;
        const id = requested.get('id');
        if (id && !requestedOpened && !dirty) {
          requestedOpened = true;
          if (isPracticeRecordId(id)) await openItem(id);
          else { blocked = true; save.disabled = true; message('练习标识无效，请新建或从账户列表打开。', true); }
        }
      }
    } catch (error) {
      connecting = false; renderList(); renderAuth(`账户暂不可读：${error instanceof Error ? error.message : '请稍后重试'}。仍可填写和导出。`); return;
    } finally { connecting = false; }
    renderList(); renderAuth(userId ? '账户已连接。点击保存后写入私人练习草稿；每次修改保留版本。' : '匿名模式：可检查和导出。输入只留在本页，登录后需明确点击保存。');
  }
  async function savePractice() {
    if (busy || blocked) return;
    if (!userId || connecting) { message('请先登录并重新读取账户，再保存。当前可匿名检查和导出。', true); return; }
    let practice: ProjectPractice;
    try { practice = collect(); toPracticeStudyItem(practice, catalog, current || undefined); }
    catch (error) { message(error instanceof Error ? error.message : '练习内容无效。', true); return; }
    const showFeedback = hasFeedback; setBusy(true); message('正在核对账户并保存私人草稿…');
    try {
      const session = await api('/api/auth/me'); const account = typeof session.user?.userId === 'string' ? session.user.userId : '';
      if (!account || account !== userId || (current && currentOwner !== account)) throw new Error('登录账户已变化或失效，已停止保存。请先导出，再重新读取正确账户。');
      const item = toPracticeStudyItem(practice, catalog, current || undefined);
      const response = await api(current ? `/api/study/items/${encodeURIComponent(current.id)}` : '/api/study/items', { method: current ? 'PUT' : 'POST', body: JSON.stringify({ item, revision: current?.revision }) });
      const result = readPracticeStudyItem(response.item, catalog);
      if (result.ok === false) throw new Error('保存结果无法安全确认，请先导出并重新读取账户核对，避免重复新建。');
      items = [result.value.item, ...items.filter(value => value.id !== result.value.item.id)]; fill(result.value.practice, result.value.item, showFeedback);
      const url = new URL(location.href); url.search = ''; url.searchParams.set('id', result.value.item.id); history.replaceState(null, '', `${url.pathname}${url.search}`);
      message(`已保存到当前账户 · 私人草稿 · 修订 ${result.value.item.revision}。参考对照不代表完成 CAE，复现与学习状态独立记录。`);
    } catch (error) { message(error instanceof Error ? error.message : '保存失败，输入仍保留。', true); }
    finally { setBusy(false); }
  }
  function download(extension: 'md' | 'json') {
    try {
      const practice = collect(); const content = extension === 'md' ? projectPracticeMarkdown(practice, catalog) : projectPracticeJson(practice, catalog);
      const url = URL.createObjectURL(new Blob([content], { type: extension === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `linear-static-${practice.caseSlug}.${extension}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      message('已发起下载。导出不表示账户已保存，也不代表已运行求解器。');
    } catch (error) { message(error instanceof Error ? error.message : '导出失败，输入仍保留。', true); }
  }

  editor.addEventListener('submit', event => { event.preventDefault(); void savePractice(); });
  // Selects emit input before change. Do not mark a case switch dirty before
  // confirming the previous case's actual edits or discard its old provenance.
  editor.addEventListener('input', event => {
    if (!(event.target instanceof HTMLSelectElement && event.target.name === 'caseSlug')) markDirty();
  });
  editor.addEventListener('change', event => {
    if (event.target instanceof HTMLSelectElement && event.target.name === 'caseSlug') switchCase();
    else markDirty();
  });
  $('#practice-check')?.addEventListener('click', () => { if (busy) return; try { renderFeedback(collect()); message('已完成参考对照。没有修改复现、学习、审核或公开状态。'); } catch (error) { clearFeedback(); message(error instanceof Error ? error.message : '输入无效，未进行判定。', true); } });
  $('#practice-export-md')?.addEventListener('click', () => download('md')); $('#practice-export-json')?.addEventListener('click', () => download('json'));
  $('#practice-new')?.addEventListener('click', () => {
    if (!canLeave()) return; requestedOpened = true; fill(blankProjectPractice(catalog.cases[0].slug)); history.replaceState(null, '', location.pathname); message('新练习默认私人草稿，答案、观察和证据均为空；执行与复现默认未运行。'); controls('caseSlug')[0]?.focus();
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  const selected = catalog.cases.find(item => item.slug === requested.get('case')) || catalog.cases[0];
  fill(blankProjectPractice(selected.slug));
  void loadAccount();
}
