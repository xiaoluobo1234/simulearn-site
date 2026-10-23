import { describe, expect, it } from 'vitest';
import { assembleKnowledgeContent } from '../functions/_shared/learning';
import { getDomainKnowledgePoints, getKnowledgePoint, knowledgeMarkdown } from '../src/data/learning-catalog';
import { structuralFoundationLessons, structuralFoundationMarkdown } from '../src/data/structural-foundations';
import { publicSearchIndex } from '../src/data/search-index';

const request = new Request('https://simulearn.cn/');

describe('mechanics foundation content delivery', () => {
  it('enriches six existing routes and keeps cross-references valid without changing plan IDs', () => {
    const points = getDomainKnowledgePoints('structural');
    const ids = new Set(points.map(point => point.id));
    expect(points).toHaveLength(90);
    expect(Object.keys(structuralFoundationMarkdown).sort()).toEqual(structuralFoundationLessons.map(lesson => lesson.id).sort());
    for (const lesson of structuralFoundationLessons) {
      const point = getKnowledgePoint('structural', lesson.id)!;
      const markdown = knowledgeMarkdown(point);
      expect(point.foundationMarkdown).toBe(structuralFoundationMarkdown[lesson.id]);
      expect(markdown).toContain('待本人复核');
      expect(markdown).toContain('参考答案');
      for (const match of markdown.matchAll(/\]\(\/domains\/structural\/kp\/([\w-]+)\/?\)/g)) expect(ids.has(match[1]), match[1]).toBe(true);
      const search = publicSearchIndex.find(entry => entry.id === `kp:structural:${lesson.id}`)!;
      expect(search.href).toBe(`/domains/structural/kp/${lesson.id}/`);
      expect(search.keywords).toContain('力学与有限元基础');
    }
  });

  it('delivers the long-form draft when optional R2 is unavailable without claiming tool tutorial or review', async () => {
    const content = await assembleKnowledgeContent({}, request, 'structural', 'units-and-dimensions');
    expect(content.foundationMode).toBe(true);
    expect(content.tutorialMode).toBe(false);
    expect(content.reviewStatus).toBe('draft');
    expect(content.aiContent).toContain('7.70085');
    expect(content.aiContent).toBe(knowledgeMarkdown(getKnowledgePoint('structural', 'units-and-dimensions')!));
  });

  it('preserves administrator title and body overrides ahead of the new static fallback', async () => {
    const reads: string[] = [];
    const env = { BOOKS: { get: async (key: string) => {
      reads.push(key);
      return { json: async () => ({ title: '管理员已有标题', aiContent: '管理员已有正文', description: '已有摘要' }) };
    } } as any };
    const content = await assembleKnowledgeContent(env, request, 'structural', 'axial-members');
    expect(reads).toEqual(['content/structural/axial-members.json']);
    expect(content.title).toBe('管理员已有标题');
    expect(content.aiContent).toBe('管理员已有正文');
    expect(content.description).toBe('已有摘要');
    expect(content.foundationMode).toBe(false);
  });

  it('does not apply foundation mode to other structural points or Python tutorials', async () => {
    const general = await assembleKnowledgeContent({}, request, 'structural', 'vectors-and-force-systems');
    const python = await assembleKnowledgeContent({}, request, 'tools', 'file-io');
    expect(general.foundationMode).toBe(false);
    expect(general.tutorialMode).toBe(false);
    expect(python.foundationMode).toBe(false);
    expect(python.tutorialMode).toBe(true);
  });
});
