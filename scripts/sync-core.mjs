/**
 * Copies the game core from the web repo into ./core, and verifies it matches.
 *
 * The engine, the CPU and the three match controllers are pure JavaScript with
 * no DOM and no React — they run unchanged on both platforms. Rather than
 * maintain two copies by hand (which drift, silently, and then the mobile app
 * scores a guess differently from the website), this copies them and records a
 * hash of each.
 *
 *   node scripts/sync-core.mjs          copy from the web repo
 *   node scripts/sync-core.mjs --check  fail if they differ (used by tests)
 *
 * Set NVP_WEB to point at the web repo if it isn't the sibling directory.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('..', import.meta.url));
const WEB = process.env.NVP_WEB || join(HERE, '..', 'nvp');

// source (in the web repo) -> destination (here)
const FILES = [
  ['shared/engine.js', 'core/engine.js'],
  ['shared/daily.js', 'core/daily.js'],
  ['src/cpu.js', 'core/cpu.js'],
  ['src/match/shared.js', 'core/match/shared.js'],
  ['src/match/local.js', 'core/match/local.js'],
  ['src/match/cpu.js', 'core/match/cpu.js'],
  ['src/match/online.js', 'core/match/online.js'],
  ['src/match/daily.js', 'core/match/daily.js'],
];

/**
 * The core imports its platform services by relative path. On web those are
 * `../prefs.js` and `../sfx.js`; here they resolve to adapters with the same
 * shape. Rewriting the import specifiers is the entire porting layer — the
 * logic itself is untouched, which is what keeps the two in step.
 */
const REWRITES = [
  [/from '\.\.\/\.\.\/shared\/daily\.js'/g, "from '../daily.js'"],
  [/from '\.\/daily\.js'/g, "from './daily.js'"],
  [/from '\.\.\/\.\.\/shared\/engine\.js'/g, "from '../engine.js'"],
  [/from '\.\.\/shared\/engine\.js'/g, "from './engine.js'"],
  [/from '\.\.\/prefs\.js'/g, "from '../../src/adapters/prefs.js'"],
  [/from '\.\.\/sfx\.js'/g, "from '../../src/adapters/sfx.js'"],
  [/from '\.\.\/net\.js'/g, "from '../../src/adapters/net.js'"],
  [/from '\.\/prefs\.js'/g, "from '../src/adapters/prefs.js'"],
  [/from '\.\/cpu\.js'/g, "from './cpu.js'"],
];

const check = process.argv.includes('--check');
const banner = '// Synced from the web repo by scripts/sync-core.mjs — do not edit here.\n'
  + '// Change it in the web repo and re-run the sync, or the two will disagree.\n';

let drift = 0;

for (const [from, to] of FILES) {
  const sourcePath = join(WEB, from);
  const destPath = join(HERE, to);

  if (!existsSync(sourcePath)) {
    console.error(`missing source: ${sourcePath}`);
    console.error('Set NVP_WEB to the web repo path.');
    process.exit(1);
  }

  let code = readFileSync(sourcePath, 'utf8');
  for (const [pattern, replacement] of REWRITES) code = code.replace(pattern, replacement);
  const next = banner + code;

  if (check) {
    const current = existsSync(destPath) ? readFileSync(destPath, 'utf8') : '';
    const same = createHash('sha256').update(current).digest('hex')
      === createHash('sha256').update(next).digest('hex');
    if (!same) {
      console.error(`DRIFT: ${to} differs from ${from}`);
      drift += 1;
    }
    continue;
  }

  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, next);
  console.log(`  ${from} -> ${to}`);
}

if (check) {
  if (drift) {
    console.error(`\n${drift} file(s) out of sync. Run: node scripts/sync-core.mjs`);
    process.exit(1);
  }
  console.log('core is in sync with the web repo');
} else {
  console.log(`\nsynced ${FILES.length} files`);
}
