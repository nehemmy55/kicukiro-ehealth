// Patient Appointment Booking Interface (Figure 11):
// department chips → date picker → doctor list → open slots → confirm.
// Taken slots are shown struck through so double-booking is impossible.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { get } from '../lib/api';
import { C, serif } from '../lib/theme';
import { nextWeekdays, dayShort, dayNum, shortLabel } from '../lib/dates';
import { Avatar, Button, Card, ChipRow, ErrorBox, Loading, Muted } from './ui';

export default function BookingFlow({ initial = {}, submitLabel = 'Confirm booking', onSubmit, submitting }) {
  const [departments, setDepartments] = useState([]);
  const [deptId, setDeptId] = useState(initial.department_id || null);
  const [days, setDays] = useState([]);
  const [date, setDate] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState(initial.doctor_id || null);
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [deps, cfg] = await Promise.all([get('/departments'), get('/settings/public')]);
        setDepartments(deps);
        if (!initial.department_id && deps[0]) setDeptId(deps[0].id);
        // booking window in calendar days -> roughly that many weekdays
        // After closing time, start from the next working day
        const now = new Date();
        const [ch, cm] = (cfg.clinic_close || '16:00').split(':').map(Number);
        const start = new Date(now);
        if (now.getHours() * 60 + now.getMinutes() >= ch * 60 + cm - 30) start.setDate(start.getDate() + 1);
        const ds = nextWeekdays(Math.max(5, Math.round((cfg.booking_window_days * 5) / 7)), start);
        setDays(ds);
        setDate(ds[0]);
      } catch (e) { setError(e.message); }
    })();
  }, []);

  useEffect(() => {
    if (!deptId) return;
    setDoctors([]); setSlots(null); setSlot(null);
    get(`/doctors?department_id=${deptId}`)
      .then((list) => {
        setDoctors(list);
        setDoctorId((cur) => (list.some((d) => d.id === cur) ? cur : list[0] ? list[0].id : null));
      })
      .catch((e) => setError(e.message));
  }, [deptId]);

  useEffect(() => {
    if (!doctorId || !date) return;
    setSlots(null); setSlot(null);
    get(`/doctors/${doctorId}/slots?date=${date}`)
      .then((r) => setSlots(r))
      .catch((e) => setError(e.message));
  }, [doctorId, date]);

  if (!departments.length && !error) return <Loading />;
  const doctor = doctors.find((d) => d.id === doctorId);

  return (
    <View>
      <ErrorBox message={error} onRetry={() => setError('')} />
      <ChipRow options={departments.map((d) => ({ label: d.name, value: d.id }))} value={deptId} onChange={setDeptId} />

      <Card title="Select a date" style={{ marginTop: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {days.map((d) => {
            const on = d === date;
            return (
              <Pressable key={d} onPress={() => setDate(d)} style={[st.day, on && st.dayOn]}>
                <Text style={[st.dayName, on && { color: '#DCEAE4' }]}>{dayShort(d)}</Text>
                <Text style={[st.dayNum, on && { color: '#fff' }]}>{dayNum(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Card>

      <Card title="Choose a doctor">
        {!doctors.length ? <Muted>No doctors available in this department.</Muted> : doctors.map((d) => {
          const on = d.id === doctorId;
          return (
            <Pressable key={d.id} onPress={() => setDoctorId(d.id)} style={[st.doc, on && st.docOn]}>
              <Avatar name={d.full_name} size={38} active={on} />
              <View style={{ flex: 1 }}>
                <Text style={st.docName}>{d.full_name}</Text>
                <Muted style={{ fontSize: 13 }}>{d.specialty}</Muted>
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Card title={`Open slots — ${date ? shortLabel(date) : ''}`}>
        {!doctorId ? <Muted>Choose a doctor first.</Muted> : !slots ? <Loading text="Checking availability…" /> : !slots.working ? (
          <Muted>{doctor ? doctor.full_name : 'This doctor'} does not consult on this day. Pick another date or doctor.</Muted>
        ) : (
          <View style={st.grid}>
            {slots.slots.map((sl) => {
              const on = sl.time === slot;
              return (
                <Pressable
                  key={sl.time}
                  disabled={!sl.available}
                  onPress={() => setSlot(sl.time)}
                  style={[st.slot, !sl.available && st.slotOff, on && st.slotOn]}
                >
                  <Text style={[st.slotText, !sl.available && st.slotTextOff, on && { color: '#fff' }]}>{sl.time}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Button
        title={slot ? `${submitLabel} · ${shortLabel(date)} at ${slot}` : 'Select an open slot to continue'}
        disabled={!slot}
        loading={submitting}
        onPress={() => onSubmit({ doctor, doctor_id: doctorId, appt_date: date, slot_time: slot })}
      />
    </View>
  );
}

const st = StyleSheet.create({
  day: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: C.green, borderColor: C.green },
  dayName: { fontSize: 12, color: C.muted, fontWeight: '600' },
  dayNum: { fontSize: 16, color: C.text, fontWeight: '700' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 10, marginBottom: 4 },
  docOn: { backgroundColor: C.greenSoft },
  docName: { fontWeight: '700', color: C.text, fontSize: 15, fontFamily: serif },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31.5%', borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  slotOff: { backgroundColor: '#EEF0EE', borderColor: '#E3E7E4' },
  slotOn: { backgroundColor: C.green, borderColor: C.green },
  slotText: { fontWeight: '700', color: C.text },
  slotTextOff: { color: C.faint, textDecorationLine: 'line-through' },
});
