// Patient mobile app (Figure 11 and Patient Use Case):
// Book · Upcoming (cancel / reschedule) · My records (medical history).
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { get, patch, post } from '../../lib/api';
import { C, serif } from '../../lib/theme';
import { greeting, niceDate } from '../../lib/dates';
import { confirm, notify } from '../../lib/dialogs';
import BookingFlow from '../../components/BookingFlow';
import RecordTimeline from '../../components/RecordTimeline';
import { Button, Card, Empty, ErrorBox, Loading, Muted, Row, Screen, Segmented, StatusBadge } from '../../components/ui';

export default function PatientHome() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('book');
  const [unread, setUnread] = useState(0);
  const [bookKey, setBookKey] = useState(0);

  useFocusEffect(useCallback(() => {
    get('/notifications').then((r) => setUnread(r.unread)).catch(() => {});
  }, [tab]));

  const signOut = async () => {
    if (await confirm('Sign out', 'Do you want to sign out?', 'Sign out')) { await logout(); router.replace('/login'); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.green }}>
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.hello}>{greeting()}</Text>
            <Text style={st.name}>{user?.full_name}</Text>
            <Text style={st.code}>{user?.patient_code}</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={st.iconBtn} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {unread > 0 && <View style={st.dot}><Text style={st.dotText}>{unread}</Text></View>}
          </Pressable>
          <Pressable onPress={signOut} style={st.iconBtn} accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <Segmented
          value={tab}
          onChange={setTab}
          tabs={[{ value: 'book', label: 'Book' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'records', label: 'My records' }]}
        />
      </View>
      {tab === 'book' && <BookTab key={bookKey} onBooked={() => { setTab('upcoming'); setBookKey((k) => k + 1); }} />}
      {tab === 'upcoming' && <UpcomingTab />}
      {tab === 'records' && <RecordsTab />}
    </View>
  );
}

function BookTab({ onBooked }) {
  const [busy, setBusy] = useState(false);
  const book = async ({ doctor, doctor_id, appt_date, slot_time }) => {
    setBusy(true);
    try {
      await post('/appointments', { doctor_id, appt_date, slot_time });
      notify('Booking confirmed ✔',
        `${doctor.full_name}\n${niceDate(appt_date)} at ${slot_time}\n\nA confirmation SMS has been sent to your phone. Please arrive 10 minutes early.`);
      onBooked();
    } catch (e) {
      notify('Could not book', e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen maxWidth={560}>
      <BookingFlow onSubmit={book} submitting={busy} />
    </Screen>
  );
}

function UpcomingTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setError(''); setData(await get('/appointments/mine')); } catch (e) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = async (a) => {
    if (!(await confirm('Cancel appointment', `Cancel your appointment with ${a.doctor_name} on ${niceDate(a.appt_date)} at ${a.slot_time}?`, 'Cancel it'))) return;
    try { await patch(`/appointments/${a.id}/cancel`); await load(); } catch (e) { notify('Could not cancel', e.message); }
  };

  const reschedule = async ({ doctor_id, appt_date, slot_time }) => {
    setBusy(true);
    try {
      await patch(`/appointments/${moving.id}/reschedule`, { doctor_id, appt_date, slot_time });
      setMoving(null);
      notify('Appointment moved', `New time: ${niceDate(appt_date)} at ${slot_time}. A confirmation SMS has been sent.`);
      await load();
    } catch (e) { notify('Could not reschedule', e.message); } finally { setBusy(false); }
  };

  if (!data) return error ? <Screen><ErrorBox message={error} onRetry={load} /></Screen> : <Loading />;

  return (
    <Screen maxWidth={560} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <ErrorBox message={error} onRetry={load} />
      {!data.upcoming.length ? (
        <Card><Empty title="No upcoming appointments" text="Use the Book tab to reserve a consultation slot." /></Card>
      ) : data.upcoming.map((a) => (
        <Card key={a.id}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={st.apptDate}>{niceDate(a.appt_date)} · {a.slot_time}</Text>
              <Text style={st.apptDoc}>{a.doctor_name}</Text>
              <Muted>{a.department} · Ref #{a.id}</Muted>
            </View>
            <StatusBadge status={a.status} />
          </Row>
          {a.status === 'booked' && (
            <Row style={{ marginTop: 14 }}>
              <Button small variant="outline" title="Reschedule" onPress={() => setMoving(a)} style={{ flex: 1 }} />
              <Button small variant="danger" title="Cancel" onPress={() => cancel(a)} style={{ flex: 1 }} />
            </Row>
          )}
          {a.status === 'checked_in' && <Muted style={{ marginTop: 10 }}>You are checked in. The doctor will call you shortly.</Muted>}
        </Card>
      ))}

      {data.past.length > 0 && (
        <Card title="History">
          {data.past.slice(0, 15).map((a) => (
            <Row key={a.id} style={st.histRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: C.text }}>{niceDate(a.appt_date)} · {a.slot_time}</Text>
                <Muted style={{ fontSize: 13 }}>{a.doctor_name} · {a.department}</Muted>
              </View>
              <StatusBadge status={a.status} />
            </Row>
          ))}
        </Card>
      )}

      <Modal visible={!!moving} animationType="slide" onRequestClose={() => setMoving(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <Row style={{ padding: 16, justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: serif, fontSize: 20, fontWeight: '700', color: C.text }}>Reschedule appointment</Text>
            <Pressable onPress={() => setMoving(null)}><Text style={{ color: C.green, fontWeight: '700' }}>Close</Text></Pressable>
          </Row>
          {moving && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
              <Muted style={{ marginBottom: 12 }}>Current: {niceDate(moving.appt_date)} at {moving.slot_time} with {moving.doctor_name}</Muted>
              <BookingFlow
                initial={{ department_id: moving.department_id, doctor_id: moving.doctor_id }}
                submitLabel="Move to"
                submitting={busy}
                onSubmit={reschedule}
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

function RecordsTab() {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setError(''); setRecords(await get('/records/mine')); } catch (e) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!records) return error ? <Screen><ErrorBox message={error} onRetry={load} /></Screen> : <Loading />;
  return (
    <Screen maxWidth={560}>
      <Card title="My medical history">
        <Muted style={{ marginBottom: 14, fontSize: 13 }}>Diagnoses and prescriptions recorded by your doctors at Kicukiro Health Center.</Muted>
        <RecordTimeline records={records} />
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, gap: 4, width: '100%', maxWidth: 560, alignSelf: 'center' },
  hello: { color: '#CFE3DB', fontSize: 14 },
  name: { color: '#fff', fontFamily: serif, fontSize: 22, fontWeight: '700' },
  code: { color: '#A9CBBE', fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 8 },
  dot: { position: 'absolute', right: 2, top: 2, backgroundColor: C.amber, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { fontSize: 11, fontWeight: '800', color: C.text },
  apptDate: { fontWeight: '700', color: C.green, marginBottom: 4 },
  apptDoc: { fontFamily: serif, fontSize: 17, fontWeight: '700', color: C.text },
  histRow: { paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border },
});
