import { searchEntries, type SearchEntry } from '../lib/search';

const dialog = document.querySelector<HTMLDialogElement>('[data-site-search]');
if (dialog) initSiteSearch(dialog);

function initSiteSearch(dialog: HTMLDialogElement) {
  const input = dialog.querySelector<HTMLInputElement>('#quick-search-input')!;
  const results = dialog.querySelector<HTMLUListElement>('#quick-search-results')!;
  const status = dialog.querySelector<HTMLElement>('#quick-search-status')!;
  const clear = dialog.querySelector<HTMLButtonElement>('[data-quick-clear]')!;
  const initialLinks = Array.from(results.querySelectorAll<HTMLAnchorElement>('a')).map(link => ({
    title: link.querySelector('strong')!.textContent!, href: link.getAttribute('href')!, description: link.querySelector('small')!.textContent!,
  }));
  const typeLabels = { kp: '知识教程', error: '报错诊断', page: '站内入口', case: '工程案例' };
  let entries: SearchEntry[] | null = null;
  let loading: Promise<void> | null = null;
  let opener: HTMLElement | null = null;
  let composing = false;
  let renderTimer: ReturnType<typeof setTimeout> | undefined;

  function addLink(title: string, href: string, description: string) {
    if (!href.startsWith('/') || href.startsWith('//') || /[\\\s<>]/.test(href)) return;
    const li = document.createElement('li');
    const link = document.createElement('a'); link.href = href; link.dataset.quickResult = '';
    const text = document.createElement('span');
    const heading = document.createElement('strong'); heading.textContent = title;
    const meta = document.createElement('small'); meta.textContent = description;
    text.append(heading, meta);
    const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
    link.append(text, arrow); li.append(link); results.append(li);
  }

  function render() {
    const query = input.value.trim().slice(0, 120);
    clear.hidden = !query;
    results.replaceChildren();
    if (!query) {
      status.textContent = '常用入口 · 输入关键词搜索公开内容';
      initialLinks.forEach(link => addLink(link.title, link.href, link.description));
      return;
    }
    if (!entries) { status.textContent = loading ? '正在读取公开搜索索引…' : '索引暂不可用，可打开完整搜索继续。'; return; }
    const matches = searchEntries(entries, query, { limit: 6 });
    status.textContent = matches.total ? `找到 ${matches.total} 项公开内容，先显示最相关的 ${matches.items.length} 项` : '没有找到匹配内容。试试“接触”“CSV”或报错代码。';
    matches.items.forEach(item => addLink(item.code ? `${item.code} · ${item.title}` : item.title, item.href, `${typeLabels[item.type]}${item.group ? ` · ${item.group}` : ''}`));
  }

  async function loadIndex() {
    if (entries) return;
    if (loading) return loading;
    loading = (async () => {
      try {
        const response = await fetch('/search-index.json', { credentials:'omit', signal:AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('index unavailable');
        const data = await response.json();
        if (!Array.isArray(data.entries) || data.entries.length > 10000) throw new Error('invalid index');
        entries = data.entries;
      } catch { entries = null; }
      finally { loading = null; if (dialog.open && input.value.trim() && !composing) render(); }
    })();
    return loading;
  }

  function open(trigger: HTMLElement | null) {
    if (dialog.open || document.querySelector('dialog[open]')) return;
    opener = trigger;
    document.dispatchEvent(new CustomEvent('simulearn:close-nav'));
    dialog.showModal(); input.focus(); render(); loadIndex();
  }
  document.querySelectorAll<HTMLAnchorElement>('[data-quick-search]').forEach(trigger => trigger.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); open(trigger);
  }));
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.repeat) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return;
    const command = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
    const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (!command && !slash) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault(); open(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  });
  input.addEventListener('input', () => { if (!composing) { clearTimeout(renderTimer); renderTimer = setTimeout(render, 70); } });
  input.addEventListener('compositionstart', () => { composing = true; clearTimeout(renderTimer); });
  input.addEventListener('compositionend', () => { composing = false; render(); });
  clear.addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  dialog.querySelector('[data-quick-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.isComposing || composing || !['ArrowDown','ArrowUp'].includes(event.key)) return;
    if (event.target === input) { clearTimeout(renderTimer); render(); }
    const links = Array.from(results.querySelectorAll<HTMLAnchorElement>('[data-quick-result]'));
    if (!links.length) return;
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.target !== input && current < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' && current <= 0) input.focus();
    else links[event.key === 'ArrowDown' ? (current + 1) % links.length : current - 1].focus();
  });
  dialog.querySelector('form')!.addEventListener('submit', event => {
    if (composing) { event.preventDefault(); return; }
    input.value = input.value.trim().slice(0,120);
  });
  dialog.addEventListener('close', () => {
    clearTimeout(renderTimer);
    if (opener?.isConnected && opener.getClientRects().length) opener.focus();
    else document.querySelector<HTMLButtonElement>('[data-menu-toggle]')?.focus();
  });
}
