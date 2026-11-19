// Lightweight charts drawn with plain Views (no chart library needed):
// "Peak consultation hours" bars and "Department load" meters (Figure 10).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../lib/theme';

export function BarChart({ data, height = 150 }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  // The two busiest hours are highlighted in amber
  const top = [...data].sort((a, b) => b.count - a.count).slice(0, 2).filter((d) => d.count > 0).map((d) => d.label);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height + 40, gap: 6 }}>
      {data.map((d) => (
        <View key={d.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: height + 40 }}>
          <Text style={st.value}>{d.count || ''}</Text>
          <View style={[st.bar, {
            height: Math.max(4, (d.count / max) * height),
            backgroundColor: top.includes(d.label) ? C.amber : C.green,
          }]} />
          <Text style={st.axis} numberOfLines={1}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function LoadBars({ data }) {
  return (
    <View>
      {data.map((d, i) => (
        <View key={d.name} style={[st.loadRow, i < data.length - 1 && { borderBottomWidth: 1, borderColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 14 }}>{d.name}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{d.count} of {d.capacity} slots</Text>
          </View>
          <View style={st.track}>
            <View style={[st.fill, { width: `${Math.round(d.load * 100)}%`, backgroundColor: d.load > 0.85 ? C.amber : C.green }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { width: '70%', maxWidth: 38, borderRadius: 6 },
  value: { fontSize: 11, color: C.muted, marginBottom: 4 },
  axis: { fontSize: 11, color: C.muted, marginTop: 6 },
  loadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  track: { width: '42%', height: 6, borderRadius: 3, backgroundColor: C.greenSoft, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
