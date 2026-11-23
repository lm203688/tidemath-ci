import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import data from './assets/noaa-tides.json';
import { layoutForSize } from './src/duoLayout';
import AiAssist from './src/AiAssist';
import TideChart from './src/TideChart';
import { colors, radius, shadow, type } from './src/theme';
import { loadStore, saveStore } from './src/store';
import { DAY, countdown, fmtDay, fmtHeight, fmtRange, fmtTime, localDayStartMs } from './src/format';
import { buildStation, hilo, readHeight } from './src/engine/station';
import { dayScore, lunarPhase, solunarWindows, sunTimes, moonTimes } from './src/engine/solunar';

const STATIONS = data.stations;
const STATION_INDEX = new Map(STATIONS.map((s) => [s.id, s]));
const SAMPLE_MIN = 10;

function daySeries(resolved, events, dayStart) {
  const count = Math.round(1440 / SAMPLE_MIN) + 1;
  const out = [];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const ms = dayStart + i * SAMPLE_MIN * 60000;
    const h = readHeight(resolved, events, ms);
    out.push({ ms, h });
    if (h < min) min = h;
    if (h > max) max = h;
  }
  const span = Math.max(0.05, max - min);
  for (const p of out) p.norm = (p.h - min) / span;
  return { points: out, min, max };
}

function withinDay(points, dayStart) {
  const end = dayStart + DAY;
  return points.filter((p) => p.ms >= dayStart && p.ms < end);
}

