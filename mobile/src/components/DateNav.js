// Previous / today / next day switcher used by schedules, queues and reports.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, serif } from '../lib/theme';
import { addDays, iso, niceDate } from '../lib/dates';

export default function DateNav({ date, onChange }) {
  const today = iso();
  const Btn = ({ label, to }) => (
    <Pressable onPress={() => onChange(to)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' }}>
      <Text style={{ fontWeight: '700', color: C.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <Btn label="‹" to={addDays(date, -1)} />
      <Text style={{ fontFamily: serif, fontSize: 17, fontWeight: '700', color: C.text, minWidth: 150, textAlign: 'center' }}>
        {date === today ? 'Today' : niceDate(date)}
      </Text>
      <Btn label="›" to={addDays(date, 1)} />
      {date !== today && <Btn label="Today" to={today} />}
    </View>
  );
}
