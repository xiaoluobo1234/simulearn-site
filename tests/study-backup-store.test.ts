import { describe, expect, it } from 'vitest';
import type { BooksBucket, R2ObjectBody } from '../functions/_shared/books';
import { StudyStore } from '../functions/_shared/study-store';
import type { StudyItem, StudyKind } from '../src/data/study-schema';
import { createStudyBackupDraft, type StudyBackupDraft } from '../src/lib/study-backup';

/** Real serialization and conditional writes; no mocked StudyStore methods. */
class BackupMemoryR2 {
  values = new Map<string, { value: string; etag: string }>();
  serial = 0;
  async get(key: string): Promise<(R2ObjectBody & { etag: string }) | null> {
    const row = this.values.get(key);
    if (!row) return null;
    return { etag: row.etag, body: new Response(row.value).body!, text: async () => row.value,
      json: async <T>() => JSON.parse(row.value) as T,
      arrayBuffer: async () => new TextEncoder().encode(row.value).buffer };
  }
  async put(key: string, value: string, options?: { onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string } }) {
    const prior = this.values.get(key);
    if (options?.onlyIf?.etagMatches && prior?.etag !== options.onlyIf.etagMatches) return null;
    if (options?.onlyIf?.etagDoesNotMatch === '*' && prior) return null;
    const etag = `backup-etag-${++this.serial}`;
    this.values.set(key, { value, etag }); return { etag };
  }
  async delete(keys: string | string[]) {
    for (const key of typeof keys === 'string' ? [keys] : keys) this.values.delete(key);
  }
}

const owner = 'sl-backup-roundtrip';
const importedAt = '2026-10-25T04:00:00.000Z';
const secondImportedAt = '2026-10-26T04:00:00.000Z';
const sourceId = 'source-11111111-1111-4111-8111-111111111111';
const missingSourceId = 'source-22222222-2222-4222-8222-222222222222';
const noteId = 'note-33333333-3333-4333-8333-333333333333';
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const envelope = (item: unknown, references: unknown[] = []) => ({ format: 'simulearn-study-v1', item, references });
function snapshot(kind: StudyKind, fields: Record<string, string> = {}, overrides: Partial<StudyItem> = {}): StudyItem {
  return { kind, id: `${kind}-44444444-4444-4444-8444-444444444444`, title: `  ${kind} 备份原题  `,
    fields, sourceIds: [], noteIds: [], learningStatus: 'independent', reviewStatus: 'reviewed', visibility: 'public',
    revision: 7, createdAt: '2026-10-23T01:00:00.000Z', updatedAt: '2026-10-24T01:00:00.000Z', ...overrides };
}
async function restore(value: unknown, fileName = 'original-study.json', date = importedAt): Promise<StudyBackupDraft> {
  const parsed = await createStudyBackupDraft(encode(value), fileName, date);
  expect(parsed.ok, parsed.ok ? undefined : parsed.error).toBe(true);
  if (!parsed.ok) throw Error(parsed.error);
  return parsed.value;
}
function withoutArchive(fields: Record<string, string>) {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'studyBackupArchive'));
}

