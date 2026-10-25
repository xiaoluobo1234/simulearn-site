import { describe, it, expect } from 'vitest';
import { linearStaticBenchmarks } from '../src/data/linear-static-benchmarks';
import { linearStaticProjectStages, linearStaticProjectVersion } from '../src/data/linear-static-project';
import { publicSearchIndex } from '../src/data/search-index';
import { getKnowledgePoint } from '../src/data/learning-catalog';
import { canonicalReaderHref } from '../src/lib/reading-position';
import { sanitizeLibraryEntry } from '../src/lib/reading-library';
import { readPracticeCatalog, checkProjectPractice, blankProjectPractice } from '../src/lib/project-practice';

describe('linear static course and public evidence integration',()=>{
  it('connects six phases to real knowledge and three independently readable benchmark cases',()=>{
    expect(linearStaticProjectStages.map(stage=>stage.id)).toEqual(['concepts','assumptions','model','solve','validate','review']);
    for(const stage of linearStaticProjectStages){
      for(const link of stage.links){
        const match=link.href.match(/^\/domains\/(structural|tools)\/kp\/([a-z0-9-]+)\/$/);
        if(match) expect(getKnowledgePoint(match[1] as 'structural'|'tools',match[2])).toBeTruthy();
      }
    }
    expect(linearStaticBenchmarks).toHaveLength(3);
    const catalog=readPracticeCatalog({version:linearStaticProjectVersion,cases:linearStaticBenchmarks.map(item=>({...item,href:`/cases/benchmarks/${item.slug}/`}))});
    expect(catalog.ok).toBe(true);
    if(!catalog.ok) throw Error(catalog.error);
    for(const item of linearStaticBenchmarks){
      const href=`/cases/benchmarks/${item.slug}/`;
      const entries=publicSearchIndex.filter(entry=>entry.href===href);
      expect(entries).toHaveLength(1);
      expect(sanitizeLibraryEntry(entries[0])?.href).toBe(href);
      expect(canonicalReaderHref(href)).toBe(href);
      const draft=blankProjectPractice(item.slug);
      for(const q of item.quantities) draft.answers[q.id]=String(q.value);
      draft.concept='not-proof';
      expect(checkProjectPractice(draft,catalog.value).allMatch).toBe(true);
      expect(draft.executor).toBe('未运行');
      expect(draft.reproduction).toBe('未运行');
      for(const link of item.related){const match=link.href.match(/^\/domains\/structural\/kp\/([a-z0-9-]+)\/$/);expect(match).toBeTruthy();expect(getKnowledgePoint('structural',match![1])).toBeTruthy();}
    }
  });
  it('keeps submitted answers and record URLs out of public library and reader state',()=>{
    const entry=publicSearchIndex.find(entry=>entry.id==='page:linear-static-project')!;
    expect(entry.href).toBe('/learning/projects/linear-static/');
    expect(canonicalReaderHref(entry.href)).toBeNull();
    expect(sanitizeLibraryEntry({...entry,href:`${entry.href}?id=record-private`})).toBeNull();
    expect(sanitizeLibraryEntry({...entry,href:'/cases/benchmarks/unknown/',type:'case'})).toBeNull();
    expect(publicSearchIndex.some(entry=>entry.href.includes('?id=')||entry.href.includes('answers='))).toBe(false);
  });
});
