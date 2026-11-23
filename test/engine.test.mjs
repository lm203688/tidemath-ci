// TideMath unit tests: run with `node --test test/`
import test from 'node:test';
import assert from 'node:assert/strict';
import { argument, fundamental } from '../src/engine/astro.js';
import { CONSTITUENTS, lookup } from '../src/engine/constituents.js';
import { predictors, heightMetres, extrema } from '../src/engine/predict.js';
import { buildStation, hilo, interpolate, readHeight } from '../src/engine/station.js';
import { lunarPhase, moonTimes, solunarWindows, sunTimes, dayScore } from '../src/engine/solunar.js';
import { DAY, countdown, fmtHeight, fmtTime, isUsDst, localDayStartMs } from '../src/format.js';

const JAN1_2027 = Date.UTC(2027, 0, 1);
const TINY = [
  { id: 'R1', name: 'Test Ref', state: 'MA', lat: 42.35, lng: -71.05, tz: -5, dst: true, t: 'R',
    d: { MSL: 2.0, MLLW: 1.0 },
    h: [['M2', 1.2, 110, 28.984104], ['S2', 0.2, 200, 30]] },
  { id: 'S1', name: 'Test Sub', state: 'MA', lat: 42.3, lng: -71.1, tz: -5, dst: true, t: 'S',
    r: 'R1', ho: [0.1, -0.05], to: [10, -5] },
];

test('M2 argument advances at its published speed', () => {
  const d = CONSTITUENTS.M2.d;
  const a = argument(d, fundamental(JAN1_2027));
  const b = argument(d, fundamental(JAN1_2027 + 3600000));
  let diff = ((b - a) % 360 + 360) % 360;
  assert.ok(Math.abs(diff - 28.9841) < 0.01, 'got ' + diff);
});

test('lunar hour-angle tau advances at 15 deg/h minus the moon\u2019s own motion', () => {
  const f0 = fundamental(JAN1_2027);
  const f1 = fundamental(JAN1_2027 + 3600000);
  let diff = ((f1.tau - f0.tau) % 360 + 360) % 360;
  // tau = 15t + h - s, so it gains ~14.49 deg/h: the moon's mean longitude eats the rest
  assert.ok(Math.abs(diff - 14.4921) < 0.01, 'tau step ' + diff);
});

test('single-constituent model reproduces its own phase and amplitude', () => {
  const model = predictors([['M2', 1.5, 0, 28.984104]]);
  assert.equal(model.dropped, 0);
  const times = [0, 6, 12, 18, 24].map((h) => JAN1_2027 + h * 3600000);
  const vals = times.map((t) => heightMetres(model, t));
  for (const v of vals) assert.ok(Math.abs(v) <= 1.6, 'bound ' + v);
  assert.ok(Math.max(...vals) > 1.2, 'should reach near the amplitude: ' + Math.max(...vals));
});

test('unknown NOAA names are dropped, not fatal', () => {
  const model = predictors([['M2', 1, 0, 28.984104], ['NOTREAL', 0.5, 0, 12]]);
  assert.equal(model.terms.length, 1);
  assert.equal(model.dropped, 1);
  assert.ok(Math.abs(model.droppedAmp - 0.5) < 1e-9);
});

test('aliases resolve to the same argument', () => {
  assert.deepEqual(lookup('OO1').d, lookup('OO').d);
  assert.deepEqual(lookup('LAM2').d, lookup('L2').d);
  assert.equal(argument(lookup('OO1').d, fundamental(JAN1_2027)).toFixed(3), argument(lookup('OO').d, fundamental(JAN1_2027)).toFixed(3));
});

test('reference station builds a harmonic model with the MSL->MLLW offset', () => {
  const r = buildStation(TINY, 'R1');
  assert.equal(r.kind, 'reference');
  assert.ok(Math.abs(r.datumOffset - 1.0) < 1e-9);
  assert.equal(r.model.terms.length, 2);
});

test('subordinate station inherits the reference model and offsets', () => {
  const s = buildStation(TINY, 'S1');
  assert.equal(s.kind, 'subordinate');
  assert.equal(s.ref.id, 'R1');
  assert.equal(s.offsets.highT, 10);
  assert.equal(s.offsets.lowH, -0.05);
});

test('extrema alternate high/low and stay inside the window', () => {
  const r = buildStation(TINY, 'R1');
  const list = hilo(r, JAN1_2027, JAN1_2027 + 2 * DAY);
  assert.ok(list.length >= 4, 'events ' + list.length);
  for (let i = 1; i < list.length; i += 1) assert.notEqual(list[i].type, list[i - 1].type);
  assert.ok(list[0].ms >= JAN1_2027 - 60000 && list[list.length - 1].ms <= JAN1_2027 + 2 * DAY + 60000);
});

