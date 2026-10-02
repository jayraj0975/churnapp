import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CSV_IMPORT_TEMPLATE, MAX_IMPORT_ROWS, importCustomersCsv, parseCsvRows } from '../src/lib/csv.ts';

test('parseCsvRows handles quoted fields with embedded commas and quotes', () => {
  const rows = parseCsvRows('a,b,c\n1,"hello, world",2\n3,"she said ""hi""",4\n');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['1', 'hello, world', '2'],
    ['3', 'she said "hi"', '4'],
  ]);
});

test('imports a valid row and reproduces the known-good template', () => {
  const { profiles, errors } = importCustomersCsv(CSV_IMPORT_TEMPLATE);
  assert.equal(errors.length, 0);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'Alice Johnson');
  assert.equal(profiles[0].contract, 'Month-to-month');
  assert.equal(profiles[0].techSupport, true);
  assert.equal(profiles[0].phoneService, true);
});

test('missing required column is rejected up front with a clear message', () => {
  const csv = 'name,tenure,monthlyCharges,contract,internetService\nBob,5,50,Month-to-month,DSL\n';
  const { profiles, errors } = importCustomersCsv(csv);
  assert.equal(profiles.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /paymentMethod/);
});

test('one malformed row is rejected by name without blocking the rest of the batch', () => {
  const csv =
    'id,name,tenure,monthlyCharges,contract,internetService,paymentMethod\n' +
    'C1,Good Customer,10,80,Month-to-month,Fiber optic,Electronic check\n' +
    'C2,Bad Customer,not-a-number,80,Month-to-month,Fiber optic,Electronic check\n' +
    'C3,Also Good,20,60,Two year,DSL,Mailed check\n';
  const { profiles, errors } = importCustomersCsv(csv);
  assert.equal(profiles.length, 2);
  assert.equal(profiles.map((p) => p.id).join(','), 'C1,C3');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Row 3/);
  assert.match(errors[0], /Bad Customer/);
});

test('duplicate ids in the file get a fresh generated id instead of colliding', () => {
  const csv =
    'id,name,tenure,monthlyCharges,contract,internetService,paymentMethod\n' +
    'DUP,First,10,80,Month-to-month,Fiber optic,Electronic check\n' +
    'DUP,Second,20,60,Two year,DSL,Mailed check\n';
  const { profiles, errors } = importCustomersCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(profiles.length, 2);
  assert.notEqual(profiles[0].id, profiles[1].id);
});

test('empty file is rejected with a clear message, not a crash', () => {
  const { profiles, errors } = importCustomersCsv('');
  assert.equal(profiles.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /empty/i);
});

test('oversized row count is rejected before per-row processing', () => {
  const header = 'id,name,tenure,monthlyCharges,contract,internetService,paymentMethod\n';
  const row = 'X,Name,10,80,Month-to-month,Fiber optic,Electronic check\n';
  const csv = header + row.repeat(MAX_IMPORT_ROWS + 1);
  const { profiles, errors } = importCustomersCsv(csv);
  assert.equal(profiles.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /row limit/);
});
