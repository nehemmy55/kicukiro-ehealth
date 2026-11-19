// Reports Generation Interface (Figure 14): tabs for Daily Attendance,
// Doctor Schedules, Patient Demographics and Department Workloads, with
// "Export CSV" and "Print / PDF" buttons. Reception staff see Daily
// Attendance only (Reception Use Case: "Export Daily Attendance Report").
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { get } from '../../lib/api';
import { C, serif } from '../../lib/theme';
import { iso, longDate } from '../../lib/dates';
import { exportCsv, printReport } from '../../lib/exporter';
import { notify } from '../../lib/dialogs';
import DateNav from '../../components/DateNav';
import Guard from '../../components/Guard';
import { Button, Card, ChipRow, Empty, ErrorBox, Loading, Row, Screen, useWide } from '../../components/ui';

const TYPES = [
  { value: 'attendance', label: 'Daily Attendance' },
  { value: 'doctor-schedules', label: 'Doctor Schedules' },
  { value: 'demographics', label: 'Patient Demographics' },
  { value: 'department-workloads', label: 'Department Workloads' },
];

export default function Reports() {
  const { user } = useAuth();
  const wide = useWide(760);
  const types = user.role === 'reception' ? TYPES.slice(0, 1) : TYPES;
  const [type, setType] = useState('attendance');
  const [date, setDate] = useState(iso());
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setReport(null);
    try { setError(''); setReport(await get(`/reports/${type}?date=${date}`)); } catch (e) { setError(e.message); }
  }, [type, date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const heading = report ? (type === 'demographics' ? report.title : type === 'department-workloads' ? report.title : `${report.title} — ${longDate(report.date)}`) : '';

  const doExport = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'csv') await exportCsv(`${type}-${date}.csv`, report.columns, report.rows);
      else await printReport(report.title, longDate(report.date), report.columns, report.rows);
    } catch (e) { notify('Export failed', e.message); } finally { setBusy(''); }
  };

  const colWidth = (key) => (['department', 'doctor', 'time_block'].includes(key) ? 180 : 120);

  return (
    <Guard roles={['reception', 'admin']}>
      <Screen>
        <ChipRow options={types} value={type} onChange={setType} />
        <View style={{ height: 14 }} />
        {type !== 'demographics' && <DateNav date={date} onChange={setDate} />}
        <ErrorBox message={error} onRetry={load} />
        <Card>
          <View style={{ flexDirection: wide ? 'row' : 'column', justifyContent: 'space-between', alignItems: wide ? 'center' : 'flex-start', gap: 10, marginBottom: 12 }}>
            <Text style={{ fontFamily: serif, fontSize: 17, fontWeight: '700', color: C.text, flexShrink: 1 }}>{heading}</Text>
            <Row gap={8}>
              <Button small variant="outline" title="⭳ Export CSV" disabled={!report || !report.rows.length} loading={busy === 'csv'} onPress={() => doExport('csv')} />
              <Button small variant="outline" title="⎙ Print / PDF" disabled={!report || !report.rows.length} loading={busy === 'pdf'} onPress={() => doExport('pdf')} />
            </Row>
          </View>
          {!report ? <Loading /> : !report.rows.length ? <Empty title="No data" text="There is no activity for this date." /> : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.border }}>
                  {report.columns.map((c) => (
                    <Text key={c.key} style={{ width: colWidth(c.key), paddingVertical: 10, paddingHorizontal: 8, fontSize: 12, fontWeight: '800', color: C.muted }}>
                      {c.label.toUpperCase()}
                    </Text>
                  ))}
                </View>
                {report.rows.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.border }}>
                    {report.columns.map((c) => (
                      <View key={c.key} style={{ width: colWidth(c.key), paddingVertical: 11, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {c.key === 'status' && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: r.status === 'On track' ? C.green : C.amber }} />}
                        <Text style={{ color: C.text, fontSize: 14 }}>{String(r[c.key])}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </Card>
      </Screen>
    </Guard>
  );
}
