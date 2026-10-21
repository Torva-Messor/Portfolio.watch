import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLocalClock } from '../js/watch/local-clock.js';

test('analog and digital teaser use one consistent visitor-local Date value', () => {
  const current = new Date(2026, 0, 1, 3, 15, 30, 500);
  const elements = new Map(['#local-clock-hour', '#local-clock-minute', '#local-clock-second', '#local-time'].map(selector => [selector, { style: {}, textContent: '', dateTime: '' }]));
  const root = { querySelector: selector => elements.get(selector) || null };
  const result = renderLocalClock(current, root);
  const closeEnough = (actual, expected) => Math.abs(actual - expected) < 1e-9;
  assert.ok(closeEnough(result.secondDegrees, 183));
  assert.ok(closeEnough(result.minuteDegrees, (15 + 30.5 / 60) * 6));
  assert.ok(closeEnough(result.hourDegrees, (3 + (15 + 30.5 / 60) / 60) * 30));
  assert.equal(elements.get('#local-clock-hour').style.transform, `rotate(${result.hourDegrees}deg)`);
  assert.equal(elements.get('#local-clock-minute').style.transform, `rotate(${result.minuteDegrees}deg)`);
  assert.equal(elements.get('#local-clock-second').style.transform, `rotate(${result.secondDegrees}deg)`);
  assert.notEqual(elements.get('#local-time').textContent, '');
  assert.equal(elements.get('#local-time').dateTime, current.toISOString());
  assert.equal(result.isoTime, current.toISOString());
});
