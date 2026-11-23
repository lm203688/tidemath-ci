// TideMath · time zone (US DST rule), unit and label formatting.
export const HOUR = 3600000;
export const DAY = 86400000;

function nthSunday(year, month, n) {
  // month is 1-based; returns UTC ms of the n-th Sunday at 00:00 UTC (approx; refined below)
  const first = Date.UTC(year, month - 1, 1);
  const dow = new Date(first).getUTCDay();
  const offset = (7 - dow) % 7;
  return first + (offset + (n - 1) * 7) * DAY;
}

// US rule since 2007: DST from 2nd Sunday of March to 1st Sunday of November.
export function isUsDst(utcMs) {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const start = nthSunday(y, 3, 2) + 7 * HOUR; // 2am local standard ~ 7am UTC (EST) / 8am for others
  const end = nthSunday(y, 11, 1) + 7 * HOUR;
  return utcMs >= start && utcMs < end;
}

export function localMs(utcMs, tzCorrHours, observedDst) {
  const dst = observedDst && isUsDst(utcMs) ? 1 : 0;
  return utcMs + (tzCorrHours + dst) * HOUR;
}

export function localDayStartMs(utcMs, tzCorrHours, observedDst) {
  const lm = localMs(utcMs, tzCorrHours, observedDst);
  const dayLocal = Math.floor(lm / DAY) * DAY;
  return dayLocal - (tzCorrHours + (observedDst && isUsDst(utcMs) ? 1 : 0)) * HOUR;
}

export function fmtTime(utcMs, tzCorrHours, observedDst, use24) {
  const d = new Date(localMs(utcMs, tzCorrHours, observedDst));
  let h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  if (use24) return String(h).padStart(2, '0') + ':' + m;
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return h + ':' + m + ' ' + suffix;
}

// "4:54 – 6:24 AM" when both ends share a meridiem, else the full "4:54 AM – 8:12 PM".
export function fmtSpan(fromUtcMs, toUtcMs, tzCorrHours, observedDst, use24) {
  const a = fmtTime(fromUtcMs, tzCorrHours, observedDst, use24);
  const b = fmtTime(toUtcMs, tzCorrHours, observedDst, use24);
  if (use24) return a + ' – ' + b;
  if (a.slice(-2) === b.slice(-2)) return a.slice(0, -3) + ' – ' + b;
  return a + ' – ' + b;
}

export function fmtDay(utcMs, tzCorrHours, observedDst) {
  const d = new Date(localMs(utcMs, tzCorrHours, observedDst));
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[d.getUTCDay()] + ', ' + mon[d.getUTCMonth()] + ' ' + d.getUTCDate();
}

export function fmtHeight(metres, units) {
  if (units === 'ft') return (metres * 3.28084).toFixed(1) + ' ft';
  return metres.toFixed(2) + ' m';
}

export function fmtRange(metres, units) {
  if (units === 'ft') return (metres * 3.28084).toFixed(1) + ' ft';
  return metres.toFixed(2) + ' m';
}

export function countdown(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 0) return 'now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return m + ' min';
  return h + ' h ' + String(m).padStart(2, '0') + ' min';
}
