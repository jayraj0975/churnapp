import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import model from '../src/lib/model.json' with { type: 'json' };
import pkg from '../package.json' with { type: 'json' };

const root = new URL('../', import.meta.url).pathname;
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const source = (dir: string) => walk(join(root, dir)).filter((f) => /\.(ts|tsx)$/.test(f));

test('user-facing money labels say "billing exposure", not loss, savings or guaranteed protection', () => {
  const banned = [/expected annual loss/i, /revenue saved/i, /annual revenue saved/i, /\bProtected\b/, /revenue at hazard/i, /MRR at (risk|hazard)/i, /lifetime value/i, /discount elasticity/i];
  const offenders: string[] = [];
  for (const f of [...source('src'), ...source('tests').filter((t) => !t.endsWith('hygiene.test.ts'))]) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const b of banned) if (b.test(line)) offenders.push(`${f.replace(root, '')}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('no API key or environment access can reach the browser bundle', () => {
  const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
  assert.ok(!/GEMINI|loadEnv|process\.env|define\s*:/.test(vite), 'vite.config.ts must not inject environment values');
  const offenders = source('src')
    .filter((f) => !f.includes('/src/server/'))
    .filter((f) => /GEMINI|process\.env|import\.meta\.env\.[A-Z_]*KEY/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map((f) => f.replace(root, '')), []);
});

test('the server loads a local .env file, so the documented Gemini setup actually works', () => {
  assert.match(readFileSync(join(root, 'server.ts'), 'utf8'), /import 'dotenv\/config'/);
});

test('package metadata is meaningful and has no duplicate dependency declarations', () => {
  assert.notEqual(pkg.version, '0.0.0');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  const both = Object.keys(pkg.dependencies).filter((d) => d in pkg.devDependencies);
  assert.deepEqual(both, []);
});

test('the serving model carries provenance that matches the model file', () => {
  const p = model.provenance;
  assert.equal(p.modelVersion, model.modelVersion);
  assert.match(p.dataSha256, /^[0-9a-f]{64}$/);
  assert.equal(p.featureSchemaSha256, createHash('sha256').update(Object.keys(model.features).join('\n')).digest('hex'));
  assert.match(p.coefficientsSha256, /^[0-9a-f]{64}$/);
  assert.equal(p.dataRows, model.nTrain + model.nTest);
  assert.ok(p.sklearn && p.python && p.numpy);
});
