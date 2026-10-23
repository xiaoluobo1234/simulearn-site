import { canonicalReaderHref, contentSignature, isSafeReaderAnchor } from '../lib/reading-position';
import {
  getReaderState, getReadingPosition, saveReadingPosition, setReaderFont, subscribeReader,
  type ReaderFont, type ReaderPosition,
} from './reading-position-store';
import { getLibrary, subscribeLibrary, LIBRARY_STORAGE_KEY } from './library-store';
import { readLibraryState } from '../lib/reading-library';
import '../styles/article-reader.css';

interface ReaderOptions { content: HTMLElement; mount: HTMLElement; href: string; signature?: string }
interface ArticleSection { anchor: string; label: string; target: HTMLElement; heading: HTMLElement; level: number }
const mountedReaders = new WeakMap<HTMLElement, () => void>();
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Public article enhancement only. Initial layout and tree scrolling never save a position. */
export function mountArticleReader({ content, mount, href, signature }: ReaderOptions): void {
  const canonicalHref = canonicalReaderHref(href);
  if (!canonicalHref) return;
  mountedReaders.get(content)?.();
  const fingerprint = signature && /^v1-[a-f0-9]{8}$/.test(signature) ? signature : contentSignature(content.textContent || '');
  const abort = new AbortController();
  const signal = abort.signal;
  let disposed = false;
  let engaged = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  let lifecycle = 0;
  let errorText = '';
  let contextNotice = '';
  let sessionRevoked = false;
  let localFontOnly = false;
  let successfulSave = false;
  let font: ReaderFont = getReaderState().state.fontSize;
  let restoring: { section: ArticleSection; fraction: number; until: number } | null = null;

  const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const element = document.createElement(tag); element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const button = (text: string, className = 'article-reader-button') => { const element = create('button', className, text); element.type = 'button'; return element; };
  const uniqueId = (base: string) => { let id = base; let number = 2; while (document.getElementById(id)) id = `${base}-${number++}`; return id; };
  content.dataset.articleReaderContent = '';
  content.dataset.readerFontSize = font;
  mount.classList.add('article-reader-mount');
  const toolbar = create('div', 'article-reader'); toolbar.dataset.articleReader = '';
  const topbar = create('div', 'article-reader-topbar');
  const progressWrap = create('div', 'article-reader-progress-wrap');
  progressWrap.append(create('span', 'article-reader-label', '正文位置'));
  const progress = create('span', 'article-reader-progress', '0%'); progress.dataset.readerProgress = '';
  progressWrap.append(progress);
  const fonts = create('div', 'article-reader-fonts'); fonts.setAttribute('role', 'group'); fonts.setAttribute('aria-label', '正文字号');
  for (const [value, label] of [['normal', '标准'], ['large', '大字'], ['extra', '特大']] as const) {
    const control = button(label); control.dataset.readerFont = value; control.setAttribute('aria-label', `字号：${label}`);
    control.addEventListener('click', () => changeFont(value), { signal }); fonts.append(control);
  }
  const top = button('回到正文开头', 'article-reader-top'); top.dataset.readerTop = '';
  topbar.append(progressWrap, fonts, top);
  const track = create('div', 'article-reader-track'); track.setAttribute('aria-hidden', 'true');
  const fill = create('span', 'article-reader-track-fill'); track.append(fill);
  const toc = create('details', 'article-reader-toc'); toc.dataset.readerToc = '';
  const summary = create('summary', 'article-reader-toc-summary', '本篇目录');
  const tocNav = create('nav', 'article-reader-toc-links'); tocNav.setAttribute('aria-label', '本文目录');
  toc.append(summary, tocNav);
  const resume = create('div', 'article-reader-resume'); resume.dataset.readerResume = ''; resume.hidden = true;
  const resumeText = create('p', 'article-reader-resume-text');
  const resumeActions = create('div', 'article-reader-resume-actions');
  const continueButton = button('继续阅读', 'article-reader-button article-reader-button--accent'); continueButton.dataset.readerContinue = '';
  const restart = button('从头阅读'); restart.dataset.readerRestart = '';
  resumeActions.append(continueButton, restart); resume.append(resumeText, resumeActions);
  const status = create('p', 'article-reader-status'); status.dataset.readerStatus = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  toolbar.append(topbar, track, toc, resume, status); mount.replaceChildren(toolbar);

  const startId = isSafeReaderAnchor(content.id) && document.getElementById(content.id) === content ? content.id : uniqueId(`reader-start-${contentSignature(canonicalHref).slice(3)}`);
  let startTarget = content;
  if (startId !== content.id) { startTarget = create('span', 'article-reader-anchor'); startTarget.id = startId; startTarget.setAttribute('aria-hidden', 'true'); content.prepend(startTarget); }
  const start: ArticleSection = { anchor: startId, label: '正文开头', target: startTarget, heading: content, level: 1 };
  const sections: ArticleSection[] = [start];
  const usedAnchors = new Set([startId]);
  const headings = Array.from(content.querySelectorAll<HTMLElement>('h2,h3')).filter(heading => !heading.closest('[data-ai-section],[data-checkpoint-area]'));
  for (const heading of headings) {
    const label = (heading.textContent || '未命名章节').replace(/\s+/g, ' ').trim().slice(0, 160);
    let target: HTMLElement = heading;
    let id = heading.id;
    if (!isSafeReaderAnchor(id) || usedAnchors.has(id) || document.getElementById(id) !== heading) {
      const parent = heading.closest<HTMLElement>('section[id]');
      if (parent && content.contains(parent) && isSafeReaderAnchor(parent.id) && !usedAnchors.has(parent.id) && document.getElementById(parent.id) === parent) {
        target = parent; id = parent.id;
      } else {
        const slug = label.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'section';
        id = uniqueId(`reader-${slug}-${contentSignature(label).slice(3)}`);
        if (!heading.id) heading.id = id;
        else { target = create('span', 'article-reader-anchor'); target.id = id; target.setAttribute('aria-hidden', 'true'); heading.prepend(target); }
      }
    }
    usedAnchors.add(id);
    const section = { anchor: id, label, target, heading, level: Number(heading.tagName.slice(1)) };
    sections.push(section);
    const link = create('a', section.level === 3 ? 'article-reader-toc-link article-reader-toc-link--nested' : 'article-reader-toc-link', label);
    link.href = `#${encodeURIComponent(id)}`; link.dataset.readerHeading = id;
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); toc.open = false; resume.hidden = true;
      history.pushState({}, '', `${location.pathname}${location.search}#${encodeURIComponent(id)}`);
      jump(section, 0, true);
    }, { signal });
    tocNav.append(link);
  }
  toc.hidden = !headings.length;
  summary.append(create('span', 'article-reader-toc-count', `${headings.length} 节`));
  const tocLinks = Array.from(tocNav.querySelectorAll<HTMLAnchorElement>('a'));

  function offset() {
    const header = document.querySelector<HTMLElement>('[data-header]');
    const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : window.innerWidth <= 1040 ? 64 : 70;
    return headerBottom + mount.getBoundingClientRect().height + 14;
  }
  function topOf(element: HTMLElement) { return element.getBoundingClientRect().top + window.scrollY; }
  function geometry() {
    const contentTop = topOf(content);
    const contentBottom = contentTop + content.getBoundingClientRect().height;
    const points = sections.map(section => ({ section, top: topOf(section.target) }));
    const line = window.scrollY + offset();
    let current = 0;
    for (let i = 1; i < points.length; i++) if (points[i].top <= line + 2) current = i;
    const end = points[current + 1]?.top ?? contentBottom;
    const sectionProgress = clamp((line - points[current].top) / Math.max(1, end - points[current].top));
    const usableHeight = Math.max(1, window.innerHeight - offset() - 24);
    return { points, current, sectionProgress, progress: clamp((line - contentTop) / Math.max(1, contentBottom - contentTop - usableHeight)) };
  }
  function currentPosition(): ReaderPosition {
    const value = geometry();
    const section = value.points[value.current].section;
    return { href: canonicalHref!, anchor: section.anchor, label: section.label, sectionProgress: value.sectionProgress, progress: value.progress, updatedAt: Date.now(), signature: fingerprint };
  }
  function updatePosition() {
    if (disposed) return;
    const value = geometry();
    const percent = Math.round(value.progress * 100);
    progress.textContent = `${percent}%`;
    fill.style.width = `${percent}%`;
    const active = value.points[value.current].section.anchor;
    tocLinks.forEach(link => { if (link.dataset.readerHeading === active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }
  function blockedReason() {
    const library = getLibrary();
    const reader = getReaderState();
    if (!library.available || !reader.available) return '浏览器本地存储不可用，阅读位置和字号暂不能可靠保存。';
    if (library.invalid || reader.invalid) return '本地阅读数据损坏或格式暂不支持，未自动覆盖；仍可继续阅读。';
    if (!library.state.historyEnabled) return '最近浏览已暂停，当前阅读位置不会继续保存。字号设置仍可使用。';
    if (sessionRevoked || !library.state.recent.some(item => item.href.replace(/\/$/, '') === canonicalHref!.replace(/\/$/, ''))) return '本篇已不在最近浏览中，当前页面不会重新写入位置。重新打开正文后再记录。';
    return '';
  }
  function updateStatus() {
    const blocked = blockedReason();
    const main = errorText || blocked || (successfulSave ? '阅读位置已保存在当前浏览器；正文位置不代表学习完成。' : '阅读位置仅保存在当前浏览器；正文位置不代表学习完成。');
    const text = contextNotice ? `${contextNotice} ${main}` : main;
    if (status.textContent !== text) status.textContent = text;
    status.classList.toggle('is-warning', !!(errorText || blocked));
  }
  function cancelPendingSave() { clearTimeout(timer); timer = undefined; dirty = false; }
  function flush() {
    clearTimeout(timer); timer = undefined;
    if (!dirty || !engaged || disposed) return;
    dirty = false;
    if (blockedReason()) { updateStatus(); return; }
    const result = saveReadingPosition(currentPosition());
    if (result.ok) { successfulSave = true; errorText = ''; }
    else errorText = result.error || '阅读位置保存失败，当前进度尚未保存。';
    updateStatus();
  }
  function queueSave() {
    if (!engaged || blockedReason()) { updateStatus(); return; }
    dirty = true;
    if (timer === undefined) timer = setTimeout(flush, 800);
  }
  function scrollToPosition(section: ArticleSection, fraction: number, smooth = false) {
    const points = geometry().points;
    const index = points.findIndex(point => point.section === section);
    const end = points[index + 1]?.top ?? topOf(content) + content.getBoundingClientRect().height;
    const y = points[index].top + Math.max(0, end - points[index].top) * clamp(fraction) - offset();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, y), behavior: smooth && !reduced ? 'smooth' : 'instant' });
  }
  function focusHeading(section: ArticleSection) {
    if (!section.heading.hasAttribute('tabindex')) section.heading.tabIndex = -1;
    section.heading.focus({ preventScroll: true });
  }
  function jump(section: ArticleSection, fraction: number, save: boolean) {
    if (save) engaged = true;
    restoring = { section, fraction, until: performance.now() + 2500 };
    const generation = lifecycle;
    requestAnimationFrame(() => {
      if (disposed || generation !== lifecycle) return;
      scrollToPosition(section, fraction);
      focusHeading(section);
      updatePosition();
      if (save) queueSave();
    });
  }
  function restorePosition(saved: ReaderPosition) {
    resume.hidden = true; toc.open = false;
    const section = sections.find(section => section.anchor === saved.anchor) || start;
    const changed = saved.signature !== fingerprint;
    if (changed || section === start && saved.anchor !== start.anchor) {
      contextNotice = section === start && saved.anchor !== start.anchor ? '原章节已失效，本次从正文开头继续。' : '正文已更新，本次从仍可用的章节起点继续；未套用旧滚动比例。';
      updateStatus();
    }
    jump(section, !changed && section.anchor === saved.anchor ? saved.sectionProgress : 0, true);
  }
  function readHash(): HTMLElement | null {
    if (!location.hash || location.hash === '#reader-resume') return null;
    // Existing HTML ids may contain punctuation. A plain getElementById lookup is
    // safe without treating the hash as a CSS selector or a stored anchor.
    try { const id = decodeURIComponent(location.hash.slice(1)); return id.length <= 512 ? document.getElementById(id) : null; }
    catch { return null; }
  }
  function handleInitialLocation(explicitNavigation = false) {
    const saved = getReadingPosition(canonicalHref!);
    const target = readHash();
    if (target) {
      resume.hidden = true;
      if (content.contains(target)) {
        const section = sections.find(section => section.target === target || section.heading === target);
        if (section) jump(section, 0, explicitNavigation);
        else {
          const y = topOf(target) - offset();
          window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
          if (explicitNavigation) { engaged = true; updatePosition(); queueSave(); }
        }
      }
      return;
    }
    if (!saved) return;
    if (location.hash === '#reader-resume') { restorePosition(saved); return; }
    // A deliberate restart is useful state, but does not warrant a 0% resume
    // prompt on the next ordinary visit. Explicit resume links still work above.
    if (saved.progress <= .01) return;
    const changed = saved.signature !== fingerprint;
    const known = sections.some(section => section.anchor === saved.anchor);
    resumeText.textContent = changed
      ? `正文已更新。上次停在“${saved.label || '正文'}”；继续时只定位到仍有效的章节起点，原章节失效则从头阅读。`
      : known ? `上次停在“${saved.label || '正文'}”附近（正文位置 ${Math.round(saved.progress * 100)}%）。` : '上次记录的章节已失效，可从正文开头重新阅读。';
    resume.hidden = false;
    continueButton.onclick = () => restorePosition(saved);
  }
  function applyFont(value: ReaderFont) {
    font = value; content.dataset.readerFontSize = value;
    fonts.querySelectorAll<HTMLButtonElement>('[data-reader-font]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.readerFont === value)));
  }
  function changeFont(value: ReaderFont) {
    const position = currentPosition();
    const wasInContent = topOf(content) <= window.scrollY + offset();
    const result = setReaderFont(value);
    localFontOnly = !result.ok;
    errorText = result.ok ? '' : `${result.error || '字号未能保存。'} 本次字号仅在当前页面生效。`;
    applyFont(value);
    if (wasInContent) {
      const section = sections.find(section => section.anchor === position.anchor) || start;
      const generation = lifecycle;
      requestAnimationFrame(() => { if (!disposed && generation === lifecycle) { scrollToPosition(section, position.sectionProgress); updatePosition(); } });
    }
    updateStatus();
  }
  function userIntent(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog,[data-tree-domain],[data-reader-toc]')) return;
    if (event instanceof KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) return;
      if (event.key === ' ' && target?.closest('button,a,summary')) return;
    }
    engaged = true;
    restoring = null;
  }
  function onScroll() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; updatePosition(); });
    if (engaged) queueSave();
  }
  top.addEventListener('click', () => { resume.hidden = true; toc.open = false; history.replaceState({}, '', `${location.pathname}${location.search}#${encodeURIComponent(start.anchor)}`); jump(start, 0, true); }, { signal });
  restart.addEventListener('click', () => { resume.hidden = true; toc.open = false; history.replaceState({}, '', `${location.pathname}${location.search}#${encodeURIComponent(start.anchor)}`); jump(start, 0, true); }, { signal });
  window.addEventListener('scroll', onScroll, { passive: true, signal });
  window.addEventListener('wheel', userIntent, { passive: true, signal });
  window.addEventListener('touchmove', userIntent, { passive: true, signal });
  window.addEventListener('keydown', userIntent, { signal });
  window.addEventListener('pointerdown', event => {
    if (event.target === document.documentElement || event.clientX >= document.documentElement.clientWidth) userIntent(event);
  }, { passive: true, signal });
  window.addEventListener('pagehide', flush, { signal });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    // Browser back restores its own viewport. Discard every old save/restore
    // transaction before refreshing settings; this is a new reading visit.
    lifecycle++;
    cancelPendingSave();
    cancelAnimationFrame(frame); frame = 0;
    engaged = false;
    restoring = null;
    sessionRevoked = false;
    successfulSave = false;
    errorText = ''; contextNotice = ''; localFontOnly = false;
    resume.hidden = true;
    applyFont(getReaderState().state.fontSize);
    updateStatus();
    requestAnimationFrame(() => { if (!disposed) updatePosition(); });
  }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); }, { signal });
  window.addEventListener('hashchange', () => { restoring = null; handleInitialLocation(true); }, { signal });
  function layoutChanged() {
    if (disposed) return;
    if (restoring && performance.now() < restoring.until) scrollToPosition(restoring.section, restoring.fraction);
    updatePosition();
  }
  const observer = new ResizeObserver(layoutChanged); observer.observe(content); observer.observe(mount);
  content.addEventListener('load', layoutChanged, { capture: true, signal });
  window.addEventListener('resize', layoutChanged, { signal });
  const unsubscribeLibrary = subscribeLibrary(() => {
    const library = getLibrary();
    if (library.available && !library.invalid && !library.state.recent.some(item => item.href.replace(/\/$/, '') === canonicalHref!.replace(/\/$/, ''))) sessionRevoked = true;
    if (blockedReason()) cancelPendingSave();
    updateStatus();
  });
  window.addEventListener('storage', event => {
    if (event.key !== LIBRARY_STORAGE_KEY && event.key !== null) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      cancelPendingSave(); engaged = false; updateStatus(); return;
    }
    // Consume the event's historical snapshot. Another tab may already have
    // re-added this article before this frozen/busy page receives the clear.
    const snapshot = readLibraryState(event.newValue);
    if (snapshot.invalid || !snapshot.state.recent.some(item => item.href.replace(/\/$/, '') === canonicalHref!.replace(/\/$/, ''))) {
      sessionRevoked = true;
      cancelPendingSave();
      engaged = false;
    } else if (!snapshot.state.historyEnabled) {
      cancelPendingSave();
      engaged = false;
    }
    updateStatus();
  }, { signal });
  const unsubscribeReader = subscribeReader(() => {
    if (!localFontOnly) {
      const next = getReaderState().state.fontSize;
      if (next !== font) applyFont(next);
    }
    if (blockedReason()) cancelPendingSave();
    updateStatus();
  });
  applyFont(font); updateStatus();
  const initialGeneration = lifecycle;
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!disposed && initialGeneration === lifecycle) { handleInitialLocation(); updatePosition(); } }));
  document.fonts?.ready.then(() => { if (!disposed) layoutChanged(); });
  mountedReaders.set(content, () => {
    flush(); disposed = true; abort.abort(); observer.disconnect(); unsubscribeLibrary(); unsubscribeReader(); cancelAnimationFrame(frame); clearTimeout(timer);
    content.querySelectorAll('.article-reader-anchor').forEach(anchor => anchor.remove());
  });
}
