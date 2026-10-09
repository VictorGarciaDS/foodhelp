import { describe, expect, it } from 'vitest';
import { currentWeekStart } from './dates';

describe('currentWeekStart', () => {
  it('returns an ISO calendar date for the current Monday', () => {
    expect(currentWeekStart()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});