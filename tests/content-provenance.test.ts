import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentCorrectionHref, contentProvenance } from '../src/data/content-provenance';
import { structuralFoundationLessons } from '../src/data/structural-foundations';
import { diagnosticRecords } from '../src/data/diagnostics';
import { linearStaticBenchmarks } from '../src/data/linear-static-benchmarks';
import { mechanicsFoundationTutorials } from '../src/data/structural-foundations-mechanics';
import { femFoundationTutorials } from '../src/data/structural-foundations-fem';
import { supportsMaterialsFoundationTutorials } from '../src/data/structural-foundations-supports-materials';
import { assemblyConstraintsFoundationTutorials } from '../src/data/structural-foundations-assembly-constraints';

describe('public content provenance and manual correction links', () => {
  it('covers the current public course, real benchmark catalog, foundations, diagnostics and three labs with unique identities', () => {
    const ids = contentProvenance.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    const expected = [
      'guide:first-study',
      'project:linear-static', ...linearStaticBenchmarks.map(item => `benchmark:${item.slug}`),
      ...structuralFoundationLessons.map(item => `foundation:${item.id}`), ...diagnosticRecords.map(item => `diagnostic:${item.slug}`),
      'lab:python', 'lab:assembly', 'lab:convergence',
    ];
    expect([...ids].sort()).toEqual(expected.sort());
    for (const item of contentProvenance) {
      expect(item.href).toMatch(/^\/[a-z0-9/-]+\/$/); expect(item.href).not.toContain('?'); expect(item.href).not.toContain('#');
      expect(item.sourcePath).toMatch(/^src\/[a-zA-Z0-9/._-]+\.(ts|astro)$/);
      expect(existsSync(fileURLToPath(new URL(`../${item.sourcePath}`, import.meta.url)))).toBe(true);
      expect(item.title.trim()).not.toBe(''); expect(item.version.trim()).not.toBe('');
    }
  });
  it('keeps human review explicitly pending without inventing reviewers, audit dates or verified-user status', () => {
    for (const item of contentProvenance) {
      expect(item.review).toBe('pending'); expect(item.reviewer).toBeNull();
      for (const key of ['reviewedAt', 'reviewerEmail', 'passed', 'mastered', 'userCompleted']) expect(item).not.toHaveProperty(key);
      expect(item.changes.length).toBeGreaterThan(0);
      expect(item.changes[0].version).toBe(item.version);
      expect(item.changes.every(change => change.summary.trim())).toBe(true);
    }
  });
  it('points each foundation history to the file that defines its actual lesson body', () => {
    const modules = [
      { body: mechanicsFoundationTutorials, path: 'src/data/structural-foundations-mechanics.ts' },
      { body: femFoundationTutorials, path: 'src/data/structural-foundations-fem.ts' },
      { body: supportsMaterialsFoundationTutorials, path: 'src/data/structural-foundations-supports-materials.ts' },
      { body: assemblyConstraintsFoundationTutorials, path: 'src/data/structural-foundations-assembly-constraints.ts' },
    ];
    const foundations = contentProvenance.filter(item => item.id.startsWith('foundation:'));
    expect(foundations).toHaveLength(structuralFoundationLessons.length);
    expect(new Set(foundations.map(item => item.sourcePath)).size).toBe(4);
    for (const lesson of structuralFoundationLessons) {
      const owners = modules.filter(module => Object.hasOwn(module.body, lesson.id));
      expect(owners).toHaveLength(1);
      const item = foundations.find(item => item.id === `foundation:${lesson.id}`)!;
      expect(item.sourcePath).toBe(owners[0].path);
      const source = readFileSync(fileURLToPath(new URL(`../${item.sourcePath}`, import.meta.url)), 'utf8');
      expect(source).toContain(`'${lesson.id}': String.raw`);
      expect(owners[0].body[lesson.id].length).toBeGreaterThan(1000);
      expect(item.sourcePath).not.toBe('src/data/structural-foundations.ts');
    }
  });
  it('builds manual correction URLs for only the known GitHub repo with correct page/version metadata', () => {
    for (const item of contentProvenance) {
      const url = new URL(contentCorrectionHref(item));
      expect(url.origin).toBe('https://github.com'); expect(url.pathname).toBe('/xiaoluobo1234/simulearn-site/issues/new');
      expect(url.searchParams.get('template')).toBe('content-correction.yml'); expect(url.searchParams.get('page')).toBe(item.href);
      expect(url.searchParams.get('content_version')).toBe(item.version); expect(url.searchParams.get('title')).toBe(`[内容纠错] ${item.title}`);
      expect([...url.searchParams.keys()].sort()).toEqual(['content_version', 'page', 'template', 'title']);
      expect(url.hash).toBe('');
    }
  });
  it('encodes Chinese and query punctuation as metadata rather than allowing injection of another destination or parameter', () => {
    const item = { ...contentProvenance[0], title: '位移 & 反力？#单位 + <tag>', version: 'v1 & labels=approved', href: '/labs/convergence/' };
    const url = new URL(contentCorrectionHref(item));
    expect(url.searchParams.get('title')).toBe(`[内容纠错] ${item.title}`); expect(url.searchParams.get('content_version')).toBe(item.version);
    expect(url.searchParams.has('labels')).toBe(false); expect(url.hash).toBe(''); expect(url.origin).toBe('https://github.com');
    expect(contentCorrectionHref(item)).not.toContain('<tag>');
  });
});
