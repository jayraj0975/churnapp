import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * Guard against a mistake this app used to make: impact figures typed into the UI as if a
 * model had produced them. Any effect on churn shown to a user must be computed.
 */
test('no hard-coded "N% risk" claims in the UI source', () => {
  const dir = new URL('../src/components/', import.meta.url);
  const offenders: string[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
    readFileSync(new URL(f, dir), 'utf8').split('\n').forEach((line, i) => {
      if (/[-+−]\s?\d+(\.\d+)?%\s*(risk|churn)/i.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], 'hard-coded impact claims found:\n' + offenders.join('\n'));
});
