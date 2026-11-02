/**
 * The catalog. Hand-authored — see the plan's "path C" decision.
 *
 * Nothing in workouts/*.md carries muscle groups, coaching cues or rep ranges;
 * the only schema that asked for them (bin/analyze-workout-image.sh) was never
 * run. So every field below except the exercise *name* is written here by hand.
 *
 * `stage` is the hair-metal rename shown in the UI. `real` is always rendered
 * underneath it so nobody has to guess what they're actually doing.
 */

export type Bucket = 'push' | 'core' | 'lower' | 'mobility';
export type Mode = 'reps' | 'hold';
export type Intensity = 'unplugged' | 'amplified' | 'shred';

export const INTENSITIES: Intensity[] = ['unplugged', 'amplified', 'shred'];

export const INTENSITY_META: Record<
  Intensity,
  { label: string; blurb: string; multiplier: number }
> = {
  unplugged: { label: 'UNPLUGGED', blurb: 'Acoustic set. Easy does it.', multiplier: 1.0 },
  amplified: { label: 'AMPLIFIED', blurb: 'Club show. Bring it.', multiplier: 1.5 },
  shred: { label: 'SHRED', blurb: 'Stadium. No survivors.', multiplier: 2.0 },
};

export const BUCKET_META: Record<Bucket, { label: string; blurb: string }> = {
  push: { label: 'UPPER / PUSH', blurb: 'Chest, shoulders, arms' },
  core: { label: 'CORE', blurb: 'Abs, obliques, low back' },
  lower: { label: 'LOWER', blurb: 'Quads, glutes, hamstrings' },
  mobility: { label: 'COOLDOWN', blurb: 'Stretch and balance' },
};

/** A rep-mode prescription. `reps` is per set. */
export interface RepRx {
  sets: number;
  reps: number;
  restSec: number;
}

/** A hold-mode prescription. `seconds` is per set. */
export interface HoldRx {
  sets: number;
  seconds: number;
  restSec: number;
}

export type Rx = RepRx | HoldRx;

export const isHoldRx = (rx: Rx): rx is HoldRx => 'seconds' in rx;

export interface Exercise {
  slug: string;
  /** The honest name. Always shown as a subtitle. */
  real: string;
  /** The song title it's billed under. */
  stage: string;
  band: string;
  bucket: Bucket;
  mode: Mode;
  /** True when the rep/hold count is per side and both sides make one set. */
  perSide?: boolean;
  muscles: string[];
  cues: string[];
  rx: Record<Intensity, Rx>;
}

const reps = (s: number, r: number, rest: number): RepRx => ({ sets: s, reps: r, restSec: rest });
const hold = (s: number, sec: number, rest: number): HoldRx => ({ sets: s, seconds: sec, restSec: rest });

