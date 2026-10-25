import {
  LEARNING_STATUS_LABELS, REVIEW_STATUS_LABELS, VISIBILITY_LABELS,
  type StudyItem, type StudyKind,
} from '../data/study-schema';
import type { EvidenceRead } from './study-evidence';

export const MAX_STUDY_BACKUP_BYTES = 2 * 1024 * 1024;
export const STUDY_BACKUP_ARCHIVE_FIELD = 'studyBackupArchive';
const MAX_FIELD_LENGTH = 32_000;
const MAX_FIELDS = 48;
const MAX_INITIAL_REQUEST_BYTES = 120 * 1024;
const encoder = new TextEncoder();
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const baseKeys = ['kind', 'title', 'fields', 'sourceIds', 'noteIds', 'learningStatus', 'reviewStatus', 'visibility'];
const identityKeys = ['id', 'revision', 'createdAt', 'updatedAt'];
type Plain = Record<string, unknown>;
type ReferenceKind = 'source' | 'note';
type BackupItem = Omit<StudyItem, 'id' | 'revision' | 'createdAt' | 'updatedAt'>
  & Partial<Pick<StudyItem, 'id' | 'revision' | 'createdAt' | 'updatedAt'>>;

export interface StudyBackupDeclaration {
  kind: StudyKind;
  title: string;
  id: string | null;
  revision: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  learningStatus: StudyItem['learningStatus'];
  reviewStatus: StudyItem['reviewStatus'];
  visibility: StudyItem['visibility'];
  sourceIds: string[];
  noteIds: string[];
  bodySha256: string | null;
  publicBodySha256: string | null;
}
export interface StudyBackupImport {
  sha256: string;
  sizeBytes: number;
  fileName: string;
  importedAt: string;
  declaredItem: StudyBackupDeclaration;
}
export interface StudyBackupReference {
  kind: ReferenceKind;
  id: string;
  contentSha256: string;
  item: StudyItem;
}
export interface StudyBackupUnresolved { kind: ReferenceKind; id: string }
export interface StudyBackupArchive {
  schemaVersion: 1;
  kind: 'unbound-study-backup';
  imports: StudyBackupImport[];
  references: StudyBackupReference[];
  unresolved: StudyBackupUnresolved[];
}
export interface RestoredStudyDraft {
  kind: StudyKind;
  title: string;
  fields: Record<string, string>;
  sourceIds: [];
  noteIds: [];
  learningStatus: 'not-started';
  reviewStatus: 'draft';
  visibility: 'private';
}
export interface StudyBackupDraft {
  item: RestoredStudyDraft;
  archive: StudyBackupArchive;
  sha256: string;
  sizeBytes: number;
  fileName: string;
  importedAt: string;
  declaredItem: StudyBackupDeclaration;
  summary: string;
}

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const record = (value: unknown): value is Plain => !!value && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value: unknown, keys: string[]): value is Plain => record(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value: unknown, max: number, min = 0): value is string => typeof value === 'string' && value.length >= min && value.length <= max;
const time = (value: unknown): value is string => text(value, 24, 24) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const hashText = (value: unknown): value is string => text(value, 64, 64) && /^[a-f0-9]{64}$/.test(value);
const fileNameOK = (value: unknown): value is string => text(value, 200, 1) && !!value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
const kindOK = (value: unknown): value is StudyKind => value === 'record' || value === 'source' || value === 'note';
const idOK = (value: unknown, kind: StudyKind): value is string => typeof value === 'string'
  && value.length === kind.length + 37 && new RegExp(`^${kind}-[a-f0-9-]{36}$`).test(value);
const idsOK = (value: unknown, kind: ReferenceKind): value is string[] => Array.isArray(value)
  && value.length <= 40 && value.every(id => idOK(id, kind));
const statusOK = (value: unknown, labels: object): boolean => typeof value === 'string' && Object.hasOwn(labels, value);

function safeTree(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= MAX_STUDY_BACKUP_BYTES;
  if (Array.isArray(value)) return value.length <= 1000 && value.every(item => safeTree(item, depth + 1));
  if (!record(value) || Reflect.ownKeys(value).length > 100) return false;
  return Reflect.ownKeys(value).every(key => {
    if (typeof key !== 'string' || forbidden.has(key) || key.length > 200) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !!descriptor && Object.hasOwn(descriptor, 'value') && safeTree(descriptor.value, depth + 1);
  });
}

