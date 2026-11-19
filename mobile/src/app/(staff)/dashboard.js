// Main Navigation Dashboard (Figure 10): KPIs, peak consultation hours,
// department load and quick actions.
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { get, post } from '../../lib/api';
import { C, serif } from '../../lib/theme';
import { longDate } from '../../lib/dates';
import { notify, confirm } from '../../lib/dialogs';
import { BarChart, LoadBars } from '../../components/Charts';
import Guard from '../../components/Guard';
import { Button, Card, ErrorBox, Loading, Muted, Screen, useWide } from '../../components/ui';

function Kpi({ label, value, note, up }) {
  return (
    <Card style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
      <Text style={{ fontFamily: serif, fontSize: 30, fontWeight: '700', color: C.text, marginVertical: 4 }}>{value}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: up === false ? C.red : C.green }}>{note}</Text>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const wide = useWide(900);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const load = useCallback(async () => {
    try { setError(''); setData(await get('/dashboard')); } catch (e) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runBackup = async () => {
    if (!(await confirm('Run cloud backup', 'Create a full backup of the database now?', 'Back up'))) return;
    setBackingUp(true);
    try {
      const r = await post('/admin/backups');
      notify('Backup completed', `${r.file_name}\n${r.row_count} rows · ${(r.size_bytes / 1024).toFixed(1)} KB`);
    } catch (e) { notify('Backup failed', e.message); } finally { setBackingUp(false); }
  };

  if (!data) return <Guard roles={['doctor', 'reception', 'admin']}>{error ? <Screen><ErrorBox message={error} onRetry={load} /></Screen> : <Loading />}</Guard>;
  const k = data.kpis;
  const change = k.changeVsLastWeek;

  const actions = {
    admin: [
      ["Manage today's queue", () => router.push('/queue')],
      ['Add doctor / staff', () => router.push({ pathname: '/users', params: { add: '1' } })],
      ['Generate report', () => router.push('/reports')],
      ['Run cloud backup', runBackup],
    ],
    reception: [
      ["Manage today's queue", () => router.push('/queue')],
      ['Register walk-in', () => router.push('/walk-in')],
      ['Daily attendance report', () => router.push('/reports')],
    ],
    doctor: [
      ['Open my schedule', () => router.push('/schedule')],
      ['Patient records', () => router.push('/records')],
    ],
  }[user.role];

  return (
    <Guard roles={['doctor', 'reception', 'admin']}>
      <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
        <Muted style={{ marginBottom: 12 }}>Facility overview · {longDate(data.date)}</Muted>
        <ErrorBox message={error} onRetry={load} />

        {data.mine && (
          <Card style={{ backgroundColor: C.greenTint, borderColor: C.greenSoft }}>
            <Text style={{ fontFamily: serif, fontSize: 17, fontWeight: '700', color: C.text }}>Your day, {user.full_name}</Text>
            <Muted style={{ marginTop: 4 }}>
              {data.mine.total} patients scheduled · {data.mine.completed} completed · {data.mine.waiting} waiting at reception
            </Muted>
          </Card>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
          <Kpi label="Appointments booked today" value={k.appointmentsToday}
            note={change === null ? 'No data for last week' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs last week`} up={change === null || change >= 0} />
          <Kpi label="Active doctors on duty" value={k.doctorsOnDuty}
            note={k.allDepartmentsStaffed ? 'All departments staffed' : 'Some departments unstaffed'} up={k.allDepartmentsStaffed} />
          <Kpi label="Total registered patients" value={k.totalPatients.toLocaleString()} note={`▲ ${k.newPatientsThisWeek} this week`} />
        </View>

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
          <Card title="Peak consultation hours" right={<Text style={{ fontSize: 12, color: C.muted, fontWeight: '700' }}>TODAY</Text>} style={{ flex: 1.5 }}>
            <BarChart data={data.peakHours} />
          </Card>
          <Card title="Department load" style={{ flex: 1 }}>
            <LoadBars data={data.departmentLoad} />
          </Card>
        </View>

        <Card title="Quick actions">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {actions.map(([label, fn]) => (
              <Button key={label} small variant="outline" title={label} onPress={fn} loading={label === 'Run cloud backup' && backingUp} />
            ))}
          </View>
        </Card>
      </Screen>
    </Guard>
  );
}
