// TideMath · sun/moon derived windows (sunrise, sunset, moon phase, solunar periods)
import { RAD, moonPosition, sunPosition, gmst, hourAngle, altitude } from './astro.js';

const norm360 = (x) => ((x % 360) + 360) % 360;

function bodyAt(ms, which) {
  return which === 'moon' ? moonPosition(ms) : sunPosition(ms);
}

// Hour angle (deg, 0..360, positive west) of the body at longitude lngEast.
function H(ms, lngEast, which) {
  const p = bodyAt(ms, which);
  return norm360(gmst(ms) + lngEast - p.ra);
}

function altitudeAt(ms, lat, lngEast, which) {
  const p = bodyAt(ms, which);
  return altitude(H(ms, lngEast, which), p.dec, lat);
}

// Lunar meridian transits inside [ms, ms+span]. sin(H) is zero both at upper transit
// (H = 0, cos(H) > 0) and at lower transit (H = 180, cos(H) < 0) and changes sign at each,
// so one scan finds both without any wrap-around bookkeeping.
function transitTimes(ms, lngEast, hoursSpan = 24) {
  const stepMs = 10 * 60000;
  const end = ms + hoursSpan * 3600000;
  const g = (t) => Math.sin(H(t, lngEast, 'moon') * RAD);
  const out = [];
  let prev = g(ms);
  for (let t = ms + stepMs; t <= end; t += stepMs) {
    const cur = g(t);
    if (prev === 0 || Math.sign(prev) !== Math.sign(cur)) {
      let lo = t - stepMs;
      let hi = t;
      for (let i = 0; i < 26; i += 1) {
        const mid = (lo + hi) / 2;
        if (Math.sign(g(lo)) === Math.sign(g(mid))) lo = mid;
        else hi = mid;
      }
      const t0 = Math.round((lo + hi) / 2 / 60000) * 60000;
      const cosH = Math.cos(H(t0, lngEast, 'moon') * RAD);
      if (!out.length || t0 - out[out.length - 1].ms > 3600000) {
        out.push({ ms: t0, upper: cosH > 0 });
      }
    }
    prev = cur;
  }
  return out;
}

export function moonTransits(dayStartMs, lat, lngEast) {
  const all = transitTimes(dayStartMs, lngEast);
  return {
    upper: all.filter((w) => w.upper).map((w) => w.ms),
    lower: all.filter((w) => !w.upper).map((w) => w.ms),
  };
}

// Altitude crossings (rise/set) for a body, threshold in degrees.
function altitudeCrossings(dayStartMs, lat, lngEast, which, threshold) {
  const stepMs = 10 * 60000;
  const end = dayStartMs + 24 * 3600000;
  const out = [];
  let prev = altitudeAt(dayStartMs, lat, lngEast, which) - threshold;
  for (let t = dayStartMs + stepMs; t <= end; t += stepMs) {
    const cur = altitudeAt(t, lat, lngEast, which) - threshold;
    if (Math.sign(prev) !== Math.sign(cur)) {
      let lo = t - stepMs;
      let hi = t;
      const f = (x) => altitudeAt(x, lat, lngEast, which) - threshold;
      for (let i = 0; i < 24; i += 1) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(lo)) === Math.sign(f(mid))) lo = mid;
        else hi = mid;
      }
      const t0 = Math.round((lo + hi) / 2 / 60000) * 60000;
      out.push({ ms: t0, rising: cur > prev });
    }
    prev = cur;
  }
  return out;
}

export function sunTimes(dayStartMs, lat, lngEast) {
  const c = altitudeCrossings(dayStartMs, lat, lngEast, 'sun', -0.833);
  const rise = c.find((x) => x.rising);
  const set = c.find((x) => !x.rising);
  return { sunrise: rise ? rise.ms : null, sunset: set ? set.ms : null };
}

export function moonTimes(dayStartMs, lat, lngEast) {
  const c = altitudeCrossings(dayStartMs, lat, lngEast, 'moon', 0.125);
  const rise = c.find((x) => x.rising);
  const set = c.find((x) => !x.rising);
  return { moonrise: rise ? rise.ms : null, moonset: set ? set.ms : null };
}

export function lunarPhase(ms) {
  const sun = sunPosition(ms);
  const moon = moonPosition(ms);
  const elong = norm360(moon.lon - sun.lon);
  const illum = (1 - Math.cos(elong * RAD)) / 2;
  let name = 'New moon';
  if (elong >= 22.5 && elong < 67.5) name = 'Waxing crescent';
  else if (elong >= 67.5 && elong < 112.5) name = 'First quarter';
  else if (elong >= 112.5 && elong < 157.5) name = 'Waxing gibbous';
  else if (elong >= 157.5 && elong < 202.5) name = 'Full moon';
  else if (elong >= 202.5 && elong < 247.5) name = 'Waning gibbous';
  else if (elong >= 247.5 && elong < 292.5) name = 'Last quarter';
  else if (elong >= 292.5 && elong < 337.5) name = 'Waning crescent';
  return { elong, illum, name };
}

// Solunar feeding windows: major = ±60 min around lunar transits, minor = ±45 min around moonrise/set.
// Overlapping windows are merged and keep the stronger (major) label.
export function solunarWindows(dayStartMs, lat, lngEast) {
  const { upper, lower } = moonTransits(dayStartMs, lat, lngEast);
  const { moonrise, moonset } = moonTimes(dayStartMs, lat, lngEast);
  const seeds = [];
  for (const t of upper) seeds.push({ ms: t, type: 'major', label: 'Moon overhead' });
  for (const t of lower) seeds.push({ ms: t, type: 'major', label: 'Moon underfoot' });
  if (moonrise) seeds.push({ ms: moonrise, type: 'minor', label: 'Moonrise' });
  if (moonset) seeds.push({ ms: moonset, type: 'minor', label: 'Moonset' });
  const pad = (w) => (w.type === 'major' ? 60 : 45) * 60000;
  const list = seeds
    .sort((a, b) => a.ms - b.ms)
    .map((w) => ({ ...w, from: w.ms - pad(w), to: w.ms + pad(w) }));
  const merged = [];
  for (const w of list) {
    const last = merged[merged.length - 1];
    if (last && w.from <= last.to) {
      last.to = Math.max(last.to, w.to);
      if (w.type === 'major' && last.type === 'minor') {
        last.type = 'major';
        last.label = w.label;
      }
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}

// Simple day score 0-100: moon phase strength + solunar coverage + tide range.
export function dayScore({ illum, rangeMetres }) {
  const phaseScore = Math.round(Math.abs(illum - 0.5) * 2 * 45); // new/full = 45, quarter = 0
  const rangeScore = Math.min(35, Math.round((rangeMetres / 2.2) * 35));
  return Math.max(0, Math.min(100, 20 + phaseScore + rangeScore));
}
