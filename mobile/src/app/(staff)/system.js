// Administrator Use Cases: "Update System Configurations",
// "Manage Database Backups" and "Generate Security/Audit Logs".
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { get, post, put } from '../../lib/api';
import { C, mono } from '../../lib/theme';
import { stamp } from '../../lib/dates';
import { notify } from '../../lib/dialogs';
import Guard from '../../components/Guard';
import { Button, Card, Empty, ErrorBox, Field, Loading, Muted, Row, Screen, Segmented, useWide } from '../../components/ui';

export default function System() {
  const [tab, setTab] = useState('settings');
  return (
    <Guard roles={['admin']}>
      <Screen maxWidth={900}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Segmented value={tab} onChange={setTab}
            tabs={[{ value: 'settings', label: 'Configuration' }, { value: 'backups', label: 'Backups' }, { value: 'audit', label: 'Audit logs' }]} />
        </Card>
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'backups' && <BackupsPanel />}
        {tab === 'audit' && <AuditPanel />}
      </Screen>
    </Guard>
  );
}

function SettingsPanel() {
  const wide = useWide(700);
  const [rows, setRows] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    get('/admin/settings').then((r) => { setRows(r); setValues(Object.fromEntries(r.map((x) => [x.setting_key, x.setting_value]))); }).catch((e) => setError(e.message));
  }, []));
  const save = async () => {
    setBusy(true); setError('');
    try { const r = await put('/admin/settings', values); notify('Saved', r.message); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  if (!rows) return error ? <ErrorBox message={error} /> : <Loading />;
  return (
    <Card title="Clinic configuration">
      <Muted style={{ marginBottom: 14, fontSize: 13 }}>These values control consultation slots, the booking window and report thresholds.</Muted>
      <ErrorBox message={error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {rows.map((r) => (
          <Field key={r.setting_key} style={{ width: wide ? '48%' : '100%' }} label={r.description} value={values[r.setting_key]}
            onChangeText={(v) => setValues((x) => ({ ...x, [r.setting_key]: v }))} autoCapitalize="none" />
        ))}
      </View>
      <Button title="Save configuration" onPress={save} loading={busy} />
    </Card>
  );
}

function BackupsPanel() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => get('/admin/backups').then(setList).catch((e) => setError(e.message)), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const run = async () => {
    setBusy(true);
    try { const r = await post('/admin/backups'); notify('Backup completed', `${r.file_name}\n${r.row_count} rows saved.`); load(); } catch (e) { notify('Backup failed', e.message); } finally { setBusy(false); }
  };
  return (
    <Card title="Database backups" right={<Button small title="Run cloud backup" onPress={run} loading={busy} />}>
      <Muted style={{ marginBottom: 10, fontSize: 13 }}>Each backup is a full snapshot of every table, saved on the server (backend/backups) for copying to cloud storage.</Muted>
      <ErrorBox message={error} />
      {!list ? <Loading /> : !list.length ? <Empty title="No backups yet" text="Run the first backup now." /> : list.map((b) => (
        <View key={b.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: C.border }}>
          <Text style={{ fontFamily: mono, fontSize: 12, color: C.text }}>{b.file_name}</Text>
          <Muted style={{ fontSize: 12 }}>{stamp(b.created_at)} · {b.row_count} rows · {(b.size_bytes / 1024).toFixed(1)} KB · by {b.created_by_name || 'system'}</Muted>
        </View>
      ))}
    </Card>
  );
}

function AuditPanel() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => get('/admin/audit-logs?limit=150').then(setList).catch((e) => setError(e.message)), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <Card title="Security & audit log" right={<Button small variant="outline" title="Refresh" onPress={load} />}>
      <ErrorBox message={error} />
      {!list ? <Loading /> : list.map((l) => (
        <Row key={l.id} style={{ paddingVertical: 9, borderTopWidth: 1, borderColor: C.border, alignItems: 'flex-start' }}>
          <Text style={{ fontFamily: mono, fontSize: 11, color: C.muted, width: 128 }}>{stamp(l.created_at)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: l.action === 'LOGIN_FAILED' ? C.red : C.text, fontSize: 13 }}>{l.action}</Text>
            <Muted style={{ fontSize: 12 }}>{l.full_name || 'Unknown user'}{l.user_role ? ` (${l.user_role})` : ''} · {l.details}</Muted>
          </View>
        </Row>
      ))}
    </Card>
  );
}
