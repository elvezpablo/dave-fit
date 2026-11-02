/**
 * Client-side submission with an offline queue.
 *
 * The whole point of baking the catalog and photos into the app is that you
 * can train in a garage with no signal. Results are held in localStorage and
 * flushed when the network comes back. Workout ids are client-generated, so
 * a replayed submission is a no-op server-side.
 */

const QUEUE = 'afc:queue';

export interface PendingWorkout {
  id: string;
  intensity: string;
  completedAt: string;
  items: { slug: string; actual: number; setsDone: number; target: number }[];
}

const read = (): PendingWorkout[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE) ?? '[]');
  } catch {
    return [];
  }
};

const write = (q: PendingWorkout[]) => localStorage.setItem(QUEUE, JSON.stringify(q.slice(-25)));

export const pendingCount = (): number => read().length;

async function post(w: PendingWorkout): Promise<boolean> {
  const res = await fetch('/api/workout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(w),
  });
  // 4xx means the server will never accept it — drop it rather than retry forever.
  if (res.status >= 400 && res.status < 500 && res.status !== 408) return true;
  return res.ok;
}

/** Returns true if it landed, false if it was queued for later. */
export async function submitWorkout(w: PendingWorkout): Promise<boolean> {
  try {
    if (await post(w)) return true;
  } catch { /* offline */ }
  write([...read().filter((q) => q.id !== w.id), w]);
  return false;
}

export async function flushQueue(): Promise<number> {
  const q = read();
  if (!q.length || !navigator.onLine) return q.length;

  const left: PendingWorkout[] = [];
  for (const w of q) {
    try {
      if (!(await post(w))) left.push(w);
    } catch {
      left.push(w);
    }
  }
  write(left);
  return left.length;
}

/** Slugs from recent sessions, newest first — feeds setlist variety offline. */
export function rememberSlugs(slugs: string[]) {
  const prev: string[] = JSON.parse(localStorage.getItem('afc:recent') ?? '[]');
  localStorage.setItem('afc:recent', JSON.stringify([...slugs, ...prev].slice(0, 18)));
}
