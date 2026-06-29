import { describe, expect, it } from 'vitest';
import { getDomainKnowledgePoints, getDomainPlans, knowledgeMarkdown, type LearningDomainSlug } from '../src/data/learning-catalog';

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
});
