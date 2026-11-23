// TideMath · station resolution (reference harmonics or subordinate offsets)
import { predictors, heightMetres, extrema, subordinateExtrema } from './predict.js';

let INDEX = null;
let INDEX_LEN = 0;

function indexOf(stations) {
  if (!INDEX || INDEX_LEN !== stations.length) {
    INDEX = new Map(stations.map((s) => [s.id, s]));
    INDEX_LEN = stations.length;
  }
  return INDEX;
}

export function findStation(stations, id) {
  return indexOf(stations).get(id) || null;
}

export function buildStation(stations, id) {
  const byId = indexOf(stations);
  const st = byId.get(id);
  if (!st) throw new Error('unknown station ' + id);
  const ref = st.t === 'R' ? st : byId.get(st.r);
  if (!ref || !ref.h || !ref.h.length) return null;
  const model = predictors(ref.h);
  const msl = ref.d && ref.d.MSL != null ? ref.d.MSL : 0;
  const mllw = ref.d && ref.d.MLLW != null ? ref.d.MLLW : 0;
  if (st.t === 'R') {
    return { st, ref: st, model, datumOffset: msl - mllw, kind: 'reference', dropped: model.dropped };
  }
  const ho = st.ho || [0, 0];
  const to = st.to || [0, 0];
  return {
    st,
    ref,
    model,
    datumOffset: msl - mllw,
    kind: 'subordinate',
    offsets: { highH: ho[0] || 0, lowH: ho[1] || 0, highT: to[0] || 0, lowT: to[1] || 0 },
    dropped: model.dropped,
  };
}

export function heightAt(resolved, ms) {
  return heightMetres(resolved.model, ms, resolved.datumOffset);
}

// High/low list inside [startMs, endMs]; subordinate stations reuse the reference extrema
// plus NOAA's published time and height offsets, exactly like the printed tide tables.
export function hilo(resolved, startMs, endMs) {
  const pts = extrema(resolved.model, startMs, endMs, resolved.datumOffset);
  if (resolved.kind !== 'subordinate') return pts;
  const o = resolved.offsets;
  return subordinateExtrema(pts, o.highH, o.lowH, o.highT, o.lowT);
}

// Cosine interpolation between two consecutive extrema — the standard tide-table reading
// used for subordinate stations, where NOAA only publishes corrections to the reference.
export function interpolate(events, ms) {
  if (!events.length) return 0;
  let i = 0;
  while (i < events.length - 1 && events[i + 1].ms <= ms) i += 1;
  const a = events[i];
  const b = events[Math.min(i + 1, events.length - 1)];
  if (b.ms === a.ms) return b.h;
  const t = Math.max(0, Math.min(1, (ms - a.ms) / (b.ms - a.ms)));
  return a.h + (b.h - a.h) * (1 - Math.cos(Math.PI * t)) / 2;
}

// Height reader that works for both station kinds: harmonics for reference stations,
// table interpolation for subordinate ones (events must span the requested time).
export function readHeight(resolved, events, ms) {
  if (resolved.kind === 'reference') return heightAt(resolved, ms);
  return interpolate(events, ms);
}
