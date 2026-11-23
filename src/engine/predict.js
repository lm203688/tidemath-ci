// TideMath · deterministic harmonic prediction
import { argument, fundamental, nodeFactor } from './astro.js';
import { lookup } from './constituents.js';
import { phaseOffset } from './phaseOffsets.js';

// constituents: [[name, amplitudeMetres, phaseDegGMT, speed], ...]
// datumOffset: metres to add so heights are above the station datum (e.g. MSL->MLLW)
export function predictors(constituents) {
  const terms = [];
  let dropped = 0;
  let droppedAmp = 0;
  for (const c of constituents) {
    const def = lookup(c[0]);
    if (!def) {
      dropped += 1;
      droppedAmp += c[1];
      continue;
    }
    terms.push({
      name: c[0],
      amp: c[1],
      phase: c[2] + phaseOffset(c[0]),
      speed: c[3],
      d: def.d,
      family: def.family,
    });
  }
  return { terms, dropped, droppedAmp };
}

export function heightMetres(model, ms, datumOffset = 0) {
  const f = fundamental(ms);
  const N = f.N;
  const factors = {};
  let sum = datumOffset;
  for (const t of model.terms) {
    let fac = factors[t.family];
    if (!fac) {
      fac = nodeFactor(t.family, N);
      factors[t.family] = fac;
    }
    const V = argument(t.d, f);
    sum += fac.f * t.amp * Math.cos((V + fac.u - t.phase) * (Math.PI / 180));
  }
  return sum;
}

// convenience: sampling from an epoch with step in minutes
export function series(model, startMs, count, stepMin, datumOffset = 0) {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = heightMetres(model, startMs + i * stepMin * 60000, datumOffset);
  }
  return out;
}

function ternaryMax(fn, a, b) {
  // golden-section refinement on [a,b] (ms)
  const phi = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let x1 = hi - phi * (hi - lo);
  let x2 = lo + phi * (hi - lo);
  let f1 = fn(x1);
  let f2 = fn(x2);
  for (let i = 0; i < 40; i += 1) {
    if (f1 > f2) {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - phi * (hi - lo);
      f1 = fn(x1);
    } else {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + phi * (hi - lo);
      f2 = fn(x2);
    }
  }
  return (lo + hi) / 2;
}

// High/low extrema inside [startMs, endMs]. Sampling 10 min, then refining.
// minProminence drops the tiny shoulder wobbles that are not real high/lows (NOAA's own
// hilo list does the same): a point survives only if it stands clear of both neighbours.
export function extrema(model, startMs, endMs, datumOffset = 0, stepMin = 10, minProminence = 0.02) {
  const step = stepMin * 60000;
  const f = (ms) => heightMetres(model, ms, datumOffset);
  const points = [];
  let prev2 = f(startMs);
  let prev1 = f(startMs + step);
  for (let ms = startMs + 2 * step; ms <= endMs; ms += step) {
    const cur = f(ms);
    const slope1 = prev1 - prev2;
    const slope2 = cur - prev1;
    if (slope1 > 0 && slope2 <= 0) {
      const t = ternaryMax(f, ms - 2 * step, ms);
      points.push({ ms: Math.round(t / 6000) * 6000, h: f(t), type: 'high' });
    } else if (slope1 < 0 && slope2 >= 0) {
      const t = ternaryMax((x) => -f(x), ms - 2 * step, ms);
      points.push({ ms: Math.round(t / 6000) * 6000, h: f(t), type: 'low' });
    }
    prev2 = prev1;
    prev1 = cur;
  }
  let list = points;
  if (minProminence > 0) {
    let changed = true;
    while (changed && list.length > 2) {
      changed = false;
      for (let i = 0; i < list.length; i += 1) {
        const prev = list[i - 1];
        const next = list[i + 1];
        if (!prev || !next) continue;
        const prominence = Math.min(Math.abs(list[i].h - prev.h), Math.abs(list[i].h - next.h));
        if (prominence < minProminence) {
          list = list.slice(0, i).concat(list.slice(i + 1));
          changed = true;
          break;
        }
      }
    }
  }
  return list;
}

// Subordinate station: apply NOAA time/height offsets to the reference high/lows.
export function subordinateExtrema(refPoints, heightOffsetHigh, heightOffsetLow, timeOffsetHigh, timeOffsetLow) {
  return refPoints.map((p) => {
    const isHigh = p.type === 'high';
    const dH = isHigh ? heightOffsetHigh : heightOffsetLow;
    const dT = isHigh ? timeOffsetHigh : timeOffsetLow;
    return {
      ms: p.ms + Math.round((dT || 0) * 60000),
      h: p.h + (dH || 0),
      type: p.type,
    };
  });
}

