import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const project = resolve('public/downloads/csv-checker');
const lab = resolve('public/downloads/python-lab');

// Independent decoder for the seekable, bounded public ZIPs made by Python zipfile.
function members(bytes: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>(); let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const flags = bytes.readUInt16LE(offset + 6), method = bytes.readUInt16LE(offset + 8);
    const compressed = bytes.readUInt32LE(offset + 18), original = bytes.readUInt32LE(offset + 22);
    const nameSize = bytes.readUInt16LE(offset + 26), extraSize = bytes.readUInt16LE(offset + 28);
    expect(flags & 8).toBe(0); expect([0, 8]).toContain(method);
    const name = bytes.subarray(offset + 30, offset + 30 + nameSize).toString('utf8');
    const start = offset + 30 + nameSize + extraSize;
    expect(start + compressed).toBeLessThanOrEqual(bytes.length); expect(files.has(name)).toBe(false);
    const body = bytes.subarray(start, start + compressed);
    const content = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    expect(content.length).toBe(original); files.set(name, content); offset = start + compressed;
  }
  expect(files.size).toBeGreaterThan(0); return files;
}

describe('published CSV learning artifacts match their executable source', () => {
  it('keeps the legacy overview sample and all public hashes consistent with the new format', () => {
    expect(readFileSync(resolve('public/downloads/csv-checker-sample.csv'))).toEqual(readFileSync(resolve(project, 'normal.csv')));
    const manifest = readFileSync(resolve(project, 'SHA256SUMS.txt'), 'ascii').trim().split(/\r?\n/);
    expect(manifest.map(line => line.slice(66)).sort()).toEqual(readdirSync(project).filter(name => name !== 'SHA256SUMS.txt').sort());
    for (const line of manifest) expect(hash(readFileSync(resolve(project, line.slice(66))))).toBe(line.slice(0, 64));
  });
  it('contains the exact current checker and four inputs, with an independently verifiable package manifest', () => {
    const archive = members(readFileSync(resolve(project, 'csv-checker.zip')));
    expect([...archive.keys()].sort()).toEqual(['PACKAGE-SHA256SUMS.txt', 'README.md', 'csv_check.py', 'missing-field.csv', 'missing-unit.csv', 'non-numeric.csv', 'normal.csv', 'runtime-check.json']);
    for (const name of ['normal.csv', 'missing-field.csv', 'non-numeric.csv', 'missing-unit.csv', 'README.md']) expect(archive.get(name)).toEqual(readFileSync(resolve(project, name)));
    for (const name of ['csv_check.py', 'runtime-check.json']) expect(archive.get(name)).toEqual(readFileSync(resolve(lab, name)));
    for (const line of archive.get('PACKAGE-SHA256SUMS.txt')!.toString('ascii').trim().split('\n')) expect(hash(archive.get(line.slice(66))!)).toBe(line.slice(0, 64));
  });
  it('binds actual reference observations to the current code and inputs without treating expected errors as user practice', () => {
    const reference = JSON.parse(readFileSync(resolve(lab, 'runtime-check.json'), 'utf8'));
    expect(reference.executor).toBe('Codex AI execution environment'); expect(reference.scope).toContain('user local execution');
    expect(reference.runtime).toContain('not browser Worker'); expect(reference.csvProjectVersion).toBe('csv-checker-v1');
    expect(reference.csvProjectChecks.map((item: { id: string }) => item.id)).toEqual(['normal', 'missing-field', 'non-numeric', 'missing-unit']);
    for (const check of reference.csvProjectChecks) {
      expect(check.codeSha256).toBe(hash(readFileSync(resolve(lab, 'csv_check.py'))));
      expect(check.inputSha256).toBe(hash(readFileSync(resolve(project, `${check.id}.csv`))));
    }
    expect(reference.csvProjectChecks[0].stdout).toContain('读取 4 行；检查发现 0 项问题');
    expect(reference.csvProjectChecks[1].state).toBe('error'); expect(reference.csvProjectChecks[1].error).toContain('缺少表头');
    expect(reference.csvProjectChecks[2].stdout).toContain("value='abc'");
    expect(reference.csvProjectChecks[3].stdout).toContain("单位 ''");
  });
});
