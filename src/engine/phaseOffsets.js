// TideMath phase calibration vs NOAA published predictions (see 数据/calibrate.mjs).
// NOAA publishes phase_GMT in a convention where the diurnal species come out 90° rotated
// against a plain Doodson sum; offsets below are the least-squares measurement over 75 days
// at 10 stations (Atlantic / Pacific / Gulf / Hawaii / Alaska). g_eff = phase_GMT + offset.
export const PHASE_OFFSETS = {
  'M2': -0.98,
  'N2': -1.01,
  'K1': -92.2,
  'M4': -1.91,
  'O1': 94.05,
  'M6': -2.96,
  'MK3': -96.21,
  'MN4': 2.83,
  'NU2': 0.15,
  'M1': 146.4,
  'J1': -92.48,
  'P1': 91.45,
  '2SM2': -22.94,
  'M3': 175.46,
  'L2': -178.76,
  'MS4': -6.22,
  'SA': -15.36,
  '2Q1': 91.95,
  '2MK3': 92.81,
  'S4': -0.6,
  '2N2': 31.37,
  'K2': 40.69,
  'M8': -2.66,
  'S6': -0.33,
  'SSA': -1.99,
  'S2': -4.34,
  'MF': -8.88,
  'MM': 0.15,
  'T2': -27.73,
  'MSF': 0.91,
  'MU2': 57,
  'SIGMA1': 0.19,
  'SO3': 94.96,
  'SK3': -93.71,
  '2MK5': -105.84,
  '2MN6': 19.6,
  '2MS6': 0.41,
  '2MK6': -12.73,
  '3MS8': -11.56,
  '3MN8': 20.6,
  'M10': -0.63,
  // aliases NOAA ships under a second name for the same argument
  'LAM2': -178.76,
  // below the trustworthy amplitude floor (<1.5 cm mean): the astronomical default (0) is safer
  // than a noisy fit, and the worst case error is bounded by the term's own amplitude.
  'OO1': 0,
  'S1': 0,
};
export const phaseOffset = (name) => PHASE_OFFSETS[name] || 0;

