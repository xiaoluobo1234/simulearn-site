import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canonicalReaderHref, contentSignature, initialReaderState, isSafeReaderAnchor,
  MAX_READER_RAW_LENGTH, MAX_READING_POSITIONS, readReaderState, sanitizeReaderPosition,
  saveReaderPosition, type ReaderPosition,
} from '../src/lib/reading-position';
import {
  clearReadingPosition, clearReadingPositions, getReaderState, getReadingPosition,
  READER_STORAGE_KEY, saveReadingPosition, setReaderFont, subscribeReader,
} from '../src/scripts/reading-position-store';

const now = 1_800_000_000_000;
const position = (overrides: Partial<ReaderPosition> = {}): ReaderPosition => ({
  href: '/domains/tools/kp/file-io/', anchor: 'reader-section-2', label: '读取文件',
  sectionProgress: 0.25, progress: 0.4, updatedAt: now,
  signature: contentSignature('公开文章示例\n\n读取 CSV 文件。'), ...overrides,
});
const serialized = (overrides: Record<string, unknown> = {}) => JSON.stringify({ ...initialReaderState(), ...overrides });
class MemoryStorage implements Storage {
  values = new Map<string, string>();
  calls: Array<[string, string]> = [];
  denyRead = false;
  denyWrite = false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] || null; }
  clear() { throw new Error('Never clear unrelated storage.'); }
  getItem(key: string) { this.calls.push(['get', key]); if (this.denyRead) throw new DOMException('denied', 'SecurityError'); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.calls.push(['set', key]); if (this.denyWrite) throw new DOMException('full', 'QuotaExceededError'); this.values.set(key, value); }
  removeItem(key: string) { this.calls.push(['remove', key]); if (this.denyWrite) throw new DOMException('denied', 'SecurityError'); this.values.delete(key); }
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

