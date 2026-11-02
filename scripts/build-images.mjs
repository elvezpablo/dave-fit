/**
 * workouts/**\/*.JPG  →  public/ex/<slug>/<file>-{480,1080}.webp
 *
 * Also emits src/data/photos.generated.json: slug → PhotoRef[].
 *
 * Two things here are not optional:
 *   - .rotate() must come first. Most of these are EXIF-rotated 90°; the
 *     extraction markdown complains about it on nearly every photo.
 *   - metadata is stripped. These are personal iPhone photos and the JPGs
 *     carry GPS coordinates of whoever's garage this is. sharp drops EXIF
 *     unless you ask for it back — never add .withMetadata() here.
 */
import { readdir, mkdir, writeFile, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { resolveSlug } from '../src/data/photo-map.ts';
import { EXERCISES } from '../src/data/exercises.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'workouts');
const OUT = path.join(ROOT, 'public', 'ex');
const INDEX = path.join(ROOT, 'src', 'data', 'photos.generated.json');

const WIDTHS = [480, 1080];
const QUALITY = 78;
const CONCURRENCY = 8;

const KNOWN = new Set(EXERCISES.map((e) => e.slug));

async function collect() {
  const folders = (await readdir(SRC, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  const jobs = [];
  const gifs = [];
  const problems = [];

  for (const folder of folders) {
    const entries = (await readdir(path.join(SRC, folder))).sort();
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      const file = path.basename(entry, path.extname(entry));

      if (ext === '.gif') {
        gifs.push({ folder, entry, file });
        continue;
      }
      if (ext !== '.jpg' && ext !== '.jpeg') continue;

      const hit = resolveSlug(file, folder);
      if (!hit) {
        problems.push(`unmapped folder: ${folder}/${entry}`);
        continue;
      }
      if (!KNOWN.has(hit.slug)) {
        problems.push(`${folder}/${entry} → unknown slug "${hit.slug}"`);
        continue;
      }
      jobs.push({ folder, entry, file, slug: hit.slug, verified: hit.verified });
    }
  }
  return { jobs, gifs, problems };
}

async function encode(job) {
  const outDir = path.join(OUT, job.slug);
  await mkdir(outDir, { recursive: true });
  const input = path.join(SRC, job.folder, job.entry);

  for (const w of WIDTHS) {
    const dest = path.join(outDir, `${job.file}-${w}.webp`);
    if (existsSync(dest)) continue; // resumable; delete public/ex to force a rebuild
    await sharp(input)
      .rotate() // honour EXIF orientation, then discard it
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(dest);
  }
}

async function pool(items, worker, limit) {
  let cursor = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
      done++;
      if (done % 25 === 0) process.stdout.write(`  ...${done}/${items.length}\n`);
    }
  });
  await Promise.all(runners);
}

const { jobs, gifs, problems } = await collect();

if (problems.length) {
  console.error('\nPhoto mapping failed:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}

console.log(`Encoding ${jobs.length} photos × ${WIDTHS.length} sizes...`);
await pool(jobs, encode, CONCURRENCY);

// The one genuine live-photo loop in the set. Ships as-is.
for (const g of gifs) {
  const hit = resolveSlug(g.file.replace(/-ANIMATION$/, ''), g.folder);
  if (!hit || !KNOWN.has(hit.slug)) continue;
  await mkdir(path.join(OUT, hit.slug), { recursive: true });
  await copyFile(path.join(SRC, g.folder, g.entry), path.join(OUT, hit.slug, g.entry));
}
const gifStems = new Set(gifs.map((g) => `${g.folder}/${g.file.replace(/-ANIMATION$/, '')}`));

// Build the index, verified photos first so they lead the flipbook.
const index = {};
for (const job of jobs) {
  (index[job.slug] ||= []).push({
    file: job.file,
    folder: job.folder,
    stem: `${job.slug}/${job.file}`,
    verified: job.verified,
    ...(gifStems.has(`${job.folder}/${job.file}`) ? { gif: true } : {}),
  });
}
for (const slug of Object.keys(index)) {
  index[slug].sort((a, b) => Number(b.verified) - Number(a.verified) || a.file.localeCompare(b.file));
}

await writeFile(INDEX, JSON.stringify(index, null, 2) + '\n');

// Report
let bytes = 0;
let files = 0;
for (const slug of Object.keys(index)) {
  for (const p of index[slug]) {
    for (const w of WIDTHS) {
      const s = await stat(path.join(OUT, slug, `${p.file}-${w}.webp`)).catch(() => null);
      if (s) { bytes += s.size; files++; }
    }
  }
}

const empty = EXERCISES.filter((e) => !index[e.slug]?.length).map((e) => e.slug);
const verified = jobs.filter((j) => j.verified).length;

console.log(`\n  ${jobs.length} photos → ${files} webp files, ${(bytes / 1048576).toFixed(1)} MB`);
console.log(`  ${verified} verified by sidecar, ${jobs.length - verified} inherited from folder name`);
console.log(`  ${Object.keys(index).length}/${EXERCISES.length} exercises have photos`);
if (empty.length) console.log(`  no photos yet: ${empty.join(', ')}`);
console.log(`  index → src/data/photos.generated.json\n`);
