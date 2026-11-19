// Medical history timeline (Figure 12): date stamp, title, diagnosis,
// prescription, remarks — newest first.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, mono } from '../lib/theme';
import { stamp } from '../lib/dates';
import { Empty } from './ui';

export default function RecordTimeline({ records, canEdit, onEdit }) {
  if (!records || !records.length) return <Empty title="No records yet" text="Clinical notes will appear here after a consultation." />;
  return (
    <View>
      {records.map((r, i) => (
        <View key={r.id} style={st.item}>
          <View style={st.rail}>
            <View style={st.dot} />
            {i < records.length - 1 && <View style={st.line} />}
          </View>
          <View style={{ flex: 1, paddingBottom: 18 }}>
            <Text style={st.stamp}>{stamp(r.recorded_at)}</Text>
            <Text style={st.title}>{r.title}</Text>
            {r.vital_signs ? <Line k="Vitals" v={r.vital_signs} /> : null}
            {r.diagnosis ? <Line k="Diagnosis" v={r.diagnosis} /> : null}
            {r.prescription ? <Line k="Prescription" v={r.prescription} /> : null}
            {r.remarks ? (r.diagnosis || r.prescription ? <Line k="Remarks" v={r.remarks} /> : <Text style={st.body}>{r.remarks}</Text>) : null}
            {r.doctor_name ? <Text style={st.by}>{r.doctor_name}</Text> : null}
            {canEdit && canEdit(r) ? (
              <Pressable onPress={() => onEdit(r)}><Text style={st.edit}>Edit note</Text></Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const Line = ({ k, v }) => (
  <Text style={st.body}><Text style={{ fontWeight: '700' }}>{k}: </Text>{v}</Text>
);

const st = StyleSheet.create({
  item: { flexDirection: 'row' },
  rail: { width: 22, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, marginTop: 4 },
  line: { flex: 1, width: 1, backgroundColor: C.border, marginTop: 4 },
  stamp: { fontFamily: mono, fontSize: 12, color: C.muted, marginBottom: 2 },
  title: { fontWeight: '700', color: C.text, fontSize: 15, marginBottom: 4 },
  body: { color: C.text, fontSize: 14, lineHeight: 21 },
  by: { color: C.muted, fontSize: 12, marginTop: 4 },
  edit: { color: C.green, fontWeight: '700', marginTop: 6 },
});
