import { isSafeSearchHref, type SearchEntry } from './search';

export type LibraryEntry = Pick<SearchEntry, 'id' | 'type' | 'title' | 'description' | 'href' | 'domain' | 'code'>;
export interface LibraryItem extends LibraryEntry { at: number }
export interface LibraryState {
  version: 1;
  favorites: LibraryItem[];
  recent: LibraryItem[];
  historyEnabled: boolean;
}
export interface LibraryReadResult { state: LibraryState; invalid: boolean; writable: boolean }
export interface LibraryWriteResult { ok: boolean; state: LibraryState; error?: string }
export interface LibraryTransition extends LibraryWriteResult { changed: boolean }
export type LibraryAction =
  | { type: 'toggleFavorite' | 'visit'; entry: LibraryEntry }
  | { type: 'removeFavorite' | 'removeRecent'; href: string }
  | { type: 'clearRecent' }
  | { type: 'setHistoryEnabled'; enabled: boolean };
export const MAX_FAVORITES = 200;
export const MAX_RECENT = 50;
export const MAX_LIBRARY_RAW_LENGTH = 1_000_000;
const MAX_FUTURE_SKEW = 5 * 60 * 1_000;
const allowedDomains = new Set(['structural', 'thermal', 'fluids', 'multiphysics', 'chip', 'tools']);
const allowedTypes = new Set(['kp', 'error', 'page', 'case']);
const entryKeys = new Set(['id', 'type', 'title', 'description', 'href', 'domain', 'code', 'at']);

