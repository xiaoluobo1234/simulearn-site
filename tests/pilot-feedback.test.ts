import { describe, expect, it } from 'vitest';
import { buildPilotFeedback, PILOT_TASK_VERSIONS, readPilotPrefill } from '../src/lib/pilot-feedback';

const now = Date.parse('2026-10-25T06:30:00Z');
const input = (changes: Record<string, unknown> = {}) => ({
  task: 'first-study', contentVersion: 'first-study-v1', selfReported: 'not-provided', difficulty: 'not-provided',
  notes: '', startPoint: 'not-provided', firstResult: 'not-provided', stoppedAtStep: 'not-provided',
  intendedNext: 'not-provided', durationMinutes: '', ...changes,
});

describe('versioned local trial feedback', () => {
  it('keeps omitted observations explicitly null and describes export time without inventing a learning event', () => {
    const result = buildPilotFeedback(input(), now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feedback).toEqual({
      version: 1, recordedAt: '2026-10-25T06:30:00.000Z', task: 'first-study', contentVersion: 'first-study-v1',
      selfReported: 'not-provided', difficulty: 'not-provided', notes: '', startPoint: null, firstResult: null,
      stoppedAtStep: null, intendedNext: null, durationMinutes: null,
      scope: '用户自行填写的试学反馈；不是系统验证完成记录；耗时与首次结果均为自述，记录时间仅表示导出时间',
    });
    for (const field of ['passed', 'mastered', 'userId', 'startedAt', 'completedAt', 'firstOutputAt', 'activityEvents', 'url']) expect(result.feedback).not.toHaveProperty(field);
  });

  it('binds each task to the known content version and rejects tampered or unsupported versions', () => {
    for (const [task, contentVersion] of Object.entries(PILOT_TASK_VERSIONS)) {
      const result = buildPilotFeedback(input({ task, contentVersion }), now);
      expect(result.ok).toBe(true);
      if (result.ok) expect([result.feedback.task, result.feedback.contentVersion]).toEqual([task, contentVersion]);
      for (const invalidVersion of ['PRIVATE_QUERY_VERSION', `${contentVersion}\n`, `${contentVersion} `, null, 1]) expect(buildPilotFeedback(input({ task, contentVersion: invalidVersion }), now).ok).toBe(false);
    }
    for (const task of ['unknown', '__proto__', 'constructor', 'first-study\n', null]) expect(buildPilotFeedback(input({ task }), now).ok).toBe(false);
  });

  it('preserves explicit self-reports independently, including unfinished work with actual output and the exact notes', () => {
    const notes = '  已看到输出，但未核对：<img src=x onerror="alert(1)">\n仍需核对单位。  ';
    const result = buildPilotFeedback(input({ selfReported: 'unfinished', difficulty: '4', notes, startPoint: 'python', firstResult: 'has-output', stoppedAtStep: 'assembly', intendedNext: 'check-source', durationMinutes: '12.5' }), now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feedback.notes).toBe(notes);
    expect(result.feedback.selfReported).toBe('unfinished');
    expect(result.feedback.firstResult).toBe('has-output');
    expect(result.feedback.stoppedAtStep).toBe('assembly');
    expect(result.feedback.durationMinutes).toBe(12.5);
    expect(result.feedback).not.toHaveProperty('completed');
    expect(buildPilotFeedback(input({ selfReported: 'finished-self-report', firstResult: 'no-output' }), now).ok).toBe(true);
  });

  it('rejects the whole record for unknown, duplicate-shaped, missing or malformed form fields', () => {
    for (const bad of [null, [], 'text', input({ accountId: 'private' }), input({ answer: 'private' }), input({ task: ['first-study', 'python'] }), input({ selfReported: 'verified' }), input({ difficulty: 4 }), input({ firstResult: 'successful' }), input({ startPoint: '/private?id=1' }), input({ stoppedAtStep: 'passed' }), input({ intendedNext: null }), input({ notes: null })]) expect(buildPilotFeedback(bad, now).ok).toBe(false);
    const missing: Record<string, unknown> = input(); delete missing.intendedNext;
    expect(buildPilotFeedback(missing, now).ok).toBe(false);
    const ownProto = Object.assign(Object.create(null), input(), { ['__proto__']: 'private' });
    expect(buildPilotFeedback(ownProto, now).ok).toBe(false);
  });

  it('enforces full-string limits and never silently trims or truncates feedback', () => {
    const boundary = ` ${'中'.repeat(1997)}\n `;
    expect(boundary.length).toBe(2000);
    const result = buildPilotFeedback(input({ notes: boundary }), now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.feedback.notes).toBe(boundary);
    expect(buildPilotFeedback(input({ notes: `${boundary}X` }), now)).toMatchObject({ ok: false, error: expect.stringContaining('未截断') });
    for (const durationMinutes of ['-1', '1440.0001', 'Infinity', 'NaN', '1e2', '1\n', '1 ', ' 1', '01', '.5', '1.', '1,2', '1e999999', '1'.repeat(33), null, 1]) expect(buildPilotFeedback(input({ durationMinutes }), now).ok).toBe(false);
    for (const durationMinutes of ['0', '0.5', '1440', '1440.000']) {
      const result = buildPilotFeedback(input({ durationMinutes }), now);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.feedback.durationMinutes).toBe(Number(durationMinutes));
    }
  });

  it('refuses invalid export clocks rather than substituting an invented date', () => {
    for (const clock of [NaN, Infinity, -1, now + .1, Number.MAX_SAFE_INTEGER]) expect(buildPilotFeedback(input(), clock).ok).toBe(false);
  });

  it('prefills only one exact whitelisted task/version pair while discarding every unrelated query field', () => {
    const params = new URLSearchParams('task=first-study&contentVersion=first-study-v1&notes=PRIVATE_NOTE&userId=PRIVATE_USER&id=PRIVATE_ID&durationMinutes=999');
    expect(readPilotPrefill(params)).toEqual({ task: 'first-study', contentVersion: 'first-study-v1' });
    expect(JSON.stringify(readPilotPrefill(params))).not.toContain('PRIVATE');
    for (const [task, contentVersion] of Object.entries(PILOT_TASK_VERSIONS)) expect(readPilotPrefill(new URLSearchParams({ task, contentVersion }))).toEqual({ task, contentVersion });
  });

  it('ignores ambiguous, unversioned and tampered prefill values as a whole', () => {
    for (const query of ['', 'task=first-study', 'contentVersion=first-study-v1', 'task=first-study&contentVersion=labs-v1', 'task=first-study&task=first-study&contentVersion=first-study-v1', 'task=first-study&contentVersion=first-study-v1&contentVersion=PRIVATE', 'task=first-study%0A&contentVersion=first-study-v1', 'task=first-study&contentVersion=first-study-v1%0A', 'task=__proto__&contentVersion=first-study-v1']) expect(readPilotPrefill(new URLSearchParams(query))).toBeNull();
  });
});
