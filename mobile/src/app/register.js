// Patient Use Case: "Register / Login" — patients create their own profile.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { C } from '../lib/theme';
import { Button, Card, ChipRow, ErrorBox, Field, H1, Label, Muted } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({ full_name: '', email: '', phone: '', gender: '', date_of_birth: '', address: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    if (!f.full_name || !f.email || !f.phone || !f.gender || !f.date_of_birth || !f.password) {
      setError('Please fill in all required fields.'); return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date_of_birth)) { setError('Write your date of birth as YYYY-MM-DD, e.g. 1997-03-11.'); return; }
    if (f.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (f.password !== f.confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const { confirm, ...body } = f;
      await register({ ...body, email: body.email.trim() });
      router.replace('/home');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, maxWidth: 460, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()}><Text style={{ color: C.green, fontWeight: '700', marginBottom: 14 }}>‹ Back to sign in</Text></Pressable>
          <H1>Create your patient account</H1>
          <Muted style={{ marginBottom: 16, marginTop: 4 }}>Book appointments from your phone and skip the queue at Kicukiro Health Center.</Muted>
          <Card>
            <ErrorBox message={error} />
            <Field label="Full name *" placeholder="e.g. Uwase Diane" value={f.full_name} onChangeText={set('full_name')} />
            <Field label="Email *" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set('email')} />
            <Field label="Phone number (for SMS confirmations) *" placeholder="07XXXXXXXX" keyboardType="phone-pad" value={f.phone} onChangeText={set('phone')} />
            <View style={{ marginBottom: 14 }}>
              <Label>Gender *</Label>
              <ChipRow scroll={false} options={[{ label: 'Female', value: 'Female' }, { label: 'Male', value: 'Male' }]} value={f.gender} onChange={set('gender')} />
            </View>
            <Field label="Date of birth (YYYY-MM-DD) *" placeholder="1997-03-11" value={f.date_of_birth} onChangeText={set('date_of_birth')} />
            <Field label="Address" placeholder="Sector / cell, e.g. Niboye" value={f.address} onChangeText={set('address')} />
            <Field label="Password *" placeholder="At least 6 characters" secureTextEntry value={f.password} onChangeText={set('password')} />
            <Field label="Confirm password *" secureTextEntry value={f.confirm} onChangeText={set('confirm')} />
            <Button title="Create account" onPress={submit} loading={busy} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
