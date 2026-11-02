/**
 * How the 148 photos in workouts/ get attached to catalog exercises.
 *
 * Two layers, checked in order:
 *
 *   1. PHOTO_OVERRIDES — a specific IMG_xxxx file. These come from the 20
 *      per-image `.md` sidecars, which contradict their own folder names.
 *      Anything here is `verified: true`.
 *   2. FOLDER_TO_SLUG — the folder's label. Everything else falls through to
 *      this and is marked `verified: false`, because folders were named after
 *      whichever photo happened to be classified first and the rest of the
 *      burst is frequently a different movement.
 *
 * Fixing a mislabeled photo means adding one line to PHOTO_OVERRIDES.
 */

/** Folder name in workouts/ → catalog slug. All 38 folders are accounted for. */
export const FOLDER_TO_SLUG: Record<string, string> = {
  'bear-crawl': 'bear-crawl',
  'bodyweight-squat': 'bodyweight-squat',
  'bodyweight-squat-38': 'bodyweight-squat',
  'boxing-stance': 'boxing-stance',
  'crunch': 'crunch',
  'dead-bug': 'dead-bug',
  'dead-bug-32': 'dead-bug',
  'forearm-plank': 'forearm-plank',
  'front-lever': 'front-lever',
  'glute-bridge': 'glute-bridge',
  'high-knees': 'high-knees',
  'high-plank': 'high-plank',
  'leg-raise': 'leg-raise',
  'push-up': 'push-up',
  'push-up-24': 'push-up',
  'reverse-crunch': 'reverse-crunch',
  'seated-straddle-stretch': 'seated-straddle-stretch',
  'side-plank': 'side-plank',
  'side-plank-30': 'side-plank',
  'side-plank-34': 'side-plank',
  'side-plank-with-reach': 'side-plank-with-reach',
  'side-split': 'side-split',
  'sit-up': 'sit-up',
  'sit-up-33': 'sit-up',
  'sit-up-37': 'sit-up',
  'split': 'front-split',
  'superman': 'superman',
  'supine-overhead-reach-dead-bug-position': 'supine-overhead-reach',
  'supine-single-leg-hamstring-stretch': 'supine-hamstring-stretch',
  'tree-pose': 'tree-pose',
  'v-ups': 'v-ups',
  'wall-sit': 'wall-sit',
  'wall-sit-35': 'wall-sit',

  // All five generic "plank" folders describe a straight-arm plank on hands
  // and toes in their REASONING text, so they are high planks, not forearm.
  'plank': 'high-plank',
  'plank-09': 'high-plank',
  'plank-17': 'high-plank',
  'plank-19': 'high-plank',
  'plank-22': 'high-plank',
};

/**
 * Per-image corrections, all sourced from the `.md` sidecar sitting next to
 * the photo. The folder name on the left is where the file physically lives.
 */
export const PHOTO_OVERRIDES: Record<string, string> = {
  // bear-crawl/ — only the first photo is actually a bear crawl
  IMG_1673: 'bear-crawl',
  IMG_1674: 'mountain-climber',
  IMG_1675: 'lizard-pose',
  IMG_1676: 'mountain-climber',

  // bodyweight-squat/ — two of three are wide-stance
  IMG_1747: 'bodyweight-squat',
  IMG_1748: 'sumo-squat',
  IMG_1749: 'sumo-squat',

  // bodyweight-squat-38/ — four different movements in one burst
  IMG_1767: 'bodyweight-squat',
  IMG_1768: 'single-leg-balance',
  IMG_1769: 'lunge',
  IMG_1770: 'wall-sit',

  // boxing-stance/ — three of four are floor work
  IMG_1692: 'boxing-stance',
  IMG_1693: 'sit-up',
  IMG_1694: 'leg-raise',
  IMG_1695: 'side-plank',

  // crunch/ — contains no crunch at all. The sidecars are per-image and were
  // generated with the other labels in context, so they win over folder-29's
  // single-photo call of "Crunch" on IMG_1650.
  IMG_1650: 'high-plank',
  IMG_1651: 'hip-flexor-stretch',
  IMG_1652: 'dead-bug',
  IMG_1653: 'forward-fold',
  IMG_1654: 'high-plank',
};

export interface PhotoRef {
  /** Basename without extension, e.g. "IMG_1760". */
  file: string;
  /** Folder it lives in under workouts/. */
  folder: string;
  /** Path stem under public/ex — "<slug>/<file>". */
  stem: string;
  /** True only when a per-image sidecar confirmed this exercise. */
  verified: boolean;
  /** The live-photo GIF, if this frame has one. */
  gif?: boolean;
}

export type PhotoIndex = Record<string, PhotoRef[]>;

/** Resolve one photo to a slug. Returns null if the folder is unknown. */
export function resolveSlug(file: string, folder: string): { slug: string; verified: boolean } | null {
  const override = PHOTO_OVERRIDES[file];
  if (override) return { slug: override, verified: true };
  const fallback = FOLDER_TO_SLUG[folder];
  if (!fallback) return null;
  return { slug: fallback, verified: false };
}
