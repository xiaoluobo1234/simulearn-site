import {
  applyLibraryAction, initialLibraryState, readLibraryState,
  type LibraryAction, type LibraryEntry, type LibraryState, type LibraryWriteResult,
} from '../lib/reading-library';
import { clearReadingPosition, clearReadingPositions } from './reading-position-store';
import { canonicalReaderHref } from '../lib/reading-position';
export type { LibraryEntry, LibraryItem, LibraryState, LibraryWriteResult } from '../lib/reading-library';

export const LIBRARY_STORAGE_KEY = 'simulearn-reading-library-v1';
const LIBRARY_EVENT = 'simulearn:reading-library-change';
export interface LibrarySnapshot { state: LibraryState; available: boolean; invalid?: boolean }
interface InternalSnapshot extends LibrarySnapshot { storage?: Storage; writable: boolean }

function readCurrent(): InternalSnapshot {
  try {
    if (typeof window === 'undefined') return { state: initialLibraryState(), available: false, writable: false };
    const storage = window.localStorage;
    if (!storage) return { state: initialLibraryState(), available: false, writable: false };
    const result = readLibraryState(storage.getItem(LIBRARY_STORAGE_KEY));
    return { ...result, storage, available: true };
  } catch { return { state: initialLibraryState(), available: false, writable: false }; }
}

export function getLibrary(): LibrarySnapshot {
  const { state, available, invalid } = readCurrent();
  return { state, available, ...(invalid ? { invalid: true } : {}) };
}
function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LIBRARY_EVENT));
}
function write(action: LibraryAction): LibraryWriteResult {
  const current = readCurrent();
  if (!current.available || !current.storage) return { ok: false, state: current.state, error: '浏览器存储不可用，未能保存。请检查隐私或存储设置。' };
  if (!current.writable) return { ok: false, state: current.state, error: '本地阅读库格式无法识别，已保留原数据。请确认后重置阅读库，再继续使用。' };
  // Browsing is automatic: never use it to repair and overwrite partially
  // invalid v1 data. Only an explicit list operation or reset may replace it.
  if (action.type === 'visit' && current.invalid) return { ok: false, state: current.state, error: '本地阅读库含有无效数据，已暂停自动记录并保留原数据。请先检查列表或明确重置阅读库。' };
  const result = applyLibraryAction(current.state, action);
  if (!result.ok) return { ok: false, state: result.state, ...(result.error ? { error: result.error } : {}) };
  try { if (result.changed) {
    // One feature key only. No account, progress, API or AI access.
    current.storage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(result.state));
  } } catch {
    return { ok: false, state: current.state, error: '保存失败：浏览器存储空间不足或写入被禁止。本次更改尚未保存。' };
  }
  const cleanup = action.type === 'removeRecent' && canonicalReaderHref(action.href) ? clearReadingPosition(action.href)
    : action.type === 'clearRecent' ? clearReadingPositions() : null;
  if (cleanup && !cleanup.ok) {
    notify();
    return { ok: false, state: result.state, error: '浏览列表已更新，但阅读位置未能清理，请检查浏览器存储设置后重试。' };
  }
  if (!result.changed && !cleanup) return { ok: true, state: result.state };
  notify();
  return { ok: true, state: result.state };
}

export function toggleFavorite(entry: LibraryEntry): LibraryWriteResult { return write({ type: 'toggleFavorite', entry }); }
export function visitEntry(entry: LibraryEntry): LibraryWriteResult { return write({ type: 'visit', entry }); }
export function removeFavorite(href: string): LibraryWriteResult { return write({ type: 'removeFavorite', href }); }
export function removeRecent(href: string): LibraryWriteResult { return write({ type: 'removeRecent', href }); }
export function clearRecent(): LibraryWriteResult { return write({ type: 'clearRecent' }); }
export function setHistoryEnabled(enabled: boolean): LibraryWriteResult { return write({ type: 'setHistoryEnabled', enabled }); }

/** Explicit recovery only: remove this feature's key and leave every other key alone. */
export function resetLibrary(): LibraryWriteResult {
  const current = readCurrent();
  if (!current.available || !current.storage) return { ok: false, state: current.state, error: '浏览器存储不可用，无法重置阅读库。' };
  try { current.storage.removeItem(LIBRARY_STORAGE_KEY); }
  catch { return { ok: false, state: current.state, error: '阅读库重置失败，原数据仍被保留。' }; }
  const cleanup = clearReadingPositions();
  notify();
  if (!cleanup.ok) return { ok:false, state:initialLibraryState(), error:'阅读列表已重置，但阅读位置未能清理，请检查浏览器存储设置后重试。' };
  return { ok: true, state: initialLibraryState() };
}

/** Works in this page and across tabs; importing this module during SSR is safe. */
export function subscribeLibrary(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const safeListener = () => { try { listener(); } catch { /* A UI listener cannot invalidate a successful save. */ } };
  const storageListener = (event: StorageEvent) => {
    if (event.key !== LIBRARY_STORAGE_KEY && event.key !== null) return;
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
    catch { return; }
    safeListener();
  };
  window.addEventListener(LIBRARY_EVENT, safeListener);
  window.addEventListener('storage', storageListener);
  return () => { window.removeEventListener(LIBRARY_EVENT, safeListener); window.removeEventListener('storage', storageListener); };
}
