// A single patient's medical record (phone layout, or opened from the
// doctor's schedule with ?appointment=<id> to record that consultation).
import React from 'react';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { C } from '../../../lib/theme';
import Guard from '../../../components/Guard';
import PatientRecord from '../../../components/PatientRecord';
import { Screen } from '../../../components/ui';

export default function PatientScreen() {
  const { id, appointment } = useLocalSearchParams();
  return (
    <Guard roles={['doctor', 'admin']}>
      <Screen maxWidth={760}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/records'))}>
          <Text style={{ color: C.green, fontWeight: '700', marginBottom: 12 }}>‹ Back</Text>
        </Pressable>
        <PatientRecord patientId={Number(id)} appointmentId={appointment ? Number(appointment) : null} />
      </Screen>
    </Guard>
  );
}