function stationLabel(st) {
  if (!st) return '';
  return st.state ? st.name + ', ' + st.state : st.name;
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => layoutForSize(width, height), [width, height]);

  const [store, setStore] = useState(() => loadStore());
  const [now, setNow] = useState(() => Date.now());
  const [dayOffset, setDayOffset] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const update = useCallback((patch) => {
    setStore((prev) => ({ ...prev, ...saveStore(patch) }));
  }, []);

  const station = STATION_INDEX.get(store.stationId) || STATION_INDEX.get('8443970');
  const resolved = useMemo(() => {
    try {
      return buildStation(STATIONS, station.id);
    } catch (e) {
      return null;
    }
  }, [station.id]);

  const tz = station.tz == null ? -5 : station.tz;
  const dst = !!station.dst;
  const today = localDayStartMs(now, tz, dst);
  const dayStart = today + dayOffset * DAY;

  const allEvents = useMemo(
    () => (resolved ? hilo(resolved, Math.min(now, dayStart) - DAY, Math.max(now, dayStart) + DAY * 8.5) : []),
    [resolved, dayStart, now]
  );
  const todaySeries = useMemo(() => (resolved ? daySeries(resolved, allEvents, dayStart) : null), [resolved, allEvents, dayStart]);
  const dayEvents = useMemo(() => withinDay(allEvents, dayStart), [allEvents, dayStart]);
  const nextEvent = useMemo(() => allEvents.find((p) => p.ms > now), [allEvents, now]);

  const sun = useMemo(() => (resolved ? sunTimes(dayStart, station.lat, station.lng) : {}), [resolved, dayStart, station.lat, station.lng]);
  const moon = useMemo(() => (resolved ? moonTimes(dayStart, station.lat, station.lng) : {}), [resolved, dayStart, station.lat, station.lng]);
  const phase = useMemo(() => lunarPhase(dayStart + DAY / 2), [dayStart]);
  const windows = useMemo(() => (resolved ? solunarWindows(dayStart, station.lat, station.lng).slice(0, 6) : []), [resolved, dayStart, station.lat, station.lng]);
  const range = todaySeries ? todaySeries.max - todaySeries.min : 0;
  const score = dayScore({ illum: phase.illum, rangeMetres: range });

  const forecast = useMemo(() => {
    if (!resolved) return [];
    const rows = [];
    for (let i = 0; i < 7; i += 1) {
      const ds = today + i * DAY;
      const ev = hilo(resolved, ds - 60000, ds + DAY + 60000).filter((p) => p.ms >= ds && p.ms < ds + DAY);
      const highs = ev.filter((p) => p.type === 'high');
      const lows = ev.filter((p) => p.type === 'low');
      const hi = highs.length ? Math.max(...highs.map((p) => p.h)) : null;
      const lo = lows.length ? Math.min(...lows.map((p) => p.h)) : null;
      const lp = lunarPhase(ds + DAY / 2);
      rows.push({ dayStart: ds, first: ev[0], hi, lo, phase: lp, count: ev.length });
    }
    return rows;
  }, [resolved, today]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const favs = store.favorites.map((id) => STATION_INDEX.get(id)).filter(Boolean);
      const rest = STATIONS.filter((s) => s.t === 'R' && s.h && s.h.length).slice(0, 24);
      return [...favs, ...rest.filter((s) => !store.favorites.includes(s.id))].slice(0, 30);
    }
    const scored = [];
    for (const s of STATIONS) {
      if (!s.h || !s.h.length) continue;
      const name = s.name.toLowerCase();
      const st = (s.state || '').toLowerCase();
      if (name.includes(q) || st === q) {
        scored.push({ s, rank: name.startsWith(q) ? 0 : 1 });
        if (scored.length >= 120) break;
      }
    }
    return scored.slice(0, 40).map((x) => x.s);
  }, [query, store.favorites]);

  const toggleFavorite = (id) => {
    const has = store.favorites.includes(id);
    update({ favorites: has ? store.favorites.filter((x) => x !== id) : [id, ...store.favorites].slice(0, 20) });
  };

  const pickStation = (id) => {
    update({ stationId: id, favorites: store.favorites.includes(id) ? store.favorites : [id, ...store.favorites] });
    setDayOffset(0);
    setPickerOpen(false);
    setQuery('');
  };

  const chartW = Math.max(240, (layout.twoPane ? layout.left : Math.min(width, 720)) - 32 - (layout.gutter && !layout.twoPane ? layout.gutter : 0));

  const trend = useMemo(() => {
    if (!resolved || !todaySeries) return 0;
    const first = todaySeries.points[0].ms;
    if (now < first || now > todaySeries.points[todaySeries.points.length - 1].ms) return 0;
    const idx = Math.max(0, Math.min(todaySeries.points.length - 2, Math.round((now - first) / (SAMPLE_MIN * 60000))));
    return todaySeries.points[idx + 1].h - todaySeries.points[idx].h;
  }, [resolved, todaySeries, now]);

  const nowHeight = resolved ? readHeight(resolved, allEvents, now) : 0;
  const markers = useMemo(() => {
    if (!todaySeries) return [];
    return dayEvents.map((p) => ({
      at: Math.max(0, Math.min(todaySeries.points.length - 1, Math.round((p.ms - dayStart) / (SAMPLE_MIN * 60000)))),
      label: '',
      kind: p.type,
    }));
  }, [todaySeries, dayEvents, dayStart]);

  const nowCard = (
    <View style={[styles.card, shadow, { marginBottom: 12 }]}>
      <Pressable onPress={() => setPickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>Station</Text>
          <Text style={type.h1} numberOfLines={1}>{stationLabel(station)}</Text>
          <Text style={type.small}>{resolved && resolved.kind === 'subordinate' ? 'Subordinate station of ' + resolved.ref.name : 'Reference station'} · {station.id}</Text>
        </View>
        <Text style={styles.change}>Change</Text>
      </Pressable>

      <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={type.hero}>{fmtHeight(nowHeight, store.units)}</Text>
        <Text style={{ ...type.h2, color: trend >= 0 ? colors.teal : colors.amber, marginLeft: 10, marginBottom: 8 }}>
          {trend >= 0 ? 'Rising' : 'Falling'}
        </Text>
      </View>
      <Text style={type.small}>Above {store.datum} · {fmtTime(now, tz, dst, store.use24)} local</Text>

      {nextEvent ? (
        <View style={styles.nextBox}>
          <Text style={styles.nextType}>{nextEvent.type === 'high' ? 'Next high' : 'Next low'}</Text>
          <Text style={styles.nextTime}>{fmtTime(nextEvent.ms, tz, dst, store.use24)}</Text>
          <Text style={styles.nextMeta}>{fmtHeight(nextEvent.h, store.units)} · in {countdown(nextEvent.ms - now)}</Text>
        </View>
      ) : null}
    </View>
  );

  const chartCard = (
    <View style={[styles.card, shadow, { marginBottom: 12 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={type.label}>Tide curve</Text>
          <Text style={type.h2}>{dayOffset === 0 ? 'Today' : fmtDay(dayStart + DAY / 2, tz, dst)}</Text>
        </View>
        <Text style={type.small}>Range {fmtRange(range, store.units)}</Text>
      </View>
      {todaySeries ? (
        <View style={{ marginTop: 10 }}>
          <TideChart points={todaySeries.points} width={chartW} height={150} markers={markers} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            {['00', '06', '12', '18'].map((h) => (
              <Text key={h} style={type.small}>{h}:00</Text>
            ))}
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>No harmonics published for this station.</Text>
      )}
    </View>
  );

  const eventsCard = (
    <View style={[styles.card, shadow, { marginBottom: 12 }]}>
      <Text style={type.label}>High & low tide</Text>
      {(dayEvents.length ? dayEvents : []).map((p, i) => (
        <View key={i} style={styles.eventRow}>
          <View style={[styles.dot, { backgroundColor: p.type === 'high' ? colors.amber : colors.teal }]} />
          <Text style={styles.eventName}>{p.type === 'high' ? 'High tide' : 'Low tide'}</Text>
          <Text style={styles.eventTime}>{fmtTime(p.ms, tz, dst, store.use24)}</Text>
          <Text style={styles.eventHeight}>{fmtHeight(p.h, store.units)}</Text>
        </View>
      ))}
      {!dayEvents.length ? <Text style={styles.empty}>No events today.</Text> : null}
    </View>
  );

  const sunCard = (
    <View style={[styles.card, shadow, { marginBottom: 12 }]}>
      <Text style={type.label}>Sun & moon</Text>
      <View style={styles.gridRow}>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>Sunrise</Text>
          <Text style={styles.gridValue}>{sun.sunrise ? fmtTime(sun.sunrise, tz, dst, store.use24) : '—'}</Text>
        </View>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>Sunset</Text>
          <Text style={styles.gridValue}>{sun.sunset ? fmtTime(sun.sunset, tz, dst, store.use24) : '—'}</Text>
        </View>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>Moonrise</Text>
          <Text style={styles.gridValue}>{moon.moonrise ? fmtTime(moon.moonrise, tz, dst, store.use24) : '—'}</Text>
        </View>
        <View style={styles.gridCell}>
          <Text style={styles.gridLabel}>Moonset</Text>
          <Text style={styles.gridValue}>{moon.moonset ? fmtTime(moon.moonset, tz, dst, store.use24) : '—'}</Text>
        </View>
      </View>
      <Text style={[type.small, { marginTop: 8 }]}>{phase.name} · {Math.round(phase.illum * 100)}% lit</Text>
    </View>
  );

  const solunarCard = (
    <View style={[styles.card, shadow, { marginBottom: 12 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={type.label}>Fishing windows</Text>
        <View style={styles.scorePill}>
          <Text style={styles.scoreText}>{score}</Text>
          <Text style={styles.scoreSuffix}>/100 day score</Text>
        </View>
      </View>
      {(windows.length ? windows : []).map((w, i) => (
        <View key={i} style={styles.windowRow}>
          <Text style={[styles.windowType, { color: w.type === 'major' ? colors.amber : colors.teal }]}>
            {w.type === 'major' ? 'MAJOR' : 'MINOR'}
          </Text>
          <Text style={styles.windowTime}>
            {fmtTime(w.from, tz, dst, store.use24)} – {fmtTime(w.to, tz, dst, store.use24)}
          </Text>
          <Text style={styles.windowLabel} numberOfLines={1}>{w.label}</Text>
        </View>
      ))}
      {!windows.length ? <Text style={styles.empty}>No windows computed.</Text> : null}
      <Text style={[type.small, { marginTop: 8 }]}>
        Major windows centre on the moon's transit (overhead / underfoot), minor on moonrise and moonset. Tides and weather still decide the bite.
      </Text>
    </View>
  );

  const forecastCard = (
    <View style={[styles.card, shadow, { marginBottom: 12 }]}>
      <Text style={type.label}>Next 7 days</Text>
      {forecast.map((row, i) => {
        const active = i === dayOffset;
        return (
          <Pressable key={i} onPress={() => setDayOffset(i)} style={[styles.forecastRow, active && styles.forecastRowActive]}>
            <Text style={[styles.forecastDay, active && { color: colors.teal }]}>{i === 0 ? 'Today' : fmtDay(row.dayStart + DAY / 2, tz, dst).replace(/,.*/, '')}</Text>
            <Text style={styles.forecastDate}>{fmtDay(row.dayStart + DAY / 2, tz, dst).split(', ')[1]}</Text>
            <Text style={styles.forecastTimes} numberOfLines={1}>
              {row.first ? fmtTime(row.first.ms, tz, dst, store.use24) : '—'} · {row.count} events
            </Text>
            <Text style={styles.forecastRange}>
              {row.hi != null && row.lo != null ? fmtRange(row.hi - row.lo, store.units) : '—'}
            </Text>
          </Pressable>
        );
      })}
      <Text style={[type.small, { marginTop: 10 }]}>Tap a day to load its curve and windows. Predictions are computed on device from NOAA harmonic constants.</Text>
    </View>
  );

  const footer = (
    <Text style={[type.small, { textAlign: 'center', marginTop: 4, marginBottom: 26 }]}>
      Prediction data: NOAA CO-OPS (public domain), frozen {String(data.fetched).slice(0, 10)}. Not for navigation — verify against official NOAA predictions before relying on it.
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: layout.topInset,
          paddingBottom: 40,
          paddingLeft: 16,
          paddingRight: layout.gutter + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Text style={styles.brand}>TideMath</Text>
            <Text style={type.small}>Offline NOAA tide tables · fishing windows</Text>
          </View>
          <Pressable onPress={() => setSettingsOpen(true)} style={styles.settingsBtn} hitSlop={8}>
            <Text style={styles.settingsGlyph}>⚙︎</Text>
          </Pressable>
        </View>

        {layout.twoPane ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: layout.left - 16, marginRight: 12 }}>{nowCard}{chartCard}</View>
            <View style={{ flex: 1 }}>{eventsCard}{solunarCard}</View>
          </View>
        ) : (
          <View>{nowCard}{chartCard}{eventsCard}{solunarCard}</View>
        )}

        {layout.twoPane ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: layout.left - 16, marginRight: 12 }}>{sunCard}</View>
            <View style={{ flex: 1 }}>{forecastCard}</View>
          </View>
        ) : (
          <View>{sunCard}{forecastCard}</View>
        )}
        {footer}
      </ScrollView>

      <AiAssist
        app="TideMath"
        gutter={layout.gutter}
        bottom={28}
        hint={
          'The user is looking at tide station ' + stationLabel(station) + ' (' + station.id + '), datum ' + store.datum +
          ', heights in ' + store.units + '. Today high/low: ' +
          (dayEvents.map((p) => (p.type === 'high' ? 'high ' : 'low ') + fmtHeight(p.h, store.units) + ' at ' + fmtTime(p.ms, tz, dst, store.use24)).join('; ') || 'none') +
          '. Tide range ' + fmtRange(range, store.units) + '. Moon: ' + phase.name + ' ' + Math.round(phase.illum * 100) +
          '% lit. Answer questions about this station, tide timing for fishing, or how to read the chart.'
        }
      />

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={type.h1}>Stations</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}><Text style={styles.change}>Done</Text></Pressable>
            </View>
            <Text style={type.small}>{STATIONS.length} NOAA stations bundled · {STATIONS.filter((s) => s.h && s.h.length).length} with harmonic predictions</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name or state (e.g. Boston, FL)"
              placeholderTextColor="#87969B"
              autoCapitalize="none"
              style={styles.search}
            />
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {searchResults.map((s) => (
                <Pressable key={s.id} onPress={() => pickStation(s.id)} style={styles.stationRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stationName} numberOfLines={1}>{stationLabel(s)}</Text>
                    <Text style={type.small}>{s.id} · {s.t === 'R' ? 'reference' : 'subordinate'}{s.dst ? ' · DST' : ''}</Text>
                  </View>
                  <Pressable onPress={() => toggleFavorite(s.id)} hitSlop={8} style={styles.star}>
                    <Text style={{ fontSize: 18, color: store.favorites.includes(s.id) ? colors.amber : '#C6D2CF' }}>
                      {store.favorites.includes(s.id) ? '★' : '☆'}
                    </Text>
                  </Pressable>
                </Pressable>
              ))}
              {!searchResults.length ? <Text style={styles.empty}>No station matches.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={type.h1}>Settings</Text>
              <Pressable onPress={() => setSettingsOpen(false)} hitSlop={10}><Text style={styles.change}>Done</Text></Pressable>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Heights in feet</Text>
              <Switch value={store.units === 'ft'} onValueChange={(v) => update({ units: v ? 'ft' : 'm' })} trackColor={{ true: colors.teal, false: '#CBD6D3' }} />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Datum MLLW (chart datum)</Text>
              <Switch
                value={store.datum === 'MLLW'}
                onValueChange={(v) => update({ datum: v ? 'MLLW' : 'MSL' })}
                trackColor={{ true: colors.teal, false: '#CBD6D3' }}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>24-hour clock</Text>
              <Switch value={store.use24} onValueChange={(v) => update({ use24: v })} trackColor={{ true: colors.teal, false: '#CBD6D3' }} />
            </View>

            <Text style={[type.label, { marginTop: 16 }]}>Data</Text>
            <Text style={type.body}>NOAA CO-OPS harmonic constituents and datums, public domain. Bundled on {String(data.fetched).slice(0, 10)}; predictions are computed on device — no network, no account.</Text>
            <Text style={[type.small, { marginTop: 8 }]}>
              Engine: {38} constituents per station where published, Doodson arguments with nodal corrections, calibrated against NOAA hourly predictions. Subordinate stations use NOAA time and height offsets.
            </Text>
            <Text style={[type.small, { marginTop: 8, color: colors.danger }]}>
              Not for navigation. Tide predictions do not include storm surge, river flow or barometric effects. Check official NOAA products before transiting shallow water.
            </Text>
            <Text style={[type.small, { marginTop: 8 }]}>Favourites: {store.favorites.length} · Version 1.0</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 16 },
  brand: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  settingsGlyph: { fontSize: 18, color: colors.ink },
  change: { fontSize: 14, fontWeight: '700', color: colors.teal },
  nextBox: { marginTop: 14, backgroundColor: colors.tealSoft, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  nextType: { fontSize: 12, fontWeight: '700', color: colors.teal, letterSpacing: 0.6 },
  nextTime: { fontSize: 18, fontWeight: '800', color: colors.ink },
  nextMeta: { fontSize: 12, color: colors.sub },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  eventName: { flex: 1, fontSize: 14, color: colors.ink, fontWeight: '600' },
  eventTime: { width: 76, fontSize: 14, fontWeight: '700', color: colors.ink, textAlign: 'right' },
  eventHeight: { width: 74, fontSize: 14, color: colors.sub, textAlign: 'right' },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  gridCell: { width: '50%', paddingVertical: 4 },
  gridLabel: { fontSize: 11, fontWeight: '700', color: colors.sub, letterSpacing: 0.5 },
  gridValue: { fontSize: 16, fontWeight: '700', color: colors.ink },
  scorePill: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: colors.amberSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { fontSize: 15, fontWeight: '800', color: colors.amber },
  scoreSuffix: { fontSize: 10, color: colors.amber, marginLeft: 4 },
  windowRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  windowType: { width: 54, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  windowTime: { width: 128, fontSize: 14, fontWeight: '700', color: colors.ink },
  windowLabel: { flex: 1, fontSize: 12, color: colors.sub },
  forecastRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  forecastRowActive: { backgroundColor: colors.tealSoft, borderRadius: 10, paddingHorizontal: 8 },
  forecastDay: { width: 54, fontSize: 14, fontWeight: '700', color: colors.ink },
  forecastDate: { width: 66, fontSize: 12, color: colors.sub },
  forecastTimes: { flex: 1, fontSize: 12, color: colors.sub },
  forecastRange: { width: 62, fontSize: 13, fontWeight: '700', color: colors.ink, textAlign: 'right' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,42,51,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 30, maxHeight: '92%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  search: { marginTop: 10, marginBottom: 6, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, height: 44, fontSize: 15, color: colors.ink },
  stationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  stationName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  star: { paddingLeft: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  settingLabel: { fontSize: 14, color: colors.ink },
  empty: { fontSize: 13, color: colors.sub, paddingVertical: 10 },
};
