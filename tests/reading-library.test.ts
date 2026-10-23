import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyLibraryAction, canonicalLibraryHref, initialLibraryState, MAX_FAVORITES,
  MAX_LIBRARY_RAW_LENGTH, MAX_RECENT, readLibraryState, sanitizeLibraryEntry,
  type LibraryEntry, type LibraryState,
} from '../src/lib/reading-library';
import {
  clearRecent, getLibrary, LIBRARY_STORAGE_KEY, removeFavorite, removeRecent,
  resetLibrary, setHistoryEnabled, subscribeLibrary, toggleFavorite, visitEntry,
} from '../src/scripts/library-store';

const now = 1_800_000_000_000;
const file: LibraryEntry = {
  id: 'kp:tools:file-io', type: 'kp', title: '文件读写', description: '读取与写入文件。',
  href: '/domains/tools/kp/file-io/', domain: 'tools',
};
const errorEntry: LibraryEntry = {
  id: 'error:ANSYS-004', type: 'error', title: '小主元错误 — 刚度矩阵奇异',
  description: 'Small pivot', href: '/errors/#ANSYS-004', code: 'ANSYS-004',
};
const tutorial = (number: number): LibraryEntry => ({ ...file, id: `kp:tools:entry-${number}`, title: `教程 ${number}`, href: `/domains/tools/kp/entry-${number}/` });
function rawState(overrides: Record<string, unknown> = {}) { return JSON.stringify({ ...initialLibraryState(), ...overrides }); }

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  calls: Array<[string, string]> = [];
  denyRead = false;
  denyWrite = false;
  get length() { return this.values.size; }
  clear() { throw new Error('The adapter must never clear other feature keys.'); }
  key(index: number) { return [...this.values.keys()][index] || null; }
  getItem(key: string) { this.calls.push(['get', key]); if (this.denyRead) throw new DOMException('blocked', 'SecurityError'); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.calls.push(['set', key]); if (this.denyWrite) throw new DOMException('full', 'QuotaExceededError'); this.values.set(key, value); }
  removeItem(key: string) { this.calls.push(['remove', key]); if (this.denyWrite) throw new DOMException('blocked', 'SecurityError'); this.values.delete(key); }
}
function browser() {
  const storage = new MemoryStorage();
  const fakeWindow = Object.assign(new EventTarget(), { localStorage: storage });
  vi.stubGlobal('window', fakeWindow);
  return { storage, fakeWindow };
}
function storageEvent(key: string | null, storageArea?: Storage) {
  const event = new Event('storage');
  Object.defineProperties(event, { key: { value: key }, storageArea: { value: storageArea } });
  return event;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('public library metadata and state validation', () => {
  it('canonicalizes public route slashes, deduplicates visits and retains exact error hashes', () => {
    expect(canonicalLibraryHref('/tools')).toBe('/tools/');
    expect(canonicalLibraryHref('/tools/')).toBe('/tools/');
    expect(canonicalLibraryHref('/')).toBe('/');
    expect(canonicalLibraryHref(errorEntry.href)).toBe('/errors/#ANSYS-004');
    let state = applyLibraryAction(initialLibraryState(), { type: 'visit', entry: { ...file, href: file.href.slice(0, -1) } }, now).state;
    state = applyLibraryAction(state, { type: 'visit', entry: errorEntry }, now + 1).state;
    state = applyLibraryAction(state, { type: 'visit', entry: file }, now + 2).state;
    expect(state.recent.map((item) => item.href)).toEqual([file.href, errorEntry.href]);
    expect(state.recent[0].at).toBe(now + 2);
    expect(applyLibraryAction(state, { type: 'removeRecent', href: file.href.slice(0, -1) }, now + 3).state.recent).toHaveLength(1);
  });

  it('projects only public metadata and rejects unsafe links, excessive values and prototypes', () => {
    const withPrivateFields = { ...file, raw: 'private draft', fields: { raw: 'secret' }, learningStatus: 'independent', token: 'not-a-real-token', at: now };
    expect(sanitizeLibraryEntry(withPrivateFields)).toEqual(file);
    const unsafe = ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/api/study/items', '/learning/shared?user=x', '/books/../ai', '/domains/tools/kp/%2e%2e', '/errors/#\" onclick=\"x'];
    for (const href of unsafe) expect(sanitizeLibraryEntry({ ...file, href })).toBeNull();
    for (const bad of [{ ...file, title: 'x'.repeat(241) }, { ...file, description: 'x'.repeat(1201) }, { ...file, domain: '__proto__' }, { ...file, type: 'private' }, { ...file, title: 7 }, { ...errorEntry, code: 'ANSYS-001' }, { ...file, href: '/tools/' }]) {
      expect(sanitizeLibraryEntry(bad)).toBeNull();
    }
    expect(sanitizeLibraryEntry(Object.create(file))).toBeNull();
    const getter = vi.fn(() => { throw new Error('must not call accessor'); });
    const accessorEntry = { ...file };
    Object.defineProperty(accessorEntry, 'title', { get: getter });
    expect(sanitizeLibraryEntry(accessorEntry)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    expect(sanitizeLibraryEntry(JSON.parse('{"__proto__":{"polluted":true}}'))).toBeNull();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('repairs known v1 entries with bounded arrays and timestamp checks without retaining private fields', () => {
    const parsed = readLibraryState(rawState({ favorites: [
      { ...file, at: now - 10, raw: 'private' }, { ...file, href: file.href.slice(0, -1), at: now },
      { ...errorEntry, at: -1 }, { ...errorEntry, at: now + 999_999 }, { ...errorEntry, at: 'yesterday' },
    ] }), now);
    expect(parsed).toMatchObject({ invalid: true, writable: true });
    expect(parsed.state.favorites).toEqual([{ ...file, at: now }]);
    expect(JSON.stringify(parsed.state)).not.toContain('private');
    const tooMany = Array.from({ length: MAX_FAVORITES + 1 }, (_, index) => ({ ...tutorial(index), at: now - index }));
    expect(readLibraryState(rawState({ favorites: tooMany }), now).state.favorites).toHaveLength(MAX_FAVORITES);
    const duplicate = readLibraryState(rawState({ recent: [{ ...file, at: now - 1 }, { ...file, at: now }] }), now);
    expect(duplicate.state.recent[0].at).toBe(now);
    expect(duplicate.state.recent).toHaveLength(1);
  });

  it('does not assume a schema for malformed, oversized, missing or unknown versions', () => {
    for (const raw of ['{bad', 'null', '[]', rawState({ version: 2 }), rawState({ version: undefined }), rawState({ historyEnabled: 'false' }), rawState({ favorites: {} }), rawState({ recent: Array(251).fill(null) }), ' '.repeat(MAX_LIBRARY_RAW_LENGTH + 1), '{"version":1,"favorites":[],"recent":[],"historyEnabled":true,"__proto__":{}}']) {
      expect(readLibraryState(raw, now)).toEqual({ state: initialLibraryState(), invalid: true, writable: false });
    }
    expect(readLibraryState(null, now)).toEqual({ state: initialLibraryState(), invalid: false, writable: true });
    expect(readLibraryState(rawState(), now)).toEqual({ state: initialLibraryState(), invalid: false, writable: true });
  });
});

describe('bounded favorites and recent transitions', () => {
  it('adds and toggles favorites by canonical href, with a hard 200 limit and no silent eviction', () => {
    let state = initialLibraryState();
    for (let index = 0; index < MAX_FAVORITES; index++) state = applyLibraryAction(state, { type: 'toggleFavorite', entry: tutorial(index) }, now + index).state;
    const full = state;
    const overflow = applyLibraryAction(state, { type: 'toggleFavorite', entry: tutorial(999) }, now + 1000);
    expect(overflow).toMatchObject({ ok: false, changed: false, state: full });
    expect(overflow.error).toContain('200');
    expect(state.favorites).toHaveLength(MAX_FAVORITES);
    const removed = applyLibraryAction(state, { type: 'toggleFavorite', entry: { ...tutorial(0), href: tutorial(0).href.slice(0, -1) } }, now + 1001);
    expect(removed.state.favorites).toHaveLength(MAX_FAVORITES - 1);
    expect(removed.state.recent).toEqual([]);
  });

  it('keeps only 50 recent entries, promotes a revisit and does not mutate the prior state', () => {
    let state = initialLibraryState();
    for (let index = 0; index < MAX_RECENT + 3; index++) state = applyLibraryAction(state, { type: 'visit', entry: tutorial(index) }, now + index).state;
    expect(state.recent).toHaveLength(MAX_RECENT);
    expect(state.recent[0].id).toBe(tutorial(52).id);
    expect(state.recent.some((item) => item.id === tutorial(0).id)).toBe(false);
    const before = structuredClone(state);
    const revisit = applyLibraryAction(state, { type: 'visit', entry: tutorial(10) }, now + 100);
    expect(revisit.state.recent[0].id).toBe(tutorial(10).id);
    expect(revisit.state.recent.filter((item) => item.id === tutorial(10).id)).toHaveLength(1);
    expect(state).toEqual(before);
  });

  it('pauses new history without deleting existing visits or stopping favorites', () => {
    let state = applyLibraryAction(initialLibraryState(), { type: 'visit', entry: file }, now).state;
    state = applyLibraryAction(state, { type: 'setHistoryEnabled', enabled: false }, now).state;
    const paused = applyLibraryAction(state, { type: 'visit', entry: errorEntry }, now + 1);
    expect(paused).toMatchObject({ ok: true, changed: false, state });
    const favorite = applyLibraryAction(state, { type: 'toggleFavorite', entry: errorEntry }, now + 2).state;
    expect(favorite.favorites).toHaveLength(1);
    const cleared = applyLibraryAction(favorite, { type: 'clearRecent' }, now + 3).state;
    expect(cleared).toMatchObject({ recent: [], favorites: favorite.favorites, historyEnabled: false });
    expect(applyLibraryAction(cleared, { type: 'setHistoryEnabled', enabled: true }, now + 4).state.historyEnabled).toBe(true);
  });
});

describe('browser persistence, error reporting and notifications', () => {
  it('is safe to import and call during SSR without browser globals', () => {
    vi.stubGlobal('window', undefined);
    expect(getLibrary()).toMatchObject({ available: false, state: initialLibraryState() });
    expect(toggleFavorite(file).ok).toBe(false);
    expect(resetLibrary().ok).toBe(false);
    expect(() => subscribeLibrary(() => {})()).not.toThrow();
  });

  it('persists successful operations, supports reload and touches only the feature key', () => {
    const { storage } = browser();
    storage.values.set('simulearn-learning-progress', 'unrelated-private-progress');
    expect(toggleFavorite(file).ok).toBe(true);
    expect(visitEntry(errorEntry).ok).toBe(true);
    expect(getLibrary().state).toMatchObject({ favorites: [{ ...file }], recent: [{ ...errorEntry }] });
    expect(JSON.parse(storage.values.get(LIBRARY_STORAGE_KEY)!)).toEqual(getLibrary().state);
    expect(removeFavorite(file.href.slice(0, -1)).state.favorites).toEqual([]);
    expect(removeRecent(errorEntry.href).state.recent).toEqual([]);
    expect(setHistoryEnabled(false).ok).toBe(true);
    expect(visitEntry(file).state.recent).toEqual([]);
    expect(setHistoryEnabled(true).ok).toBe(true);
    expect(visitEntry(file).state.recent).toHaveLength(1);
    expect(clearRecent().state.recent).toEqual([]);
    expect(storage.values.get('simulearn-learning-progress')).toBe('unrelated-private-progress');
    expect(storage.calls.every(([, key]) => key === LIBRARY_STORAGE_KEY)).toBe(true);
  });

  it('returns actual unchanged state when reads or writes are blocked, with no memory fallback', () => {
    const { storage, fakeWindow } = browser();
    toggleFavorite(file);
    const before = storage.values.get(LIBRARY_STORAGE_KEY);
    const priorState = getLibrary().state;
    const listener = vi.fn(); const unsubscribe = subscribeLibrary(listener);
    storage.denyWrite = true;
    const failed = toggleFavorite(errorEntry);
    expect(failed).toMatchObject({ ok: false, state: priorState });
    expect(failed.error).toContain('保存失败');
    expect(storage.values.get(LIBRARY_STORAGE_KEY)).toBe(before);
    expect(getLibrary().state).toEqual(priorState);
    expect(listener).not.toHaveBeenCalled();
    storage.denyRead = true;
    expect(getLibrary().available).toBe(false);
    expect(toggleFavorite(errorEntry).ok).toBe(false);
    Object.defineProperty(fakeWindow, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
    expect(getLibrary().available).toBe(false);
    expect(resetLibrary().ok).toBe(false);
    unsubscribe();
  });

  it('preserves unsupported data on every write until an explicit reset, then removes only its key', () => {
    const { storage } = browser();
    const unsupported = rawState({ version: 2 });
    storage.values.set(LIBRARY_STORAGE_KEY, unsupported);
    storage.values.set('theme', 'dark');
    expect(getLibrary()).toMatchObject({ available: true, invalid: true });
    expect(toggleFavorite(file).ok).toBe(false);
    expect(visitEntry(file).ok).toBe(false);
    expect(clearRecent().ok).toBe(false);
    expect(setHistoryEnabled(false).ok).toBe(false);
    expect(storage.values.get(LIBRARY_STORAGE_KEY)).toBe(unsupported);
    expect(storage.calls.some(([operation]) => operation === 'set')).toBe(false);
    storage.denyWrite = true;
    expect(resetLibrary().ok).toBe(false);
    expect(storage.values.get(LIBRARY_STORAGE_KEY)).toBe(unsupported);
    storage.denyWrite = false;
    expect(resetLibrary()).toEqual({ ok: true, state: initialLibraryState() });
    expect(storage.values.has(LIBRARY_STORAGE_KEY)).toBe(false);
    expect(storage.values.get('theme')).toBe('dark');
    expect(toggleFavorite(file).ok).toBe(true);
  });

  it('never repairs partially invalid v1 data during automatic browsing, but permits explicit list changes', () => {
    const { storage } = browser();
    const original = rawState({ favorites: [
      { ...file, at: Date.now() },
      { ...errorEntry, href: '/api/study/items', at: Date.now() },
    ] });
    storage.values.set(LIBRARY_STORAGE_KEY, original);
    const before = getLibrary();
    expect(before).toMatchObject({ available: true, invalid: true });
    expect(before.state.favorites).toHaveLength(1);
    const listener = vi.fn(); const unsubscribe = subscribeLibrary(listener);
    const automaticVisit = visitEntry(errorEntry);
    expect(automaticVisit).toMatchObject({ ok: false, state: before.state });
    expect(automaticVisit.error).toContain('保留原数据');
    expect(storage.values.get(LIBRARY_STORAGE_KEY)).toBe(original);
    expect(storage.calls.some(([operation]) => operation === 'set')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    const explicitFavorite = toggleFavorite(errorEntry);
    expect(explicitFavorite.ok).toBe(true);
    expect(explicitFavorite.state.favorites).toHaveLength(2);
    expect(getLibrary().invalid).toBeUndefined();
    expect(storage.values.get(LIBRARY_STORAGE_KEY)).not.toContain('/api/study/items');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('notifies same-page listeners and other-tab changes, ignores other keys and unsubscribes', () => {
    const { storage, fakeWindow } = browser();
    const listener = vi.fn();
    const unsubscribe = subscribeLibrary(listener);
    toggleFavorite(file);
    expect(listener).toHaveBeenCalledTimes(1);
    fakeWindow.dispatchEvent(storageEvent('theme', storage));
    expect(listener).toHaveBeenCalledTimes(1);
    storage.values.set(LIBRARY_STORAGE_KEY, rawState({ historyEnabled: false }));
    fakeWindow.dispatchEvent(storageEvent(LIBRARY_STORAGE_KEY, storage));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getLibrary().state.historyEnabled).toBe(false);
    fakeWindow.dispatchEvent(storageEvent(LIBRARY_STORAGE_KEY, new MemoryStorage()));
    expect(listener).toHaveBeenCalledTimes(2);
    fakeWindow.dispatchEvent(storageEvent(null, storage));
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    resetLibrary();
    fakeWindow.dispatchEvent(storageEvent(LIBRARY_STORAGE_KEY, storage));
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
