import type { StudyItem } from '../data/study-schema';
import {
  FAILURE_FIELD_LIMITS, FAILURE_REVIEW_FIELDS, blankFailureReview, failureReviewJson,
  failureReviewMarkdown, isFailureRecordId, prefillFailureReview, readFailureDiagnostics,
  readFailureStudyItem, toFailureStudyItem, validateFailureReview,
  type FailureDiagnostic, type FailureReview,
} from '../lib/failure-review';
import { MAX_FAILURE_REVIEW_IMPORT_BYTES, readFailureReviewImport, prepareFailureReviewImport, type FailureReviewImport } from '../lib/failure-review-import';

const app = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-failure-workbench]');
if (app) initFailureReviewWorkbench(app);

/** The editor never uses localStorage, AI or a simulation API. */
function initFailureReviewWorkbench(app: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector);
  const form = $<HTMLFormElement>('#failure-form');
  const auth = $('#failure-auth');
  const status = $('#failure-status');
  const saveButton = $<HTMLButtonElement>('#failure-save');
  const list = $('#failure-list');
  if (!form || !auth || !status || !saveButton || !list) return;
  const editor = form;
  const authTarget = auth;
  const statusTarget = status;
  const save = saveButton;
  const listTarget = list;
  let diagnostics: FailureDiagnostic[] = [];
  try {
    const text = document.getElementById('failure-diagnostics-data')?.textContent || '[]';
    if (text.length <= 128_000) diagnostics = readFailureDiagnostics(JSON.parse(text));
  } catch { /* A missing catalog must not make the private editor unusable. */ }
  const requested = new URLSearchParams(location.search);
  let current: StudyItem | null = null;
  let currentOwner = '';
  let userId = '';
  let items: StudyItem[] = [];
  let busy = false;
  let connecting = false;
  let blocked = false;
  let dirty = false;
  let authGeneration = 0;
  let requestedOpened = false;
  let editorRevision = 0;
  let lastEditorSnapshot = '';
  let importGeneration = 0;
  let importPreview: { imported: FailureReviewImport; review: FailureReview | null; revision: number; editorSnapshot: string } | null = null;
  // Form controls normalize line endings (and single-line inputs remove them).
  // Retain untouched source literals until that particular field is edited.
  const importedLiterals = new Map<string, { raw: string; rendered: string }>();
  const importFile = $<HTMLInputElement>('#failure-import-file');
  const importKind = $<HTMLSelectElement>('#failure-import-kind');
  const importApply = $<HTMLButtonElement>('#failure-import-apply');
  const importCancel = $<HTMLButtonElement>('#failure-import-cancel');
  const importBox = $('#failure-import-preview');
  const importStatus = $('#failure-import-status');
  const importSource = $('#failure-import-source');
  const previewLabels: Record<string, string> = {
    title: '复盘标题', date: '实际发生日期', software: '软件或工具', version: '版本与运行环境',
    model: '模型、载荷与单位', symptom: '实际观察到的异常', expected: '预期结果与依据',
    hypothesis: '可能原因与尚缺证据', attempts: '我实际做过的检查', actual: '实际输出或日志摘录',
    evidence: '证据、文件与来源链接', change: '实际修改与版本', retest: '复测结果与比较',
    next: '下一项任务与完成条件', diagnosticId: '关联诊断', executor: '执行者（文件自述，未经核验）', reproduction: '复现状态（文件自述，未经核验）',
  };

  function importMessage(text: string) { if (importStatus) importStatus.textContent = text; }
  function invalidateImport(text?: string, clearSource = false, clearFile = true) {
    importGeneration++; importPreview = null;
    if (clearFile && importFile) importFile.value = '';
    if (importKind) { importKind.value = ''; importKind.disabled = true; importKind.closest<HTMLElement>('label')?.setAttribute('hidden', ''); }
    if (importBox) { importBox.replaceChildren(); importBox.hidden = true; }
    if (importApply) importApply.disabled = true;
    if (importCancel) importCancel.disabled = true;
    if (clearSource && importSource) { importSource.textContent = ''; importSource.hidden = true; }
    if (text) importMessage(text);
  }
  function editorSnapshot() {
    return JSON.stringify([...FAILURE_REVIEW_FIELDS, 'executor', 'reproduction'].map(name => [name, control(name)?.value || '']));
  }
  function previewParagraph(text: string, className?: string) {
    if (!importBox) return;
    const paragraph = document.createElement('p'); paragraph.textContent = text;
    if (className) paragraph.className = className;
    importBox.append(paragraph);
  }
  function previewField(label: string, text: string, field?: string) {
    if (!importBox) return;
    const block = document.createElement('div'); const heading = document.createElement('strong'); const content = document.createElement('pre');
    block.className = 'failure-import-field'; heading.textContent = label; content.textContent = text || '未记录';
    if (field) content.dataset.failurePreviewField = field;
    block.append(heading, content); importBox.append(block);
  }
  function renderImportPreview() {
    if (!importPreview || !importBox) return;
    const preview = importPreview; const imported = preview.imported;
    importBox.replaceChildren(); importBox.hidden = false; preview.review = null;
    if (importApply) importApply.disabled = true;
    previewParagraph('仅供预览 · 尚未起稿 · 文件中的经历与状态未经本页核验', 'failure-import-trust');
    previewField('来源文件与内容指纹（仅标识所选字节，不证明来源真实性）', `文件名：${imported.source.fileName}\nSHA-256：${imported.source.sha256}\n字节数：${imported.source.sizeBytes}\n本次本机读入时间：${imported.source.importedAt}`);
    previewParagraph(current || dirty || FAILURE_REVIEW_FIELDS.some(name => !!control(name)?.value) ? '当前编辑区已有内容。起稿会替换全部编辑内容，并解除原账户记录的关联；如需保留，请先导出当前 JSON。账户中的原记录不会因此被修改。' : '起稿后是一条尚未保存的新复盘；只有再次明确保存才会写入账户。');
    let kind: 'python' | 'assembly' | undefined;
    if (imported.kind === 'first-study') {
      kind = importKind?.value === 'python' || importKind?.value === 'assembly' ? importKind.value : undefined;
      previewParagraph('来源：首次试学备份。下方仅把选中实验的既有观察整理为新草稿；执行者与复现状态保持“未运行”，不是对文件运行声明的核验。');
      previewField('原文件自述状态与时间（历史声明）', `自述开始时间：${imported.draft.startedAt || '未记录'}\n自述结束时间：${imported.draft.finishedAt || '未记录'}\n四步自述确认：${Object.values(imported.draft.declarations).filter(value => value.selfReported).length} / 4\n原自述执行环境：${imported.draft.fields.environment || '未提供'}\n已附结果文件：${imported.draft.evidence.length} 份，均为未经证实的文件`);
      if (!kind) { importMessage('试学备份已读取，尚未起稿。请明确选择 Python 或装配，再核对完整复盘预览。'); return; }
      const evidence = imported.draft.evidence.find(item => item.kind === kind);
      previewField('选中实验文件的原声明（不证明实际执行）', evidence ? `执行状态：${evidence.declaredStatus}\n环境：${evidence.declaredEnvironment || '未提供'}\n输入对照：${evidence.modelMatch}\n原结果文件导入时间（本机声明）：${evidence.importedAt}` : '原备份未附这一类结果文件；仅能整理本人自述。');
    } else previewParagraph('来源：失败复盘 JSON。原有正文、执行者与复现状态按文件自述保留；不会继承账户记录标识、公开状态或个人学习状态。');
    const prepared = prepareFailureReviewImport(imported, kind);
    if (!prepared.ok) { importMessage(`${prepared.error} 当前编辑内容保持不变。`); return; }
    if (prepared.value.diagnosticId && !diagnostics.some(item => item.id === prepared.value.diagnosticId)) {
      importMessage('文件关联的诊断不在当前公开目录中，已停止起稿；没有删除关联或修改当前内容。'); return;
    }
    preview.review = prepared.value;
    previewParagraph('将填入编辑区的完整复盘：', 'failure-import-trust');
    for (const field of [...FAILURE_REVIEW_FIELDS, 'executor', 'reproduction'] as const) {
      const label = imported.kind === 'first-study' && (field === 'executor' || field === 'reproduction') ? `${field === 'executor' ? '执行者' : '复现状态'}（新草稿默认，待本人填写）` : previewLabels[field];
      previewField(label, prepared.value[field], field);
    }
    if (importApply) importApply.disabled = busy;
    importMessage('完整草稿已生成预览，尚未改写编辑区。核对正文、文件自述与替换范围后，再明确作为新复盘起稿。');
  }

  function control(name: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
    const value = editor.elements.namedItem(name);
    return value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement || value instanceof HTMLSelectElement ? value : null;
  }
  for (const name of FAILURE_REVIEW_FIELDS) {
    const field = control(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.maxLength = FAILURE_FIELD_LIMITS[name];
  }
  function message(text: string, error = false, recordId?: string) {
    statusTarget.textContent = text;
    statusTarget.classList.toggle('is-error', error);
    if (recordId && isFailureRecordId(recordId)) {
      const link = document.createElement('a');
      link.href = `/learning/records/?id=${encodeURIComponent(recordId)}`;
      link.textContent = '到原学习工作台查看';
      statusTarget.append(document.createTextNode(' '), link);
    }
  }
  function setBusy(value: boolean) {
    if (value) invalidateImport('正在处理账户记录，导入预览已取消；当前编辑内容保持不变。');
    busy = value;
    editor.inert = value;
    if (importFile) importFile.disabled = value;
    save.disabled = value || blocked;
    save.textContent = value ? '正在处理…' : '保存私人草稿';
    $<HTMLButtonElement>('#failure-new')?.toggleAttribute('disabled', value);
    renderList();
  }
  function collect(): FailureReview {
    const draft = blankFailureReview();
    for (const name of FAILURE_REVIEW_FIELDS) {
      const rendered = control(name)?.value || '';
      const original = importedLiterals.get(name);
      if (original && original.rendered !== rendered) importedLiterals.delete(name);
      draft[name] = original && original.rendered === rendered ? original.raw : rendered;
    }
    // A hidden input is still untrusted. Only a real catalog member can be associated.
    if (draft.diagnosticId && !diagnostics.some(card => card.id === draft.diagnosticId)) throw new Error('关联诊断不在当前公开目录中，请新建复盘后重试；输入仍保留。');
    const values = { ...draft, executor: control('executor')?.value || '未运行', reproduction: control('reproduction')?.value || '未运行' };
    const result = validateFailureReview(values);
    if (result.ok === false) throw new Error(result.error);
    return result.value;
  }
  function fill(review: FailureReview, item: StudyItem | null = null) {
    editorRevision++;
    invalidateImport(undefined, true);
    importedLiterals.clear();
    editor.reset();
    for (const name of [...FAILURE_REVIEW_FIELDS, 'executor', 'reproduction'] as const) {
      const input = control(name);
      if (input) {
        input.value = review[name];
        if (name !== 'executor' && name !== 'reproduction' && review[name] !== input.value) importedLiterals.set(name, { raw: review[name], rendered: input.value });
      }
    }
    lastEditorSnapshot = editorSnapshot();
    current = item;
    currentOwner = item ? userId : '';
    blocked = false;
    save.disabled = busy;
    dirty = false;
    const records = $<HTMLAnchorElement>('#failure-records');
    if (records) records.href = item ? `/learning/records/?id=${encodeURIComponent(item.id)}` : '/learning/records/';
    renderList();
  }
  function markDirty(event: Event) {
    const snapshot = editorSnapshot();
    // Text inputs emit change only on blur, often after input already handled
    // the edit. A file picker may keep that blur pending until Apply is clicked.
    if (event.type === 'change' && snapshot === lastEditorSnapshot) return;
    lastEditorSnapshot = snapshot;
    const field = event.target;
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) importedLiterals.delete(field.name);
    editorRevision++;
    const pending = importPreview !== null || importCancel?.disabled === false;
    invalidateImport(pending ? '编辑内容已变化，导入预览已取消；请重新选择文件并核对。' : undefined);
    dirty = true;
    if (!blocked && !busy) message('有未保存的修改。当前输入只留在此页，可导出备份。');
  }
  function canLeave(): boolean {
    return !busy && (!dirty || window.confirm('当前修改尚未保存。确认放弃并切换？可取消后先导出备份。'));
  }

  async function api(path: string, init: RequestInit = {}): Promise<Record<string, any>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const headers = new Headers(init.headers);
      if (init.method && init.method !== 'GET') {
        const tokenResponse = await fetch('/api/auth/csrf-token', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        const csrf = await tokenResponse.json().catch(() => null);
        if (!tokenResponse.ok || !csrf?.ok || typeof csrf.token !== 'string' || !csrf.token) throw new Error('无法取得安全令牌，请稍后重试；输入仍保留。');
        headers.set('X-CSRF-Token', csrf.token);
        headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        if (response.status === 401) throw new Error('登录已失效。请先导出当前输入，再登录并重新读取账户。');
        if (response.status === 409) throw new Error('保存冲突：这条记录已在其他页面更新。当前输入完整保留，请先导出，再打开最新版本合并。');
        throw new Error(typeof data?.error === 'string' ? data.error : `请求失败（${response.status}），输入仍保留。`);
      }
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('请求超时，保存结果尚未确认。请先导出备份，再重新读取账户核对，避免重复新建。');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function renderList() {
    listTarget.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = userId ? '账户中暂无失败复盘。填写真实过程后，可保存私人草稿。' : '登录并读取账户后，在这里查看已保存的失败复盘。';
      listTarget.append(empty);
      return;
    }
    for (const item of [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      const card = document.createElement('div');
      card.className = 'failure-list-item';
      const title = document.createElement('strong'); title.textContent = item.title;
      const meta = document.createElement('span');
      const visibility = item.visibility === 'private' ? '私人' : item.visibility === 'pending' ? '待公开' : '已公开';
      meta.textContent = `修订 ${item.revision} · ${visibility}`;
      const open = document.createElement('button');
      open.type = 'button'; open.className = 'btn btn-ghost btn-sm';
      open.textContent = item.id === current?.id ? '重新读取' : '打开'; open.disabled = busy;
      open.dataset.failureOpen = item.id;
      open.addEventListener('click', () => { if (canLeave()) void openItem(item.id); });
      card.append(title, meta, open); listTarget.append(card);
    }
  }
  function renderAuth(text: string, loggedIn: boolean) {
    authTarget.textContent = text;
    if (!loggedIn) {
      const login = document.createElement('a'); login.href = '/login/'; login.target = '_blank'; login.rel = 'noopener'; login.textContent = '在新标签页登录';
      authTarget.append(document.createTextNode(' '), login);
    }
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn-ghost btn-sm';
    retry.textContent = '重新读取账户'; retry.disabled = busy || connecting;
    retry.addEventListener('click', () => { if (!busy && !connecting) void loadAccount(); });
    authTarget.append(document.createTextNode(' '), retry);
  }
  async function openItem(id: string) {
    invalidateImport('读取记录前已取消导入预览；尚未起稿。');
    if (busy) return;
    if (!isFailureRecordId(id)) { message('复盘标识无效，未读取任何记录。', true); return; }
    setBusy(true);
    message('正在读取账户中的最新版本…');
    try {
      const data = await api(`/api/study/items/${encodeURIComponent(id)}`);
      const result = readFailureStudyItem(data.item);
      if (result.ok === false) {
        blocked = true;
        message(result.error, true, id);
        return;
      }
      fill(result.value.review, result.value.item);
      const url = new URL(location.href); url.search = ''; url.searchParams.set('id', id);
      history.replaceState(null, '', `${url.pathname}${url.search}`);
      message(`已读取私人复盘 · 修订 ${result.value.item.revision}。本页保存为草稿；个人学习状态独立保留。`);
    } catch (error) { message(error instanceof Error ? error.message : '读取失败，当前输入仍保留。', true); }
    finally { setBusy(false); }
  }

  async function loadAccount() {
    const generation = ++authGeneration;
    connecting = true;
    authTarget.textContent = '正在核对登录状态…';
    try {
      const session = await api('/api/auth/me');
      if (generation !== authGeneration) return;
      userId = typeof session.user?.userId === 'string' ? session.user.userId : '';
      items = [];
      if (!userId) {
        renderList(); connecting = false;
        renderAuth('当前为匿名编辑，输入只留在本页。可导出备份，登录后显式保存到账户。', false);
        return;
      }
      const collected: StudyItem[] = [];
      const cursors = new Set<string>();
      let cursor = '';
      do {
        const data = await api(`/api/study/items?kind=record${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        if (generation !== authGeneration) return;
        if (!Array.isArray(data.items) || data.items.length > 200) throw new Error('账户列表响应格式无效，请重试读取。');
        for (const value of data.items) {
          if (value?.kind === 'record' && value.fields?.recordType === '失败复盘' && isFailureRecordId(value.id)
            && typeof value.title === 'string' && typeof value.updatedAt === 'string' && Number.isSafeInteger(value.revision)) collected.push(value as StudyItem);
        }
        cursor = typeof data.cursor === 'string' ? data.cursor : '';
        if (cursor && (cursor.length > 2048 || cursors.has(cursor))) throw new Error('账户分页响应异常，未继续读取。');
        if (cursor) cursors.add(cursor);
      } while (cursor);
      items = collected;
      renderList();
      const id = requested.get('id');
      if (id && !requestedOpened && !dirty && !busy) {
        requestedOpened = true;
        if (isFailureRecordId(id)) await openItem(id);
        else { blocked = true; save.disabled = true; message('URL 中的复盘标识无效，请新建复盘或从账户列表打开。', true); }
      }
    } catch (error) {
      if (generation !== authGeneration) return;
      connecting = false;
      renderAuth(`账户暂不可读：${error instanceof Error ? error.message : '请稍后重试'}。可继续编辑和导出。`, Boolean(userId));
      renderList();
      return;
    } finally {
      if (generation === authGeneration) connecting = false;
    }
    renderAuth(userId ? '账户已连接。仅点击保存后写入私人草稿，每次保存保留版本。' : '当前为匿名编辑，输入只留在本页。可导出备份，登录后显式保存到账户。', Boolean(userId));
  }

  async function saveReview() {
    invalidateImport('保存操作已取消待导入预览；未明确起稿的文件不会写入账户。');
    if (busy || blocked) return;
    if (connecting) { message('正在读取账户，请稍后再保存；输入仍保留。', true); return; }
    if (!userId) { message('请先在新标签页登录，再点击“重新读取账户”。当前可匿名编辑和导出。', true); return; }
    let draft: FailureReview;
    try { draft = collect(); toFailureStudyItem(draft, current || undefined); }
    catch (error) { message(error instanceof Error ? error.message : '复盘内容无效。', true); return; }
    setBusy(true);
    message('正在核对账户并保存私人草稿…');
    try {
      const session = await api('/api/auth/me');
      const accountId = typeof session.user?.userId === 'string' ? session.user.userId : '';
      if (!accountId || accountId !== userId || (current && accountId !== currentOwner)) throw new Error('登录账户已变化或失效，已停止保存。请先导出输入，重新读取正确账户后再操作。');
      const item = toFailureStudyItem(draft, current || undefined);
      const data = await api(current ? `/api/study/items/${encodeURIComponent(current.id)}` : '/api/study/items', {
        method: current ? 'PUT' : 'POST', body: JSON.stringify({ item, revision: current?.revision }),
      });
      const saved = readFailureStudyItem(data.item);
      if (!saved.ok) throw new Error('服务器已响应，但保存内容无法安全确认。请先导出，再重新读取账户核对；不要重复新建。');
      items = [saved.value.item, ...items.filter(value => value.id !== saved.value.item.id)];
      fill(saved.value.review, saved.value.item);
      const url = new URL(location.href); url.search = ''; url.searchParams.set('id', saved.value.item.id);
      history.replaceState(null, '', `${url.pathname}${url.search}`);
      message(`已保存到当前账户 · 私人草稿 · 修订 ${saved.value.item.revision}。复现状态与个人学习状态分别记录。`);
    } catch (error) { message(error instanceof Error ? error.message : '保存失败，输入仍保留。', true); }
    finally { setBusy(false); }
  }

  function download(kind: 'md' | 'json') {
    try {
      const review = collect();
      const text = kind === 'md' ? failureReviewMarkdown(review) : failureReviewJson(review);
      const blob = new Blob([text], { type: kind === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(review.title.trim() || '失败复盘').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80)}.${kind}`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      message(`已发起 ${kind === 'md' ? 'Markdown' : 'JSON'} 下载；导出不代表账户已保存。`);
    } catch (error) { message(error instanceof Error ? error.message : '导出失败，原输入仍保留。', true); }
  }

  editor.addEventListener('submit', event => { event.preventDefault(); void saveReview(); });
  editor.addEventListener('input', markDirty);
  editor.addEventListener('change', markDirty);
  $('#failure-export-md')?.addEventListener('click', () => download('md'));
  $('#failure-export-json')?.addEventListener('click', () => download('json'));
  $('#failure-new')?.addEventListener('click', () => {
    invalidateImport('已取消导入预览。');
    if (!canLeave()) return;
    requestedOpened = true;
    fill(blankFailureReview());
    history.replaceState(null, '', location.pathname);
    message('新复盘尚未保存。日期、经历与结果均按实际填写，默认未运行。');
    control('title')?.focus();
  });
  importFile?.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    invalidateImport(undefined, false, false);
    if (!file) { importMessage('尚未选择文件。'); return; }
    if (busy) { importMessage('正在处理账户记录，请完成后再选择文件。'); return; }
    const generation = importGeneration; const revision = editorRevision; const snapshot = editorSnapshot();
    if (importCancel) importCancel.disabled = false;
    if (file.size > MAX_FAILURE_REVIEW_IMPORT_BYTES) { importMessage('导入文件最多 2 MiB；当前编辑内容与账户记录保持不变。'); return; }
    importMessage('正在本机读取与检查文件；尚未改写编辑区，不会执行导入代码。');
    try {
      const parsed = await readFailureReviewImport(new Uint8Array(await file.arrayBuffer()), file.name, new Date().toISOString());
      if (generation !== importGeneration || revision !== editorRevision || snapshot !== editorSnapshot() || busy) return;
      if (!parsed.ok) { importMessage(`${parsed.error} 当前编辑内容与账户记录保持不变。`); return; }
      importPreview = { imported: parsed.value, review: null, revision, editorSnapshot: snapshot };
      if (importKind) {
        importKind.value = ''; importKind.disabled = parsed.value.kind !== 'first-study';
        importKind.closest<HTMLElement>('label')?.toggleAttribute('hidden', parsed.value.kind !== 'first-study');
      }
      renderImportPreview();
    } catch {
      if (generation === importGeneration) importMessage('无法读取这份 JSON 文件；当前编辑内容与账户记录保持不变。');
    }
  });
  importKind?.addEventListener('change', () => {
    if (busy || !importPreview) return;
    if (importPreview.revision !== editorRevision || importPreview.editorSnapshot !== editorSnapshot()) { invalidateImport('编辑内容已变化，请重新选择文件并核对。'); return; }
    renderImportPreview();
  });
  importApply?.addEventListener('click', () => {
    if (busy || !importPreview?.review) return;
    if (importPreview.revision !== editorRevision || importPreview.editorSnapshot !== editorSnapshot()) { invalidateImport('编辑内容已变化，请重新选择文件并核对。'); return; }
    const preview = importPreview;
    const review = importPreview.review;
    if (review.diagnosticId && !diagnostics.some(item => item.id === review.diagnosticId)) { invalidateImport('关联诊断不在当前公开目录中，未起稿，原编辑内容保留。'); return; }
    requestedOpened = true;
    fill(review);
    current = null; currentOwner = ''; dirty = true;
    history.replaceState(null, '', location.pathname);
    if (importSource) {
      importSource.hidden = false;
      importSource.textContent = `本页起稿来源提示（仅本页展示，不额外加入账户或导出字段）：${preview.imported.source.fileName} · SHA-256 ${preview.imported.source.sha256} · ${preview.imported.source.sizeBytes} 字节 · 本次本机读入时间 ${preview.imported.source.importedAt}。散列仅标识所选字节，不核验来源；后续编辑未计入这个指纹。预览中“证据”字段所列来源索引属于你明确选择起稿的正文，会随正文保存或导出。未编辑字段保留导入原文的换行格式，即使单行控件省去换行显示；编辑某字段后，该字段按编辑框文本记录，其余字段仍保留原格式。`;
    }
    importMessage('已按你的明确操作作为新复盘起稿。来源文件与账户原记录均未修改；保存前请核对完整草稿。');
    message('新复盘尚未保存。文件中的正文与状态只是自述；本页未核验运行、复现、根因或学习掌握。保存将新建私人草稿。');
    control('title')?.focus();
  });
  importCancel?.addEventListener('click', () => invalidateImport('已取消导入预览；当前编辑内容与账户记录保持不变。'));
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

  const initial = prefillFailureReview(requested.get('diagnostic'), diagnostics);
  fill(initial);
  if (initial.diagnosticId) message('关联诊断仅作排查指导。这里是空白复盘，请填写你实际做过的尝试和证据。');
  else if (requested.has('diagnostic')) message('未找到该公开诊断，已打开空白复盘；没有采用 URL 中的其他内容。');
  void loadAccount();
}
