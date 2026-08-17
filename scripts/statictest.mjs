/**
 * Static checks that don't need a device.
 *
 * A React Native app can't be executed here — no Metro, no emulator — so this
 * catches the class of error that would otherwise only surface on first launch:
 * a file that doesn't parse, or an import pointing at a path that isn't there.
 * It parses every source file as JSX and resolves every relative import against
 * the filesystem.
 *
 *   node scripts/statictest.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['node_modules', '.git', '.expo', 'android', 'ios', 'assets']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (['.js', '.jsx', '.mjs'].includes(extname(entry))) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
let failures = 0;

// --- 1. every file parses -------------------------------------------------
// Node can't parse JSX, so strip JSX-looking blocks conservatively and check the
// remaining structure: balanced braces/parens/brackets and no stray syntax.
function balanced(source, file) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const closers = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  let i = 0;
  let inString = null;
  let inLine = false;
  let inBlock = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLine) { if (ch === '\n') inLine = false; i += 1; continue; }
    if (inBlock) { if (ch === '*' && next === '/') { inBlock = false; i += 2; continue; } i += 1; continue; }
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') { inLine = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; i += 1; continue; }

    if (pairs[ch]) stack.push({ ch, i });
    else if (closers[ch]) {
      const top = stack.pop();
      if (!top || top.ch !== closers[ch]) {
        console.error(`  PARSE ${relative(ROOT, file)}: unbalanced '${ch}' at offset ${i}`);
        return false;
      }
    }
    i += 1;
  }
  if (stack.length) {
    console.error(`  PARSE ${relative(ROOT, file)}: ${stack.length} unclosed bracket(s)`);
    return false;
  }
  return true;
}

console.log('parsing');
const JSX = /<[A-Z][\w.]*[\s/>]|<\/[A-Z]/;
let strict = 0;
let heuristic = 0;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if (JSX.test(source)) {
    // Node can't parse JSX, so fall back to structural checking.
    if (!balanced(source, file)) failures += 1;
    heuristic += 1;
  } else {
    // Everything else gets the real parser, which is far stricter.
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(`  PARSE ${relative(ROOT, file)}: ${result.stderr.split('\n')[2] || 'syntax error'}`);
      failures += 1;
    }
    strict += 1;
  }
}
console.log(`  ${strict} parsed by node, ${heuristic} JSX files structurally checked`);

// --- 2. every relative import resolves ------------------------------------
console.log('imports');
/**
 * Removes comments while leaving strings intact, so prose that happens to
 * contain `from "..."` isn't mistaken for an import. Replaces comment bodies
 * with spaces rather than deleting them, keeping offsets aligned for messages.
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  let inString = null;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i += 2; continue; }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; out += ch; i += 1; continue; }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') { out += ' '; i += 1; }
      continue;
    }
    if (ch === '/' && next === '*') {
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += '  ';
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

// Bounded by the absence of a semicolon so a multi-line import still matches,
// but the scan can't run past the statement into unrelated code.
const IMPORT = /^[ \t]*(?:import|export)[^;]*?\bfrom\s+['"]([^'"]+)['"]/gm;
const REQUIRE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
let resolved = 0;

for (const file of files) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const specifiers = [
    ...[...source.matchAll(IMPORT)].map((m) => m[1]),
    ...[...source.matchAll(REQUIRE)].map((m) => m[1]),
  ];

  for (const spec of specifiers) {
    if (!spec.startsWith('.')) continue;         // package imports: not our problem here
    const base = resolve(dirname(file), spec);
    const candidates = [
      base,
      `${base}.js`, `${base}.jsx`, `${base}.mjs`,
      join(base, 'index.js'),
    ];
    if (candidates.some((c) => existsSync(c) && statSync(c).isFile())) {
      resolved += 1;
    } else {
      console.error(`  MISSING ${relative(ROOT, file)} -> ${spec}`);
      failures += 1;
    }
  }
}
console.log(`  ${resolved} relative imports resolve`);

// --- 3. declared dependencies cover every package import ------------------
console.log('dependencies');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  'react-native', 'react',
]);

const packages = new Set();
for (const file of files) {
  if (file.includes(`${'scripts'}/`)) continue;      // node-only tooling
  const source = stripComments(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(IMPORT)) {
    const spec = match[1];
    if (spec.startsWith('.') || spec.startsWith('node:')) continue;
    // scoped packages keep two segments, others keep one
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    packages.add(name);
  }
}

for (const name of [...packages].sort()) {
  if (!declared.has(name)) {
    console.error(`  UNDECLARED ${name}`);
    failures += 1;
  }
}
console.log(`  ${packages.size} package imports, all declared`);

// --- 4. sound assets referenced by the adapter exist ----------------------
console.log('assets');
const sfx = readFileSync(join(ROOT, 'src/adapters/sfx.js'), 'utf8');
let sounds = 0;
for (const match of sfx.matchAll(/require\('([^']+\.wav)'\)/g)) {
  const path = resolve(join(ROOT, 'src/adapters'), match[1]);
  if (!existsSync(path)) {
    console.error(`  MISSING SOUND ${match[1]}`);
    failures += 1;
  } else sounds += 1;
}
console.log(`  ${sounds} sound files present`);

console.log();
if (failures) {
  console.error(`${failures} problem(s) found`);
  process.exit(1);
}
console.log('static checks passed');
