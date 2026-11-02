import { describe, it, expect } from 'vitest';
import {
  itemPoints, weekKey, civilDate, previousDay,
  nextStreak, liveStreak, rankFor, RANKS,
} from '../src/lib/scoring';

describe('itemPoints', () => {
  it('scales reps by intensity', () => {
    expect(itemPoints('reps', 20, 'unplugged')).toBe(20);
    expect(itemPoints('reps', 20, 'amplified')).toBe(30);
    expect(itemPoints('reps', 20, 'shred')).toBe(40);
  });

  it('converts held seconds at 5s per point', () => {
    expect(itemPoints('hold', 60, 'unplugged')).toBe(12);
    expect(itemPoints('hold', 60, 'amplified')).toBe(18);
    expect(itemPoints('hold', 75, 'shred')).toBe(30);
  });

  it('refuses to score nonsense', () => {
    expect(itemPoints('reps', 0, 'shred')).toBe(0);
    expect(itemPoints('reps', -5, 'shred')).toBe(0);
    expect(itemPoints('hold', NaN, 'shred')).toBe(0);
  });
});

describe('weekKey', () => {
  it('is stable across a week and rolls on Monday', () => {
    // 2026-11-01 is a Sunday; 11-02 is the Monday that starts a new ISO week.
    const sun = weekKey(new Date('2026-11-01T18:00:00Z'));
    const mon = weekKey(new Date('2026-11-02T18:00:00Z'));
    const tue = weekKey(new Date('2026-11-03T18:00:00Z'));
    expect(mon).not.toBe(sun);
    expect(tue).toBe(mon);
  });

  it('handles the year boundary with ISO rules', () => {
    // 2027-01-01 is a Friday, so it belongs to ISO week 53 of 2026.
    expect(weekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
    expect(weekKey(new Date('2027-01-04T12:00:00Z'))).toBe('2027-W01');
  });

  it('matches the format the DB indexes on', () => {
    expect(weekKey(new Date('2026-11-01T18:00:00Z'))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('buckets by the leaderboard zone, not UTC', () => {
    // 06:00 UTC Monday is still Sunday evening in America/Chicago.
    expect(weekKey(new Date('2026-11-02T04:00:00Z'))).toBe(
      weekKey(new Date('2026-11-01T18:00:00Z')),
    );
  });
});

describe('streaks', () => {
  it('increments on consecutive days', () => {
    expect(nextStreak('2026-10-31', '2026-11-01', 4)).toBe(5);
  });
  it('does not double count the same day', () => {
    expect(nextStreak('2026-11-01', '2026-11-01', 4)).toBe(4);
  });
  it('resets after a gap', () => {
    expect(nextStreak('2026-10-28', '2026-11-01', 9)).toBe(1);
  });
  it('starts at 1 for a first ever workout', () => {
    expect(nextStreak(null, '2026-11-01', 0)).toBe(1);
  });
  it('crosses a month boundary', () => {
    expect(nextStreak('2026-10-31', '2026-11-01', 1)).toBe(2);
    expect(previousDay('2026-11-01')).toBe('2026-10-31');
  });
  it('reports a stale streak as dead', () => {
    expect(liveStreak('2026-10-20', 12, '2026-11-01')).toBe(0);
    expect(liveStreak('2026-10-31', 12, '2026-11-01')).toBe(12);
    expect(liveStreak(null, 0, '2026-11-01')).toBe(0);
  });
});

describe('ranks', () => {
  it('starts everyone as a Roadie', () => {
    expect(rankFor(0).title).toBe('Roadie');
  });
  it('climbs in order and never skips', () => {
    for (const r of RANKS) expect(rankFor(r.min).title).toBe(r.title);
    expect(rankFor(499).title).toBe('Roadie');
    expect(rankFor(500).title).toBe('Groupie');
  });
  it('tops out with no next rank', () => {
    const top = rankFor(999_999);
    expect(top.title).toBe('Hall of Fame');
    expect(top.next).toBeNull();
    expect(top.progress).toBe(1);
  });
  it('reports progress toward the next rank', () => {
    const r = rankFor(1_000);
    expect(r.next?.title).toBe('Garage Band');
    expect(r.next?.remaining).toBe(500);
    expect(r.progress).toBeCloseTo(0.5, 5);
  });
});

describe('civilDate', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(civilDate(new Date('2026-11-01T18:00:00Z'))).toBe('2026-11-01');
  });
});