/** Canonical property order only; every string, including all line endings, stays intact. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
async function digest(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
const digestText = (value: string) => digest(encoder.encode(value));

function readItem(value: unknown, requireSaved = false): EvidenceRead<BackupItem> {
  if (!record(value) || !kindOK(value.kind) || !text(value.title, 200)
    || !record(value.fields) || Object.keys(value.fields).length > MAX_FIELDS
    || !idsOK(value.sourceIds, 'source') || !idsOK(value.noteIds, 'note')
    || !statusOK(value.learningStatus, LEARNING_STATUS_LABELS) || !statusOK(value.reviewStatus, REVIEW_STATUS_LABELS)
    || !statusOK(value.visibility, VISIBILITY_LABELS)) return fail('备份条目的类型、标题、字段、引用或状态不符合学习工作台格式。');
  const saved = identityKeys.some(key => Object.hasOwn(value, key));
  if (!exact(value, saved ? [...baseKeys, ...identityKeys] : baseKeys) || requireSaved && !saved) return fail('备份条目含未知字段，或保存身份与修订信息不完整。');
  if (saved && (!idOK(value.id, value.kind) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1
    || (value.revision as number) > 1000 || !time(value.createdAt) || !time(value.updatedAt)
    || Date.parse(value.updatedAt) < Date.parse(value.createdAt))) return fail('备份声明的条目标识、修订或时间无效。');
  for (const [key, content] of Object.entries(value.fields)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || forbidden.has(key) || !text(content, MAX_FIELD_LENGTH)) return fail('备份字段名称无效，或字段超过 32000 字符；内容未被裁剪。');
  }
  return { ok: true, value: value as unknown as BackupItem };
}

function declarationOK(value: unknown): value is StudyBackupDeclaration {
  if (!exact(value, ['kind', 'title', ...identityKeys, 'learningStatus', 'reviewStatus', 'visibility', 'sourceIds', 'noteIds', 'bodySha256', 'publicBodySha256'])
    || !kindOK(value.kind) || !text(value.title, 200) || !idsOK(value.sourceIds, 'source') || !idsOK(value.noteIds, 'note')
    || !statusOK(value.learningStatus, LEARNING_STATUS_LABELS) || !statusOK(value.reviewStatus, REVIEW_STATUS_LABELS)
    || !statusOK(value.visibility, VISIBILITY_LABELS)
    || !(value.bodySha256 === null || hashText(value.bodySha256)) || !(value.publicBodySha256 === null || hashText(value.publicBodySha256))) return false;
  if (value.id === null) return value.revision === null && value.createdAt === null && value.updatedAt === null;
  return idOK(value.id, value.kind) && Number.isSafeInteger(value.revision) && (value.revision as number) >= 1 && (value.revision as number) <= 1000
    && time(value.createdAt) && time(value.updatedAt) && Date.parse(value.updatedAt) >= Date.parse(value.createdAt);
}

function missingReferences(imports: StudyBackupImport[], references: StudyBackupReference[], previous: StudyBackupUnresolved[] = []): StudyBackupUnresolved[] {
  const supplied = new Set(references.map(item => `${item.kind}:${item.id}`));
  const required = new Map<string, StudyBackupUnresolved>();
  const add = (kind: ReferenceKind, id: string) => required.set(`${kind}:${id}`, { kind, id });
  for (const item of previous) add(item.kind, item.id);
  for (const item of [...imports.map(item => item.declaredItem), ...references.map(item => item.item)]) {
    for (const id of item.sourceIds) add('source', id);
    for (const id of item.noteIds) add('note', id);
  }
  return [...required].filter(([key]) => !supplied.has(key)).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}

/** Strict reader for already-saved, still-unverified reference archives. No item is bound to an account. */
export async function readStudyBackupArchive(value: unknown): Promise<EvidenceRead<StudyBackupArchive>> {
  if (!text(value, MAX_FIELD_LENGTH, 1)) return fail('studyBackupArchive 归档为空或超过 32000 字符；没有覆盖旧归档。');
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { return fail('studyBackupArchive 不是受支持的归档 JSON；同名字段未被覆盖。'); }
  if (!safeTree(raw) || !exact(raw, ['schemaVersion', 'kind', 'imports', 'references', 'unresolved'])
    || raw.schemaVersion !== 1 || raw.kind !== 'unbound-study-backup'
    || !Array.isArray(raw.imports) || !raw.imports.length || !Array.isArray(raw.references) || !Array.isArray(raw.unresolved)) return fail('studyBackupArchive 版本、结构或对象键不受支持；没有覆盖旧来源或引用。');
  for (const entry of raw.imports) {
    if (!exact(entry, ['sha256', 'sizeBytes', 'fileName', 'importedAt', 'declaredItem']) || !hashText(entry.sha256)
      || !Number.isSafeInteger(entry.sizeBytes) || (entry.sizeBytes as number) < 1 || (entry.sizeBytes as number) > MAX_STUDY_BACKUP_BYTES
      || !fileNameOK(entry.fileName) || !time(entry.importedAt) || !declarationOK(entry.declaredItem)) return fail('studyBackupArchive 的来源声明无效；没有丢弃或重写旧记录。');
  }
  const references: StudyBackupReference[] = [];
  try {
    for (const entry of raw.references) {
      if (!exact(entry, ['kind', 'id', 'contentSha256', 'item']) || (entry.kind !== 'source' && entry.kind !== 'note')
        || !idOK(entry.id, entry.kind) || !hashText(entry.contentSha256)) return fail('studyBackupArchive 的引用快照字段无效。');
      const item = readItem(entry.item, true);
      if (!item.ok || item.value.kind !== entry.kind || item.value.id !== entry.id) return fail('studyBackupArchive 的引用身份、类型或内容无效。');
      if (await digestText(canonical(item.value)) !== entry.contentSha256) return fail('studyBackupArchive 引用内容与指纹不一致；没有自动修复或丢弃这份快照。');
      references.push(entry as unknown as StudyBackupReference);
    }
  } catch { return fail('当前环境无法计算引用指纹，尚未恢复归档。'); }
  const unresolved: StudyBackupUnresolved[] = [];
  for (const entry of raw.unresolved) {
    if (!exact(entry, ['kind', 'id']) || (entry.kind !== 'source' && entry.kind !== 'note') || !idOK(entry.id, entry.kind)) return fail('studyBackupArchive 的缺失引用标识无效。');
    unresolved.push(entry as unknown as StudyBackupUnresolved);
  }
  const imports = raw.imports as unknown as StudyBackupImport[];
  const expected = missingReferences(imports, references);
  if (canonical([...unresolved].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))) !== canonical(expected)) return fail('studyBackupArchive 的缺失引用清单与原声明不一致；未忽略这些差异。');
  return { ok: true, value: { schemaVersion: 1, kind: 'unbound-study-backup', imports, references, unresolved } };
}

