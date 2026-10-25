import { describe, expect, it } from 'vitest';
import { ACTIVITY_KEY, ACTIVITY_KINDS, ACTIVITY_PAGES, appendActivity, emptyActivity, readActivity, summarizeActivity, type ActivityState } from '../src/lib/learning-activity';

const now = Date.parse('2026-10-25T02:00:00Z');
const enabled = (): ActivityState => ({ version: 1, enabled: true, events: [] });
const event = (changes: Record<string, unknown> = {}) => ({ kind: 'practice-check', page: 'convergence', at: now, ...changes });
const serialized = (events: unknown[] = [], changes: Record<string, unknown> = {}) => JSON.stringify({ version: 1, enabled: true, events, ...changes });

describe('opt-in local activity has no inferred learning completion', () => {
  it('defaults off, gives fresh empty states and refuses to append until the user has opted in', () => {
    expect(ACTIVITY_KEY).toBe('simulearn-learning-activity-v1');
    expect(readActivity(null, now)).toEqual({ state: emptyActivity(), valid: true });
    const state = emptyActivity(); expect(state.enabled).toBe(false);
    expect(appendActivity(state, 'practice-check', 'convergence', now)).toBe(state);
    expect(state.events).toEqual([]);
    state.events.push({ kind: 'page-view', page: 'project', at: now }); expect(emptyActivity().events).toEqual([]);
  });
  it('accepts only the documented event/page enums and projects no payload, identity, answer or URL fields', () => {
    for (const kind of ACTIVITY_KINDS) for (const page of ACTIVITY_PAGES) {
      const state = appendActivity(enabled(), kind, page, now);
      expect(state.events).toEqual([{ kind, page, at: now }]);
      expect(Object.keys(state.events[0]).sort()).toEqual(['at', 'kind', 'page']);
    }
    for (const [kind, page] of [['completed', 'project'], ['practice-check', '/learning/?id=private'], ['private-note', 'review'], [null, 'python'], ['page-view', {}]]) {
      const state = enabled(); expect(appendActivity(state, kind, page, now)).toBe(state);
    }
    for (const extra of ['csv', 'answer', 'email', 'userId', 'recordId', 'url', 'unit', 'result']) {
      expect(readActivity(serialized([event({ [extra]: 'private' })]), now)).toEqual({ state: emptyActivity(), valid: false });
    }
  });
  it('fails closed for corrupt, unknown, oversized or partially invalid schemas without returning a fake successful subset', () => {
    for (const raw of ['{bad', 'null', '[]', '{}', serialized([], { version: 2 }), serialized([], { enabled: 'yes' }), serialized([], { email: 'private' }), serialized([event(), { kind: 'completed', page: 'project', at: now }]), serialized([null]), serialized([event({ kind: undefined })]), serialized([event({ page: undefined })]), ' '.repeat(128001), serialized(Array(1001).fill(event()))]) {
      expect(readActivity(raw, now)).toEqual({ state: emptyActivity(), valid: false });
    }
    expect(readActivity(serialized([], { enabled: false }), now)).toEqual({ state: { version: 1, enabled: false, events: [] }, valid: true });
  });
  it('checks integer timestamps and the inclusive five-minute future boundary', () => {
    for (const at of [0, now, now + 300000]) expect(readActivity(serialized([event({ at })]), now).valid).toBe(true);
    for (const at of [-1, 0.5, String(now), now + 300001, Number.MAX_SAFE_INTEGER, null]) expect(readActivity(serialized([event({ at })]), now).valid).toBe(false);
    for (const at of [NaN, Infinity, -1, 0.5]) { const state = enabled(); expect(appendActivity(state, 'page-view', 'project', at)).toBe(state); }
  });
  it('retains only the latest thousand events and does not mutate prior or paused state', () => {
    const old = { ...enabled(), events: Array.from({ length: 1000 }, (_, index) => ({ kind: 'page-view' as const, page: 'project' as const, at: now - 1000 + index })) };
    const next = appendActivity(old, 'practice-check', 'assembly', now);
    expect(old.events).toHaveLength(1000); expect(old.events[0].at).toBe(now - 1000);
    expect(next.events).toHaveLength(1000); expect(next.events[0].at).toBe(now - 999); expect(next.events.at(-1)).toEqual({ kind: 'practice-check', page: 'assembly', at: now });
    const paused = { ...next, enabled: false }; expect(appendActivity(paused, 'reference-run', 'python', now + 1)).toBe(paused);
  });
  it('summarizes Shanghai calendar days and raw steps without claiming independent users, completion or retention', () => {
    const state: ActivityState = { version: 1, enabled: true, events: [
      { kind: 'page-view', page: 'project', at: Date.parse('2026-10-24T15:59:59Z') },
      { kind: 'practice-check', page: 'convergence', at: Date.parse('2026-10-24T16:00:00Z') },
      { kind: 'reference-run', page: 'python', at: Date.parse('2026-10-24T16:00:01Z') },
    ] };
    expect(summarizeActivity(state)).toEqual({ events: 3, days: 2, first: '2026-10-24', last: '2026-10-25', checks: 1, runs: 1 });
    const summary = summarizeActivity(state);
    for (const key of ['completionRate', 'users', 'retentionRate', 'mastered', 'completed']) expect(summary).not.toHaveProperty(key);
    expect(summarizeActivity(emptyActivity())).toEqual({ events: 0, days: 0, first: '尚无记录', last: '尚无记录', checks: 0, runs: 0 });
  });
});
