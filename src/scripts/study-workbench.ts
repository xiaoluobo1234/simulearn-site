import { ORGANIZE_PROMPT } from '../data/study-schema';

type Kind = 'record' | 'source' | 'note';
interface Item {
  id?: string;
  kind: Kind;
  title: string;
  fields: Record<string, string>;
  sourceIds: string[];
  noteIds: string[];
  learningStatus: string;
  reviewStatus: string;
  visibility: string;
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
}

const app = document.querySelector<HTMLElement>('[data-study-workbench]');
if (app) initWorkbench(app);

function initWorkbench(app: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
  const form = $<HTMLFormElement>('#study-form');
  const kinds: Kind[] = ['record', 'source', 'note'];
  const labels: Record<Kind, string> = { record: '学习记录', source: '资料卡', note: '知识笔记' };
  const reviewLabels: Record<string, string> = { draft: '草稿', pending: '待复核', reviewed: '已核对' };
  const visibilityLabels: Record<string, string> = { private: '私人', pending: '待公开', public: '已公开' };
  const fieldLabels: Record<string, string> = {
    date: '学习日期', organizedDate: '整理日期', recordType: '记录类型', project: '所属项目', knowledgeLinks: '关联知识点或站内文章', raw: '原始记录', problem: '这次的问题', expected: '完成后应该观察到什么', attempts: '实际尝试', planned: '未执行但准备尝试', code: '代码、文件或提交版本', executor: '执行者与环境', input: '输入样例', expectedOutput: '预期输出', actualOutput: '实际输出或报错', evidence: '结果证据与来源链接', reproduction: '复现状态', understanding: '我的理解', misconceptions: '当时的误解与修正依据', uncertainties: '未解决问题', version: '软件或资料版本', conditions: '适用条件与单位', untested: '尚未测试的情况', nextTask: '下一项学习任务', doneWhen: '可观察的完成条件', body: '整理稿', url: '原始链接', author: '作者或发布机构', type: '资料类型', readRange: '实际阅读范围', reason: '收藏原因', conclusion: '支持的具体结论', readStatus: '阅读与核验状态', nextReading: '下一次阅读范围', accessLimits: '访问限制与未核验信息', publicBody: '公开稿',
  };
  const learningLabels: Record<string, string> = { 'not-started': '未开始', introduced: '已接触', followed: '跟随完成', explain: '能解释', independent: '能独立修改并复现' };
  let kind: Kind = 'record';
  let current: Item;
  let items: Record<Kind, Item[]> = { record: [], source: [], note: [] };
  let userId = '';
  let dirty = false;
  let busy = false;
  let loading = false;
  let loaded = false;
  let versions: Item[] = [];
  let selectedVersion: Item | null = null;
  let aiTarget: string | undefined;

  function message(text: string, error = false) {
    const target = $('#study-message');
    target.textContent = text;
    target.classList.toggle('is-error', error);
  }

  function blank(nextKind: Kind): Item {
    return { kind: nextKind, title: '', fields: nextKind === 'record' ? { executor: '未运行', reproduction: '未运行', recordType: '学习过程' } : {}, sourceIds: [], noteIds: [], learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' };
  }

  function markDirty() {
    if (loading) return;
    dirty = true;
    $('#study-save-state').textContent = '有未保存的修改';
    $('#study-save-state').classList.add('is-dirty');
    updateSaveLabel();
  }

  function updateSaveLabel() {
    $('#study-save').textContent = (form.elements.namedItem('reviewStatus') as HTMLSelectElement).value === 'draft' ? '保存草稿' : '保存更改';
  }

  function collect(): Item {
    const result: Item = { ...current, fields: { ...current.fields }, sourceIds: [], noteIds: [] };
    result.title = $<HTMLInputElement>('#study-title').value.trim();
    const names = kind === 'record' ? 'field:' : `${kind}:`;
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[name]').forEach(control => {
      if (control.name.startsWith(names) || control.name === 'field:body') result.fields[control.name.slice(control.name.indexOf(':') + 1)] = control.value;
    });
    for (const status of ['learningStatus', 'reviewStatus', 'visibility'] as const) result[status] = (form.elements.namedItem(status) as HTMLSelectElement).value;
    result.sourceIds = Array.from(app.querySelectorAll<HTMLInputElement>('[data-ref="source"]:checked')).map(input => input.value);
    result.noteIds = Array.from(app.querySelectorAll<HTMLInputElement>('[data-ref="note"]:checked')).map(input => input.value);
    return result;
  }

  function fill(item: Item) {
    loading = true;
    current = structuredClone(item);
    form.reset();
    $<HTMLInputElement>('#study-title').value = item.title;
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[name]').forEach(control => {
      if (control.name.includes(':')) control.value = item.fields[control.name.split(':')[1]] || (control.name === 'field:executor' || control.name === 'field:reproduction' ? '未运行' : control.name === 'field:recordType' ? '学习过程' : '');
    });
    for (const status of ['learningStatus', 'reviewStatus', 'visibility'] as const) (form.elements.namedItem(status) as HTMLSelectElement).value = item[status];
    app.querySelectorAll<HTMLElement>('[data-section]').forEach(section => section.hidden = section.dataset.section !== kind);
    $('[data-raw-field]').hidden = kind !== 'record';
    $('[data-ai-tools]').hidden = kind !== 'record';
    $('[data-references]').hidden = kind === 'source';
    $('[data-note-refs-wrap]').hidden = kind !== 'record';
    $('#study-body-heading').textContent = kind === 'record' ? '原始记录与整理稿' : kind === 'source' ? '资料补充说明' : '知识笔记正文';
    $('#study-kind-label').textContent = `${item.id ? '编辑' : '新建'}${labels[kind]}`;
    $<HTMLInputElement>('#study-title').placeholder = kind === 'record' ? '给这次学习一个具体的标题' : kind === 'source' ? '资料标题与适用版本' : '一个可复用的知识点';
    $('#study-save-state').textContent = item.id ? `已保存 · 修订 ${item.revision}` : '尚未保存';
    $('#study-save-state').classList.remove('is-dirty');
    $<HTMLButtonElement>('#study-history').disabled = !item.id;
    $('#study-ai-status').textContent = '';
    dirty = false;
    renderReferences();
    renderList();
    updateSaveLabel();
    loading = false;
  }

  function renderReferences() {
    for (const refKind of ['source', 'note'] as const) {
      const container = $(`#study-${refKind}-refs`);
      const selected = !loading && dirty && container.querySelector('input')
        ? Array.from(container.querySelectorAll<HTMLInputElement>('input:checked')).map(input => input.value)
        : refKind === 'source' ? current.sourceIds : current.noteIds;
      container.replaceChildren();
      if (!items[refKind].length) {
        const empty = document.createElement('p');
        empty.className = 'study-muted';
        empty.textContent = loaded ? `暂无${labels[refKind]}。切换上方标签新建后，可在这里关联。` : '登录并读取内容后，可选择已有条目。';
        container.append(empty);
      }
      items[refKind].filter(item => item.id !== current.id).forEach(item => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.ref = refKind;
        input.value = item.id!;
        input.checked = selected.includes(item.id!);
        const text = document.createElement('span');
        text.textContent = item.title;
        label.append(input, text);
        container.append(label);
      });
    }
  }

  function renderList() {
    for (const value of kinds) $(`[data-count="${value}"]`).textContent = loaded ? String(items[value].length) : '—';
    const container = $('#study-list');
    container.replaceChildren();
    const query = $<HTMLInputElement>('#study-search').value.trim().toLocaleLowerCase();
    const filter = $<HTMLSelectElement>('#study-filter').value;
    const matches = items[kind].filter(item => (!filter || item.reviewStatus === filter) && (!query || `${item.title} ${Object.values(item.fields).join(' ')}`.toLocaleLowerCase().includes(query)));
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'study-empty';
      const mark = document.createElement('span');
      mark.className = 'study-empty-mark'; mark.textContent = '＋';
      const heading = document.createElement('strong');
      heading.textContent = query || filter ? '没有匹配的内容' : loaded ? `第一条${labels[kind]}，从这里开始` : '你的记录，从这里开始';
      const text = document.createElement('p');
      text.textContent = query || filter ? '试试其他关键词或审核状态。' : kind === 'record' ? '一次真实的问题、一段报错或一个还没想明白的地方，都值得留下。' : '保存原始来源与自己的理解，再在学习记录中引用。';
      empty.append(mark, heading, text); container.append(empty);
    }
    matches.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).forEach(item => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `study-list-item${item.id === current.id ? ' is-active' : ''}`;
      const title = document.createElement('strong'); title.textContent = item.title;
      const date = document.createElement('span'); date.textContent = item.fields.date || (item.updatedAt ? `整理于 ${new Date(item.updatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : '学习日期未提供');
      const status = document.createElement('small'); status.textContent = `${reviewLabels[item.reviewStatus]} · ${visibilityLabels[item.visibility]}`;
      button.append(title, date, status);
      button.addEventListener('click', () => openItem(item)); container.append(button);
    });
  }

  async function api(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), path.endsWith('/organize') ? 60000 : 20000);
    try {
      const headers = new Headers(init.headers);
      if (init.method && init.method !== 'GET') {
        headers.set('Content-Type', 'application/json');
        // Explicitly obtain a token as well as using BaseLayout's interceptor.
        // This also covers cached pages whose script execution order differs.
        const csrfResponse = await fetch('/api/auth/csrf-token', { credentials: 'same-origin', signal: controller.signal });
        const csrf = await csrfResponse.json();
        if (!csrfResponse.ok || !csrf.token) throw new Error('无法取得安全令牌，请刷新页面后重试。');
        headers.set('X-CSRF-Token', csrf.token);
      }
      const response = await fetch(path, { ...init, headers, credentials: 'same-origin', signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        if (response.status === 401) throw new Error('登录已失效。请先导出当前内容，再重新登录。');
        if (response.status === 409) throw new Error('这条记录已在其他页面更新。当前输入已保留，请先导出，再重新载入最新版本后合并。');
        if (response.status === 503) throw new Error(data?.error || '服务暂不可用，请稍后重试。');
        throw new Error(typeof data?.error === 'string' ? data.error : `请求失败（${response.status}），输入内容仍保留在编辑器中。`);
      }
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('请求超时，输入内容仍保留。请稍后重试，或先导出备份。');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function canLeave() { return !busy && (!dirty || window.confirm('当前修改尚未保存。确认放弃这些修改并切换？可取消后先保存或导出。')); }

  async function openItem(item: Item) {
    if (!canLeave()) return;
    busy = true;
    form.inert = true;
    message('正在读取最新版本…');
    try { const data = await api(`/api/study/items/${encodeURIComponent(item.id!)}`); fill(data.item); message(''); }
    catch (error) { message((error as Error).message, true); }
    finally { busy = false; form.inert = false; }
  }

  function switchKind(nextKind: Kind) {
    kind = nextKind;
    app.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(tab => { const active = tab.dataset.kind === kind; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); });
    $('#study-list-title').textContent = `我的${labels[kind]}`;
    $('#study-new').setAttribute('aria-label', `新建${labels[kind]}`);
  }

  async function save(publicConfirmed = false, override?: Item) {
    if (busy) return false;
    if (!userId) { message('请先登录再保存。你也可以导出当前内容作为本地备份。', true); return false; }
    const item = override || collect();
    if (!item.title) { message('请先填写一个具体的标题。', true); $<HTMLInputElement>('#study-title').focus(); return false; }
    if (item.visibility === 'public' && !publicConfirmed) { message('请通过“预览公开稿”重新核对本次公开内容，或将公开状态改为私人后保存。', true); return false; }
    busy = true;
    form.inert = true;
    $('#study-save-state').textContent = '正在保存…';
    message('');
    try {
      const data = await api(item.id ? `/api/study/items/${encodeURIComponent(item.id)}` : '/api/study/items', {
        method: item.id ? 'PUT' : 'POST', body: JSON.stringify({ item, revision: item.revision, ...(publicConfirmed ? { publicConfirmed: true } : {}) }),
      });
      items[kind] = [data.item, ...items[kind].filter(existing => existing.id !== data.item.id)];
      fill(data.item);
      message(`已保存到你的账户 · 修订 ${data.item.revision}。`);
      if (data.item.visibility === 'public') {
        const link = document.createElement('a');
        link.href = `/learning/shared/?owner=${encodeURIComponent(userId)}&id=${encodeURIComponent(data.item.id)}`;
        link.target = '_blank'; link.rel = 'noopener'; link.textContent = ' 查看公开稿 ↗'; $('#study-message').append(link);
      }
      return true;
    } catch (error) {
      $('#study-save-state').textContent = '保存失败 · 输入已保留';
      message((error as Error).message, true);
      return false;
    } finally { busy = false; form.inert = false; }
  }

  function markdown(item: Item) {
    const lines = [`# ${item.title || `未命名${labels[item.kind]}`}`, '', `- 类型：${labels[item.kind]}`, `- 个人学习状态：${learningLabels[item.learningStatus]}`, `- 内容审核状态：${reviewLabels[item.reviewStatus]}`, `- 公开状态：${visibilityLabels[item.visibility]}`, `- 修订：${item.revision || '未保存'}`, ''];
    for (const [key, value] of Object.entries(item.fields)) {
      if (value.trim()) lines.push(`## ${fieldLabels[key] || key}`, '', value, '');
    }
    if (!item.fields.date && item.kind === 'record') lines.push('学习发生日期：未提供', '');
    for (const refKind of ['source', 'note'] as const) {
      const ids = refKind === 'source' ? item.sourceIds : item.noteIds;
      if (ids.length) {
        lines.push(`## 关联${labels[refKind]}`, '');
        ids.forEach(id => { const ref = items[refKind].find(value => value.id === id); lines.push(`- ${ref?.title || id}（${id}）`); if (ref) for (const [key, value] of Object.entries(ref.fields)) if (value) lines.push(`  - ${fieldLabels[key] || key}：${value.replace(/\n/g, '\n    ')}`); });
        lines.push('');
      }
    }
    return lines.join('\n');
  }

  function download(content: string, extension: string, mime: string) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a'); link.href = url; link.download = `${collect().title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 90) || 'simulearn-record'}.${extension}`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('已导出当前输入，包含尚未保存的修改。导出不会改变审核或公开状态。');
  }

  async function load() {
    const auth = $('#study-auth');
    auth.textContent = '正在核对登录状态…';
    try {
      const session = await api('/api/auth/me');
      userId = session.user?.userId || '';
      if (!userId) {
        auth.replaceChildren(document.createTextNode('登录后，记录将保存到你的账户并可跨设备读取。当前可填写、复制提示词和导出；尚未保存的输入只留在此页。 '));
        const link = document.createElement('a'); link.href = '/login'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = '在新标签页登录 ↗'; auth.append(link);
        auth.append(document.createTextNode(' '));
        const reconnect = document.createElement('button'); reconnect.type = 'button'; reconnect.className = 'study-text-button'; reconnect.textContent = '登录后重新读取'; reconnect.onclick = () => { if (!busy) load(); }; auth.append(reconnect);
        renderList(); renderReferences(); return;
      }
      const results = await Promise.all(kinds.map(async value => {
        const collected: Item[] = [];
        let cursor = '';
        do {
          const data = await api(`/api/study/items?kind=${value}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
          collected.push(...data.items); cursor = data.cursor || '';
        } while (cursor);
        return [value, collected] as const;
      }));
      results.forEach(([value, values]) => { items[value] = values; });
      loaded = true;
      auth.textContent = '账户已连接 · 保存后可跨设备读取。每次修改都保留版本，原始记录默认私人。';
      auth.classList.add('study-notice--success');
      renderList(); renderReferences();
      const requestedId = new URLSearchParams(location.search).get('id');
      if (requestedId && !dirty) {
        const response = await api(`/api/study/items/${encodeURIComponent(requestedId)}`);
        if (kinds.includes(response.item.kind)) { switchKind(response.item.kind); fill(response.item); }
      }
    } catch (error) {
      auth.replaceChildren(document.createTextNode(`暂时无法读取账户或记录：${(error as Error).message} `));
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'study-text-button'; retry.textContent = '重试读取'; retry.onclick = () => { if (!busy) load(); }; auth.append(retry);
      renderList(); renderReferences();
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); save(); });
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  $('#study-search').addEventListener('input', renderList);
  $('#study-filter').addEventListener('change', renderList);
  $('#study-new').addEventListener('click', () => { if (canLeave()) { fill(blank(kind)); message('新建内容默认私人草稿。请按实际经历填写。'); $('#study-title').focus(); } });
  app.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.kind === kind || !canLeave()) return;
    switchKind(button.dataset.kind as Kind);
    fill(blank(kind)); message('');
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));

  $('#study-export').addEventListener('click', () => download(markdown(collect()), 'md', 'text/markdown;charset=utf-8'));
  $('#study-export-json').addEventListener('click', () => {
    const item = collect();
    download(JSON.stringify({ format: 'simulearn-study-v1', item, references: [...items.source.filter(value => item.sourceIds.includes(value.id!)), ...items.note.filter(value => item.noteIds.includes(value.id!))] }, null, 2), 'json', 'application/json;charset=utf-8');
  });

  $('#study-copy-prompt').addEventListener('click', async () => {
    const text = `${ORGANIZE_PROMPT}\n\n以下是我本次的原始记录：\n${markdown(collect())}`;
    try { await navigator.clipboard.writeText(text); $('#study-ai-status').textContent = '完整提示词与当前记录已复制。可交给你使用的 AI 整理，再粘贴回来核对。'; }
    catch { download(text, 'txt', 'text/plain;charset=utf-8'); $('#study-ai-status').textContent = '浏览器未开放剪贴板，已导出完整提示词文本。'; }
  });

  $('#study-organize').addEventListener('click', async () => {
    if (busy) return;
    const item = collect();
    if (!userId) { $('#study-ai-status').textContent = '登录后可使用在线整理。也可复制完整提示词与记录，在你使用的 AI 中手动整理。'; return; }
    if (![item.fields.raw, item.fields.problem, item.fields.attempts, item.fields.actualOutput].some(value => value?.trim())) { $('#study-ai-status').textContent = '先写下一个实际问题、尝试或原始记录，再进行整理。'; return; }
    const raw = markdown(item);
    if (raw.length > 24000) { $('#study-ai-status').textContent = '本次材料超过在线整理的 24,000 字符限制。请缩短原始材料，或复制完整提示词在你使用的 AI 中整理。'; return; }
    aiTarget = current.id;
    busy = true;
    $<HTMLButtonElement>('#study-organize').disabled = true;
    $('#study-ai-status').textContent = '正在根据本次记录生成建议，原始输入保持在编辑器中…';
    try {
      const data = await api('/api/study/organize', { method: 'POST', body: JSON.stringify({ raw }) });
      if (typeof data.draft !== 'string' || !data.draft.trim()) throw new Error('整理服务没有返回有效草稿。');
      $('#study-ai-raw').textContent = raw;
      $<HTMLTextAreaElement>('#study-ai-draft').value = data.draft;
      $('#study-ai-status').textContent = '已生成待核验建议。只有点击“应用为私人草稿”才会写入整理稿。';
      $<HTMLDialogElement>('#study-ai-dialog').showModal();
    } catch (error) { $('#study-ai-status').textContent = `在线整理未完成：${(error as Error).message} 可复制完整提示词继续手动整理。`; }
    finally { busy = false; $<HTMLButtonElement>('#study-organize').disabled = false; }
  });
  $('#study-apply-ai').addEventListener('click', () => {
    if (current.id !== aiTarget || kind !== 'record') return;
    $<HTMLTextAreaElement>('#study-body').value = $<HTMLTextAreaElement>('#study-ai-draft').value;
    (form.elements.namedItem('reviewStatus') as HTMLSelectElement).value = 'draft';
    (form.elements.namedItem('visibility') as HTMLSelectElement).value = 'private';
    markDirty();
    $<HTMLDialogElement>('#study-ai-dialog').close();
    message('建议已应用到编辑器，尚未保存。审核状态为草稿，公开状态为私人；学习状态保持你的选择。');
  });

  $('#study-history').addEventListener('click', async () => {
    if (busy || !current.id) return;
    busy = true; message('正在读取版本记录…');
    try {
      const data = await api(`/api/study/items/${encodeURIComponent(current.id)}/history`);
      versions = data.versions;
      selectedVersion = null;
      $<HTMLButtonElement>('#study-restore').disabled = true;
      $('#study-version-preview').textContent = '选择一个版本预览。';
      const container = $('#study-versions'); container.replaceChildren();
      versions.sort((a, b) => (b.revision || 0) - (a.revision || 0)).forEach(version => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'study-version';
        button.textContent = `修订 ${version.revision} · ${version.updatedAt ? new Date(version.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '日期未提供'}`;
        button.addEventListener('click', () => { selectedVersion = version; $('#study-version-preview').textContent = markdown(version); $<HTMLButtonElement>('#study-restore').disabled = version.revision === current.revision; container.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === button)); }); container.append(button);
      });
      if (!versions.length) container.textContent = '暂无历史版本。';
      $<HTMLDialogElement>('#study-history-dialog').showModal(); message('');
    } catch (error) { message((error as Error).message, true); }
    finally { busy = false; }
  });
  $('#study-restore').addEventListener('click', async () => {
    if (!selectedVersion || busy) return;
    if (dirty && !window.confirm('恢复将替换尚未保存的修改。确认已经导出或不需要这些修改？')) return;
    const restored: Item = { ...structuredClone(selectedVersion), id: current.id, revision: current.revision, reviewStatus: 'draft', visibility: 'private' };
    if (await save(false, restored)) $<HTMLDialogElement>('#study-history-dialog').close();
  });

  $('#study-publish').addEventListener('click', () => {
    if (busy) return;
    const item = collect();
    if (item.reviewStatus !== 'reviewed') { message('请先本人核对内容，并将审核状态设为“已核对”，再预览公开稿。', true); return; }
    $<HTMLTextAreaElement>('#study-public-body').value = item.fields.publicBody || '';
    $<HTMLInputElement>('#study-public-confirm').checked = false;
    $('#study-public-error').textContent = '';
    $<HTMLDialogElement>('#study-public-dialog').showModal();
  });
  $('#study-copy-public').addEventListener('click', () => { $<HTMLTextAreaElement>('#study-public-body').value = $<HTMLTextAreaElement>('#study-body').value; $<HTMLInputElement>('#study-public-confirm').checked = false; });
  $('#study-public-body').addEventListener('input', () => { $<HTMLInputElement>('#study-public-confirm').checked = false; });
  $('#study-confirm-publish').addEventListener('click', async () => {
    if (busy) return;
    const publicBody = $<HTMLTextAreaElement>('#study-public-body').value.trim();
    if (!$<HTMLInputElement>('#study-public-confirm').checked || !publicBody) { $('#study-public-error').textContent = '请填写公开稿，并勾选本人核对确认。'; return; }
    const item = collect(); item.fields.publicBody = publicBody; item.visibility = 'public';
    $<HTMLButtonElement>('#study-confirm-publish').disabled = true;
    if (await save(true, item)) $<HTMLDialogElement>('#study-public-dialog').close();
    else $('#study-public-error').textContent = $('#study-message').textContent;
    $<HTMLButtonElement>('#study-confirm-publish').disabled = false;
  });

  const query = new URLSearchParams(location.search);
  const requestedKind = query.get('kind') as Kind;
  if (kinds.includes(requestedKind)) switchKind(requestedKind);
  const initial = blank(kind);
  if (kind === 'record' && query.get('project') === 'csv-checker') initial.fields.project = '工程参数与有限元结果 CSV 检查器（拟开展）';
  fill(initial);
  load();
}