describe('public article position validation', () => {
  it('produces stable short fingerprints without persisting or returning article text', () => {
    const text = '# 公开知识点\n\n一段正文';
    expect(contentSignature(text)).toBe(contentSignature(text));
    expect(contentSignature(text)).toMatch(/^v1-[a-f0-9]{8}$/);
    expect(contentSignature(text)).not.toBe(contentSignature(text + '已修订'));
    expect(contentSignature('')).toMatch(/^v1-[a-f0-9]{8}$/);
    const projected = sanitizeReaderPosition({ ...position(), body: text, token: 'private-value', learningStatus: 'independent' }, now)!;
    expect(projected).toEqual(position());
    expect(JSON.stringify(projected)).not.toContain(text);
    expect(projected).not.toHaveProperty('body');
    expect(projected).not.toHaveProperty('learningStatus');
  });

  it('accepts only canonical public knowledge details and the real case, never private or error pages', () => {
    for (const domain of ['structural', 'thermal', 'fluids', 'multiphysics', 'chip', 'tools']) {
      expect(canonicalReaderHref(`/domains/${domain}/kp/example-1`)).toBe(`/domains/${domain}/kp/example-1/`);
    }
    expect(canonicalReaderHref('/cases/rock-dynamic-stability')).toBe('/cases/rock-dynamic-stability/');
    for (const href of ['/', '/tools/', '/library/', '/learning/records/', '/learning/shared', '/learning/activity/', '/labs/', '/labs/python/', '/labs/assembly/', '/labs/convergence/', '/content-status/', '/api/study/items', '/errors/#ANSYS-004', '/errors/', '/cases/unknown-case/', '/domains/tools/kp/file-io/?token=x', '/domains/tools/kp/file-io/#section', '//evil.example', 'javascript:alert(1)', '/domains/tools/kp/%2e%2e', '/domains/private/kp/note/']) {
      expect(canonicalReaderHref(href)).toBeNull();
      expect(sanitizeReaderPosition(position({ href }), now)).toBeNull();
    }
  });

  it('validates real safe IDs, bounded labels, ratios, timestamps and hash format without evaluating accessors', () => {
    for (const anchor of ['工程问题', 'reader-section-0', 'validation', '第2节_边界条件']) expect(isSafeReaderAnchor(anchor)).toBe(true);
    for (const anchor of ['', 'a'.repeat(121), '#section', 'a b', 'a.b', 'a:b', 'a/b', 'a?b', 'a[b]', 'a\"b', 'a\\b', '<script>', 'a\n']) {
      expect(sanitizeReaderPosition(position({ anchor }), now)).toBeNull();
    }
    for (const changes of [
      { label: 'x'.repeat(161) }, { label: 'x\n' }, { sectionProgress: -0.01 }, { sectionProgress: 1.01 },
      { progress: NaN }, { progress: Infinity }, { updatedAt: -1 }, { updatedAt: now + 999_999 },
      { updatedAt: 0.5 }, { signature: 'unhashed article text' }, { signature: 'v1-FFFFFFFF' },
    ]) expect(sanitizeReaderPosition({ ...position(), ...changes }, now)).toBeNull();
    expect(sanitizeReaderPosition(position({ sectionProgress: 0, progress: 1, updatedAt: 0 }), now)).not.toBeNull();
    expect(sanitizeReaderPosition(Object.create(position()), now)).toBeNull();
    expect(sanitizeReaderPosition(JSON.parse('{"__proto__":{"polluted":true}}'), now)).toBeNull();
    const accessor = { ...position() }; const getter = vi.fn(() => 'unexpected');
    Object.defineProperty(accessor, 'label', { get: getter });
    expect(sanitizeReaderPosition(accessor, now)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it('bounds and safely projects known state while marking any partial corruption as unwritable', () => {
    const parsed = readReaderState(serialized({ fontSize: 'large', positions: [
      position({ updatedAt: now - 1, anchor: 'old' }), position({ updatedAt: now, href: '/domains/tools/kp/file-io' }),
      position({ href: '/learning/records/' }), position({ href: '/domains/tools/kp/functions/', updatedAt: now + 999_999 }),
    ] }), now);
    expect(parsed).toMatchObject({ invalid: true, writable: false, state: { fontSize: 'large' } });
    expect(parsed.state.positions).toEqual([position()]);
    const excessive = Array.from({ length: 51 }, (_, index) => position({ href: `/domains/tools/kp/item-${index}/`, updatedAt: now - index }));
    const bounded = readReaderState(serialized({ positions: excessive }), now);
    expect(bounded.state.positions).toHaveLength(50);
    expect(bounded).toMatchObject({ invalid: true, writable: false });
    for (const raw of ['{bad', 'null', '[]', serialized({ version: 2 }), serialized({ version: undefined }), serialized({ fontSize: 'huge' }), serialized({ positions: {} }), serialized({ positions: Array(251).fill(null) }), ' '.repeat(MAX_READER_RAW_LENGTH + 1), '{"version":1,"fontSize":"normal","positions":[],"__proto__":{}}']) {
      expect(readReaderState(raw, now)).toEqual({ state: initialReaderState(), invalid: true, writable: false });
    }
    expect(readReaderState(null, now)).toEqual({ state: initialReaderState(), invalid: false, writable: true });
  });

  it('keeps the newest position per href, caps at 50, preserves font and ignores stale writes', () => {
    let state = { ...initialReaderState(), fontSize: 'extra' as const };
    for (let index = 0; index < 53; index++) state = saveReaderPosition(state, position({ href: `/domains/tools/kp/item-${index}/`, updatedAt: now + index }), now + 100).state as typeof state;
    expect(state.positions).toHaveLength(MAX_READING_POSITIONS);
    expect(state.positions[0].href).toBe('/domains/tools/kp/item-52/');
    expect(state.fontSize).toBe('extra');
    const before = structuredClone(state);
    const revisit = saveReaderPosition(state, position({ href: '/domains/tools/kp/item-10', anchor: 'next-section', updatedAt: now + 101 }), now + 101);
    expect(revisit.state.positions[0]).toMatchObject({ href: '/domains/tools/kp/item-10/', anchor: 'next-section' });
    expect(revisit.state.positions.filter((item) => item.href === '/domains/tools/kp/item-10/')).toHaveLength(1);
    expect(state).toEqual(before);
    const stale = saveReaderPosition(revisit.state, position({ href: '/domains/tools/kp/item-10/', updatedAt: now + 1 }), now + 102);
    expect(stale).toMatchObject({ ok: true, changed: false, state: revisit.state });
  });
});

describe('reader browser storage isolation and failures', () => {
  it('is SSR safe and treats inaccessible storage as failure without a memory fallback', () => {
    vi.stubGlobal('window', undefined);
    expect(getReaderState()).toMatchObject({ available: false, state: initialReaderState() });
    expect(getReadingPosition(position().href)).toBeNull();
    expect(saveReadingPosition(position()).ok).toBe(false);
    expect(setReaderFont('large').ok).toBe(false);
    expect(clearReadingPositions().ok).toBe(false);
    expect(() => subscribeReader(() => {})()).not.toThrow();
    const { storage, fakeWindow } = browser();
    storage.denyRead = true;
    expect(getReaderState().available).toBe(false);
    expect(saveReadingPosition(position()).ok).toBe(false);
    Object.defineProperty(fakeWindow, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    expect(getReaderState().available).toBe(false);
  });

  it('reloads a real saved position, applies font preferences, and clears positions without changing other keys', () => {
    const { storage } = browser();
    storage.values.set('simulearn-reading-library-v1', 'unrelated-library');
    storage.values.set('simulearn-learning-progress', 'unrelated-progress');
    const current = position({ updatedAt: Date.now(), anchor: '文件读取' });
    expect(saveReadingPosition(current).ok).toBe(true);
    expect(getReadingPosition(current.href.slice(0, -1))).toEqual(current);
    expect(setReaderFont('extra').state.fontSize).toBe('extra');
    expect(clearReadingPosition(current.href.slice(0, -1)).state).toMatchObject({ positions: [], fontSize: 'extra' });
    saveReadingPosition(current);
    expect(clearReadingPositions().state).toEqual({ version: 1, positions: [], fontSize: 'extra' });
    expect(getReaderState().state.fontSize).toBe('extra');
    expect(storage.values.get('simulearn-reading-library-v1')).toBe('unrelated-library');
    expect(storage.values.get('simulearn-learning-progress')).toBe('unrelated-progress');
    expect(storage.calls.every(([, key]) => key === READER_STORAGE_KEY)).toBe(true);
  });

  it('does not overwrite partially corrupt or unknown raw data on automatic save, font changes or clear-one', () => {
    const { storage } = browser();
    for (const original of [serialized({ version: 2 }), '{broken', serialized({ fontSize: 'large', positions: [position({ updatedAt: Date.now() }), position({ href: '/api/study/items' })] })]) {
      storage.values.set(READER_STORAGE_KEY, original);
      const before = getReaderState();
      expect(before).toMatchObject({ available: true, invalid: true });
      expect(saveReadingPosition(position({ updatedAt: Date.now() })).ok).toBe(false);
      expect(setReaderFont('extra').ok).toBe(false);
      expect(clearReadingPosition(position().href).ok).toBe(false);
      expect(storage.values.get(READER_STORAGE_KEY)).toBe(original);
      expect(storage.calls.some(([method]) => method === 'set')).toBe(false);
      expect(getReaderState().state).toEqual(before.state);
    }
    expect(clearReadingPositions()).toEqual({ ok: true, state: initialReaderState() });
    expect(storage.values.has(READER_STORAGE_KEY)).toBe(false);
    expect(saveReadingPosition(position({ updatedAt: Date.now() })).ok).toBe(true);
  });

  it('reports quota failures and leaves old state and notifications unchanged', () => {
    const { storage } = browser();
    saveReadingPosition(position({ updatedAt: Date.now() }));
    const before = storage.values.get(READER_STORAGE_KEY);
    const state = getReaderState().state;
    const listener = vi.fn(); const unsubscribe = subscribeReader(listener);
    storage.denyWrite = true;
    const failure = saveReadingPosition(position({ updatedAt: Date.now(), anchor: 'another-section' }));
    expect(failure).toMatchObject({ ok: false, state });
    expect(failure.error).toContain('保存失败');
    expect(setReaderFont('large')).toMatchObject({ ok: false, state });
    expect(clearReadingPositions()).toMatchObject({ ok: false, state });
    expect(storage.values.get(READER_STORAGE_KEY)).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    storage.values.set(READER_STORAGE_KEY, '{bad');
    expect(clearReadingPositions().ok).toBe(false);
    expect(storage.values.get(READER_STORAGE_KEY)).toBe('{bad');
    unsubscribe();
  });

  it('notifies this page and other tabs while ignoring library/progress events and supporting unsubscribe', () => {
    const { storage, fakeWindow } = browser();
    const listener = vi.fn(); const unsubscribe = subscribeReader(listener);
    saveReadingPosition(position({ updatedAt: Date.now() }));
    expect(listener).toHaveBeenCalledTimes(1);
    fakeWindow.dispatchEvent(storageEvent('simulearn-reading-library-v1', storage));
    fakeWindow.dispatchEvent(storageEvent('simulearn-learning-progress', storage));
    fakeWindow.dispatchEvent(storageEvent(READER_STORAGE_KEY, new MemoryStorage()));
    expect(listener).toHaveBeenCalledTimes(1);
    storage.values.set(READER_STORAGE_KEY, serialized({ fontSize: 'large' }));
    fakeWindow.dispatchEvent(storageEvent(READER_STORAGE_KEY, storage));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getReaderState().state.fontSize).toBe('large');
    fakeWindow.dispatchEvent(storageEvent(null, storage));
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    setReaderFont('extra');
    fakeWindow.dispatchEvent(storageEvent(READER_STORAGE_KEY, storage));
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
