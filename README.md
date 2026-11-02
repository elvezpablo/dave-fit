# Appetite for Contraction

A phone-installable bodyweight workout app. Open it, get three exercises that
add up to a balanced session, pick how loud you want it, run the timer, and
climb the leaderboard. Built on the 148 garage photos in `workouts/`, dressed
as a 1989 stadium tour.

Astro 5 (SSR) → Cloudflare Workers + D1.

> **This repository must stay private.** The 148 source photos in `workouts/`
> are committed with their original EXIF, which includes GPS coordinates of
> where they were shot. That data is in git history permanently — removing it
> means rewriting history, not a follow-up commit. Don't publish or fork this
> repo. The derived WebP files under `public/ex/` that the app actually serves
> have all metadata stripped, so the deployed site leaks nothing.

---

## Deploying

```bash
npm install
npm run images          # workouts/ → public/ex/  (one time, ~40s)

npx wrangler d1 create dave-fit
#   paste the printed database_id into wrangler.jsonc
npm run db:remote       # apply schema.sql + seed the invite code
npm run deploy
```

Then add a custom domain by uncommenting `routes` in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "shred.yourdomain.com", "custom_domain": true }]
```

The shared invite code is **`SHRED1989`**, seeded by `schema.sql`. To change it:

```bash
npx wrangler d1 execute dave-fit --remote \
  --command "INSERT INTO invite_codes (code,label) VALUES ('NEWCODE','shared'); \
             UPDATE invite_codes SET active=0 WHERE code='SHRED1989'"
```

## Developing

```bash
npm run db:local        # local D1
npx wrangler dev        # http://localhost:8788
npm test                # 31 unit tests
```

## Installing on a phone

Android gets a real install prompt. **iOS does not** — it's Safari → Share →
Add to Home Screen, and only from Safari. Once installed it runs standalone and
works offline: the catalog and photos are precached, and a workout finished
with no signal queues in `localStorage` and posts itself when the network
returns.

---

## How a setlist is built

One exercise from each of three buckets — **push**, **core**, **lower** — plus
an optional **mobility** cooldown. Anything drawn in your recent sessions is
heavily penalised so you don't get Sister Christian four days running.
`swapTrack` re-rolls inside the same bucket, so the balance survives.

Points are `reps × intensity`, with a held second worth a fifth of a rep:

| | multiplier |
|---|---|
| UNPLUGGED | 1.0× |
| AMPLIFIED | 1.5× |
| SHRED | 2.0× |

Scoring is recomputed server-side in `/api/workout` from the raw counts — the
client's own total is ignored, and reps are clamped, so a replayed or edited
offline submission can't invent a score. Workout ids are client-generated, so
a retried submission is a no-op.

---

## About the photo labels

**The folder names in `workouts/` are not reliable, and the app says so.**

Folders were named after whichever photo got classified first, but a burst
usually contains several different movements. Where per-image `.md` sidecars
exist they contradict their own folder:

| Folder | What its photos actually are |
|---|---|
| `boxing-stance/` | boxing stance, **sit-up**, **leg raise**, **side plank** |
| `crunch/` | **high plank**, **hip flexor stretch**, **dead bug**, **forward fold**, high plank — no crunch |
| `bodyweight-squat-38/` | squat, **single-leg balance**, **lunge**, **wall sit** |
| `bear-crawl/` | bear crawl, **mountain climber**, **lizard pose**, mountain climber |
| `bodyweight-squat/` | squat, **sumo squat**, sumo squat |

So photos resolve in two layers (`src/data/photo-map.ts`):

1. **`PHOTO_OVERRIDES`** — a specific `IMG_xxxx`, taken from its sidecar.
   Marked `verified: true`.
2. **`FOLDER_TO_SLUG`** — the folder's label. Everything else falls through
   here as `verified: false` and renders with an **UNSORTED** badge.

20 of 148 photos are verified. The other 128 are best-effort and some are
wrong — you will occasionally see a wall lean filed under Front Lever.

**To fix one:** add a line to `PHOTO_OVERRIDES` and re-run `npm run images`.

```ts
IMG_1661: 'forward-fold',   // was inheriting front-lever from its folder
```

The exercise metadata itself — movement bucket, muscles, coaching cues, rep
and hold prescriptions — is hand-written in `src/data/exercises.ts`. None of
it came from the markdown, which only ever carried `EXERCISE` / `PERSON` /
`REASONING`.

### Exercises with no photos

`crunch` currently has none: all five photos in `crunch/` turned out to be
other movements. Photoless exercises stay browsable in `/exercises` but are
excluded from setlists — a demo you can't see is a demo you can't follow.

---

## Layout

```
src/
  data/exercises.ts          32 exercises, hand-authored
  data/photo-map.ts          folder defaults + per-image overrides
  data/photos.generated.json emitted by npm run images
  lib/setlist.ts             bucket-balanced picker
  lib/scoring.ts             points, ISO weeks, streaks, ranks
  lib/auth.ts                PBKDF2 via WebCrypto, session cookies
  lib/db.ts                  D1 queries
  lib/offline.ts             localStorage queue + flush
  styles/theme.css           the airbrush design system
scripts/build-images.mjs     sharp pipeline
schema.sql                   D1 tables + seed invite code
workouts/                    source photos — never deployed
```

### The image pipeline

`npm run images` turns 148 JPGs (115 MB, 4032×3024) into 296 WebP files
(~12 MB) at 480px and 1080px. Two things in it are not optional:

- **`.rotate()` runs first.** Most of these are EXIF-rotated 90°; without it
  half the app is sideways.
- **Metadata is stripped.** These are personal iPhone photos and the JPGs
  carry GPS coordinates of the garage they were shot in. `sharp` drops EXIF
  unless asked otherwise — never add `.withMetadata()` here.

The pipeline is resumable; delete `public/ex/` to force a full rebuild.