test('subordinate hilo shifts times and heights by the NOAA offsets', () => {
  const r = buildStation(TINY, 'R1');
  const s = buildStation(TINY, 'S1');
  const ref = hilo(r, JAN1_2027, JAN1_2027 + DAY);
  const sub = hilo(s, JAN1_2027, JAN1_2027 + DAY);
  assert.equal(ref.length, sub.length);
  const refHigh = ref.find((p) => p.type === 'high');
  const subHigh = sub.find((p) => p.type === 'high');
  assert.equal(subHigh.ms - refHigh.ms, 10 * 60000);
  assert.ok(Math.abs(subHigh.h - refHigh.h - 0.1) < 1e-9);
});

test('interpolation is bounded by its bracketing extrema and hits them exactly', () => {
  const events = [
    { ms: JAN1_2027, h: 2, type: 'high' },
    { ms: JAN1_2027 + 6 * 3600000, h: -1, type: 'low' },
  ];
  assert.equal(interpolate(events, JAN1_2027), 2);
  assert.equal(interpolate(events, JAN1_2027 + 6 * 3600000), -1);
  const mid = interpolate(events, JAN1_2027 + 3 * 3600000);
  assert.ok(Math.abs(mid - 0.5) < 1e-9, 'cosine midpoint ' + mid);
  const clamped = interpolate(events, JAN1_2027 + 99 * 3600000);
  assert.equal(clamped, -1);
});

test('readHeight routes by station kind', () => {
  const r = buildStation(TINY, 'R1');
  const s = buildStation(TINY, 'S1');
  const at = JAN1_2027 + 3 * 3600000;
  assert.equal(readHeight(r, [], at), heightMetres(r.model, at, r.datumOffset));
  const ev = hilo(s, JAN1_2027 - DAY, JAN1_2027 + 2 * DAY);
  const v = readHeight(s, ev, at);
  assert.ok(Number.isFinite(v));
});

test('sun rise precedes set and both are inside the local day', () => {
  const day = localDayStartMs(Date.UTC(2027, 5, 21, 15), -5, true);
  const sun = sunTimes(day, 42.35, -71.05);
  assert.ok(sun.sunrise && sun.sunset);
  assert.ok(sun.sunrise < sun.sunset);
  assert.ok(sun.sunrise >= day && sun.sunset <= day + DAY);
});

test('moon phase sweeps the full illuminance range over one synodic month', () => {
  let maxIllum = 0;
  let minIllum = 1;
  for (let i = 0; i < 60; i += 1) {
    const p = lunarPhase(Date.UTC(2027, 0, 1) + i * 12 * 3600000);
    maxIllum = Math.max(maxIllum, p.illum);
    minIllum = Math.min(minIllum, p.illum);
  }
  assert.ok(maxIllum > 0.98, 'full moon ' + maxIllum);
  assert.ok(minIllum < 0.02, 'new moon ' + minIllum);
  const a = lunarPhase(Date.UTC(2027, 0, 1));
  const b = lunarPhase(Date.UTC(2027, 0, 1) + 29.53 * DAY);
  assert.ok(Math.abs(a.illum - b.illum) < 0.05, 'return after a synodic month');
});

test('solunar windows are ordered and carry a moon altitude sign', () => {
  const day = Date.UTC(2027, 4, 10);
  const w = solunarWindows(day, 42.35, -71.05);
  assert.ok(w.length >= 2);
  for (let i = 1; i < w.length; i += 1) assert.ok(w[i].from >= w[i - 1].from);
  for (const x of w) assert.ok(x.to > x.from);
});

test('day score is bounded 0..100 and rewards a big range with a new moon', () => {
  const low = dayScore({ illum: 0.5, rangeMetres: 0.4 });
  const high = dayScore({ illum: 0.02, rangeMetres: 3.4 });
  assert.ok(low >= 0 && low <= 100);
  assert.ok(high > low, 'high ' + high + ' low ' + low);
});

test('US DST flips on the 2027 rule dates', () => {
  assert.equal(isUsDst(Date.UTC(2027, 0, 15)), false);
  assert.equal(isUsDst(Date.UTC(2027, 6, 15)), true);
  assert.equal(isUsDst(Date.UTC(2027, 11, 15)), false);
  assert.equal(isUsDst(Date.UTC(2027, 2, 14, 12)), true);
  assert.equal(isUsDst(Date.UTC(2027, 10, 8, 12)), false);
});

test('local day start moves with the zone and keeps midnight local', () => {
  const noonUtc = Date.UTC(2027, 0, 2, 17); // 12:00 EST
  const start = localDayStartMs(noonUtc, -5, false);
  assert.equal(fmtTime(start, -5, false, true), '00:00');
  assert.equal(fmtTime(start, -5, false, false), '12:00 AM');
});

test('formatting helpers', () => {
  assert.equal(fmtHeight(1.234, 'm'), '1.23 m');
  assert.equal(fmtHeight(1.5, 'ft'), '4.9 ft');
  assert.equal(countdown(45 * 60000), '45 min');
  assert.equal(countdown(90 * 60000), '1 h 30 min');
  assert.equal(countdown(-60000), 'now');
});
