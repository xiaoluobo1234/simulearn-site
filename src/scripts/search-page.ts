import { searchEntries, type SearchEntry } from '../lib/search';
import { createFavoriteButton } from './reading-actions';

const searchPage = document.querySelector<HTMLElement>('[data-search-page]');
if (searchPage) initializeSearch(searchPage);

function initializeSearch(page: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => page.querySelector<T>(selector)!;
  const input = $<HTMLInputElement>('#searchInput');
  const domainInput = $<HTMLSelectElement>('#searchDomain');
  const typeInput = $<HTMLSelectElement>('#searchType');
  const clear = $<HTMLButtonElement>('#searchClear');
  const results = $('#searchResults');
  const stats = $('#searchStats');
  const more = $<HTMLButtonElement>('#searchMore');
  const domains: Record<string, string> = { structural: '结构力学', thermal: '热管理', fluids: '流体', multiphysics: '多物理场', chip: '芯片仿真', tools: '工具脚本' };
  const types: Record<string, string> = { kp: '教程知识点', error: '报错代码', case: '工程案例', page: '站内页面' };
  const levels: Record<string, string> = { low: '基础', mid: '进阶', high: '深入' };
  let index: SearchEntry[];
  let composing = false;
  let timer: ReturnType<typeof setTimeout>;
  let typingSession = false;
  let visibleLimit = 20;
  let lastTotal = 0;

  try {
    index = JSON.parse($('#searchIndexData').textContent || '[]');
    if (!Array.isArray(index)) throw new Error('Invalid index');
  } catch {
    stats.textContent = '搜索索引暂时无法读取，请刷新页面重试。你也可以使用推荐入口继续浏览。';
    return;
  }

  function currentState() {
    return { query: input.value.trim(), domain: domainInput.value, type: typeInput.value };
  }

  function updateURL(mode: 'push' | 'replace') {
    const state = currentState();
    const url = new URL(location.href);
    url.hash = '';
    url.search = '';
    if (state.query) url.searchParams.set('q', state.query);
    if (state.domain) url.searchParams.set('domain', state.domain);
    if (state.type) url.searchParams.set('type', state.type);
    if (url.href !== location.href) history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url.href);
  }

  function readURL() {
    const url = new URL(location.href);
    let query = url.searchParams.get('q') || '';
    if (!url.searchParams.has('q') && url.hash.length > 1) {
      try { query = decodeURIComponent(url.hash.slice(1)); }
      catch { query = url.hash.slice(1); }
    }
    input.value = query.slice(0, 120);
    domainInput.value = domains[url.searchParams.get('domain') || ''] ? url.searchParams.get('domain')! : '';
    typeInput.value = types[url.searchParams.get('type') || ''] ? url.searchParams.get('type')! : '';
    visibleLimit = 20;
    typingSession = false;
    render();
    updateURL('replace');
  }

  function highlight(target: HTMLElement, text: string, query: string) {
    // Query and source strings only become text nodes; neither is parsed as HTML.
    const words = [...new Set(query.toLocaleLowerCase().split(/\s+/).filter(Boolean))].slice(0, 12);
    const lower = text.toLocaleLowerCase();
    const ranges: Array<[number, number]> = [];
    for (const word of words) {
      let position = lower.indexOf(word);
      while (position !== -1) {
        ranges.push([position, position + word.length]);
        position = lower.indexOf(word, position + Math.max(word.length, 1));
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const range of ranges) {
      const previous = merged.at(-1);
      if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
      else merged.push([...range]);
    }
    let position = 0;
    for (const [start, end] of merged) {
      if (position < start) target.append(document.createTextNode(text.slice(position, start)));
      const mark = document.createElement('mark'); mark.textContent = text.slice(start, end); target.append(mark);
      position = end;
    }
    target.append(document.createTextNode(text.slice(position)));
  }

  function renderEntry(entry: SearchEntry, query: string) {
    const link = document.createElement('a'); link.className = 'search-result-item'; link.href = entry.href; link.dataset.searchResult = entry.id; link.dataset.resultType = entry.type;
    const meta = document.createElement('div'); meta.className = 'search-result-meta';
    const badge = document.createElement('span'); badge.className = `search-result-type search-result-type--${entry.type}`; badge.textContent = types[entry.type]; meta.append(badge);
    const location = [entry.domain ? domains[entry.domain] || entry.domain : '', entry.group || '', entry.level ? levels[entry.level] || entry.level : ''].filter(Boolean);
    if (location.length) { const context = document.createElement('span'); context.className = 'search-result-context'; context.textContent = location.join(' / '); meta.append(context); }
    const heading = document.createElement('h3');
    if (entry.code && !entry.title.includes(entry.code)) { const code = document.createElement('span'); code.className = 'search-result-code'; highlight(code, entry.code, query); heading.append(code, document.createTextNode(' ')); }
    highlight(heading, entry.title, query);
    const description = document.createElement('p'); highlight(description, entry.description || '', query);
    const path = document.createElement('span'); path.className = 'search-result-path'; path.textContent = entry.href;
    const arrow = document.createElement('span'); arrow.className = 'search-result-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    link.append(meta, heading, description, path, arrow);
    const card = document.createElement('div'); card.className = 'search-result-card';
    card.append(link, createFavoriteButton(entry));
    return card;
  }

  function updateActiveFilters() {
    const container = $('#searchActiveFilters'); container.replaceChildren();
    const state = currentState();
    for (const [value, label, select] of [[state.domain, domains[state.domain], domainInput], [state.type, types[state.type], typeInput]] as const) {
      if (!value) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'search-active-filter';
      button.textContent = `${label} ×`; button.setAttribute('aria-label', `清除${label}筛选`);
      button.addEventListener('click', () => { select.value = ''; discreteChange(); }); container.append(button);
    }
    container.hidden = !state.domain && !state.type;
    $<HTMLButtonElement>('[data-search-reset]').hidden = container.hidden;
  }

  function emptyState(query: string) {
    const empty = document.createElement('div'); empty.className = 'search-empty';
    const icon = document.createElement('span'); icon.className = 'search-empty-icon'; icon.textContent = '⌕'; icon.setAttribute('aria-hidden', 'true');
    const heading = document.createElement('h3'); heading.textContent = '暂时没有匹配的内容';
    const description = document.createElement('p'); description.textContent = query ? '试试更短的关键词，或使用报错原文、软件名称、错误代码查找。' : '这个领域与内容类型暂时没有交集，试试调整筛选。';
    empty.append(icon, heading, description);
    const state = currentState();
    if (state.domain || state.type) { const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'search-load-more'; reset.textContent = '清除筛选，保留关键词'; reset.addEventListener('click', resetFilters); empty.append(reset); }
    const examples = document.createElement('div'); examples.className = 'search-empty-examples';
    const hint = document.createElement('span'); hint.textContent = '例如：'; examples.append(hint);
    for (const word of ['接触', 'pivot', 'Python']) { const button = document.createElement('button'); button.type = 'button'; button.className = 'search-text-button'; button.textContent = word; button.addEventListener('click', () => { domainInput.value = ''; typeInput.value = ''; input.value = word; discreteChange(); input.focus(); }); examples.append(button); }
    empty.append(examples);
    return empty;
  }

  function render(appendOnly = false) {
    const state = currentState();
    clear.hidden = !input.value;
    updateActiveFilters();
    const browsing = !!(state.query || state.domain || state.type);
    $('#searchRecommendations').hidden = browsing;
    $('#searchResultsTitle').textContent = state.query ? '搜索结果' : state.domain || state.type ? '浏览公开内容' : '公开知识，随时查找';
    if (!browsing) {
      results.replaceChildren();
      stats.textContent = `收录 ${index.length} 条公开内容 · 输入关键词或选择筛选`;
      $('#searchPagination').hidden = true;
      return;
    }
    const matches = searchEntries(index, state.query, { domain: state.domain, type: state.type, limit: visibleLimit });
    lastTotal = matches.total;
    stats.textContent = `${state.query ? `“${state.query}” · ` : ''}找到 ${matches.total} 条结果`;
    const fragment = document.createDocumentFragment();
    const existing = appendOnly ? results.querySelectorAll('[data-search-result]').length : 0;
    for (const entry of matches.items.slice(existing)) fragment.append(renderEntry(entry, state.query));
    if (!matches.total) fragment.append(emptyState(state.query));
    if (appendOnly) results.append(fragment);
    else results.replaceChildren(fragment);
    $('#searchPagination').hidden = !matches.total;
    $('#searchShown').textContent = `已显示 ${matches.items.length} / ${matches.total} 条`;
    more.hidden = matches.items.length >= matches.total;
    more.textContent = `再显示 ${Math.min(20, matches.total - matches.items.length)} 条 ↓`;
  }

  function discreteChange() {
    clearTimeout(timer); typingSession = false; visibleLimit = 20; updateURL('push'); render();
  }

  function resetFilters() {
    domainInput.value = ''; typeInput.value = ''; discreteChange();
  }

  function scheduleSearch() {
    clear.hidden = !input.value;
    clearTimeout(timer);
    if (composing) return;
    timer = setTimeout(() => { visibleLimit = 20; updateURL(typingSession ? 'replace' : 'push'); typingSession = true; render(); }, 120);
  }

  input.addEventListener('input', scheduleSearch);
  input.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
  input.addEventListener('compositionend', () => { composing = false; scheduleSearch(); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && (composing || event.isComposing)) event.preventDefault(); });
  $('#searchForm').addEventListener('submit', event => { event.preventDefault(); if (!composing) discreteChange(); });
  clear.addEventListener('click', () => { input.value = ''; discreteChange(); input.focus(); });
  domainInput.addEventListener('change', discreteChange);
  typeInput.addEventListener('change', discreteChange);
  $('[data-search-reset]').addEventListener('click', resetFilters);
  more.addEventListener('click', () => {
    visibleLimit = Math.min(lastTotal, visibleLimit + 20);
    const previousCount = results.querySelectorAll('[data-search-result]').length;
    render(true);
    results.querySelectorAll<HTMLAnchorElement>('[data-search-result]')[previousCount]?.focus({ preventScroll: true });
  });
  page.querySelectorAll<HTMLAnchorElement>('[data-search-keyword]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); input.value = link.dataset.searchKeyword || ''; discreteChange(); input.focus();
  }));
  window.addEventListener('popstate', () => { clearTimeout(timer); composing = false; readURL(); });
  window.addEventListener('hashchange', () => { clearTimeout(timer); readURL(); });
  readURL();
}