describe('study backup restore survives the real private store and a second backup', () => {
  it('retains exact CSV/raw fields, unbound reference versions, missing references and original declarations across two saved drafts', async () => {
    const rawPython = '\uFEFF' + JSON.stringify({ schemaVersion: 1, executor: '用户当前浏览器 WebWorker', state: 'succeeded',
      code: 'print("PRIVATE 原始输出")\r\n', input: 'parameter,value,unit\r\nA,abc,mm2\r\n',
      stdout: 'PRIVATE 原文\r孤立回车\r\n没有核验', stderr: '', value: '',
      environment: 'CPython 3.14.2 · Pyodide 314.0.7 · WebAssembly / WebWorker',
      startedAt: '2026-10-24T00:00:00.000Z', finishedAt: '2026-10-24T00:00:01.000Z', elapsedMs: 1000,
      limitation: '文件声明，不证明本人执行或 CSV 合格。' }, null, 2).replace(/\n/g, '\r\n') + '\r\n';
    const csvMetadata = JSON.stringify({ trust: 'unverified-imported-file', declaredState: 'succeeded',
      fileName: '原始结果.json', sha256: 'a'.repeat(64), scope: '旧声明尚未核对。' }, null, 2);
    const fields = { raw: '  私人原始记录\r\n保留换行\r单独回车  ', body: '# 原整理稿\r\n仍待核对\n', publicBody: '原公开稿也须保留\r\n',
      executor: '', reproduction: '', recordType: '', date: '', organizedDate: '', nextTask: '',
      code: 'print("original")\r\n', input: 'parameter,value,unit\r\nA,abc,mm2\r\n', actualOutput: '文件曾声明 succeeded\r\n',
      csvResultOriginal: rawPython, csvResultMetadata: csvMetadata, customCheckpoint: '  未知合法字段\r原样保留\r\n  ', arbitraryEmpty: '' };
    const sourceV1 = snapshot('source', { url: 'https://example.com/original', readRange: '', publicBody: '来源旧公开稿\r\n' }, { id: sourceId, revision: 1 });
    const sourceV2 = { ...sourceV1, revision: 2, updatedAt: '2026-10-24T02:00:00.000Z', fields: { ...sourceV1.fields, readRange: '实际只读第 1 节\r\n' } };
    const note = snapshot('note', { body: '笔记中的推测，未核验\r\n', publicBody: '', customNote: '只属于快照' }, { id: noteId, sourceIds: [missingSourceId] });
    const original = snapshot('record', fields, { sourceIds: [sourceId, missingSourceId], noteIds: [noteId] });
    const first = await restore(envelope(original, [sourceV1, sourceV2, note]));
    expect(withoutArchive(first.item.fields)).toEqual(fields);
    expect(first.archive.imports[0].declaredItem).toMatchObject({ title: original.title, id: original.id,
      revision: original.revision, createdAt: original.createdAt, updatedAt: original.updatedAt,
      learningStatus: 'independent', reviewStatus: 'reviewed', visibility: 'public', sourceIds: original.sourceIds, noteIds: original.noteIds });
    expect(first.archive.references).toHaveLength(3);
    expect(first.archive.references.map(reference => reference.item)).toEqual(expect.arrayContaining([sourceV1, sourceV2, note]));
    expect(first.archive.unresolved).toContainEqual({ kind: 'source', id: missingSourceId });
    const bucket = new BackupMemoryR2(), store = new StudyStore(bucket as unknown as BooksBucket);
    const saved = await store.create(owner, first.item);
    const loaded = await store.get(owner, saved.id);
    expect(loaded.fields).toEqual(first.item.fields);
    expect(loaded.title).toBe(original.title.trim()); // The original title survives in declaredItem.
    expect(loaded).toMatchObject({ sourceIds: [], noteIds: [], learningStatus: 'not-started', reviewStatus: 'draft', visibility: 'private', revision: 1 });
    expect(loaded.id).not.toBe(original.id);
    await expect(store.get(owner, sourceId)).rejects.toMatchObject({ status: 404 });
    await expect(store.get(owner, noteId)).rejects.toMatchObject({ status: 404 });
    expect((await store.history(owner, loaded.id))[0].fields).toEqual(first.item.fields);

    // This is the ordinary workbench's second export: references are empty
    // because restored snapshots have never been bound to the account.
    const second = await restore(envelope(loaded), 'second-export.json', secondImportedAt);
    expect(withoutArchive(second.item.fields)).toEqual(fields);
    expect(second.item.fields.csvResultOriginal).toBe(rawPython);
    expect(second.item.fields.csvResultMetadata).toBe(csvMetadata);
    expect(second.archive.imports).toHaveLength(first.archive.imports.length + 1);
    expect(second.archive.imports).toEqual(expect.arrayContaining(first.archive.imports));
    expect(second.archive.references).toEqual(first.archive.references);
    expect(second.archive.unresolved).toEqual(first.archive.unresolved);
    expect(JSON.stringify(second.archive)).not.toContain('studyBackupArchive');
    const secondSaved = await store.create(owner, second.item);
    expect(secondSaved.id).not.toBe(saved.id);
    expect((await store.get(owner, secondSaved.id)).fields).toEqual(second.item.fields);
    expect((await store.get(owner, saved.id)).fields).toEqual(first.item.fields);
    expect(bucket.values.size).toBe(4); // Two heads + two private history snapshots, no restored references.
  });

  for (const kind of ['source', 'note'] as const) it(`round-trips a ${kind} including publicBody, explicit empty fields and unknown fields`, async () => {
    const fields = { body: '  正文\r\n第二行\r第三行  ', publicBody: '# 原公开正文\r\n', url: '',
      author: '', readRange: '', executor: '', reproduction: '', customField: '<img src=x>\r\n  ', unknownEmpty: '' };
    const original = snapshot(kind, fields);
    const first = await restore(envelope(original));
    const store = new StudyStore(new BackupMemoryR2() as unknown as BooksBucket);
    const firstSaved = await store.create(owner, first.item);
    const firstLoaded = await store.get(owner, firstSaved.id);
    expect(firstLoaded.kind).toBe(kind);expect(firstLoaded.fields).toEqual(first.item.fields);
    expect(withoutArchive(firstLoaded.fields)).toEqual(fields);
    const second = await restore(envelope(firstLoaded), `${kind}-second.json`, secondImportedAt);
    expect(withoutArchive(second.item.fields)).toEqual(fields);
    expect(second.archive.imports).toEqual(expect.arrayContaining(first.archive.imports));
    expect(second.archive.imports[0].declaredItem).toMatchObject({ title: original.title, learningStatus: 'independent', reviewStatus: 'reviewed', visibility: 'public' });
    const secondSaved = await store.create(owner, second.item);
    expect((await store.get(owner, secondSaved.id)).fields).toEqual(second.item.fields);
    expect((await store.get(owner, firstSaved.id)).fields).toEqual(first.item.fields);
  });

  it('rejects archive collisions and save-capacity overflows before any data is written or trimmed', async () => {
    const bucket = new BackupMemoryR2(), store = new StudyStore(bucket as unknown as BooksBucket);
    const fullFields = Object.fromEntries(Array.from({ length: 48 }, (_, index) => [`field${index}`, `原字段 ${index}`]));
    const hugeReference = snapshot('source', { body: '源'.repeat(32_000) }, { id: sourceId });
    const oversizedBody = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`field${index}`, '中'.repeat(5000)]));
    const cases = [
      envelope(snapshot('record', fullFields)),
      envelope(snapshot('record', { raw: 'x'.repeat(32_001) })),
      envelope(snapshot('record', oversizedBody)),
      envelope(snapshot('record', { raw: '保留主记录' }, { sourceIds: [sourceId] }), [hugeReference]),
      envelope(snapshot('record', { raw: '保留原文', studyBackupArchive: '用户以前使用的同名字段，不能覆盖' })),
    ];
    for (const [index, backup] of cases.entries()) {
      const before = JSON.stringify(backup);
      const parsed = await createStudyBackupDraft(encode(backup), `capacity-${index}.json`, importedAt);
      expect(parsed.ok, `capacity/collision case ${index} must refuse instead of dropping fields`).toBe(false);
      if (parsed.ok) await store.create(owner, parsed.value.item);
      expect(JSON.stringify(backup)).toBe(before);
      expect(bucket.values.size).toBe(0);expect(bucket.serial).toBe(0);
    }
  });
});
