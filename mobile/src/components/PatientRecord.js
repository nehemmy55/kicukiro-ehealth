// Medical Records Overview (Figure 12): patient header, "+ Add Clinical Note"
// and the history timeline. Doctors can add and edit their own notes.
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { get } from '../lib/api';
import { C, serif } from '../lib/theme';
import { notify } from '../lib/dialogs';
import ClinicalNoteModal from './ClinicalNoteModal';
import RecordTimeline from './RecordTimeline';
import { Button, Card, ErrorBox, Loading, Muted, Row } from './ui';

export default function PatientRecord({ patientId, appointmentId, onNoteSaved }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [linkedAppt, setLinkedAppt] = useState(appointmentId || null);

  useEffect(() => { setLinkedAppt(appointmentId || null); }, [appointmentId, patientId]);

  const load = useCallback(async () => {
    try { setError(''); setData(await get(`/records/patient/${patientId}`)); } catch (e) { setError(e.message); }
  }, [patientId]);
  useEffect(() => { setData(null); load(); }, [load]);

  if (!data) return <Card>{error ? <ErrorBox message={error} onRetry={load} /> : <Loading />}</Card>;
  const p = data.patient;
  const isDoctor = user.role === 'doctor';

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontFamily: serif, fontSize: 22, fontWeight: '700', color: C.greenDark }}>{p.full_name}</Text>
          <Muted>{p.patient_code} · Age {p.age} · {p.gender}{p.department ? ` · ${p.department}` : ''}</Muted>
          {p.phone ? <Muted style={{ fontSize: 13 }}>Tel. {p.phone}</Muted> : null}
        </View>
        {isDoctor && <Button variant="amber" small title="+ Add Clinical Note" onPress={() => { setEditing(null); setModal(true); }} />}
      </Row>
      {isDoctor && linkedAppt ? (
        <View style={{ backgroundColor: C.amberSoft, borderRadius: 10, padding: 10, marginBottom: 14 }}>
          <Text style={{ color: '#7A4E0E', fontSize: 13 }}>Consultation in progress (appointment #{linkedAppt}). Saving a clinical note will mark it completed.</Text>
        </View>
      ) : null}
      <RecordTimeline
        records={data.records}
        canEdit={(r) => isDoctor && r.doctor_id === user.doctor_id}
        onEdit={(r) => { setEditing(r); setModal(true); }}
      />
      <ClinicalNoteModal
        visible={modal}
        patient={p}
        appointmentId={linkedAppt}
        editing={editing}
        onClose={() => setModal(false)}
        onSaved={() => {
          setModal(false);
          if (!editing && linkedAppt) setLinkedAppt(null);
          notify(editing ? 'Note updated' : 'Clinical note saved', 'The record has been securely saved to the database.');
          load();
          if (onNoteSaved) onNoteSaved();
        }}
      />
    </Card>
  );
}
