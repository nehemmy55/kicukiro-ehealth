// Reception Staff Use Case: "View Daily Appt. Queues" and
// "Verify Patient Physical Attendance". Also the admin's "Manage today's queue".
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { get, patch } from '../../lib/api';
import { C } from '../../lib/theme';
import { iso } from '../../lib/dates';
import { confirm, notify } from '../../lib/dialogs';
import DateNav from '../../components/DateNav';
import Guard from '../../components/Guard';
import { Button, Card, ChipRow, Empty, ErrorBox, Loading, Muted, Row, Screen, StatusBadge, useWide } from '../../components/ui';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'booked', label: 'Expected' },
  { value: 'checked_in', label: 'Arrived' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No-show' },
];

export default function Queue() {
  const { user } = useAuth();
  const wide = useWide(760);
  const [date, setDate] = useState(iso());
  const [dept, setDept] = useState(0);
  const [status, setStatus] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { get('/departments').then(setDepartments).catch(() => {}); }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      setList(await get(`/appointments/queue?date=${date}${dept ? `&department_id=${dept}` : ''}`));
    } catch (e) { setError(e.message); }
  }, [date, dept]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setStatusFor = async (a, next, question) => {
    if (question && !(await confirm(question[0], question[1], question[2]))) return;
    setBusyId(a.id);
    try { await patch(`/appointments/${a.id}/status`, { status: next }); await load(); } catch (e) { notify('Error', e.message); } finally { setBusyId(null); }
  };
  const cancel = async (a) => {
    if (!(await confirm('Cancel appointment', `Cancel ${a.patient_name}'s ${a.slot_time} appointment? The patient will be notified.`, 'Cancel it'))) return;
    try { await patch(`/appointments/${a.id}/cancel`); await load(); } catch (e) { notify('Error', e.message); }
  };

  const counts = (list || []).reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {});
  const shown = (list || []).filter((a) => status === 'all' || a.status === status);

  return (
    <Guard roles={['reception', 'admin']}>
      <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <DateNav date={date} onChange={setDate} />
          {user.role === 'reception' && <Button small variant="amber" title="+ Register walk-in" onPress={() => router.push('/walk-in')} style={{ marginBottom: 14 }} />}
        </Row>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {[['Expected', counts.booked, C.blue], ['Arrived', counts.checked_in, C.amberDark], ['Completed', counts.completed, C.green], ['No-show', counts.no_show, C.red]].map(([l, n, col]) => (
            <Card key={l} style={{ flex: 1, minWidth: 120, marginBottom: 0, paddingVertical: 12 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: col }}>{n || 0}</Text>
              <Muted style={{ fontSize: 13 }}>{l}</Muted>
            </Card>
          ))}
        </View>

        <ChipRow options={[{ value: 0, label: 'All departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} value={dept} onChange={setDept} />
        <View style={{ height: 8 }} />
        <ChipRow options={FILTERS} value={status} onChange={setStatus} />
        <View style={{ height: 14 }} />
        <ErrorBox message={error} onRetry={load} />

        {!list ? <Loading /> : !shown.length ? <Card><Empty title="Queue is empty" text="No appointments match this filter." /></Card> : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {shown.map((a, i) => (
              <View key={a.id} style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderColor: C.border, flexDirection: wide ? 'row' : 'column', gap: 10, alignItems: wide ? 'center' : 'stretch' }}>
                <Row style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Text style={{ width: 50, fontWeight: '800', color: C.green }}>{a.slot_time}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: C.text }}>{a.patient_name} <Text style={{ color: C.muted, fontWeight: '400', fontSize: 13 }}>{a.patient_code}</Text></Text>
                    <Muted style={{ fontSize: 13 }}>{a.doctor_name} · {a.department} · {a.source === 'walk_in' ? 'Walk-in' : 'App booking'}</Muted>
                  </View>
                  <StatusBadge status={a.status} />
                </Row>
                <Row style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }} gap={8}>
                  {a.status === 'booked' && <>
                    <Button small title="✓ Verify attendance" loading={busyId === a.id} onPress={() => setStatusFor(a, 'checked_in')} />
                    <Button small variant="outline" title="No-show" onPress={() => setStatusFor(a, 'no_show', ['Mark no-show', `${a.patient_name} did not arrive?`, 'Mark'])} />
                    <Button small variant="danger" title="Cancel" onPress={() => cancel(a)} />
                  </>}
                  {['checked_in', 'no_show'].includes(a.status) && user.role === 'reception' &&
                    <Button small variant="outline" title="Undo" onPress={() => setStatusFor(a, 'booked')} />}
                </Row>
              </View>
            ))}
          </Card>
        )}
      </Screen>
    </Guard>
  );
}
