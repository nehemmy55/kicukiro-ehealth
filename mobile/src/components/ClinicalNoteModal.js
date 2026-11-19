// "Add Clinical Note" modal form (Figure 13): vital signs, diagnosis,
// prescription, qualitative remarks and an auto-attached secure timestamp.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { post, put } from '../lib/api';
import { C, serif, mono } from '../lib/theme';
import { Button, ErrorBox, Field, Label, Muted, Row } from './ui';

export default function ClinicalNoteModal({ visible, patient, appointmentId, editing, onClose, onSaved }) {
  const empty = { vital_signs: '', diagnosis: '', prescription: '', remarks: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!visible) return;
    setForm(editing ? {
      vital_signs: editing.vital_signs || '', diagnosis: editing.diagnosis || '',
      prescription: editing.prescription || '', remarks: editing.remarks || '',
    } : empty);
    setError('');
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [visible, editing]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.diagnosis.trim() && !form.remarks.trim()) { setError('Enter at least a diagnosis or remarks.'); return; }
    setSaving(true); setError('');
    try {
      const rec = editing
        ? await put(`/records/${editing.id}`, form)
        : await post('/records', { ...form, patient_id: patient.id, appointment_id: appointmentId || null });
      onSaved(rec);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
        <View style={st.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22 }}>
            <Text style={st.title}>{editing ? 'Edit Clinical Note' : 'Add Clinical Note'}</Text>
            <Muted style={{ marginBottom: 16 }}>{patient?.full_name} · {patient?.department || patient?.patient_code}</Muted>
            <ErrorBox message={error} />
            <Field label="Vital signs" placeholder="BP 118/76, Temp 36.8°C, HR 78bpm" value={form.vital_signs} onChangeText={set('vital_signs')} />
            <Field label="Diagnosis" placeholder="e.g. Mild malaria, typhoid check advised" value={form.diagnosis} onChangeText={set('diagnosis')} />
            <Field label="Prescription" placeholder="Artemether-lumefantrine, 3 days…" value={form.prescription} onChangeText={set('prescription')} multiline />
            <Field label="Qualitative remarks" placeholder="e.g. Patient responded well; advise rest and hydration." value={form.remarks} onChangeText={set('remarks')} multiline />
            <Label>Secure timestamp (auto-attached)</Label>
            <View style={st.stamp}>
              <Text style={{ fontFamily: mono, color: C.text }}>
                {editing ? `Original: ${editing.recorded_at}` : now.toLocaleString('en-GB')}
              </Text>
            </View>
            <Row style={{ marginTop: 18, justifyContent: 'flex-end' }}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ minWidth: 110 }} />
              <Button title={editing ? 'Save changes' : 'Save to record'} onPress={save} loading={saving} style={{ minWidth: 150 }} />
            </Row>
          </ScrollView>
          <Pressable onPress={onClose} style={st.close}><Text style={{ fontSize: 18, color: C.muted }}>✕</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,40,32,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 440, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 16 },
  title: { fontFamily: serif, fontSize: 21, fontWeight: '700', color: C.green, marginBottom: 2 },
  stamp: { backgroundColor: C.greenTint, borderRadius: 10, padding: 12 },
  close: { position: 'absolute', right: 14, top: 12, padding: 6 },
});
