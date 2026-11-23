// TideMath · constituent table
// doodson = [tau, s, h, p, N, p1] coefficients (Schureman/Doodson arguments, Greenwich)
// family selects the nodal factor / phase correction set.

export const CONSTITUENTS = {
  M2: { d: [2, 0, 0, 0, 0, 0], family: 'm2' },
  S2: { d: [2, 2, -2, 0, 0, 0], family: 'solar' },
  N2: { d: [2, -1, 0, 1, 0, 0], family: 'm2' },
  K2: { d: [2, 2, 0, 0, 0, 0], family: 'k2' },
  K1: { d: [1, 1, 0, 0, 0, 0], family: 'k1' },
  O1: { d: [1, -1, 0, 0, 0, 0], family: 'o1' },
  P1: { d: [1, 1, -2, 0, 0, 0], family: 'solar' },
  Q1: { d: [1, -2, 0, 1, 0, 0], family: 'o1' },
  M4: { d: [4, 0, 0, 0, 0, 0], family: 'm4' },
  M6: { d: [6, 0, 0, 0, 0, 0], family: 'm6' },
  M8: { d: [8, 0, 0, 0, 0, 0], family: 'm8' },
  S4: { d: [4, 4, -4, 0, 0, 0], family: 'solar' },
  S6: { d: [6, 6, -6, 0, 0, 0], family: 'solar' },
  MS4: { d: [4, 2, -2, 0, 0, 0], family: 'm2' },
  MN4: { d: [4, -1, 0, 1, 0, 0], family: 'm2' },
  M3: { d: [3, 0, 0, 0, 0, 0], family: 'm2' },
  MK3: { d: [3, 1, 0, 0, 0, 0], family: 'm2' },
  '2MK3': { d: [3, -1, 0, 0, 0, 0], family: 'm2' },
  K3: { d: [3, 3, 0, 0, 0, 0], family: 'm2' },
  '2N2': { d: [2, -2, 0, 2, 0, 0], family: 'm2' },
  MU2: { d: [2, 1, -2, 0, 0, 0], family: 'm2' },
  NU2: { d: [2, -1, 2, -1, 0, 0], family: 'm2' },
  L2: { d: [2, 1, 0, -1, 0, 0], family: 'm2' },
  LAM: { d: [2, 1, 0, -1, 0, 0], family: 'm2' },
  T2: { d: [2, 2, -3, 0, 0, 0], family: 'solar' },
  R2: { d: [2, 2, -1, 0, 0, 0], family: 'solar' },
  J1: { d: [1, 2, 0, -1, 0, 0], family: 'o1' },
  M1: { d: [1, 0, 0, 0, 0, 0], family: 'o1' },
  OO: { d: [1, 3, 0, -2, 0, 0], family: 'k1' },
  OO1: { d: [1, 3, 0, -2, 0, 0], family: 'k1' },
  S1: { d: [1, 1, -1, 0, 0, 0], family: 'solar' },
  LAM2: { d: [2, 1, 0, -1, 0, 0], family: 'm2' },
  '2Q1': { d: [1, -3, 0, 2, 0, 0], family: 'o1' },
  RHO: { d: [1, -2, 0, 1, 0, 0], family: 'o1' },
  SIGMA1: { d: [1, -3, 2, -1, 0, 0], family: 'o1' },
  MM: { d: [0, 1, 0, -1, 0, 0], family: 'm2' },
  MF: { d: [0, 2, 0, 0, 0, 0], family: 'm2' },
  MSF: { d: [0, 2, -2, 0, 0, 0], family: 'solar' },
  SA: { d: [0, 0, 1, 0, 0, 0], family: 'solar' },
  SSA: { d: [0, 0, 2, 0, 0, 0], family: 'solar' },
  '2SM2': { d: [2, 4, -4, 0, 0, 0], family: 'solar' },
  '2SM2b': { d: [2, 4, -4, 0, 0, 0], family: 'solar' },
  '3MK7': { d: [7, 1, 0, 0, 0, 0], family: 'm2' },
  SK3: { d: [3, 3, -2, 0, 0, 0], family: 'solar' },
  SO3: { d: [3, 1, -2, 0, 0, 0], family: 'solar' },
  '2MS6': { d: [6, 2, -2, 0, 0, 0], family: 'm6' },
  '2MN6': { d: [6, -1, 0, 1, 0, 0], family: 'm6' },
  '3MS8': { d: [8, 2, -2, 0, 0, 0], family: 'm8' },
  '3MN8': { d: [8, -1, 0, 1, 0, 0], family: 'm8' },
  '2MK5': { d: [5, 1, 0, 0, 0, 0], family: 'm2' },
  '2SM5': { d: [5, 3, -4, 0, 0, 0], family: 'solar' },
  M10: { d: [10, 0, 0, 0, 0, 0], family: 'm2' },
  M12: { d: [12, 0, 0, 0, 0, 0], family: 'm2' },
  '2MS4': { d: [4, 4, -4, 0, 0, 0], family: 'solar' },
  '3M2S2': { d: [6, 2, -2, 0, 0, 0], family: 'm6' },
  '2MK6': { d: [6, 2, 0, 0, 0, 0], family: 'm6' },
};

// Constituents NOAA publishes but whose argument we approximate by speed-derived tau only.
// Kept out of the sum rather than guessed: their amplitudes are < 3 cm at nearly every station.
export function lookup(name) {
  return CONSTITUENTS[name] || null;
}

export const FAMILIES = ['m2', 'o1', 'k1', 'k2', 'm4', 'm6', 'm8', 'solar'];
