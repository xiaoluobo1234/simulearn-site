import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getDomainKnowledgePoints, type LearningDomainSlug } from '../src/data/learning-catalog';
import { extractPublicErrorEntries, publicSearchIndex } from '../src/data/search-index';
import { GET } from '../src/pages/search-index.json';
import { isSafeSearchHref, normalizeSearchQuery, searchEntries, type SearchEntry } from '../src/lib/search';

describe('public search index source and privacy', () => {
  it('indexes every real knowledge point once with its existing domain route', () => {
    const domains: LearningDomainSlug[] = ['structural', 'thermal', 'fluids', 'multiphysics', 'chip', 'tools'];
    const expected = domains.flatMap((domain) => getDomainKnowledgePoints(domain).map((point) => `/domains/${domain}/kp/${point.id}/`));
    expect(publicSearchIndex.filter((entry) => entry.type === 'kp').map((entry) => entry.href).sort()).toEqual(expected.sort());
    expect(new Set(publicSearchIndex.map((entry) => entry.id)).size).toBe(publicSearchIndex.length);
  });

  it('derives error codes, titles and uppercase anchors from the actual ErrorLookup component', () => {
    const actualSource = readFileSync(new URL('../src/components/ErrorLookup.astro', import.meta.url), 'utf8');
    const errors = extractPublicErrorEntries(actualSource);
    expect(errors).toHaveLength(60);
    for (const error of errors) {
      expect(actualSource).toContain(`code: '${error.code}'`);
      expect(actualSource).toContain(`title: '${error.title}'`);
      expect(error.href).toBe(`/errors/#${error.code}`);
    }
    for (const code of ['ANSYS-004', 'FLUENT-008', 'LSDYNA-006']) {
      expect(searchEntries(publicSearchIndex, code).items[0].href).toBe(`/errors/#${code}`);
    }
    expect(() => extractPublicErrorEntries(actualSource.replace('id={err.code}', 'id="changed"'))).toThrow('anchor contract changed');
    expect(() => extractPublicErrorEntries('no error database')).toThrow();
  });

  it('contains public pages and the actual case while never reading or indexing private records', async () => {
    for (const href of ['/learning/', '/learning/records/', '/library/', '/tools/', '/fea-series/', '/cases/', '/diagnostic/', '/failures/', '/books/', '/cae/', '/about/', '/cases/rock-dynamic-stability/']) {
      expect(publicSearchIndex.some((entry) => entry.href === href)).toBe(true);
    }
    expect(publicSearchIndex.some((entry) => entry.href.startsWith('/api/') || entry.href.includes('/learning/shared') || /^record-|^source-|^note-/.test(entry.id))).toBe(false);
    expect(publicSearchIndex.every((entry) => isSafeSearchHref(entry.href))).toBe(true);
    // Tools has its own /tools/ landing page; /domains/tools/ is not generated.
    expect(publicSearchIndex.some((entry) => entry.href === '/domains/tools/')).toBe(false);
    const response = GET();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.entries).toEqual(publicSearchIndex);
    expect(payload).not.toHaveProperty('user');
    const indexSource = readFileSync(new URL('../src/data/search-index.ts', import.meta.url), 'utf8');
    expect(indexSource).not.toMatch(/StudyStore|BOOKS|localStorage|fetch\(/);
  });
});

