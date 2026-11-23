// TideMath · tiny local store (settings + favourite stations), no account, no network.
import { File, Paths } from 'expo-file-system';

const FILE = 'tidemath-store.json';
const DEFAULTS = {
  stationId: '8443970', // Boston, MA
  units: 'ft',
  datum: 'MLLW',
  use24: false,
  favorites: ['8443970'],
};

let cache = null;

function handle() {
  try {
    return new File(Paths.document, FILE);
  } catch (e) {
    return null;
  }
}

export function loadStore() {
  if (cache) return cache;
  try {
    const f = handle();
    if (f && f.exists) {
      const raw = f.text();
      cache = { ...DEFAULTS, ...JSON.parse(raw) };
      return cache;
    }
  } catch (e) {
    // fall through to defaults
  }
  cache = { ...DEFAULTS };
  return cache;
}

export function saveStore(patch) {
  cache = { ...loadStore(), ...patch };
  try {
    const f = handle();
    if (f) f.write(JSON.stringify(cache));
  } catch (e) {
    // in-memory only
  }
  return cache;
}

export { DEFAULTS };