export const EXERCISES: Exercise[] = [
  // ─────────────────────────────── UPPER / PUSH ───────────────────────────────
  {
    slug: 'push-up',
    real: 'Push-Up',
    stage: 'Welcome to the Jungle',
    band: "Guns N' Roses",
    bucket: 'push',
    mode: 'reps',
    muscles: ['Chest', 'Triceps', 'Front delts', 'Core'],
    cues: [
      'Hands just outside the shoulders.',
      'Elbows back at 45°, not flared out wide.',
      'Squeeze the glutes — one line from heel to head.',
      'Lower until your chest is a fist off the floor.',
    ],
    rx: { unplugged: reps(2, 8, 60), amplified: reps(3, 12, 45), shred: reps(4, 20, 30) },
  },
  {
    slug: 'high-plank',
    real: 'High Plank (straight-arm)',
    stage: 'Still of the Night',
    band: 'Whitesnake',
    bucket: 'push',
    mode: 'hold',
    muscles: ['Core', 'Shoulders', 'Triceps', 'Glutes'],
    cues: [
      'Wrists stacked directly under the shoulders.',
      "Ribs down — don't let the low back sag.",
      'Push the floor away, upper back wide.',
      'Glutes and quads locked on the whole time.',
    ],
    rx: { unplugged: hold(2, 30, 45), amplified: hold(3, 45, 40), shred: hold(4, 60, 30) },
  },
  {
    slug: 'forearm-plank',
    real: 'Forearm Plank',
    stage: 'Patience',
    band: "Guns N' Roses",
    bucket: 'push',
    mode: 'hold',
    muscles: ['Deep core', 'Transverse abdominis', 'Shoulders', 'Glutes'],
    cues: [
      'Elbows under the shoulders, forearms parallel.',
      'Tuck the tailbone, flatten the low back.',
      'Pull the elbows toward your toes without moving.',
      "Breathe. Don't hold your breath and call it a hold.",
    ],
    rx: { unplugged: hold(2, 30, 45), amplified: hold(3, 45, 40), shred: hold(4, 60, 30) },
  },
  {
    slug: 'bear-crawl',
    real: 'Bear Crawl',
    stage: 'Animal',
    band: 'Def Leppard',
    bucket: 'push',
    mode: 'reps',
    muscles: ['Core', 'Shoulders', 'Quads', 'Hip flexors'],
    cues: [
      'Knees an inch off the floor. No higher.',
      'Opposite hand and foot move together.',
      "Hips stay level — don't let them rock side to side.",
      'Short steps beat long ones.',
    ],
    rx: { unplugged: reps(2, 10, 60), amplified: reps(3, 16, 45), shred: reps(4, 24, 30) },
  },
  {
    slug: 'mountain-climber',
    real: 'Mountain Climber',
    stage: 'Mountain Song',
    band: "Jane's Addiction",
    bucket: 'push',
    mode: 'reps',
    muscles: ['Core', 'Hip flexors', 'Shoulders', 'Cardio'],
    cues: [
      'Start from a tight high plank.',
      "Drive the knee to the chest — don't bounce the hips.",
      'Shoulders stay over the wrists.',
      'Both knees up counts as one rep.',
    ],
    rx: { unplugged: reps(2, 12, 45), amplified: reps(3, 20, 40), shred: reps(4, 30, 30) },
  },
  {
    slug: 'front-lever',
    real: 'Front Lever',
    stage: 'Rocket',
    band: 'Def Leppard',
    bucket: 'push',
    mode: 'hold',
    muscles: ['Lats', 'Core', 'Glutes', 'Grip'],
    cues: [
      'Pull the bar toward your hips with locked arms.',
      'Posterior pelvic tilt — rib cage down.',
      'Tuck the knees to regress it. No shame.',
      'Squeeze everything; this is a whole-body hold.',
    ],
    rx: { unplugged: hold(2, 8, 75), amplified: hold(3, 12, 60), shred: hold(4, 20, 45) },
  },
  {
    slug: 'boxing-stance',
    real: 'Boxing Stance',
    stage: 'Youth Gone Wild',
    band: 'Skid Row',
    bucket: 'push',
    mode: 'hold',
    muscles: ['Legs', 'Core', 'Shoulders'],
    cues: [
      'Lead foot forward, back heel light off the floor.',
      'Hands up at the cheekbones, elbows tucked in.',
      'Knees soft, weight on the balls of the feet.',
      "Keep bouncing — it's a stance, not a statue.",
    ],
    rx: { unplugged: hold(2, 30, 45), amplified: hold(3, 45, 40), shred: hold(4, 60, 30) },
  },

  // ─────────────────────────────────── CORE ───────────────────────────────────
  {
    slug: 'sit-up',
    real: 'Sit-Up',
    stage: 'Sister Christian',
    band: 'Night Ranger',
    bucket: 'core',
    mode: 'reps',
    muscles: ['Rectus abdominis', 'Hip flexors', 'Obliques'],
    cues: [
      'Feet flat, knees bent to about 90°.',
      'Peel the spine off the floor one vertebra at a time.',
      'Chin off the chest — leave a fist of space.',
      "Lower under control. Don't drop.",
    ],
    rx: { unplugged: reps(2, 10, 60), amplified: reps(3, 18, 45), shred: reps(4, 28, 30) },
  },
  {
    slug: 'crunch',
    real: 'Crunch',
    stage: 'Cherry Pie',
    band: 'Warrant',
    bucket: 'core',
    mode: 'reps',
    muscles: ['Upper rectus abdominis'],
    cues: [
      'Low back stays glued to the floor.',
      'Only the shoulder blades leave the ground.',
      "Hands at the temples — don't yank on your neck.",
      'Exhale hard at the top.',
    ],
    rx: { unplugged: reps(2, 12, 45), amplified: reps(3, 20, 40), shred: reps(4, 30, 30) },
  },
  {
    slug: 'reverse-crunch',
    real: 'Reverse Crunch',
    stage: 'Round and Round',
    band: 'Ratt',
    bucket: 'core',
    mode: 'reps',
    muscles: ['Lower abs', 'Hip flexors'],
    cues: [
      'Knees stacked over the hips to start.',
      "Curl the tailbone up — it's not a leg swing.",
      'Press the low back into the floor the whole time.',
      'Lower slow, three counts down.',
    ],
    rx: { unplugged: reps(2, 10, 50), amplified: reps(3, 15, 45), shred: reps(4, 24, 30) },
  },
  {
    slug: 'v-ups',
    real: 'V-Ups',
    stage: 'Alive',
    band: 'Pearl Jam',
    bucket: 'core',
    mode: 'reps',
    muscles: ['Rectus abdominis', 'Hip flexors'],
    cues: [
      'Arms overhead, legs straight to start.',
      'Fold like a jackknife, hands meet over the hips.',
      'Legs straight — bend the knees to regress.',
      "Touch down light, don't rest at the bottom.",
    ],
    rx: { unplugged: reps(2, 8, 60), amplified: reps(3, 14, 45), shred: reps(4, 22, 30) },
  },
  {
    slug: 'leg-raise',
    real: 'Leg Raise',
    stage: 'Raise Your Hands',
    band: 'Bon Jovi',
    bucket: 'core',
    mode: 'reps',
    muscles: ['Lower abs', 'Hip flexors'],
    cues: [
      'Hands under the glutes if the low back arches.',
      'Legs straight, heels pressed together.',
      'Stop lowering before the low back lifts.',
      'Pause an inch off the floor.',
    ],
    rx: { unplugged: reps(2, 10, 50), amplified: reps(3, 15, 45), shred: reps(4, 24, 30) },
  },
  {
    slug: 'dead-bug',
    real: 'Dead Bug',
    stage: 'Man in the Box',
    band: 'Alice in Chains',
    bucket: 'core',
    mode: 'reps',
    muscles: ['Deep core', 'Anti-extension'],
    cues: [
      'Arms straight up, knees in tabletop.',
      'Lower the opposite arm and leg together.',
      'Low back pinned to the floor — that is the whole exercise.',
      'Slow beats far. Stop where you lose contact.',
    ],
    rx: { unplugged: reps(2, 8, 50), amplified: reps(3, 12, 45), shred: reps(4, 20, 30) },
  },
  {
    slug: 'side-plank',
    real: 'Side Plank',
    stage: 'Wanted Dead or Alive',
    band: 'Bon Jovi',
    bucket: 'core',
    mode: 'hold',
    perSide: true,
    muscles: ['Obliques', 'Quadratus lumborum', 'Glute medius', 'Shoulder'],
    cues: [
      'Elbow under the shoulder, feet stacked.',
      'Drive the bottom hip toward the ceiling.',
      "Body in one flat plane — don't rotate forward.",
      'Per side. Both sides make one set.',
    ],
    rx: { unplugged: hold(2, 20, 45), amplified: hold(3, 30, 40), shred: hold(4, 45, 30) },
  },
  {
    slug: 'side-plank-with-reach',
    real: 'Side Plank with Reach-Through',
    stage: 'Reach Down',
    band: 'Temple of the Dog',
    bucket: 'core',
    mode: 'reps',
    perSide: true,
    muscles: ['Obliques', 'Serratus', 'Shoulder stability'],
    cues: [
      'Start from a solid side plank.',
      'Thread the top arm under the torso.',
      'Rotate from the ribs, keep the hips high.',
      'Return to a fully open T each rep.',
    ],
    rx: { unplugged: reps(2, 6, 50), amplified: reps(3, 10, 45), shred: reps(4, 16, 30) },
  },
  {
    slug: 'supine-overhead-reach',
    real: 'Supine Overhead Reach',
    stage: 'Nothingman',
    band: 'Pearl Jam',
    bucket: 'core',
    mode: 'reps',
    muscles: ['Deep core', 'Lats', 'Shoulders'],
    cues: [
      'Knees bent, feet flat, ribs pulled down.',
      'Reach the arms overhead toward the floor behind you.',
      'Stop the instant the low back arches off the floor.',
      'This trains the rib cage, not the arms.',
    ],
    rx: { unplugged: reps(2, 10, 45), amplified: reps(3, 15, 40), shred: reps(4, 22, 30) },
  },
  {
    slug: 'superman',
    real: 'Superman',
    stage: 'Blaze of Glory',
    band: 'Bon Jovi',
    bucket: 'core',
    mode: 'reps',
    muscles: ['Erector spinae', 'Glutes', 'Rear delts'],
    cues: [
      'Face down, arms and legs long.',
      'Lift the chest and the thighs at the same time.',
      "Squeeze the glutes — don't crank the neck back.",
      'Pause two counts at the top.',
    ],
    rx: { unplugged: reps(2, 10, 45), amplified: reps(3, 15, 40), shred: reps(4, 24, 30) },
  },

  // ─────────────────────────────────── LOWER ──────────────────────────────────
  {
    slug: 'bodyweight-squat',
    real: 'Bodyweight Squat',
    stage: 'Down in a Hole',
    band: 'Alice in Chains',
    bucket: 'lower',
    mode: 'reps',
    muscles: ['Quads', 'Glutes', 'Hamstrings', 'Core'],
    cues: [
      'Feet shoulder width, toes turned slightly out.',
      'Sit back and down, chest proud.',
      'Knees track out over the toes.',
      'Hips below parallel if your ankles allow it.',
    ],
    rx: { unplugged: reps(2, 12, 60), amplified: reps(3, 20, 45), shred: reps(4, 30, 30) },
  },
  {
    slug: 'sumo-squat',
    real: 'Sumo Squat (wide stance)',
    stage: 'Unskinny Bop',
    band: 'Poison',
    bucket: 'lower',
    mode: 'reps',
    muscles: ['Adductors', 'Glutes', 'Quads'],
    cues: [
      'Stance wide, toes turned out about 45°.',
      'Drop straight down between the heels.',
      'Push the knees out the entire way.',
      'Squeeze the glutes hard at the top.',
    ],
    rx: { unplugged: reps(2, 10, 60), amplified: reps(3, 18, 45), shred: reps(4, 26, 30) },
  },
  {
    slug: 'wall-sit',
    real: 'Wall Sit',
    stage: "Livin' on a Prayer",
    band: 'Bon Jovi',
    bucket: 'lower',
    mode: 'hold',
    muscles: ['Quads', 'Glutes', 'Isometric endurance'],
    cues: [
      'Back flat against the wall, thighs parallel to the floor.',
      'Knees at 90°, directly over the ankles.',
      "Weight in the heels. Hands off the thighs — that's cheating.",
      "You're halfway there. Just breathe.",
    ],
    rx: { unplugged: hold(2, 30, 60), amplified: hold(3, 45, 45), shred: hold(4, 75, 40) },
  },
  {
    slug: 'glute-bridge',
    real: 'Glute Bridge',
    stage: 'Pour Some Sugar on Me',
    band: 'Def Leppard',
    bucket: 'lower',
    mode: 'reps',
    muscles: ['Glutes', 'Hamstrings', 'Core'],
    cues: [
      'Heels pulled in close to the glutes.',
      'Drive through the heels, not the toes.',
      'Full hip extension — squeeze at the top.',
      "Ribs down; don't arch the low back to go higher.",
    ],
    rx: { unplugged: reps(2, 12, 45), amplified: reps(3, 20, 40), shred: reps(4, 30, 30) },
  },
  {
    slug: 'high-knees',
    real: 'High Knees',
    stage: "Runnin' with the Devil",
    band: 'Van Halen',
    bucket: 'lower',
    mode: 'reps',
    muscles: ['Hip flexors', 'Calves', 'Quads', 'Cardio'],
    cues: [
      'Drive the knee up to hip height.',
      'Stay up on the balls of the feet.',
      'Arms pumping, elbows at 90°.',
      'Count every time the right knee comes up.',
    ],
    rx: { unplugged: reps(2, 20, 45), amplified: reps(3, 30, 40), shred: reps(4, 50, 30) },
  },
  {
    slug: 'lunge',
    real: 'Lunge',
    stage: 'Here I Go Again',
    band: 'Whitesnake',
    bucket: 'lower',
    mode: 'reps',
    perSide: true,
    muscles: ['Quads', 'Glutes', 'Hamstrings', 'Balance'],
    cues: [
      'Step out far enough to make two 90° angles.',
      'Front knee over the ankle, not past the toes.',
      'Back knee kisses the floor.',
      'Push through the front heel to stand up.',
    ],
    rx: { unplugged: reps(2, 8, 60), amplified: reps(3, 12, 45), shred: reps(4, 20, 30) },
  },
  {
    slug: 'single-leg-balance',
    real: 'Single-Leg Balance with Side Raise',
    stage: 'Dr. Feelgood',
    band: 'Mötley Crüe',
    bucket: 'lower',
    mode: 'hold',
    perSide: true,
    muscles: ['Glute medius', 'Ankle stabilizers', 'Core'],
    cues: [
      'Stand tall, soften the standing knee.',
      'Lift the other leg straight out to the side.',
      "Hips stay level — don't hike the lifted side.",
      'Eyes on a fixed point. Close them to make it brutal.',
    ],
    rx: { unplugged: hold(2, 20, 40), amplified: hold(3, 30, 35), shred: hold(4, 45, 30) },
  },

  // ───────────────────────────── COOLDOWN / MOBILITY ──────────────────────────
  {
    slug: 'tree-pose',
    real: 'Tree Pose (Vrksasana)',
    stage: 'Even Flow',
    band: 'Pearl Jam',
    bucket: 'mobility',
    mode: 'hold',
    perSide: true,
    muscles: ['Balance', 'Hips', 'Ankles', 'Core'],
    cues: [
      'Foot to the inner calf or inner thigh — never the knee.',
      'Press the foot and leg into each other.',
      'Open the lifted knee out to the side.',
      'Hands at the heart or straight overhead.',
    ],
    rx: { unplugged: hold(1, 20, 20), amplified: hold(2, 30, 20), shred: hold(2, 45, 20) },
  },
  {
    slug: 'seated-straddle-stretch',
    real: 'Seated Straddle Stretch',
    stage: 'Wind of Change',
    band: 'Scorpions',
    bucket: 'mobility',
    mode: 'hold',
    muscles: ['Adductors', 'Hamstrings', 'Low back'],
    cues: [
      'Sit tall on the sit bones before you reach.',
      'Hinge from the hips, not the upper back.',
      'Toes pointed up to the ceiling.',
      'Breathe out and settle deeper on each exhale.',
    ],
    rx: { unplugged: hold(1, 30, 20), amplified: hold(2, 45, 20), shred: hold(2, 60, 20) },
  },
  {
    slug: 'side-split',
    real: 'Side Split (straddle)',
    stage: 'Bed of Roses',
    band: 'Bon Jovi',
    bucket: 'mobility',
    mode: 'hold',
    muscles: ['Adductors', 'Hip flexors'],
    cues: [
      'Feet turned slightly out, hands down for support.',
      'Slide out slowly — never bounce.',
      'Keep the pelvis under you, not tipped forward.',
      'Back out the moment it goes sharp.',
    ],
    rx: { unplugged: hold(1, 30, 25), amplified: hold(2, 45, 20), shred: hold(2, 60, 20) },
  },
  {
    slug: 'front-split',
    real: 'Front Split',
    stage: "Sweet Child o' Mine",
    band: "Guns N' Roses",
    bucket: 'mobility',
    mode: 'hold',
    perSide: true,
    muscles: ['Hamstrings', 'Hip flexors'],
    cues: [
      'Hips square to the front leg.',
      'Hands on blocks or the floor for support.',
      'Front foot flexed, back toe pointed.',
      'Sink on the exhale, hold on the inhale.',
    ],
    rx: { unplugged: hold(1, 30, 25), amplified: hold(2, 45, 20), shred: hold(2, 60, 20) },
  },
  {
    slug: 'supine-hamstring-stretch',
    real: 'Supine Single-Leg Hamstring Stretch',
    stage: 'Black',
    band: 'Pearl Jam',
    bucket: 'mobility',
    mode: 'hold',
    perSide: true,
    muscles: ['Hamstrings', 'Calves'],
    cues: [
      'Lie flat, opposite leg straight on the floor.',
      'Strap or hands behind the thigh, not the knee.',
      'Leg as straight as it will go without the knee bending.',
      'Keep both hips on the ground.',
    ],
    rx: { unplugged: hold(1, 30, 15), amplified: hold(2, 40, 15), shred: hold(2, 60, 15) },
  },
  {
    slug: 'hip-flexor-stretch',
    real: 'Half-Kneeling Hip Flexor Stretch',
    stage: 'Jesus Christ Pose',
    band: 'Soundgarden',
    bucket: 'mobility',
    mode: 'hold',
    perSide: true,
    muscles: ['Hip flexors', 'Quads'],
    cues: [
      'Half-kneeling, both knees at 90°.',
      'Tuck the tailbone first — that is where the stretch comes from.',
      'Squeeze the glute on the kneeling side.',
      'Reach the same-side arm overhead to deepen it.',
    ],
    rx: { unplugged: hold(1, 30, 15), amplified: hold(2, 40, 15), shred: hold(2, 60, 15) },
  },
  {
    slug: 'forward-fold',
    real: 'Standing Forward Fold',
    stage: 'Fade to Black',
    band: 'Metallica',
    bucket: 'mobility',
    mode: 'hold',
    muscles: ['Hamstrings', 'Low back', 'Calves'],
    cues: [
      'Soft bend in the knees — this is not a hamstring contest.',
      'Hinge from the hips, let the head hang heavy.',
      'Grab opposite elbows and sway.',
      'Roll up slowly or you will see stars.',
    ],
    rx: { unplugged: hold(1, 30, 15), amplified: hold(2, 40, 15), shred: hold(2, 60, 15) },
  },
  {
    slug: 'lizard-pose',
    real: 'Lizard Pose / Low Lunge',
    stage: 'Rooster',
    band: 'Alice in Chains',
    bucket: 'mobility',
    mode: 'hold',
    perSide: true,
    muscles: ['Hip flexors', 'Adductors', 'Hamstrings'],
    cues: [
      'Front foot outside the hands.',
      'Drop to the forearms if you can get there.',
      'Back leg long, top of the foot down.',
      'Let the front knee drift out to the side.',
    ],
    rx: { unplugged: hold(1, 30, 20), amplified: hold(2, 45, 20), shred: hold(2, 60, 20) },
  },
];

export const BY_SLUG: Map<string, Exercise> = new Map(EXERCISES.map((e) => [e.slug, e]));

export const byBucket = (b: Bucket): Exercise[] => EXERCISES.filter((e) => e.bucket === b);

export const getExercise = (slug: string): Exercise | undefined => BY_SLUG.get(slug);