describe('search query matching and ordering', () => {
  it('prioritizes exact titles and error codes, including full-width input', () => {
    const file = publicSearchIndex.find((entry) => entry.id === 'kp:tools:file-io')!;
    expect(searchEntries(publicSearchIndex, file.title).items[0].id).toBe(file.id);
    expect(searchEntries(publicSearchIndex, 'ＡＮＳＹＳ－００４').items[0].code).toBe('ANSYS-004');
    expect(searchEntries(publicSearchIndex, '  ＮｕｍＰｙ  ').items.some((entry) => entry.id === 'kp:tools:numpy-intro')).toBe(true);
  });

  it('resolves useful engineering and tool aliases without expanding short English substrings', () => {
    expect(searchEntries(publicSearchIndex, 'CSV', { type: 'kp' }).items[0].id).toBe('kp:tools:file-io');
    expect(searchEntries(publicSearchIndex, 'CSV文件读写', { type: 'kp' }).items[0].id).toBe('kp:tools:file-io');
    const fea = searchEntries(publicSearchIndex, 'FEA', { type: 'kp', limit: 1000 });
    expect(fea.total).toBeGreaterThan(0);
    expect(fea.items.map((entry) => entry.id).sort()).toEqual(searchEntries(publicSearchIndex, '有限元', { type: 'kp', limit: 1000 }).items.map((entry) => entry.id).sort());
    const cfd = searchEntries(publicSearchIndex, 'CFD', { type: 'kp', limit: 1000 });
    expect(cfd.total).toBeGreaterThan(0);
    expect(cfd.items.map((entry) => entry.id).sort()).toEqual(searchEntries(publicSearchIndex, '流体', { type: 'kp', limit: 1000 }).items.map((entry) => entry.id).sort());
    expect(searchEntries(publicSearchIndex, 'finite element', { type: 'kp' }).total).toBeGreaterThan(0);
    expect(searchEntries(publicSearchIndex, 'rigid body motion', { type: 'error' }).items.some((entry) => entry.code === 'GENERAL-001')).toBe(true);
    expect(searchEntries(publicSearchIndex, '热', { domain: 'thermal' }).total).toBeGreaterThan(0);
    expect(searchEntries(publicSearchIndex, 'heat', { domain: 'thermal', limit: 1000 }).total).toBe(searchEntries(publicSearchIndex, '热分析', { domain: 'thermal', limit: 1000 }).total);
    const irrelevant: SearchEntry = { id: 'synthetic', type: 'page', title: 'Input parameters', description: 'type input here', href: '/tools/' };
    expect(searchEntries([irrelevant], 'np').total).toBe(0);
  });

  it('uses AND across English, Chinese and mixed-language terms', () => {
    const result = searchEntries(publicSearchIndex, 'Python 文件读写');
    expect(result.items[0].id).toBe('kp:tools:file-io');
    expect(searchEntries(publicSearchIndex, 'numpy 数组', { type: 'kp', limit: 1000 }).items.every((entry) => /numpy/i.test(`${entry.group} ${entry.id}`))).toBe(true);
    expect(searchEntries(publicSearchIndex, 'Python 一个不存在的词qwerty').total).toBe(0);
    expect(searchEntries(publicSearchIndex, '接触不收敛', { type: 'error', limit: 1000 }).items.some((entry) => entry.code === 'ANSYS-002')).toBe(true);
    const contactResults = searchEntries(publicSearchIndex, '接触不收敛').items;
    expect(contactResults[0].id).toBe('diagnostic:nonconvergence');
    expect(contactResults.some(entry => entry.id === 'error:ANSYS-002')).toBe(true);
    expect(searchEntries(publicSearchIndex, '热分析 不收敛', { type: 'error' }).items.some((entry) => entry.code === 'ANSYS-015')).toBe(true);
    expect(searchEntries(publicSearchIndex, '力').total).toBe(0);
    expect(searchEntries(publicSearchIndex, '的').total).toBe(0);
    expect(searchEntries(publicSearchIndex, '天文未知短语').total).toBe(0);
  });

  it('combines type/domain filters and computes total before any display limit', () => {
    const expected = publicSearchIndex.filter((entry) => entry.type === 'kp' && entry.domain === 'structural').length;
    const limited = searchEntries(publicSearchIndex, '', { domain: 'structural', type: 'kp', limit: 3 });
    expect(limited.items).toHaveLength(3);
    expect(limited.total).toBe(expected);
    expect(limited.total).toBeGreaterThan(60);
    expect(limited.truncated).toBe(true);
    const all = searchEntries(publicSearchIndex, '', { domain: 'structural', type: 'kp', limit: 10000 });
    expect(all.items).toHaveLength(expected);
    expect(all.truncated).toBe(false);
    expect(searchEntries(publicSearchIndex, '', { type: 'kp', domain: 'tools' }).total).toBe(82);
    expect(searchEntries(publicSearchIndex, '', { domain: 'all', type: 'all', limit: 0 }).total).toBe(publicSearchIndex.length);
    expect(searchEntries(publicSearchIndex, '', { type: 'private' }).total).toBe(0);
    expect(searchEntries(publicSearchIndex, '', { domain: '__proto__' }).total).toBe(0);
  });

  it('limits only query length, retaining searchable content beyond 120 characters', () => {
    expect(normalizeSearchQuery('x'.repeat(200))).toHaveLength(120);
    expect(normalizeSearchQuery('  ＣＳＶ\u200b\n文件读写  ')).toBe('csv 文件读写');
    const longEntry: SearchEntry = { id: 'long', type: 'page', title: 'Long public text', description: 'x'.repeat(180) + ' unique-tail-token', href: '/about/' };
    expect(searchEntries([longEntry], 'unique-tail-token').total).toBe(1);
    expect(searchEntries(publicSearchIndex, '[.*+?^${}()|\\]').total).toBe(0);
  });

  it('drops hostile or private URLs even when an injected entry exactly matches the query', () => {
    const badHrefs = ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/api/study/items', '/learning/shared?user=private', '/books/../ai', '/domains/tools/', '/domains/tools/kp/%2e%2e', '/\\evil.example', '/errors/#\" onclick=\"alert(1)', '/domains/tools/kp/file-io/?token=test'];
    const injected = badHrefs.map((href, index): SearchEntry => ({ id: `unsafe-${index}`, type: 'page', title: 'CSV', description: '', href }));
    expect(searchEntries(injected, 'CSV').items).toEqual([]);
    expect(searchEntries(injected, '').total).toBe(0);
    for (const href of badHrefs) expect(isSafeSearchHref(href)).toBe(false);
  });
});
