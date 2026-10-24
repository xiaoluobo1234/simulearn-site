import { describe,it,expect } from 'vitest';
import { diagnosticRecords } from '../src/data/diagnostics';
import { failureExamples } from '../src/data/failure-examples';
import { publicSearchIndex } from '../src/data/search-index';
import { isSafeSearchHref } from '../src/lib/search';
import { canonicalReaderHref } from '../src/lib/reading-position';
import { getKnowledgePoint } from '../src/data/learning-catalog';

describe('diagnostic evidence paths',()=>{
  it('keeps old anchors, valid related lessons and one public search entry per path',()=>{
    expect(diagnosticRecords).toHaveLength(6);
    const ids=diagnosticRecords.map(card=>card.id);
    expect(ids).toEqual(expect.arrayContaining(['diag-rigid-body','diag-nonconvergence','diag-stress-singularity']));
    expect(new Set(ids).size).toBe(6);
    for(const card of diagnosticRecords){
      expect(card.reviewStatus).toBe('draft');
      expect(new Set(card.checks.map(check=>check.id)).size).toBe(card.checks.length);
      expect(card.checks.length).toBeGreaterThanOrEqual(4);
      expect(card.sources.length).toBeGreaterThan(0);
      for(const source of card.sources) {expect(new URL(source.url).protocol).toBe('https:');expect(source.scope.length).toBeGreaterThan(10);}
      for(const link of card.related){ const id=link.href.match(/^\/domains\/structural\/kp\/([\w-]+)\/?$/)?.[1];expect(id).toBeTruthy();expect(getKnowledgePoint('structural',id!)).toBeTruthy(); }
      const href=`/diagnostic/${card.slug}/`;
      expect(isSafeSearchHref(href)).toBe(true);
      expect(canonicalReaderHref(href)).toBe(href);
      expect(publicSearchIndex.filter(entry=>entry.href===href)).toHaveLength(1);
    }
  });
  it('keeps private review routes and invented paths out of public reading state',()=>{
    for(const href of ['/failures/review/','/diagnostic/unknown/','/diagnostic/units/?raw=private']){
      expect(isSafeSearchHref(href)).toBe(false);expect(canonicalReaderHref(href)).toBeNull();
    }
    expect(publicSearchIndex.some(entry=>entry.href.includes('/failures/review'))).toBe(false);
    expect(failureExamples).toHaveLength(3);
    expect(failureExamples.every(example=>diagnosticRecords.some(card=>card.slug===example.diagnosticSlug))).toBe(true);
  });
});