export function initialLibraryState(): LibraryState {
  return { version: 1, favorites: [], recent: [], historyEnabled: true };
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.getOwnPropertyNames(value).every((key) => !['__proto__', 'constructor', 'prototype'].includes(key)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) || {}, 'value'));
}
function own(record: Record<string, unknown>, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}
function text(value: unknown, maxLength: number, required = false): value is string {
  return typeof value === 'string' && value.length <= maxLength
    && (!required || !!value.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

/** Public routes only. A hash is retained only for an existing error-card route. */
export function canonicalLibraryHref(value: unknown): string | null {
  if (typeof value !== 'string' || !isSafeSearchHref(value)) return null;
  if (value === '/' || value.includes('#')) return value;
  return `${value.replace(/\/$/, '')}/`;
}

/** Copy exactly the public metadata fields; raw notes, account state, etc. are dropped. */
export function sanitizeLibraryEntry(value: unknown): LibraryEntry | null {
  try {
    if (!plainRecord(value)) return null;
    const id = own(value, 'id');
    const type = own(value, 'type');
    const title = own(value, 'title');
    const description = own(value, 'description');
    const href = canonicalLibraryHref(own(value, 'href'));
    const domain = own(value, 'domain');
    const code = own(value, 'code');
    if (!text(id, 160, true) || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/.test(id)
      || typeof type !== 'string' || !allowedTypes.has(type)
      || !text(title, 240, true) || !text(description, 1_200) || !href) return null;
    if (domain !== undefined && (typeof domain !== 'string' || !allowedDomains.has(domain))) return null;
    if (code !== undefined && (typeof code !== 'string' || !/^(ANSYS|ABAQUS|GENERAL|FLUENT|LSDYNA)-\d{3}$/.test(code))) return null;
    if (type === 'error' && (!/^\/errors\/#/.test(href) || (code && !href.endsWith(`#${code}`)))) return null;
    if (type === 'kp' && !/^\/domains\/(structural|thermal|fluids|multiphysics|chip|tools)\/kp\//.test(href)) return null;
    if (type === 'case' && href !== '/cases/rock-dynamic-stability/' && !/^\/cases\/benchmarks\/(uniform-bar|stepped-bar|cantilever-beam)\/$/.test(href)) return null;
    return { id, type: type as LibraryEntry['type'], title: title.trim(), description: description.trim(), href,
      ...(domain === undefined ? {} : { domain: domain as LibraryEntry['domain'] }),
      ...(code === undefined ? {} : { code: code as string }) };
  } catch { return null; }
}

function validTime(value: unknown, now: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= now + MAX_FUTURE_SKEW;
}
function collection(input: unknown[], limit: number, now: number): { items: LibraryItem[]; invalid: boolean } {
  let invalid = input.length > limit;
  const candidates: Array<{ item: LibraryItem; order: number }> = [];
  for (const [order, value] of input.entries()) {
    const entry = sanitizeLibraryEntry(value);
    const at = plainRecord(value) ? own(value, 'at') : undefined;
    if (!entry || !validTime(at, now)) { invalid = true; continue; }
    if (Object.keys(value as object).some((key) => !entryKeys.has(key)) || own(value as Record<string, unknown>, 'href') !== entry.href) invalid = true;
    candidates.push({ item: { ...entry, at }, order });
  }
  candidates.sort((a, b) => b.item.at - a.item.at || a.order - b.order);
  const seen = new Set<string>();
  const items: LibraryItem[] = [];
  for (const { item } of candidates) {
    if (seen.has(item.href)) { invalid = true; continue; }
    seen.add(item.href);
    if (items.length < limit) items.push(item);
  }
  return { items, invalid };
}

/** Unknown schemas and unreadable JSON stay untouched until an explicit reset.
 * Known v1 data can be repaired by dropping invalid entries and copying public fields.
 */
export function readLibraryState(raw: string | null, now = Date.now()): LibraryReadResult {
  const empty = (): LibraryReadResult => ({ state: initialLibraryState(), invalid: true, writable: false });
  if (raw === null) return { state: initialLibraryState(), invalid: false, writable: true };
  if (typeof raw !== 'string' || raw.length > MAX_LIBRARY_RAW_LENGTH || !validTime(now, now)) return empty();
  try {
    const value: unknown = JSON.parse(raw);
    if (!plainRecord(value) || own(value, 'version') !== 1 || typeof own(value, 'historyEnabled') !== 'boolean') return empty();
    const favorites = own(value, 'favorites');
    const recent = own(value, 'recent');
    if (!Array.isArray(favorites) || !Array.isArray(recent) || favorites.length > MAX_FAVORITES * 5 || recent.length > MAX_RECENT * 5) return empty();
    const cleanFavorites = collection(favorites, MAX_FAVORITES, now);
    const cleanRecent = collection(recent, MAX_RECENT, now);
    const extraFields = Object.keys(value).some((key) => !['version', 'favorites', 'recent', 'historyEnabled'].includes(key));
    return {
      state: { version: 1, favorites: cleanFavorites.items, recent: cleanRecent.items, historyEnabled: own(value, 'historyEnabled') as boolean },
      invalid: cleanFavorites.invalid || cleanRecent.invalid || extraFields, writable: true,
    };
  } catch { return empty(); }
}

/** Pure state transition. Persistence and browser events belong in the adapter. */
export function applyLibraryAction(state: LibraryState, action: LibraryAction, now = Date.now()): LibraryTransition {
  const unchanged = (error?: string): LibraryTransition => ({ ok: !error, state, changed: false, ...(error ? { error } : {}) });
  if (!validTime(now, now)) return unchanged('记录时间无效。');
  if (action.type === 'clearRecent') return state.recent.length ? { ok: true, changed: true, state: { ...state, recent: [] } } : unchanged();
  if (action.type === 'setHistoryEnabled') {
    if (typeof action.enabled !== 'boolean') return unchanged('最近浏览设置无效。');
    return state.historyEnabled === action.enabled ? unchanged() : { ok: true, changed: true, state: { ...state, historyEnabled: action.enabled } };
  }
  if (action.type === 'removeFavorite' || action.type === 'removeRecent') {
    const href = canonicalLibraryHref(action.href);
    if (!href) return unchanged('站内链接无效。');
    const key = action.type === 'removeFavorite' ? 'favorites' : 'recent';
    const items = state[key].filter((item) => item.href !== href);
    return items.length === state[key].length ? unchanged() : { ok: true, changed: true, state: { ...state, [key]: items } };
  }
  if (!('entry' in action)) return unchanged('阅读库操作类型无效。');
  if (action.type === 'visit' && !state.historyEnabled) return unchanged();
  const entry = sanitizeLibraryEntry(action.entry);
  if (!entry) return unchanged('只能保存有效的站内公开内容，且标题与描述不能过长。');
  if (action.type === 'toggleFavorite') {
    const existing = state.favorites.some((item) => item.href === entry.href);
    if (existing) return { ok: true, changed: true, state: { ...state, favorites: state.favorites.filter((item) => item.href !== entry.href) } };
    if (state.favorites.length >= MAX_FAVORITES) return unchanged('收藏已达 200 项，请先移除部分收藏。');
    const item: LibraryItem = { ...entry, at: Math.max(now, state.favorites[0]?.at || 0) };
    return { ok: true, changed: true, state: { ...state, favorites: [item, ...state.favorites] } };
  }
  const item: LibraryItem = { ...entry, at: Math.max(now, state.recent[0]?.at || 0) };
  return { ok: true, changed: true, state: { ...state, recent: [item, ...state.recent.filter((value) => value.href !== entry.href)].slice(0, MAX_RECENT) } };
}
