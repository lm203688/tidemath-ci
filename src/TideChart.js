// TideMath · polyline tide chart drawn with plain Views (no svg dependency).
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { colors } from './theme';

function segments(points, w, h, pad) {
  const n = points.length;
  const xs = points.map((_, i) => pad + (i / (n - 1)) * (w - pad * 2));
  const ys = points.map((p) => h - pad - p.norm * (h - pad * 2));
  const segs = [];
  for (let i = 1; i < n; i += 1) {
    const x1 = xs[i - 1];
    const y1 = ys[i - 1];
    const x2 = xs[i];
    const y2 = ys[i];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    segs.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, len, angle });
  }
  return { segs, xs, ys };
}

export default function TideChart({
  points, // [{ms, h, norm}] norm 0..1
  width,
  height = 132,
  markers = [], // [{at: index, label, kind}]
  accent = colors.teal,
  fill = colors.tealSoft,
  compact = false,
}) {
  const pad = compact ? 10 : 14;
  const { segs, xs, ys } = useMemo(() => segments(points, width, height, pad), [points, width, height, pad]);
  const columnFill = useMemo(() => {
    // soft vertical bars under the line for body
    return points.map((p, i) => ({
      x: xs[i],
      top: ys[i],
      bottom: height - pad,
    }));
  }, [points, xs, ys, height, pad]);

  return (
    <View style={{ width, height }}>
      {columnFill.map((c, i) =>
        i % 2 === 0 ? (
          <View
            key={'f' + i}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.top,
              width: Math.max(2, width / points.length),
              height: Math.max(0, c.bottom - c.top),
              backgroundColor: fill,
              opacity: 0.55,
            }}
          />
        ) : null
      )}
      {segs.map((s, i) => (
        <View
          key={'s' + i}
          style={{
            position: 'absolute',
            left: s.x - s.len / 2,
            top: s.y,
            width: s.len,
            height: 2,
            backgroundColor: accent,
            transform: [{ rotate: s.angle + 'rad' }],
            opacity: 0.9,
          }}
        />
      ))}
      {markers.map((m, i) => (
        <View key={'m' + i} style={{ position: 'absolute', left: xs[m.at] - 3, top: ys[m.at] - 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.kind === 'high' ? colors.amber : colors.teal }} />
          {!compact && m.label ? (
            <Text
              style={{
                position: 'absolute',
                top: m.kind === 'high' ? -16 : 8,
                left: -18,
                width: 44,
                textAlign: 'center',
                fontSize: 10,
                fontWeight: '700',
                color: m.kind === 'high' ? colors.amber : colors.teal,
              }}
            >
              {m.label}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
