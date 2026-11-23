// TideMath · astronomy primitives (pure, no deps)
// Fundamental arguments follow Meeus, Astronomical Algorithms (accurate to seconds over 1900-2100).

export const RAD = Math.PI / 180;

export function julianDay(ms) {
  return ms / 86400000 + 2440587.5;
}

export function centuries(ms) {
  return (julianDay(ms) - 2451545.0) / 36525.0;
}

// Mean longitude of the Moon (s), Sun (h), lunar perigee (p), ascending node (N), solar perigee (p1), degrees.
export function fundamental(ms) {
  const T = centuries(ms);
  const s =
    218.3164477 +
    481267.88123421 * T -
    0.0015786 * T * T +
    (T * T * T) / 538841 -
    (T * T * T * T) / 65194000;
  const h = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const p =
    83.3532465 +
    4069.0137287 * T -
    0.01032 * T * T -
    (T * T * T) / 80053 +
    (T * T * T * T) / 18999000;
  const N =
    125.0445479 -
    1934.1362891 * T +
    0.0020754 * T * T +
    (T * T * T) / 467441 -
    (T * T * T * T) / 60616000;
  const p1 = 282.93734098 + 1.71945766667 * T + 0.00001717 * T * T;
  const hours = (ms / 3600000) % 24;
  // Greenwich mean lunar time
  const tau = 15 * ((ms / 3600000) % 24) + h - s;
  return { T, s, h, p, N, p1, tau, hours };
}

const norm360 = (x) => ((x % 360) + 360) % 360;

// Equilibrium argument V (degrees, Greenwich) for one constituent.
// doodson = [tau, s, h, p, N, p1] coefficients
export function argument(doodson, f) {
  return norm360(
    doodson[0] * f.tau +
      doodson[1] * f.s +
      doodson[2] * f.h +
      doodson[3] * f.p +
      doodson[4] * f.N +
      doodson[5] * f.p1
  );
}

// Nodal factor f and phase correction u (degrees) at a given time.
// family: 'm2' | 'o1' | 'k1' | 'k2' | 'm4' | 'm6' | 'm8' | 'solar'
export function nodeFactor(family, Ndeg) {
  const N = Ndeg * RAD;
  const cos = (k) => Math.cos(k * N);
  const sin = (k) => Math.sin(k * N);
  switch (family) {
    case 'm2': {
      const f = 1.0 - 0.03731 * cos(1) + 0.00052 * cos(2) - 0.00004 * cos(3);
      const u = -2.14 * sin(1) + 0.11 * sin(2) - 0.01 * sin(3);
      return { f, u };
    }
    case 'o1': {
      const f = 1.0089 + 0.1871 * cos(1) - 0.0172 * cos(2) + 0.0013 * cos(3);
      const u = 10.8 * sin(1) - 1.3 * sin(2) + 0.2 * sin(3);
      return { f, u };
    }
    case 'k1': {
      const f = 1.0069 + 0.1154 * cos(1) - 0.0088 * cos(2) + 0.0007 * cos(3);
      const u = -8.9 * sin(1) + 0.7 * sin(2) - 0.1 * sin(3);
      return { f, u };
    }
    case 'k2': {
      const f = 1.0241 + 0.2863 * cos(1) + 0.0083 * cos(2) - 0.0015 * cos(3);
      const u = -17.4 * sin(1) + 1.7 * sin(2) - 0.2 * sin(3);
      return { f, u };
    }
    case 'm4': {
      const m2 = nodeFactor('m2', Ndeg);
      return { f: m2.f * m2.f, u: 2 * m2.u };
    }
    case 'm6': {
      const m2 = nodeFactor('m2', Ndeg);
      return { f: m2.f ** 3, u: 3 * m2.u };
    }
    case 'm8': {
      const m2 = nodeFactor('m2', Ndeg);
      return { f: m2.f ** 4, u: 4 * m2.u };
    }
    default:
      return { f: 1, u: 0 };
  }
}

// Moon position (equatorial), low-precision but adequate for solunar windows (~1-2 min).
export function moonPosition(ms) {
  const f = fundamental(ms);
  const T = f.T;
  const L = norm360(218.3164477 + 481267.88123421 * T); // mean longitude
  const D = norm360(297.8501921 + 445267.1114034 * T); // mean elongation
  const M = norm360(357.5291092 + 35999.0502909 * T); // sun anomaly
  const Mp = norm360(134.9633964 + 477198.8675055 * T); // moon anomaly
  const F = norm360(93.272095 + 483202.0175233 * T); // argument of latitude
  const d2r = RAD;
  // main periodic terms (degrees)
  const lon =
    L +
    6.289 * Math.sin(Mp * d2r) +
    1.274 * Math.sin((2 * D - Mp) * d2r) +
    0.658 * Math.sin(2 * D * d2r) +
    0.214 * Math.sin(2 * Mp * d2r) -
    0.186 * Math.sin(M * d2r) -
    0.114 * Math.sin(2 * F * d2r);
  const lat =
    5.128 * Math.sin(F * d2r) +
    0.281 * Math.sin((Mp + F) * d2r) +
    0.278 * Math.sin((Mp - F) * d2r);
  const obl = 23.4392911 - 0.0130042 * T;
  const lam = lon * d2r;
  const bet = lat * d2r;
  const eps = obl * d2r;
  const ra = Math.atan2(
    Math.sin(lam) * Math.cos(eps) - Math.tan(bet) * Math.sin(eps),
    Math.cos(lam)
  );
  const dec = Math.asin(
    Math.sin(bet) * Math.cos(eps) + Math.cos(bet) * Math.sin(eps) * Math.sin(lam)
  );
  // distance (km) for phase/illumination
  const dist = 385000 - 20905 * Math.cos(Mp * d2r) - 3699 * Math.cos((2 * D - Mp) * d2r);
  return { ra: norm360(ra / d2r), dec: dec / d2r, dist, lon: norm360(lon), lat };
}

export function sunPosition(ms) {
  const T = centuries(ms);
  const L0 = norm360(280.46646 + 36000.76983 * T);
  const M = norm360(357.52911 + 35999.05029 * T);
  const C =
    (1.914602 - 0.004817 * T) * Math.sin(M * RAD) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M * RAD) +
    0.000289 * Math.sin(3 * M * RAD);
  const lon = norm360(L0 + C);
  const obl = 23.4392911 - 0.0130042 * T;
  const ra = Math.atan2(Math.cos(obl * RAD) * Math.sin(lon * RAD), Math.cos(lon * RAD)) / RAD;
  const dec = Math.asin(Math.sin(obl * RAD) * Math.sin(lon * RAD)) / RAD;
  return { ra: norm360(ra), dec, lon };
}

// Greenwich sidereal time (degrees)
export function gmst(ms) {
  const T = centuries(ms);
  return norm360(
    280.46061837 + 360.98564736629 * (julianDay(ms) - 2451545.0) + 0.000387933 * T * T
  );
}

// Hour angle of a body (degrees, positive west) at a longitude (east positive)
export function hourAngle(ra, ms, lng) {
  return norm360(gmst(ms) + lng - ra);
}

// Altitude of a body for a given hour angle / declination / latitude
export function altitude(Hdeg, decDeg, latDeg) {
  const H = Hdeg * RAD;
  const d = decDeg * RAD;
  const p = latDeg * RAD;
  return Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H)) / RAD;
}
