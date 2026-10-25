import { isSafeSearchHref } from './search';

export type ReaderFont = 'normal' | 'large' | 'extra';
export interface ReaderPosition {
  href: string;
  anchor: string;
  label: string;
  sectionProgress: number;
  progress: number;
  updatedAt: number;
  signature: string;
}
export interface ReaderState { version: 1; positions: ReaderPosition[]; fontSize: ReaderFont }
export interface ReaderReadResult { state: ReaderState; invalid: boolean; writable: boolean }
export interface ReaderWriteResult { ok: boolean; state: ReaderState; error?: string }
export interface ReaderTransition extends ReaderWriteResult { changed: boolean }
export const MAX_READING_POSITIONS = 50;
export const MAX_READER_RAW_LENGTH = 256_000;
const FUTURE_SKEW = 5 * 60 * 1_000;
const positionKeys = new Set(['href', 'anchor', 'label', 'sectionProgress', 'progress', 'updatedAt', 'signature']);

export function initialReaderState(): ReaderState { return { version: 1, positions: [], fontSize: 'normal' }; }
export function isReaderFont(value: unknown): value is ReaderFont { return value === 'normal' || value === 'large' || value === 'extra'; }

/** Synchronous fingerprint only: no article text is stored or returned. */
export function contentSignature(text: string): string {
  let hash = 0x811c9dc5;
  for (let offset = 0; offset < text.length; offset++) {
    hash ^= text.charCodeAt(offset);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function canonicalReaderHref(value: unknown): string | null {
  if (typeof value !== 'string' || !isSafeSearchHref(value)) return null;
  if (!/^\/domains\/(structural|thermal|fluids|multiphysics|chip|tools)\/kp\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(value)
    && !/^\/cases\/rock-dynamic-stability\/?$/.test(value)
    && !/^\/cases\/benchmarks\/(uniform-bar|stepped-bar|cantilever-beam)\/?$/.test(value)
    && !/^\/diagnostic\/(rigid-body|nonconvergence|stress-singularity|units|force-balance|boundary)\/?$/.test(value)) return null;
  return `${value.replace(/\/$/, '')}/`;
}
export function isSafeReaderAnchor(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 120 && /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(value);
}
function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) return false;
  return Object.getOwnPropertyNames(value).every((key) => !['constructor', 'prototype', '__proto__'].includes(key)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) || {}, 'value'));
}
function own(record: Record<string, unknown>, key: string): unknown { return Object.getOwnPropertyDescriptor(record, key)?.value; }
function ratio(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }
function time(value: unknown, now: number): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= now + FUTURE_SKEW; }

/** Exact projection prevents accidental persistence of article bodies or account data. */
export function sanitizeReaderPosition(value: unknown, now = Date.now()): ReaderPosition | null {
  try {
    if (!plainRecord(value) || !time(now, now)) return null;
    const href = canonicalReaderHref(own(value, 'href'));
    const anchor = own(value, 'anchor');
    const label = own(value, 'label');
    const sectionProgress = own(value, 'sectionProgress');
    const progress = own(value, 'progress');
    const updatedAt = own(value, 'updatedAt');
    const signature = own(value, 'signature');
    if (!href || !isSafeReaderAnchor(anchor) || typeof label !== 'string' || label.length > 160
      || /[\u0000-\u001f\u007f]/.test(label) || !ratio(sectionProgress) || !ratio(progress)
      || !time(updatedAt, now) || typeof signature !== 'string' || !/^v1-[a-f0-9]{8}$/.test(signature)) return null;
    return { href, anchor, label: label.trim(), sectionProgress, progress, updatedAt, signature };
  } catch { return null; }
}

/** Invalid data may be displayed safely, but no mutation should repair it implicitly. */
export function readReaderState(raw: string | null, now = Date.now()): ReaderReadResult {
  const empty = (): ReaderReadResult => ({ state: initialReaderState(), invalid: true, writable: false });
  if (raw === null) return { state: initialReaderState(), invalid: false, writable: true };
  if (typeof raw !== 'string' || raw.length > MAX_READER_RAW_LENGTH || !time(now, now)) return empty();
  try {
    const value: unknown = JSON.parse(raw);
    if (!plainRecord(value) || own(value, 'version') !== 1 || !isReaderFont(own(value, 'fontSize'))) return empty();
    const input = own(value, 'positions');
    if (!Array.isArray(input) || input.length > MAX_READING_POSITIONS * 5) return empty();
    let invalid = input.length > MAX_READING_POSITIONS || Object.keys(value).some((key) => !['version', 'positions', 'fontSize'].includes(key));
    const candidates: Array<{ position: ReaderPosition; order: number }> = [];
    for (const [order, item] of input.entries()) {
      const position = sanitizeReaderPosition(item, now);
      if (!position) { invalid = true; continue; }
      if (Object.keys(item).some((key) => !positionKeys.has(key)) || item.href !== position.href) invalid = true;
      candidates.push({ position, order });
    }
    candidates.sort((a, b) => b.position.updatedAt - a.position.updatedAt || a.order - b.order);
    const seen = new Set<string>();
    const positions: ReaderPosition[] = [];
    for (const { position } of candidates) {
      if (seen.has(position.href)) { invalid = true; continue; }
      seen.add(position.href);
      if (positions.length < MAX_READING_POSITIONS) positions.push(position);
    }
    return { state: { version: 1, positions, fontSize: own(value, 'fontSize') as ReaderFont }, invalid, writable: !invalid };
  } catch { return empty(); }
}

/** Keep the latest timestamp for each public article; stale writes cannot roll it back. */
export function saveReaderPosition(state: ReaderState, value: unknown, now = Date.now()): ReaderTransition {
  const position = sanitizeReaderPosition(value, now);
  if (!position) return { ok: false, state, changed: false, error: '阅读位置无效，仅能保存公开教程或案例中的安全章节位置。' };
  const previous = state.positions.find((item) => item.href === position.href);
  if (previous && previous.updatedAt > position.updatedAt) return { ok: true, state, changed: false };
  const positions = [position, ...state.positions.filter((item) => item.href !== position.href)]
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_READING_POSITIONS);
  return { ok: true, state: { ...state, positions }, changed: true };
}
