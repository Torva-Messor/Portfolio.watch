import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateZetaField, metricsAt, parseCSV, parseDateValue, parseNumericValue, prepareHistoricalRecords } from '../js/quant-analysis.js';

test('CSV parser handles BOM, CRLF, quoted delimiters, escaped quotes and unterminated fields', () => {
  const us = parseCSV('\uFEFFdate,close,note\r\n2026-01-01,100,"blue, chip"\r\n2026-01-02,101,"say ""yes"""\r\n');
  assert.equal(us.delimiter, ',');
  assert.equal(us.rows[1][2], 'blue, chip');
  assert.equal(us.rows[2][2], 'say "yes"');
  const eu = parseCSV('date;close;note\r\n01.02.2024;1.234,50;first\r\n02.02.2024;1.235,75;second\r\n');
  assert.equal(eu.delimiter, ';');
  assert.equal(parseNumericValue(eu.rows[1][1], eu.delimiter), 1234.5);
  assert.equal(parseNumericValue('1,234.56', ','), 1234.56);
  assert.equal(parseNumericValue('1.234', ';'), 1234);
  assert.equal(parseNumericValue('12.345.678', '\t'), 12345678);
  assert.throws(() => parseCSV('date,value\n2026-01-01,"unterminated\n2026-01-02,2\n'), /unterminated quoted field/);
});

test('date parser accepts ISO, European, year-month, and unambiguous US formats while rejecting invalid dates', () => {
  assert.equal(parseDateValue('2024-02-29'), '2024-02-29');
  assert.equal(parseDateValue('2024/02/29'), '2024-02-29');
  assert.equal(parseDateValue('2024-02'), '2024-02-01');
  assert.equal(parseDateValue('29.02.2024'), '2024-02-29');
  assert.equal(parseDateValue('02/29/2024'), '2024-02-29');
  assert.equal(parseDateValue('31.02.2024'), null);
  assert.equal(parseDateValue(''), null);
});

test('history normalization sorts values and reports missing numeric observations', () => {
  const result = prepareHistoricalRecords([
    { date: '02.02.2024', values: ['10,5'] },
    { date: '01.02.2024', values: ['10,0'] },
    { date: '03.02.2024', values: [''] }
  ], 0, ';');
  assert.deepEqual(result.observations, [
    { date: '2024-02-01', value: 10 },
    { date: '2024-02-02', value: 10.5 }
  ]);
  assert.deepEqual(result.skippedMissing, [4]);
  assert.throws(() => prepareHistoricalRecords([
    { date: '2024-01-01', values: ['1'] }, { date: '2024-01-01', values: ['2'] }
  ], 0, ','), /Duplicate observation date/);
  assert.throws(() => prepareHistoricalRecords([
    { date: 'bad-date', values: ['1'] }, { date: '2024-01-02', values: ['2'] }
  ], 0, ','), /Invalid or missing date/);
  assert.throws(() => prepareHistoricalRecords([{ date: '2024-01-01', values: ['1'] }], 0, ','), /At least two/);
});

test('rolling window uses exactly prior changes and needs a complete baseline', () => {
  const observations = [100, 102, 101, 105, 104, 110, 106, 125].map((value, index) => ({ date: `2020-${String(index + 1).padStart(2, '0')}-01`, value }));
  const field = calculateZetaField(observations, { window: 5, damping: 0 });
  assert.equal(field.series[5].baselineCount, 4);
  assert.equal(field.series[5].sufficient, false);
  assert.equal(field.series[6].baselineCount, 5);
  assert.equal(field.series[6].sufficient, true);
  assert.equal(field.series[6].change, Math.log(106 / 110) * 100);
  assert.ok(Number.isFinite(field.series[6].zScore));
  assert.equal(metricsAt(field, 6).date, observations[6].date);
});

test('future observations cannot change a historical field value', () => {
  const observations = Array.from({ length: 15 }, (_, index) => ({
    date: `2021-${String(index + 1).padStart(2, '0')}-01`,
    value: 100 * Math.exp(index * 0.001 + Math.sin(index * 1.2) * 0.04)
  }));
  const before = calculateZetaField(observations, { window: 5, damping: 0.2 });
  const revisedFuture = observations.map((row, index) => index <= 8 ? row : { ...row, value: row.value * 7 });
  const after = calculateZetaField(revisedFuture, { window: 5, damping: 0.2 });
  assert.equal(before.series[8].zeta, after.series[8].zeta);
  assert.equal(before.series[8].baselineMean, after.series[8].baselineMean);
});

test('zero-variance baseline and non-positive value series are explicitly handled', () => {
  const observations = [0, 1, 2, 3, 4, 5, 20].map((value, index) => ({ date: `2022-${String(index + 1).padStart(2, '0')}-01`, value }));
  const field = calculateZetaField(observations, { window: 5, damping: 0 });
  assert.equal(field.useLogReturns, false);
  assert.equal(field.unit, 'Δ value units');
  assert.equal(field.series[6].sufficient, true);
  assert.equal(field.series[6].zeroVariance, true);
  assert.equal(field.series[6].zeta, null);
  assert.equal(metricsAt(field, 6).hasSignal, false);
});

test('damping affects only the custom smoothed field and parameters are bounded', () => {
  const observations = [100, 101, 103, 99, 104, 102, 109, 113, 110, 120, 121, 111].map((value, index) => ({ date: `2023-${String(index + 1).padStart(2, '0')}-01`, value }));
  const noMemory = calculateZetaField(observations, { window: 3, damping: 0 });
  const memory = calculateZetaField(observations, { window: 3, damping: 0.75 });
  const validIndex = 5;
  assert.equal(noMemory.series[validIndex].zScore, memory.series[validIndex].zScore);
  assert.notEqual(noMemory.series[validIndex].zeta, memory.series[validIndex].zeta);
  const bounded = calculateZetaField(observations, { window: 3, damping: 5 });
  assert.equal(bounded.damping, 0.9);
  assert.throws(() => calculateZetaField([{ value: 1 }, { value: Number.NaN }]), /finite numbers/);
  assert.throws(() => metricsAt(memory, 100), /outside the historical series/);
});
