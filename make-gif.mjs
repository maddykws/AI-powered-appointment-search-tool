// make-gif.mjs — stitch PNG frames into animated GIF
import GIFEncoder from 'gif-encoder-2';
import sharp from 'sharp';
import { existsSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FRAMES = [
  { file: 'frame-01-landing.png',    delay: 2000 }, // 2s — agent selection
  { file: 'frame-02-connecting.png', delay: 1500 }, // 1.5s — connecting
  { file: 'frame-03-in-call.png',    delay: 3000 }, // 3s — Aria speaking
  { file: 'frame-04-ended.png',      delay: 2000 }, // 2s — switch to Max
  { file: 'frame-05-max.png',        delay: 3000 }, // 3s — Max + post-call
];

const OUTPUT = join(__dirname, 'demo.gif');
const WIDTH  = 960;
const HEIGHT = 540;

console.log('Building demo.gif...');

const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', true);
encoder.setQuality(12);
encoder.setRepeat(0); // loop forever

// Create read stream and pipe to file BEFORE start()
const ws = createWriteStream(OUTPUT);
encoder.createReadStream().pipe(ws);
const done = new Promise((res, rej) => { ws.on('finish', res); ws.on('error', rej); });

encoder.start();

for (const { file, delay } of FRAMES) {
  const paths = [
    join(__dirname, file),
    `C:/Users/madha/Documents/career-ops/.claude/worktrees/beautiful-curran/${file}`,
  ];
  const src = paths.find(p => existsSync(p));
  if (!src) { console.warn(`  SKIP ${file} — not found`); continue; }

  const { data } = await sharp(src)
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  encoder.setDelay(delay);
  encoder.addFrame(data);
  console.log(`  + ${file} (${delay}ms)`);
}

encoder.finish();
await done;
console.log(`\nSaved → ${OUTPUT}`);
