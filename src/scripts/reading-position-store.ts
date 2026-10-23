import {
  canonicalReaderHref, initialReaderState, isReaderFont, readReaderState, saveReaderPosition,
  type ReaderFont, type ReaderPosition, type ReaderState, type ReaderWriteResult,
} from '../lib/reading-position';
export type { ReaderFont, ReaderPosition, ReaderState, ReaderWriteResult } from '../lib/reading-position';

export const READER_STORAGE_KEY = 'simulearn-reading-position-v1';
const READER_EVENT = 'simulearn:reading-position-change';
export interface ReaderSnapshot { state: ReaderState; available: boolean; invalid?: boolean }
interface InternalSnapshot extends ReaderSnapshot { storage?: Storage; writable: boolean }

function readCurrent(): InternalSnapshot {
  try {
    if (typeof window === 'undefined') return { state: initialReaderState(), available: false, writable: false };
    const storage = window.localStorage;
    if (!storage) return { state: initialReaderState(), available: false, writable: false };
    return { ...readReaderState(storage.getItem(READER_STORAGE_KEY)), storage, available: true };
  } catch { return { state: initialReaderState(), available: false, writable: false }; }
}
export function getReaderState(): ReaderSnapshot {
  const { state, available, invalid } = readCurrent();
  return { state, available, ...(invalid ? { invalid: true } : {}) };
}
export function getReadingPosition(href: string): ReaderPosition | null {
  const safeHref = canonicalReaderHref(href);
  if (!safeHref) return null;
  return readCurrent().state.positions.find((position) => position.href === safeHref) || null;
}
function notify(): void { if (typeof window !== 'undefined') window.dispatchEvent(new Event(READER_EVENT)); }
function denied(current: InternalSnapshot): ReaderWriteResult | null {
  if (!current.available || !current.storage) return { ok: false, state: current.state, error: '浏览器存储不可用，阅读设置与位置未保存。' };
  if (current.invalid || !current.writable) return { ok: false, state: current.state, error: '本地阅读位置数据损坏或格式不受支持，已保留原数据。请确认后清除阅读位置再继续保存。' };
  return null;
}
function persist(current: InternalSnapshot, state: ReaderState): ReaderWriteResult {
  try { current.storage!.setItem(READER_STORAGE_KEY, JSON.stringify(state)); }
  catch { return { ok: false, state: current.state, error: '保存失败：浏览器存储已满或写入被禁止。阅读位置与设置未保存。' }; }
  notify();
  return { ok: true, state };
}
export function saveReadingPosition(position: ReaderPosition): ReaderWriteResult {
  const current = readCurrent();
  const failure = denied(current); if (failure) return failure;
  const result = saveReaderPosition(current.state, position);
  if (!result.ok || !result.changed) return { ok: result.ok, state: result.state, ...(result.error ? { error: result.error } : {}) };
  return persist(current, result.state);
}
export function clearReadingPosition(href: string): ReaderWriteResult {
  const current = readCurrent();
  const failure = denied(current); if (failure) return failure;
  const safeHref = canonicalReaderHref(href);
  if (!safeHref) return { ok: false, state: current.state, error: '阅读位置链接无效。' };
  const positions = current.state.positions.filter((position) => position.href !== safeHref);
  return positions.length === current.state.positions.length ? { ok: true, state: current.state } : persist(current, { ...current.state, positions });
}
/** Explicit action: healthy data keeps font preferences; damaged data is reset by
 * removing only this key. The caller is responsible for the user's confirmation.
 */
export function clearReadingPositions(): ReaderWriteResult {
  const current = readCurrent();
  if (!current.available || !current.storage) return { ok: false, state: current.state, error: '浏览器存储不可用，无法清除阅读位置。' };
  if (current.invalid || !current.writable) {
    try { current.storage.removeItem(READER_STORAGE_KEY); }
    catch { return { ok: false, state: current.state, error: '清除阅读位置失败，原数据仍被保留。' }; }
    notify();
    return { ok: true, state: initialReaderState() };
  }
  if (!current.state.positions.length) return { ok: true, state: current.state };
  return persist(current, { ...current.state, positions: [] });
}
export function setReaderFont(font: ReaderFont): ReaderWriteResult {
  const current = readCurrent();
  if (!isReaderFont(font)) return { ok: false, state: current.state, error: '字号设置无效。' };
  const failure = denied(current); if (failure) return failure;
  return current.state.fontSize === font ? { ok: true, state: current.state } : persist(current, { ...current.state, fontSize: font });
}
export function subscribeReader(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const safeListener = () => { try { listener(); } catch { /* UI errors cannot turn a persisted save into a reported failure. */ } };
  const storageListener = (event: StorageEvent) => {
    if (event.key !== READER_STORAGE_KEY && event.key !== null) return;
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
    catch { return; }
    safeListener();
  };
  window.addEventListener(READER_EVENT, safeListener);
  window.addEventListener('storage', storageListener);
  return () => { window.removeEventListener(READER_EVENT, safeListener); window.removeEventListener('storage', storageListener); };
}