/** Reads a whole exported backup locally and prepares a new, unsaved private draft. */
export async function createStudyBackupDraft(bytes: Uint8Array, fileName: string, importedAt: string): Promise<EvidenceRead<StudyBackupDraft>> {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > MAX_STUDY_BACKUP_BYTES) return fail('学习备份必须非空且不超过 2 MiB；没有裁剪文件。');
  if (!fileNameOK(fileName) || !time(importedAt)) return fail('备份文件名或本次导入时间无效。');
  const selected = Uint8Array.from(bytes);
  let raw: unknown;
  try {
    const original = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(selected);
    raw = JSON.parse(original.replace(/^\uFEFF/, ''));
  } catch { return fail('请选择完整、有效的 UTF-8 学习工作台 JSON 备份；未替换无效编码。'); }
  if (!safeTree(raw) || !exact(raw, ['format', 'item', 'references']) || raw.format !== 'simulearn-study-v1'
    || !Array.isArray(raw.references) || raw.references.length > 80) return fail('只支持 simulearn-study-v1 学习工作台备份，且格式、对象键和引用数量须有效。');
  const main = readItem(raw.item);
  if (!main.ok) return main;
  const attached: StudyItem[] = [];
  for (const reference of raw.references) {
    const item = readItem(reference, true);
    if (!item.ok || (item.value.kind !== 'source' && item.value.kind !== 'note')) return fail('备份 references 必须包含完整、有效的资料或知识笔记快照；未丢弃不支持的条目。');
    attached.push(item.value as StudyItem);
  }
  let previous: StudyBackupArchive | null = null;
  if (Object.hasOwn(main.value.fields, STUDY_BACKUP_ARCHIVE_FIELD)) {
    const read = await readStudyBackupArchive(main.value.fields[STUDY_BACKUP_ARCHIVE_FIELD]);
    if (!read.ok) return read;
    previous = read.value;
  }
  try {
    const sha256 = await digest(selected);
    const declaredItem: StudyBackupDeclaration = {
      kind: main.value.kind, title: main.value.title,
      id: main.value.id ?? null, revision: main.value.revision ?? null,
      createdAt: main.value.createdAt ?? null, updatedAt: main.value.updatedAt ?? null,
      learningStatus: main.value.learningStatus, reviewStatus: main.value.reviewStatus, visibility: main.value.visibility,
      sourceIds: [...main.value.sourceIds], noteIds: [...main.value.noteIds],
      bodySha256: Object.hasOwn(main.value.fields, 'body') ? await digestText(main.value.fields.body) : null,
      publicBodySha256: Object.hasOwn(main.value.fields, 'publicBody') ? await digestText(main.value.fields.publicBody) : null,
    };
    const imports: StudyBackupImport[] = [];
    const importKeys = new Set<string>();
    for (const entry of previous?.imports ?? []) {
      const key = canonical(entry);
      if (!importKeys.has(key)) { importKeys.add(key); imports.push(entry); }
    }
    const currentImport: StudyBackupImport = { sha256, sizeBytes: selected.byteLength, fileName, importedAt, declaredItem };
    // Old entries stay in order. A byte-identical provenance record is not a new event.
    if (!imports.some(value => canonical(value) === canonical(currentImport))) imports.push(currentImport);
    const references: StudyBackupReference[] = [];
    const keys = new Set<string>();
    for (const entry of previous?.references ?? []) {
      const key = `${entry.kind}:${entry.id}:${entry.contentSha256}`;
      if (!keys.has(key)) { keys.add(key); references.push(entry); }
    }
    for (const item of attached) {
      const contentSha256 = await digestText(canonical(item));
      const key = `${item.kind}:${item.id}:${contentSha256}`;
      if (!keys.has(key)) { keys.add(key); references.push({ kind: item.kind as ReferenceKind, id: item.id, contentSha256, item }); }
    }
    const archive: StudyBackupArchive = {
      schemaVersion: 1, kind: 'unbound-study-backup', imports, references,
      unresolved: missingReferences(imports, references, previous?.unresolved),
    };
    const archiveText = JSON.stringify(archive);
    const fields = { ...main.value.fields, [STUDY_BACKUP_ARCHIVE_FIELD]: archiveText };
    const item: RestoredStudyDraft = {
      kind: main.value.kind, title: main.value.title, fields,
      sourceIds: [], noteIds: [], learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private',
    };
    if (archiveText.length > MAX_FIELD_LENGTH || Object.keys(fields).length > MAX_FIELDS
      || encoder.encode(JSON.stringify({ item })).byteLength > MAX_INITIAL_REQUEST_BYTES) return fail('无法在保存容量内无损容纳正文、旧来源和引用归档（归档 32000 字符、48 字段、请求 120 KiB）；没有裁剪或应用，请保留原备份。');
    return { ok: true, value: { item, archive, sha256, sizeBytes: selected.byteLength, fileName, importedAt, declaredItem,
      summary: `已准备新建私人草稿；${references.length} 份引用仅作为未绑定快照保留，未进入资料库，${archive.unresolved.length} 个引用标识未附快照。旧身份与状态仅为文件声明，学习日期沿用原自述；未执行文件内容，未确认作者、本人实践、审核或公开。` } };
  } catch { return fail('当前环境无法计算文件或引用指纹，尚未恢复备份；当前内容应保持不变。'); }
}
