import { getLibrary, subscribeLibrary, toggleFavorite, visitEntry, type LibraryEntry } from './library-store';
import { getReadingPosition, subscribeReader } from './reading-position-store';

const entries = new WeakMap<HTMLButtonElement, LibraryEntry>();
let feedbackTimer: ReturnType<typeof setTimeout>;
let activeReadingEntry: LibraryEntry | null = null;

function notify(message: string) {
  const feedback = document.querySelector<HTMLElement>('[data-library-feedback]');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = false;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 5000);
}

function refreshButtons() {
  const { state, available } = getLibrary();
  document.querySelectorAll<HTMLButtonElement>('[data-library-favorite]').forEach(button => {
    const entry = entries.get(button);
    if (!entry) return;
    const saved = state.favorites.some(item => item.id === entry.id || item.href.replace(/\/$/, '') === entry.href.replace(/\/$/, ''));
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}：${entry.title}`);
    button.querySelector('span')!.textContent = saved ? '已收藏' : '收藏';
    button.disabled = !available;
    button.title = available ? '仅保存在当前浏览器' : '浏览器存储不可用，暂不能保存收藏';
  });
}

export function createFavoriteButton(entry: LibraryEntry): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'library-save-button';
  button.dataset.libraryFavorite = entry.href;
  button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z"/></svg><span>收藏</span>';
  entries.set(button, entry);
  const { state, available } = getLibrary();
  const saved = state.favorites.some(item => item.id === entry.id || item.href.replace(/\/$/, '') === entry.href.replace(/\/$/, ''));
  button.setAttribute('aria-pressed', String(saved));
  button.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}：${entry.title}`);
  button.querySelector('span')!.textContent = saved ? '已收藏' : '收藏';
  button.disabled = !available;
  button.title = available ? '仅保存在当前浏览器' : '浏览器存储不可用，暂不能保存收藏';
  button.addEventListener('click', () => {
    const result = toggleFavorite(entry);
    notify(result.ok ? (result.state.favorites.some(item => item.id === entry.id) ? '已收藏，可在“收藏与最近浏览”中找到。仅保存在当前浏览器。' : '已取消收藏。') : result.error || '保存失败，请检查浏览器存储空间。');
  });
  return button;
}

export function attachReadingActions(target: HTMLElement, entry: LibraryEntry, record = true) {
  target.replaceChildren(createFavoriteButton(entry));
  target.classList.add('reading-actions');
  const link = document.createElement('a'); link.href = '/library/'; link.textContent = '收藏与最近浏览 ↗';
  target.append(link);
  if (record) { activeReadingEntry = entry; visitEntry(entry); }
}

subscribeLibrary(refreshButtons);
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  refreshButtons();
  if (activeReadingEntry) visitEntry(activeReadingEntry);
});

document.querySelectorAll<HTMLElement>('[data-reading-entry]').forEach(target => {
  try {
    const entry = JSON.parse(target.dataset.readingEntry || 'null') as LibraryEntry;
    if (entry) attachReadingActions(target, entry);
  } catch { /* A missing public descriptor leaves the article readable. */ }
});

const continuation = document.querySelector<HTMLElement>('[data-library-continue]');
if (continuation) {
  const renderContinue = () => {
    const { state, available } = getLibrary();
    const recent = state.recent.slice(0, 3);
    continuation.hidden = !available || !recent.length;
    const list = continuation.querySelector<HTMLElement>('[data-library-continue-list]')!;
    const focusedHref = list.contains(document.activeElement) ? (document.activeElement as HTMLAnchorElement).getAttribute('href') : null;
    list.replaceChildren();
    for (const item of recent) {
      const link = document.createElement('a'); link.href = item.href;
      const position = getReadingPosition(item.href);
      if (position && position.progress > .01) { link.href = `${item.href}#reader-resume`; link.dataset.readerContinue = ''; }
      const type = document.createElement('small'); type.textContent = ({ kp:'教程知识点', error:'报错详情', case:'工程案例', page:'站内页面' })[item.type];
      const title = document.createElement('strong'); title.textContent = `${item.code ? `${item.code} · ` : ''}${item.title}`;
      const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      link.append(type, title, arrow);
      if (position && position.progress > .01) { const note = document.createElement('small'); note.className = 'home-position-note'; note.textContent = `继续阅读 · ${position.label || '正文'} · 位置 ${Math.round(position.progress * 100)}%`; link.append(note); }
      list.append(link);
    }
    if (focusedHref) Array.from(list.querySelectorAll<HTMLAnchorElement>('a')).find(link => link.getAttribute('href')?.split('#')[0] === focusedHref.split('#')[0])?.focus({ preventScroll:true });
    continuation.querySelector<HTMLElement>('[data-library-paused]')!.hidden = state.historyEnabled;
  };
  renderContinue();
  subscribeLibrary(renderContinue);
  subscribeReader(renderContinue);
  window.addEventListener('pageshow', event => { if (event.persisted) renderContinue(); });
}
