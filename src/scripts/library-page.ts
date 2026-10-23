import {
  getLibrary, removeFavorite, removeRecent, clearRecent, setHistoryEnabled, resetLibrary, subscribeLibrary,
  type LibraryItem, type LibraryState,
} from './library-store';

const libraryPage = document.querySelector<HTMLElement>('[data-library-page]');
if (libraryPage) initLibrary(libraryPage);

function initLibrary(page: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => page.querySelector<T>(selector)!;
  const filter = $<HTMLInputElement>('[data-library-filter]');
  const typeFilter = $<HTMLSelectElement>('[data-library-type]');
  const list = $('[data-library-list]');
  const feedback = $('[data-library-status]');
  const types: Record<string, string> = { kp: '教程知识点', error: '报错代码', case: '工程案例', page: '站内页面' };
  const domains: Record<string, string> = { structural: '结构力学', thermal: '热管理', fluids: '流体', multiphysics: '多物理场', chip: '芯片仿真', tools: '工具脚本' };
  let view: 'favorites' | 'recent' = 'favorites';
  let snapshot = getLibrary();
  let state: LibraryState = snapshot.state;
  let visibleItems: LibraryItem[] = [];
  let composing = false;

  function report(text: string, error = false) {
    feedback.textContent = text;
    feedback.classList.toggle('is-error', error);
  }

  function formattedTime(at: number) {
    const date = new Date(at);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '时间未记录';
  }

  function refresh() {
    snapshot = getLibrary();
    state = snapshot.state;
    render();
  }

  function renderStorageStatus() {
    const note = $('[data-library-storage]');
    note.classList.toggle('is-warning', !snapshot.available || !!snapshot.invalid);
    const text = !snapshot.available
      ? '当前浏览器未允许可靠的本地存储，列表暂时无法持久保存。请检查浏览器设置；本功能不提供跨设备同步。浏览不代表学习完成。'
      : snapshot.invalid
        ? '检测到本地数据损坏或格式暂不支持，以下仅显示可读取的内容。无法读取的数据不会被静默覆盖；若操作失败，请先保留浏览器中的原数据。浏览不代表学习完成。'
        : '仅保存在当前浏览器，暂不跨设备同步；浏览不代表学习完成。清理浏览器站点数据会移除这些列表。';
    note.querySelector('p')!.textContent = text;
    $<HTMLButtonElement>('[data-library-reset-storage]').hidden = !snapshot.available || !snapshot.invalid;
  }

  function createEntry(item: LibraryItem, index: number) {
    const card = document.createElement('article');
    card.className = 'library-entry'; card.dataset.libraryEntry = item.href;
    const link = document.createElement('a'); link.className = 'library-entry-link'; link.href = item.href;
    const meta = document.createElement('div'); meta.className = 'library-entry-meta';
    const badge = document.createElement('span'); badge.className = `library-entry-type library-entry-type--${item.type}`; badge.textContent = types[item.type] || '公开内容'; meta.append(badge);
    const domain = document.createElement('span'); domain.textContent = item.domain ? domains[item.domain] || item.domain : '站内公开内容'; meta.append(domain);
    const heading = document.createElement('h3'); heading.textContent = item.code && !item.title.includes(item.code) ? `${item.code} · ${item.title}` : item.title;
    const description = document.createElement('p'); description.textContent = item.description;
    const path = document.createElement('span'); path.className = 'library-entry-path'; path.textContent = item.href;
    link.append(meta, heading, description, path);
    const actions = document.createElement('div'); actions.className = 'library-entry-actions';
    const time = document.createElement('span'); time.className = 'library-entry-time'; time.textContent = `${view === 'favorites' ? '收藏于' : '浏览于'} ${formattedTime(item.at)}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'library-remove'; remove.dataset.libraryRemove = item.href; remove.disabled = !snapshot.available;
    remove.textContent = view === 'favorites' ? '移除收藏' : '移除记录';
    remove.setAttribute('aria-label', `${remove.textContent}：${item.title}`);
    remove.addEventListener('click', () => {
      const isFavorite = view === 'favorites';
      const result = isFavorite ? removeFavorite(item.href) : removeRecent(item.href);
      if (!result.ok) { report(result.error || '当前操作未能保存，原列表保持不变。', true); refresh(); return; }
      refresh();
      report(isFavorite ? '已移除收藏。原内容仍可正常访问。' : '已移除这条浏览记录，收藏保持不变。');
      const buttons = list.querySelectorAll<HTMLButtonElement>('[data-library-remove]');
      (buttons[Math.min(index, buttons.length - 1)] || $<HTMLButtonElement>(`[data-library-tab="${view}"]`)).focus({ preventScroll: true });
    });
    actions.append(time, remove); card.append(link, actions);
    return card;
  }

  function emptyState(filtered: boolean) {
    const empty = document.createElement('div'); empty.className = 'library-empty';
    const icon = document.createElement('span'); icon.className = 'library-empty-icon'; icon.textContent = view === 'favorites' ? '☆' : '↶'; icon.setAttribute('aria-hidden', 'true');
    const heading = document.createElement('h3'); heading.textContent = filtered ? '没有匹配的条目' : view === 'favorites' ? '把想再看的内容，留在这里' : '从下一次阅读开始';
    const text = document.createElement('p'); text.textContent = filtered ? '试试其他标题关键词，或清除内容类型筛选。' : view === 'favorites' ? '在公开教程、搜索结果或报错条目中点击收藏，下次就能直接找到。' : state.historyEnabled ? '访问已接入的公开教程、报错或案例后，最近浏览会出现在这里。' : '浏览记录已暂停。恢复记录后，下一次访问将开始留下入口。';
    empty.append(icon, heading, text);
    if (filtered) { const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'library-button'; reset.textContent = '清除筛选'; reset.addEventListener('click', resetFilters); empty.append(reset); }
    else { const search = document.createElement('a'); search.className = 'library-button library-button--primary'; search.href = '/search/'; search.textContent = '搜索公开教程 →'; empty.append(search); }
    return empty;
  }

  function render() {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusedCard = focused?.closest<HTMLElement>('[data-library-entry]');
    const focusedHref = focusedCard?.dataset.libraryEntry;
    const focusedIndex = visibleItems.findIndex(item => item.href === focusedHref);
    const focusedRemove = focused?.matches('[data-library-remove]');
    renderStorageStatus();
    page.querySelectorAll<HTMLButtonElement>('[data-library-tab]').forEach(button => { const active = button.dataset.libraryTab === view; button.setAttribute('aria-pressed', String(active)); button.classList.toggle('is-active', active); });
    for (const key of ['favorites', 'recent'] as const) $(`[data-library-total="${key}"]`).textContent = String(state[key].length);
    $('[data-library-heading]').textContent = view === 'favorites' ? '我的收藏' : '最近浏览';
    $('[data-library-history]').hidden = view !== 'recent';
    $('[data-library-history-description]').textContent = !snapshot.available ? '本地存储不可用，无法可靠记录浏览。' : state.historyEnabled ? '正在记录已接入页面的最近访问。' : '已暂停新浏览记录，原有列表仍然保留。';
    $('[data-library-history-dot]').classList.toggle('is-paused', !state.historyEnabled || !snapshot.available);
    const pause = $<HTMLButtonElement>('[data-library-pause]'); pause.textContent = state.historyEnabled ? '暂停记录' : '恢复记录'; pause.setAttribute('aria-pressed', String(!state.historyEnabled)); pause.disabled = !snapshot.available;
    $<HTMLButtonElement>('[data-library-clear]').disabled = !snapshot.available || !state.recent.length;
    page.querySelectorAll<HTMLButtonElement>('[data-library-export]').forEach(button => { button.disabled = !state.favorites.length && !state.recent.length; });
    const query = filter.value.trim().normalize('NFKC').toLocaleLowerCase();
    const all = [...state[view]].sort((a, b) => b.at - a.at);
    visibleItems = all.filter(item => (!typeFilter.value || item.type === typeFilter.value) && (!query || `${item.title} ${item.description} ${item.code || ''}`.normalize('NFKC').toLocaleLowerCase().includes(query)));
    const filtered = !!(query || typeFilter.value);
    $('[data-library-reset]').hidden = !filtered;
    $('[data-library-count]').textContent = filtered ? `找到 ${visibleItems.length} 条 · 本列表共 ${all.length} 条` : `共 ${all.length} 条`;
    list.setAttribute('aria-label', view === 'favorites' ? '收藏列表' : '最近浏览列表');
    const fragment = document.createDocumentFragment();
    visibleItems.forEach((item, index) => fragment.append(createEntry(item, index)));
    if (!visibleItems.length) fragment.append(emptyState(filtered));
    list.replaceChildren(fragment);
    if (focusedHref) {
      const replacement = Array.from(list.querySelectorAll<HTMLElement>('[data-library-entry]')).find(card => card.dataset.libraryEntry === focusedHref);
      const next = replacement || list.querySelectorAll<HTMLElement>('[data-library-entry]')[Math.max(0, Math.min(focusedIndex, visibleItems.length - 1))];
      (next?.querySelector<HTMLElement>(focusedRemove ? '[data-library-remove]' : 'a') || $<HTMLButtonElement>(`[data-library-tab="${view}"]`)).focus({ preventScroll: true });
    }
  }

  function resetFilters() { filter.value = ''; typeFilter.value = ''; render(); filter.focus(); }

  function updateURL() {
    const url = new URL(location.href);
    if (view === 'recent') url.searchParams.set('tab', 'recent');
    else url.searchParams.delete('tab');
    if (url.href !== location.href) history.pushState({}, '', url.href);
  }

  page.querySelectorAll<HTMLButtonElement>('[data-library-tab]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.libraryTab === 'recent' ? 'recent' : 'favorites'; updateURL(); report(''); refresh();
  }));
  filter.addEventListener('input', () => { if (!composing) render(); });
  filter.addEventListener('compositionstart', () => { composing = true; });
  filter.addEventListener('compositionend', () => { composing = false; render(); });
  typeFilter.addEventListener('change', render);
  $('[data-library-reset]').addEventListener('click', resetFilters);
  $('[data-library-pause]').addEventListener('click', () => {
    const result = setHistoryEnabled(!state.historyEnabled);
    refresh(); report(result.ok ? result.state.historyEnabled ? '已恢复记录；仅记录此后访问的已接入页面。' : '已暂停记录。现有浏览列表与收藏保持不变。' : result.error || '浏览记录设置未能保存。', !result.ok);
  });
  $('[data-library-clear]').addEventListener('click', () => {
    if (!state.recent.length || !window.confirm('确认清空当前浏览器的全部最近浏览记录？此操作无法撤销，收藏与原文章保持不变。')) return;
    const result = clearRecent();
    refresh(); report(result.ok ? '最近浏览已清空，收藏与原内容保持不变。' : result.error || '最近浏览未能清空。', !result.ok);
    if (result.ok) $<HTMLButtonElement>('[data-library-pause]').focus();
  });
  $('[data-library-reset-storage]').addEventListener('click', () => {
    if (!window.confirm('确认重置当前浏览器的阅读列表？这会清除本机收藏、最近浏览和暂停设置，用于修复损坏或不兼容的数据。操作无法撤销，不会删除原文章或私人学习记录。')) return;
    const result = resetLibrary();
    refresh(); report(result.ok ? '本机阅读列表已重置，可以重新收藏和记录浏览。' : result.error || '本机阅读列表重置失败。', !result.ok);
    if (result.ok) $<HTMLButtonElement>(`[data-library-tab="${view}"]`).focus();
  });

  function markdownText(value: string) { return value.replace(/[\\`*_[\]<>]/g, '\\$&').replace(/[\r\n]+/g, ' '); }
  function exportLists(format: string) {
    refresh();
    const at = new Date();
    let content: string;
    if (format === 'json') {
      content = JSON.stringify(state, null, 2);
    } else {
      const lines = ['# SimuLearn 收藏与最近浏览', '', `导出时间：${formattedTime(at.getTime())}（Asia/Shanghai）`, '', '仅包含当前浏览器中已保存的公开内容入口。浏览不代表学习完成；本文件不包含私人学习记录或搜索查询历史。', '', `浏览记录：${state.historyEnabled ? '启用' : '暂停'}`, ''];
      for (const [key, title] of [['favorites', '收藏'], ['recent', '最近浏览']] as const) {
        lines.push(`## ${title}（${state[key].length} 条）`, '');
        [...state[key]].sort((a, b) => b.at - a.at).forEach(item => lines.push(`- [${markdownText(item.title)}](${new URL(item.href, 'https://simulearn.cn').href})`, `  - ${types[item.type]} · ${item.domain ? domains[item.domain] || item.domain : '站内公开内容'} · ${formattedTime(item.at)}`, ...(item.description ? [`  - ${markdownText(item.description)}`] : []), ''));
        if (!state[key].length) lines.push('暂无条目。', '');
      }
      content = lines.join('\n');
    }
    const blob = new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `SimuLearn-阅读列表-${at.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })}.${format === 'json' ? 'json' : 'md'}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    report('已导出当前浏览器中可读取的收藏与最近浏览；导出不受页面筛选影响。');
  }
  page.querySelectorAll<HTMLButtonElement>('[data-library-export]').forEach(button => button.addEventListener('click', () => exportLists(button.dataset.libraryExport || 'json')));
  window.addEventListener('popstate', () => { view = new URLSearchParams(location.search).get('tab') === 'recent' ? 'recent' : 'favorites'; report(''); refresh(); });
  subscribeLibrary(refresh);
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  view = new URLSearchParams(location.search).get('tab') === 'recent' ? 'recent' : 'favorites';
  render();
}
