// Administrator Use Case: "Manage System Users (Add/Remove Staff)".
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, ROLE_LABEL } from '../../lib/auth';
import { del, get, patch, post } from '../../lib/api';
import { C, serif } from '../../lib/theme';
import { stamp } from '../../lib/dates';
import { confirm, notify } from '../../lib/dialogs';
import Guard from '../../components/Guard';
import { Avatar, Button, Card, ChipRow, Empty, ErrorBox, Field, Label, Loading, Muted, Row, Screen } from '../../components/ui';

const ROLE_FILTERS = [
  { value: '', label: 'All' }, { value: 'doctor', label: 'Doctors' }, { value: 'reception', label: 'Reception' },
  { value: 'admin', label: 'Admins' }, { value: 'patient', label: 'Patients' },
];
const WEEK = [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat']];

export default function Users() {
  const { user: me } = useAuth();
  const params = useLocalSearchParams();
  const [role, setRole] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { if (params.add) { setAdding(true); router.setParams({ add: undefined }); } }, [params.add]);

  const load = useCallback(async () => {
    try { setError(''); setList(await get(`/admin/users${role ? `?role=${role}` : ''}`)); } catch (e) { setError(e.message); }
  }, [role]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (u) => {
    const verb = u.is_active ? 'Deactivate' : 'Activate';
    if (!(await confirm(`${verb} account`, `${verb} ${u.full_name}?`, verb))) return;
    try { await patch(`/admin/users/${u.id}`, { is_active: !u.is_active }); load(); } catch (e) { notify('Error', e.message); }
  };
  const remove = async (u) => {
    if (!(await confirm('Remove staff', `Remove ${u.full_name}? Staff with clinical history are deactivated instead.`, 'Remove'))) return;
    try { const r = await del(`/admin/users/${u.id}`); notify('Done', r.message); load(); } catch (e) { notify('Error', e.message); }
  };

  return (
    <Guard roles={['admin']}>
      <Screen>
        <Row style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: serif, fontSize: 20, fontWeight: '700', color: C.text }}>System users</Text>
          <Button small variant="amber" title="+ Add doctor / staff" onPress={() => setAdding(true)} />
        </Row>
        <ChipRow options={ROLE_FILTERS} value={role} onChange={setRole} />
        <View style={{ height: 14 }} />
        <ErrorBox message={error} onRetry={load} />
        {!list ? <Loading /> : !list.length ? <Card><Empty title="No users" /></Card> : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {list.map((u, i) => (
              <View key={u.id} style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderColor: C.border, opacity: u.is_active ? 1 : 0.55 }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Avatar name={u.full_name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: C.text }}>{u.full_name}{u.is_active ? '' : '  (inactive)'}</Text>
                    <Muted style={{ fontSize: 13 }}>{ROLE_LABEL[u.role]}{u.department ? ` · ${u.department} · ${u.specialty}` : ''}</Muted>
                    <Muted style={{ fontSize: 12 }}>{u.email}{u.last_login_at ? ` · last login ${stamp(u.last_login_at)}` : ''}</Muted>
                  </View>
                </Row>
                {u.id !== me.id && (
                  <Row style={{ justifyContent: 'flex-end', marginTop: 8 }} gap={8}>
                    <Button small variant="outline" title={u.is_active ? 'Deactivate' : 'Activate'} onPress={() => toggle(u)} />
                    {u.role !== 'patient' && <Button small variant="danger" title="Remove" onPress={() => remove(u)} />}
                  </Row>
                )}
              </View>
            ))}
          </Card>
        )}
        <AddUserModal visible={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
      </Screen>
    </Guard>
  );
}

function AddUserModal({ visible, onClose, onSaved }) {
  const blank = { full_name: '', email: '', phone: '', password: '', role: 'doctor', department_id: null, specialty: '', days: ['1', '2', '3', '4', '5'] };
  const [f, setF] = useState(blank);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setF(blank); setError(''); get('/departments').then(setDepartments).catch(() => {}); } }, [visible]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true); setError('');
    try {
      const { days, ...body } = f;
      const r = await post('/admin/users', { ...body, working_days: days.sort().join(',') });
      notify('User added', r.message);
      onSaved();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <Row style={{ padding: 16, justifyContent: 'space-between', maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Text style={{ fontFamily: serif, fontSize: 20, fontWeight: '700', color: C.text }}>Add doctor / staff</Text>
          <Pressable onPress={onClose}><Text style={{ color: C.green, fontWeight: '700' }}>Close</Text></Pressable>
        </Row>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
          <Card>
            <ErrorBox message={error} />
            <View style={{ marginBottom: 14 }}>
              <Label>Role</Label>
              <ChipRow scroll={false} options={[{ value: 'doctor', label: 'Doctor' }, { value: 'reception', label: 'Reception staff' }, { value: 'admin', label: 'Administrator' }]} value={f.role} onChange={set('role')} />
            </View>
            <Field label="Full name" placeholder={f.role === 'doctor' ? 'Dr. Mugisha K.' : 'Full name'} value={f.full_name} onChangeText={set('full_name')} />
            <Field label="Email (login ID)" autoCapitalize="none" keyboardType="email-address" placeholder="name@kicukirohc.rw" value={f.email} onChangeText={set('email')} />
            <Field label="Phone" keyboardType="phone-pad" value={f.phone} onChangeText={set('phone')} />
            <Field label="Temporary password" placeholder="At least 6 characters" value={f.password} onChangeText={set('password')} />
            {f.role === 'doctor' && (
              <>
                <View style={{ marginBottom: 14 }}>
                  <Label>Department</Label>
                  <ChipRow scroll={false} options={departments.map((d) => ({ value: d.id, label: d.name }))} value={f.department_id} onChange={set('department_id')} />
                </View>
                <Field label="Specialty" placeholder="e.g. General Practice" value={f.specialty} onChangeText={set('specialty')} />
                <Label>Consultation days</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {WEEK.map(([v, l]) => {
                    const on = f.days.includes(v);
                    return (
                      <Pressable key={v} onPress={() => set('days')(on ? f.days.filter((d) => d !== v) : [...f.days, v])}
                        style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : C.border, backgroundColor: on ? C.green : '#fff' }}>
                        <Text style={{ color: on ? '#fff' : C.text, fontWeight: '700' }}>{l}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            <Button title="Create account" onPress={save} loading={busy} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
