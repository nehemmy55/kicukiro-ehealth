// Reception Staff Use Case: "Register Walk-in Patients". Creates the patient
// (or finds an existing one) and places them in today's queue at the next
// free slot with an on-duty doctor.
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { get, post } from '../../lib/api';
import { C, serif } from '../../lib/theme';
import { iso, isoWeekdayOf } from '../../lib/dates';
import Guard from '../../components/Guard';
import { Avatar, Button, Card, ChipRow, ErrorBox, Field, Label, Muted, Row, Screen, Segmented, s } from '../../components/ui';

const blank = { full_name: '', gender: '', date_of_birth: '', phone: '', address: '' };

export default function WalkIn() {
  const [mode, setMode] = useState('new');
  const [form, setForm] = useState(blank);
  const [departments, setDepartments] = useState([]);
  const [deptId, setDeptId] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState(0);
  const [reason, setReason] = useState('');
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { get('/departments').then((d) => { setDepartments(d); setDeptId(d[0]?.id); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!deptId) return;
    setDoctorId(0);
    // only doctors who consult today
    const today = isoWeekdayOf(iso());
    get(`/doctors?department_id=${deptId}`)
      .then((list) => setDoctors(list.filter((d) => d.working_days.split(',').map(Number).includes(today))))
      .catch(() => {});
  }, [deptId]);
  useEffect(() => {
    if (mode !== 'existing' || q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => get(`/patients?q=${encodeURIComponent(q)}`).then(setFound).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q, mode]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (mode === 'new') {
      if (!form.full_name || !form.gender || !form.date_of_birth) { setError('Full name, gender and date of birth are required.'); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth)) { setError('Date of birth must be YYYY-MM-DD.'); return; }
    } else if (!patient) { setError('Search and select the patient first.'); return; }
    setBusy(true);
    try {
      const body = {
        department_id: deptId, doctor_id: doctorId || undefined, reason: reason || undefined,
        ...(mode === 'new' ? form : { patient_id: patient.id }),
      };
      setResult(await post('/patients/walk-in', body));
      setForm(blank); setPatient(null); setQ(''); setReason('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Guard roles={['reception']}>
      <Screen maxWidth={640}>
        {result && (
          <Card style={{ backgroundColor: C.greenTint, borderColor: C.green }}>
            <Text style={{ fontFamily: serif, fontSize: 18, fontWeight: '700', color: C.green }}>✓ Patient queued</Text>
            <Text style={{ color: C.text, marginTop: 6, lineHeight: 21 }}>{result.message}</Text>
            <Row style={{ marginTop: 12 }}>
              <Button small title="View queue" onPress={() => router.push('/queue')} />
              <Button small variant="outline" title="Register another" onPress={() => setResult(null)} />
            </Row>
          </Card>
        )}

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Segmented value={mode} onChange={(m) => { setMode(m); setError(''); }}
            tabs={[{ value: 'new', label: 'New patient' }, { value: 'existing', label: 'Existing patient' }]} />
          <View style={{ padding: 16 }}>
            <ErrorBox message={error} />
            {mode === 'new' ? (
              <>
                <Field label="Full name *" placeholder="e.g. Niyonzima Patrick" value={form.full_name} onChangeText={set('full_name')} />
                <View style={{ marginBottom: 14 }}>
                  <Label>Gender *</Label>
                  <ChipRow scroll={false} options={[{ label: 'Female', value: 'Female' }, { label: 'Male', value: 'Male' }]} value={form.gender} onChange={set('gender')} />
                </View>
                <Field label="Date of birth (YYYY-MM-DD) *" placeholder="1990-05-21" value={form.date_of_birth} onChangeText={set('date_of_birth')} />
                <Field label="Phone" placeholder="07XXXXXXXX" keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} />
                <Field label="Address" placeholder="Sector / cell" value={form.address} onChangeText={set('address')} />
              </>
            ) : (
              <View style={{ marginBottom: 14 }}>
                <Label>Find patient</Label>
                <TextInput placeholder="Name, KHC code or phone" placeholderTextColor={C.faint} value={q}
                  onChangeText={(v) => { setQ(v); setPatient(null); }} style={s.input} />
                {patient ? (
                  <Row style={{ marginTop: 10, backgroundColor: C.greenSoft, padding: 10, borderRadius: 10 }}>
                    <Avatar name={patient.full_name} size={36} active />
                    <Text style={{ fontWeight: '700', color: C.text, flex: 1 }}>{patient.full_name} · {patient.patient_code}</Text>
                  </Row>
                ) : found.slice(0, 6).map((p) => (
                  <Pressable key={p.id} onPress={() => setPatient(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <Avatar name={p.full_name} size={34} />
                    <View><Text style={{ fontWeight: '700', color: C.text }}>{p.full_name}</Text><Muted style={{ fontSize: 12 }}>{p.patient_code} · {p.phone || 'no phone'}</Muted></View>
                  </Pressable>
                ))}
              </View>
            )}

            <Label>Department *</Label>
            <ChipRow options={departments.map((d) => ({ label: d.name, value: d.id }))} value={deptId} onChange={setDeptId} />
            <View style={{ height: 14 }} />
            <Label>Doctor on duty today</Label>
            {doctors.length ? (
              <ChipRow scroll={false} options={[{ value: 0, label: 'Next available' }, ...doctors.map((d) => ({ value: d.id, label: d.full_name }))]} value={doctorId} onChange={setDoctorId} />
            ) : <Muted>No doctor from this department is on duty today.</Muted>}
            <View style={{ height: 14 }} />
            <Field label="Reason for visit" placeholder="e.g. Fever and headache" value={reason} onChangeText={setReason} />
            <Button title="Register & add to today's queue" onPress={submit} loading={busy} disabled={!doctors.length} />
          </View>
        </Card>
      </Screen>
    </Guard>
  );
}
