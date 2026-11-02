import type { APIRoute } from 'astro';
import { EXERCISES } from '../../data/exercises';
import photoIndex from '../../data/photos.generated.json';

/** Static catalog for the player and the offline cache. */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      EXERCISES.map((e) => ({
        slug: e.slug, real: e.real, stage: e.stage, band: e.band,
        bucket: e.bucket, mode: e.mode, perSide: !!e.perSide,
        muscles: e.muscles, cues: e.cues, rx: e.rx,
        photos: ((photoIndex as Record<string, { stem: string }[]>)[e.slug] ?? []).map((p) => p.stem),
      })),
    ),
    { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } },
  );
