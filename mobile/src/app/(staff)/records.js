// Medical Records Management Interface (§5.2.4). On a wide screen (web
// portal / tablet) the patient list and record sit side by side as in
// Figure 12; on a phone, tapping a patient opens their record.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { get } from '../../lib/api';
import { C } from '../../lib/theme';
import Guard from '../../components/Guard';
import PatientRecord from '../../components/PatientRecord';
import { Avatar, Card, Empty, ErrorBox, Loading, Muted, Screen, useWide, s } from '../../components/ui';

export default function Records() {
  const wide = useWide(900);
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (query) => {
    try { setError(''); setList(await get(`/patients?q=${encodeURIComponent(query || '')}`)); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t); }, [q, load]);
  useEffect(() => { if (wide && list && list.length && !selected) setSelected(list[0].id); }, [wide, list]);

  const open = (p) => (wide ? setSelected(p.id) : router.push({ pathname: '/patient/[id]', params: { id: p.id } }));

  const listPanel = (
    <Card style={wide ? { width: 300, padding: 10 } : { padding: 10 }}>
      <TextInput placeholder="Search patients…" placeholderTextColor={C.faint} value={q} onChangeText={setQ} style={[s.input, { marginBottom: 8 }]} />
      <ErrorBox message={error} onRetry={() => load(q)} />
      {!list ? <Loading /> : !list.length ? <Empty title="No patients found" /> : list.map((p) => {
        const on = wide && p.id === selected;
        return (
          <Pressable key={p.id} onPress={() => open(p)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: on ? C.greenSoft : 'transparent' }}>
            <Avatar name={p.full_name} size={40} active={on} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: C.text }}>{p.full_name}</Text>
              <Muted style={{ fontSize: 12 }}>{p.patient_code}{p.department ? ` · ${p.department}` : ''}</Muted>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );

  return (
    <Guard roles={['doctor', 'admin']}>
      <Screen>
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
            {listPanel}
            <View style={{ flex: 1 }}>{selected ? <PatientRecord patientId={selected} /> : null}</View>
          </View>
        ) : listPanel}
      </Screen>
    </Guard>
  );
}
