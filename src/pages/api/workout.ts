import type { APIRoute } from 'astro';
import { BY_SLUG, INTENSITIES, type Intensity } from '../../data/exercises';
import { itemPoints } from '../../lib/scoring';
import { recordWorkout, type SubmittedItem } from '../../lib/db';

/**
 * Accepts a finished workout. Points are recomputed here from the raw
 * rep/second counts — the client's own total is ignored, so a stale or
 * replayed offline submission can't invent a score.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const db = locals.runtime?.env?.DB;
  if (!user || !db) return json({ error: 'Not signed in.' }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }

  const id = String(body?.id ?? '');
  const intensity = String(body?.intensity ?? '') as Intensity;
  if (!/^[0-9a-f-]{16,64}$/i.test(id)) return json({ error: 'Bad workout id.' }, 400);
  if (!INTENSITIES.includes(intensity)) return json({ error: 'Bad intensity.' }, 400);
  if (!Array.isArray(body?.items) || body.items.length === 0) return json({ error: 'No tracks.' }, 400);
  if (body.items.length > 8) return json({ error: 'Too many tracks.' }, 400);

  const items: SubmittedItem[] = [];
  for (const raw of body.items) {
    const exercise = BY_SLUG.get(String(raw?.slug ?? ''));
    if (!exercise) return json({ error: `Unknown exercise: ${raw?.slug}` }, 400);

    // Clamp to something a human could plausibly have done.
    const cap = exercise.mode === 'hold' ? 3_600 : 1_000;
    const actual = Math.min(Math.max(Math.round(Number(raw?.actual) || 0), 0), cap);
    const setsDone = Math.min(Math.max(Math.round(Number(raw?.setsDone) || 0), 0), 20);
    const target = Math.min(Math.max(Math.round(Number(raw?.target) || 0), 0), cap);

    items.push({
      slug: exercise.slug,
      mode: exercise.mode,
      target,
      actual,
      setsDone,
      points: itemPoints(exercise.mode, actual, intensity),
    });
  }

  const points = items.reduce((n, i) => n + i.points, 0);
  const completedAt = Number.isFinite(Date.parse(String(body?.completedAt)))
    ? String(body.completedAt)
    : new Date().toISOString();

  const { inserted, stats } = await recordWorkout(db, user.id, {
    id, intensity, completedAt, points, items,
  });

  return json({ ok: true, inserted, points, stats });
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
