import { describe, expect, it } from 'vitest';
import { getDomainKnowledgePoints, getDomainPlans, knowledgeMarkdown, type LearningDomainSlug } from '../src/data/learning-catalog';
import { toolsChapterOrder } from '../src/data/tools-learning';

const domains: LearningDomainSlug[] = ['structural', 'thermal', 'fluids', 'multiphysics', 'chip'];

describe('preset learning catalog', () => {
  it.each(domains)('%s has valid 20/30/40 plans', (domain) => {
    const plans = getDomainPlans(domain);
    expect(plans.low).toHaveLength(20);
    expect(plans.mid).toHaveLength(30);
    expect(plans.high).toHaveLength(40);
    const points = getDomainKnowledgePoints(domain);
    expect(new Set(points.map((point) => point.id)).size).toBe(90);
    const ids = new Set(points.map((point) => point.id));
    for (const point of points) {
      expect(point.prerequisites.every((id) => ids.has(id))).toBe(true);
      const content = knowledgeMarkdown(point);
      expect([...content].length).toBeGreaterThanOrEqual(600);
      expect(content).toContain('## 验证清单');
      expect(point.question.length).toBeGreaterThan(10);
    }
  });

  it('tools provides 82 tutorials across Python, APDL, NumPy and SciPy without mixed level routes', () => {
    const plans = getDomainPlans('tools');
    expect(plans.low).toHaveLength(82);
    expect(plans.mid).toHaveLength(0);
    expect(plans.high).toHaveLength(0);

    const points = [...plans.low, ...plans.mid, ...plans.high];
    expect(new Set(points.map((point) => point.id)).size).toBe(82);
    expect(new Set(toolsChapterOrder.filter((ch) => points.some((p) => p.group === ch)))).toEqual(new Set(points.map((point) => point.group)));

    const ids = new Set(points.map((point) => point.id));
    for (const point of points) {
      expect(point.prerequisites.every((id) => ids.has(id))).toBe(true);
      expect(point.difficulty).toMatch(/零基础|基础/);
      expect(point.practiceStatus).toBe('collecting');
      const content = knowledgeMarkdown(point);
      expect([...content].length).toBeGreaterThanOrEqual(1500);
      expect((content.match(/~~~/g) || []).length).toBeGreaterThanOrEqual(6);
      expect(content).not.toContain('## 验证清单');
    }
  });
});
