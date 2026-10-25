import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createStudyBackupDraft, MAX_STUDY_BACKUP_BYTES, readStudyBackupArchive, STUDY_BACKUP_ARCHIVE_FIELD } from '../src/lib/study-backup';
import type { StudyItem, StudyKind } from '../src/data/study-schema';

const importedAt = '2026-10-25T09:00:00.000Z';
const later = '2026-10-25T09:01:00.000Z';
const createdAt = '2026-10-23T01:00:00.000Z';
const updatedAt = '2026-10-24T01:00:00.000Z';
const id = (kind: StudyKind, digit: string) => `${kind}-${digit.repeat(8)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const hash = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
const entry = (kind: StudyKind = 'record', fields: Record<string, string> = {}) => ({ kind, title: '', fields,
  sourceIds: [] as string[], noteIds: [] as string[], learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' });
const saved = (kind: StudyKind, digit: string, fields: Record<string, string> = {}): StudyItem => ({ ...entry(kind, fields),
  id: id(kind, digit), title: `${kind} 原文`, revision: 1, createdAt, updatedAt,
  learningStatus: 'independent', reviewStatus: 'reviewed', visibility: 'public' });
const backup = (item: unknown = entry(), references: unknown[] = []) => ({ format: 'simulearn-study-v1', item, references });

describe('learning workbench JSON backup to a new private draft', () => {
  it('accepts real unsaved exports with empty titles for all kinds and preserves every ordinary field verbatim', async () => {
    const fields = { date: '2026-10-20（本人自述）', organizedDate: '', executor: '', reproduction: '', recordType: '',
      unknownValidField: '  原文\r\n孤立\r换行\n', publicBody: '<b>旧公开稿</b>',
      csvResultOriginal: '\uFEFF{\r\n"stdout":"literal\\r\\n"\r\n}\r\n', csvResultMetadata: '{"trust":"unverified-imported-file"}' };
    for (const kind of ['record', 'source', 'note'] as const) {
      const read = await createStudyBackupDraft(encode(backup(entry(kind, fields))), `${kind}.json`, importedAt);
      expect(read.ok, JSON.stringify(read)).toBe(true); if (!read.ok) continue;
      expect(read.value.item).toMatchObject({ kind, title: '', sourceIds: [], noteIds: [], learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' });
      for (const [key, value] of Object.entries(fields)) expect(read.value.item.fields[key], key).toBe(value);
      for (const key of ['id', 'revision', 'createdAt', 'updatedAt']) expect(read.value.item).not.toHaveProperty(key);
      expect(read.value.declaredItem).toMatchObject({ id: null, revision: null, createdAt: null, updatedAt: null });
      expect(read.value.item.fields.date).not.toBe(importedAt.slice(0, 10));
      expect(read.value.declaredItem.publicBodySha256).toBe(hash(fields.publicBody));
      expect(read.value.declaredItem.bodySha256).toBeNull();
    }
  });

  it('preserves BOM/full file SHA and records saved identity/statuses only as unverified declarations', async () => {
    const original = saved('record', '1', { body: '# original\r\n<script>not run</script>', date: '' });
    const text = '\uFEFF' + JSON.stringify(backup(original), null, 2).replace(/\n/g, '\r\n') + '\r\n';
    const bytes = new TextEncoder().encode(text);
    const read = await createStudyBackupDraft(bytes, '私人的备份.json', importedAt);
    expect(read.ok).toBe(true); if (!read.ok) return;
    expect(read.value.sha256).toBe(hash(bytes)); expect(read.value.sizeBytes).toBe(bytes.byteLength);
    expect(read.value.declaredItem).toMatchObject({ id: original.id, revision: 1, createdAt, updatedAt,
      learningStatus: 'independent', reviewStatus: 'reviewed', visibility: 'public', bodySha256: hash(original.fields.body), publicBodySha256: null });
    expect(read.value.item).toMatchObject({ learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private' });
    expect(read.value.item.fields.body).toBe(original.fields.body);
    expect(read.value.archive.imports).toHaveLength(1);
    expect(read.value.archive.imports[0]).toMatchObject({ sha256: hash(bytes), fileName: '私人的备份.json', importedAt, sizeBytes: bytes.byteLength });
    expect(read.value.archive.imports[0].declaredItem).not.toHaveProperty('fields');
    expect(read.value.summary).toContain('未确认作者');
  });

  it('keeps multiple versions and missing direct/nested references without binding any old account ID', async () => {
    const source = saved('source', '2', { body: 'source revision one' });
    const changed = { ...source, revision: 2, fields: { body: 'source revision two' } };
    const note = { ...saved('note', '3'), sourceIds: [id('source', '4')] };
    const main = { ...saved('record', '1'), sourceIds: [source.id, id('source', '5')], noteIds: [note.id] };
    const read = await createStudyBackupDraft(encode(backup(main, [source, changed, source, note])), 'references.json', importedAt);
    expect(read.ok).toBe(true); if (!read.ok) return;
    expect(read.value.item.sourceIds).toEqual([]); expect(read.value.item.noteIds).toEqual([]);
    expect(read.value.archive.references).toHaveLength(3);
    expect(read.value.archive.references.filter(ref => ref.id === source.id).map(ref => ref.item.revision)).toEqual([1, 2]);
    expect(read.value.archive.unresolved).toEqual([{ kind: 'source', id: id('source', '4') }, { kind: 'source', id: id('source', '5') }]);
    expect(read.value.declaredItem.sourceIds).toEqual(main.sourceIds);
    expect(read.value.summary).toContain('未进入资料库');
    expect(await readStudyBackupArchive(read.value.item.fields[STUDY_BACKUP_ARCHIVE_FIELD])).toEqual({ ok: true, value: read.value.archive });
  });

  it('restores exported archives without nesting, retains provenance and deduplicates equal snapshots with canonical property order', async () => {
    const source = saved('source', '2', { url: 'https://example.test/', body: 'source content' });
    const main = { ...saved('record', '1', { body: 'old body' }), sourceIds: [source.id, id('source', '5')] };
    const first = await createStudyBackupDraft(encode(backup(main, [source])), 'first.json', importedAt);
    expect(first.ok).toBe(true); if (!first.ok) return;
    const firstArchive = structuredClone(first.value.archive);
    const reordered = { ...source, fields: { body: source.fields.body, url: source.fields.url } };
    const exported = { ...first.value.item, id: id('record', '6'), revision: 1, createdAt, updatedAt,
      fields: { ...first.value.item.fields, body: 'new private edit' } };
    const second = await createStudyBackupDraft(encode(backup(exported, [reordered])), 'second.json', later);
    expect(second.ok, JSON.stringify(second)).toBe(true); if (!second.ok) return;
    expect(second.value.archive.imports).toHaveLength(2);
    expect(second.value.archive.imports[0]).toEqual(firstArchive.imports[0]);
    expect(second.value.archive.imports[1].declaredItem.bodySha256).toBe(hash('new private edit'));
    expect(second.value.archive.references).toEqual(firstArchive.references);
    expect(second.value.archive.unresolved).toEqual(firstArchive.unresolved);
    expect(second.value.item.fields.body).toBe('new private edit');
    expect(Object.keys(second.value.item.fields).filter(key => key === STUDY_BACKUP_ARCHIVE_FIELD)).toHaveLength(1);
    for (const entry of second.value.archive.imports) { expect(entry).not.toHaveProperty('archive'); expect(entry.declaredItem).not.toHaveProperty('fields'); }
    expect(await readStudyBackupArchive(second.value.item.fields[STUDY_BACKUP_ARCHIVE_FIELD])).toEqual({ ok: true, value: second.value.archive });
    expect(first.value.archive).toEqual(firstArchive);
  });

  it('recomputes latest body hashes from actual input rather than trusting earlier archive claims', async () => {
    const first = await createStudyBackupDraft(encode(backup(entry('record', { body: '# uploaded body', publicBody: '' }))), 'first.json', importedAt);
    expect(first.ok).toBe(true); if (!first.ok) return;
    const archive = structuredClone(first.value.archive);
    archive.imports[0].declaredItem.bodySha256 = '0'.repeat(64);
    const second = await createStudyBackupDraft(encode(backup({ ...first.value.item, fields: { ...first.value.item.fields, studyBackupArchive: JSON.stringify(archive) } })), 'second.json', later);
    expect(second.ok).toBe(true); if (!second.ok) return;
    expect(second.value.archive.imports[0].declaredItem.bodySha256).toBe('0'.repeat(64));
    expect(second.value.declaredItem.bodySha256).toBe(hash('# uploaded body'));
    expect(second.value.declaredItem.publicBodySha256).toBe(hash(''));
    expect(second.value.archive.imports.at(-1)?.declaredItem.bodySha256).toBe(hash('# uploaded body'));
  });

  it('rejects damaged or conflicting reserved archives and modified referenced content without silently repairing it', async () => {
    for (const value of ['', 'custom unrelated field', '{}', JSON.stringify({ schemaVersion: 2, kind: 'unbound-study-backup' })]) {
      const read = await createStudyBackupDraft(encode(backup(entry('record', { studyBackupArchive: value }))), 'conflict.json', importedAt);
      expect(read.ok).toBe(false);
    }
    const source = saved('source', '2', { body: 'original source' });
    const first = await createStudyBackupDraft(encode(backup({ ...entry(), sourceIds: [source.id] }, [source])), 'first.json', importedAt);
    expect(first.ok).toBe(true); if (!first.ok) return;
    const modified = structuredClone(first.value.archive); modified.references[0].item.fields.body = 'tampered source';
    const read = await createStudyBackupDraft(encode(backup({ ...first.value.item, fields: { ...first.value.item.fields, studyBackupArchive: JSON.stringify(modified) } })), 'tampered.json', later);
    expect(read).toMatchObject({ ok: false }); if (!read.ok) expect(read.error).toContain('指纹不一致');
    const wrongMissing = structuredClone(first.value.archive); wrongMissing.unresolved.push({ kind: 'source', id: id('source', '9') });
    expect((await readStudyBackupArchive(JSON.stringify(wrongMissing))).ok).toBe(false);
    expect((await readStudyBackupArchive({ ...first.value.archive })).ok).toBe(false);
  });

  it('rejects malformed formats, identities, statuses, UTF-8, unsafe keys and excessive nesting', async () => {
    const valid = saved('record', '1');
    for (const value of [{ ...backup(), format: 'simulearn-study-v2' }, { ...backup(), extra: true }, { item: valid, references: [] },
      backup({ ...valid, kind: 'unknown' }), backup({ ...valid, id: id('source', '1') }), backup({ ...valid, revision: 0 }),
      backup({ ...entry(), id: valid.id }), backup({ ...valid, updatedAt: '2026-10-22T01:00:00.000Z' }),
      backup({ ...valid, learningStatus: 'mastered' }), backup({ ...valid, fields: { x: 42 } }),
      backup(entry(), [saved('record', '3')]), backup(entry(), [entry('source')]), backup({ ...entry(), sourceIds: [id('note', '2')] })]) {
      expect((await createStudyBackupDraft(encode(value), 'bad.json', importedAt)).ok, JSON.stringify(value)).toBe(false);
    }
    const bytes = encode(backup()); const invalid = new Uint8Array(bytes.length + 2); invalid.set(bytes); invalid.set([0xc0, 0xaf], bytes.length);
    expect((await createStudyBackupDraft(invalid, 'invalid.json', importedAt)).ok).toBe(false);
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const unsafe = JSON.stringify(backup()).replace('"fields":{}', `"fields":{"${key}":"polluted"}`);
      expect((await createStudyBackupDraft(new TextEncoder().encode(unsafe), 'unsafe.json', importedAt)).ok).toBe(false);
    }
    expect((await createStudyBackupDraft(new TextEncoder().encode('['.repeat(40) + '0' + ']'.repeat(40)), 'deep.json', importedAt)).ok).toBe(false);
    for (const name of ['', 'x'.repeat(201), 'bad\n.json']) expect((await createStudyBackupDraft(bytes, name, importedAt)).ok).toBe(false);
    expect((await createStudyBackupDraft(bytes, 'valid.json', '2026-02-30T01:00:00.000Z')).ok).toBe(false);
  });

  it('rejects over-limit files, fields, references, archive expansion and multibyte requests without truncation', async () => {
    expect(MAX_STUDY_BACKUP_BYTES).toBe(2 * 1024 * 1024);
    expect((await createStudyBackupDraft(new Uint8Array(), 'empty.json', importedAt)).ok).toBe(false);
    expect((await createStudyBackupDraft(new Uint8Array(MAX_STUDY_BACKUP_BYTES + 1), 'large.json', importedAt)).ok).toBe(false);
    const tooManyFields = Object.fromEntries(Array.from({ length: 48 }, (_, index) => [`f${index}`, '']));
    expect((await createStudyBackupDraft(encode(backup(entry('record', tooManyFields))), 'fields.json', importedAt)).ok).toBe(false);
    expect((await createStudyBackupDraft(encode(backup(entry('record', { body: 'x'.repeat(32001) }))), 'field.json', importedAt)).ok).toBe(false);
    expect((await createStudyBackupDraft(encode(backup(entry(), Array.from({ length: 81 }, () => saved('source', '2')))), 'refs.json', importedAt)).ok).toBe(false);
    const largeSource = saved('source', '2', { body: 'x'.repeat(31900) });
    const tooLargeArchive = await createStudyBackupDraft(encode(backup(entry(), [largeSource])), 'archive.json', importedAt);
    expect(tooLargeArchive).toMatchObject({ ok: false }); if (!tooLargeArchive.ok) expect(tooLargeArchive.error).toContain('无损');
    const largeUnicode = entry('record', { body: '中'.repeat(31_000), raw: '文'.repeat(31_000) });
    const oversizedRequest = await createStudyBackupDraft(encode(backup(largeUnicode)), 'unicode.json', importedAt);
    expect(oversizedRequest).toMatchObject({ ok: false }); if (!oversizedRequest.ok) expect(oversizedRequest.error).toContain('120 KiB');
    const fullField = await createStudyBackupDraft(encode(backup(entry('record', { body: 'x'.repeat(32000) }))), 'full-field.json', importedAt);
    expect(fullField.ok).toBe(true); if (fullField.ok) expect(fullField.value.item.fields.body).toHaveLength(32000);
  });

  it('snapshots bytes before asynchronous hashing and never calls fetch or executes embedded text', async () => {
    const fields = { body: '__import__("js").fetch("/api/private")\n<script>evil()</script>' };
    const original = backup(entry('note', fields));
    const bytes = encode(original); const expected = hash(bytes);
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      const pending = createStudyBackupDraft(bytes, '<img onerror=evil()>.json', importedAt); bytes.fill(0);
      const read = await pending;
      expect(read.ok).toBe(true); if (!read.ok) return;
      expect(read.value.sha256).toBe(expected); expect(read.value.item.fields.body).toBe(fields.body);
      expect(fetch).not.toHaveBeenCalled();
      expect(new TextEncoder().encode(JSON.stringify({ item: read.value.item })).byteLength).toBeLessThanOrEqual(120 * 1024);
      expect(JSON.parse(JSON.stringify({ format: 'simulearn-study-v1', item: read.value.item, references: [] })).item.fields.body).toBe(fields.body);
    } finally { fetch.mockRestore(); }
  });
});
