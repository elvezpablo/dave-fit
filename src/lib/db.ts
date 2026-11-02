import type { Intensity } from '../data/exercises';
import { civilDate, weekKey, nextStreak, liveStreak, rankFor, type Rank } from './scoring';

export interface UserRow {
  id: string;
  handle: string;
  handle_lower: string;
  password_hash: string;
  salt: string;
  created_at: string;
}

export interface StatsRow {
  user_id: string;
  lifetime_points: number;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string | null;
  workout_count: number;
}

export interface SessionUser {
  id: string;
  handle: string;
  stats: StatsRow;
  rank: Rank;
  streak: number;
}

export interface SubmittedItem {
  slug: string;
  mode: 'reps' | 'hold';
  target: number;
  actual: number;
  setsDone: number;
  points: number;
}

export interface SubmittedWorkout {
  id: string;
  intensity: Intensity;
  completedAt: string;
  points: number;
  items: SubmittedItem[];
}

export interface BoardRow {
  user_id: string;
  handle: string;
  points: number;
  workouts: number;
  streak: number;
  rank: string;
}

// ───────────────────────────────── sessions ─────────────────────────────────

export async function userFromToken(db: D1Database, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.handle, s.expires_at,
              st.lifetime_points, st.current_streak, st.longest_streak,
              st.last_workout_date, st.workout_count
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN user_stats st ON st.user_id = u.id
        WHERE s.token = ?`,
    )
    .bind(token)
    .first<Record<string, unknown>>();

  if (!row) return null;
  if (new Date(String(row.expires_at)) < new Date()) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }

  const stats: StatsRow = {
    user_id: String(row.id),
    lifetime_points: Number(row.lifetime_points ?? 0),
    current_streak: Number(row.current_streak ?? 0),
    longest_streak: Number(row.longest_streak ?? 0),
    last_workout_date: (row.last_workout_date as string | null) ?? null,
    workout_count: Number(row.workout_count ?? 0),
  };

  return {
    id: String(row.id),
    handle: String(row.handle),
    stats,
    rank: rankFor(stats.lifetime_points),
    streak: liveStreak(stats.last_workout_date, stats.current_streak, civilDate()),
  };
}

export async function createSession(db: D1Database, userId: string, token: string, days: number) {
  const now = new Date();
  const expires = new Date(now.getTime() + days * 86_400_000);
  await db
    .prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, now.toISOString(), expires.toISOString())
    .run();
}

export const destroySession = (db: D1Database, token: string) =>
  db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();

// ────────────────────────────────── users ───────────────────────────────────

export const findUserByHandle = (db: D1Database, handle: string) =>
  db
    .prepare('SELECT * FROM users WHERE handle_lower = ?')
    .bind(handle.toLowerCase())
    .first<UserRow>();

export async function createUser(
  db: D1Database,
  opts: { handle: string; hash: string; salt: string },
): Promise<string> {
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, handle, handle_lower, password_hash, salt, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, opts.handle, opts.handle.toLowerCase(), opts.hash, opts.salt, new Date().toISOString()),
    db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').bind(id),
  ]);
  return id;
}

/** Checks and burns one use of an invite code. Returns false if it's spent. */
export async function redeemInvite(db: D1Database, code: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT code, uses, max_uses, active FROM invite_codes WHERE code = ?')
    .bind(code.trim().toUpperCase())
    .first<{ code: string; uses: number; max_uses: number | null; active: number }>();

  if (!row || !row.active) return false;
  if (row.max_uses !== null && row.uses >= row.max_uses) return false;

  await db.prepare('UPDATE invite_codes SET uses = uses + 1 WHERE code = ?').bind(row.code).run();
  return true;
}

// ───────────────────────────────── workouts ─────────────────────────────────

/**
 * Idempotent: the workout id is generated on the client, so an offline
 * submission that gets retried lands once. Returns false if it was a replay.
 */
export async function recordWorkout(
  db: D1Database,
  userId: string,
  w: SubmittedWorkout,
): Promise<{ inserted: boolean; stats: StatsRow }> {
  const existing = await db.prepare('SELECT id FROM workouts WHERE id = ?').bind(w.id).first();

  if (!existing) {
    const completed = new Date(w.completedAt);
    const localDate = civilDate(completed);

    const prior =
      (await db.prepare('SELECT * FROM user_stats WHERE user_id = ?').bind(userId).first<StatsRow>()) ??
      ({
        user_id: userId,
        lifetime_points: 0,
        current_streak: 0,
        longest_streak: 0,
        last_workout_date: null,
        workout_count: 0,
      } satisfies StatsRow);

    const streak = nextStreak(prior.last_workout_date, localDate, prior.current_streak);

    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO workouts (id, user_id, completed_at, local_date, week_key, intensity, points)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(w.id, userId, completed.toISOString(), localDate, weekKey(completed), w.intensity, w.points),
    ];

    w.items.forEach((item, i) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO workout_items
               (id, workout_id, slug, position, mode, target, actual, sets_done, points)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), w.id, item.slug, i, item.mode, item.target, item.actual, item.setsDone, item.points),
      );
    });

    statements.push(
      db
        .prepare(
          `UPDATE user_stats
              SET lifetime_points   = lifetime_points + ?,
                  workout_count     = workout_count + 1,
                  current_streak    = ?,
                  longest_streak    = MAX(longest_streak, ?),
                  last_workout_date = ?
            WHERE user_id = ?`,
        )
        .bind(w.points, streak, streak, localDate, userId),
    );

    await db.batch(statements);
  }

  const stats = await db.prepare('SELECT * FROM user_stats WHERE user_id = ?').bind(userId).first<StatsRow>();
  return { inserted: !existing, stats: stats! };
}

export const recentSlugs = async (db: D1Database, userId: string, limit = 12): Promise<string[]> => {
  const { results } = await db
    .prepare(
      `SELECT i.slug
         FROM workout_items i
         JOIN workouts w ON w.id = i.workout_id
        WHERE w.user_id = ?
        ORDER BY w.completed_at DESC, i.position ASC
        LIMIT ?`,
    )
    .bind(userId, limit)
    .all<{ slug: string }>();
  return results.map((r) => r.slug);
};

export const workoutHistory = async (db: D1Database, userId: string, limit = 30) => {
  const { results } = await db
    .prepare(
      `SELECT w.id, w.completed_at, w.local_date, w.intensity, w.points,
              GROUP_CONCAT(i.slug) AS slugs
         FROM workouts w
         LEFT JOIN workout_items i ON i.workout_id = w.id
        WHERE w.user_id = ?
        GROUP BY w.id
        ORDER BY w.completed_at DESC
        LIMIT ?`,
    )
    .bind(userId, limit)
    .all<{ id: string; completed_at: string; local_date: string; intensity: Intensity; points: number; slugs: string | null }>();
  return results.map((r) => ({ ...r, slugs: r.slugs ? r.slugs.split(',') : [] }));
};

// ──────────────────────────────── leaderboard ───────────────────────────────

export type BoardMode = 'week' | 'all' | 'streak';

export async function leaderboard(db: D1Database, mode: BoardMode, limit = 50): Promise<BoardRow[]> {
  const today = civilDate();

  if (mode === 'week') {
    const { results } = await db
      .prepare(
        `SELECT u.id AS user_id, u.handle,
                COALESCE(SUM(w.points), 0) AS points,
                COUNT(w.id) AS workouts,
                st.lifetime_points, st.current_streak, st.last_workout_date
           FROM users u
           LEFT JOIN user_stats st ON st.user_id = u.id
           LEFT JOIN workouts w ON w.user_id = u.id AND w.week_key = ?
          GROUP BY u.id
         HAVING points > 0
          ORDER BY points DESC, workouts DESC, u.handle ASC
          LIMIT ?`,
      )
      .bind(weekKey(), limit)
      .all<Record<string, unknown>>();
    return results.map(shape(today));
  }

  const order = mode === 'streak' ? 'st.current_streak DESC, st.lifetime_points DESC' : 'st.lifetime_points DESC';
  const { results } = await db
    .prepare(
      `SELECT u.id AS user_id, u.handle,
              st.lifetime_points AS points, st.workout_count AS workouts,
              st.lifetime_points, st.current_streak, st.last_workout_date
         FROM users u
         JOIN user_stats st ON st.user_id = u.id
        WHERE st.workout_count > 0
        ORDER BY ${order}, u.handle ASC
        LIMIT ?`,
    )
    .bind(limit)
    .all<Record<string, unknown>>();

  const rows = results.map(shape(today));
  // A stale streak is zero; re-sort so the board doesn't rank dead streaks.
  if (mode === 'streak') rows.sort((a, b) => b.streak - a.streak || b.points - a.points);
  return rows;
}

const shape = (today: string) => (r: Record<string, unknown>): BoardRow => ({
  user_id: String(r.user_id),
  handle: String(r.handle),
  points: Number(r.points ?? 0),
  workouts: Number(r.workouts ?? 0),
  streak: liveStreak((r.last_workout_date as string | null) ?? null, Number(r.current_streak ?? 0), today),
  rank: rankFor(Number(r.lifetime_points ?? 0)).title,
});
