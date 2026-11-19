// Doctor Use Case: "View Daily Appointments".
// "As a doctor, I want to view my daily schedule digitally so that I can
// manage my consultation time efficiently." (§3.4.1.1)
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { get, patch } from '../../lib/api';
import { C } from '../../lib/theme';
import { iso } from '../../lib/dates';
import { confirm, notify } from '../../lib/dialogs';
import DateNav from '../../components/DateNav';
import Guard from '../../components/Guard';
import { Avatar, Button, Card, Empty, ErrorBox, Loading, Muted, Row, Screen, StatusBadge } from '../../components/ui';

export default function Schedule() {
  const [date, setDate] = useState(iso());
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setError(''); setList(await get(`/appointments/queue?date=${date}`)); } catch (e) { setError(e.message); }
  }, [date]);
  useFocusEffect(useCallback(() => { setList(null); load(); }, [load]));

  const noShow = async (a) => {
    if (!(await confirm('Mark as no-show', `${a.patient_name} did not attend?`, 'Mark no-show'))) return;
    try { await patch(`/appointments/${a.id}/status`, { status: 'no_show' }); load(); } catch (e) { notify('Error', e.message); }
  };

  const counts = (list || []).reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {});

  return (
    <Guard roles={['doctor']}>
      <Screen maxWidth={760} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
        <DateNav date={date} onChange={setDate} />
        <ErrorBox message={error} onRetry={load} />
        {list && (
          <Muted style={{ marginBottom: 12 }}>
            {list.length} appointments · {counts.checked_in || 0} waiting · {counts.completed || 0} completed · {counts.no_show || 0} no-show
          </Muted>
        )}
        {!list ? <Loading /> : !list.length ? <Card><Empty title="No appointments" text="Nothing is booked for this day." /></Card> : list.map((a) => (
          <Card key={a.id} style={a.status === 'checked_in' && { borderColor: C.amber, borderWidth: 2 }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 56 }}>
                <Text style={{ fontWeight: '800', color: C.green, fontSize: 16 }}>{a.slot_time}</Text>
              </View>
              <Avatar name={a.patient_name} size={40} />
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => router.push({ pathname: '/patient/[id]', params: { id: a.patient_id, appointment: a.id } })}>
                  <Text style={{ fontWeight: '700', color: C.text, fontSize: 15 }}>{a.patient_name}</Text>
                </Pressable>
                <Muted style={{ fontSize: 13 }}>{a.patient_code} · {a.source === 'walk_in' ? 'Walk-in' : 'Booked via app'}</Muted>
                {a.reason ? <Muted style={{ fontSize: 13 }}>{a.reason}</Muted> : null}
              </View>
              <StatusBadge status={a.status} />
            </Row>
            {['booked', 'checked_in'].includes(a.status) && (
              <Row style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                {a.status === 'booked' && <Button small variant="danger" title="No-show" onPress={() => noShow(a)} />}
                <Button small variant="amber" title="Open record & consult"
                  onPress={() => router.push({ pathname: '/patient/[id]', params: { id: a.patient_id, appointment: a.id } })} />
              </Row>
            )}
          </Card>
        ))}
      </Screen>
    </Guard>
  );
}
