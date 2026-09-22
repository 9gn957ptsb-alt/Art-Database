#!/usr/bin/env node
/**
 * Bake dirt to PNG files so a website can use them as plain images, no JavaScript needed.
 *
 *   node dirt/bake.mjs                                  # every preset, 512px tiles → dirt/out/
 *   node dirt/bake.mjs --preset potting-soil --size 1024 --seed 42
 *   node dirt/bake.mjs --preset cellar-grime --width 1600 --height 1000
 *   node dirt/bake.mjs --config my-dirt.json            # a JSON file with the generateDirt options
 *   node dirt/bake.mjs --base '#efe9df'                 # flatten onto a colour to preview
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDirt, PRESETS } from './dirt.js';
import { encodePNG } from './png.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

function bake(name, options, outDir) {
  const t0 = Date.now();
  const img = generateDirt(options);
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, encodePNG(img));
  console.log(`${file}  ${img.width}×${img.height}  ${Date.now() - t0}ms`);
}

const args = parseArgs(process.argv.slice(2));
const outDir = args.out || join(here, 'out');
mkdirSync(outDir, { recursive: true });

const size = Number(args.size || 512);
const common = {
  width: Number(args.width || size),
  height: Number(args.height || size),
  seed: Number(args.seed || 1),
  ...(args.base ? { base: args.base } : {}),
  ...(args.amount ? { amount: Number(args.amount) } : {}),
};

if (args.config) {
  const cfg = JSON.parse(readFileSync(args.config, 'utf8'));
  bake(args.name || 'custom', { ...common, ...cfg }, outDir);
} else {
  const names = args.preset ? [args.preset] : Object.keys(PRESETS);
  for (const name of names) {
    const preset = PRESETS[name];
    if (!preset) {
      console.error(`Unknown preset "${name}". Available: ${Object.keys(PRESETS).join(', ')}`);
      process.exit(1);
    }
    bake(name, { ...common, ...preset, ...(args.tile ? { tile: args.tile !== 'false' } : {}) }, outDir);
  }
}
