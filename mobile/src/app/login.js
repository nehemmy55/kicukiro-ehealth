// User Authentication Interface (Figure 9): one login, separate Patient
// (mobile app) and Staff (web portal) entry points.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, homeFor } from '../lib/auth';
import { C, serif } from '../lib/theme';
import { API_URL } from '../lib/config';
import { Button, ErrorBox, Field, Muted, useWide } from '../components/ui';

const DEMO = {
  patient: [{ label: 'Patient', email: 'diane.uwase@gmail.com', password: 'Patient@123' }],
  staff: [
    { label: 'Doctor', email: 'dr.mugisha@kicukirohc.rw', password: 'Doctor@123' },
    { label: 'Reception', email: 'reception@kicukirohc.rw', password: 'Reception@123' },
    { label: 'Admin', email: 'admin@kicukirohc.rw', password: 'Admin@123' },
  ],
};

export default function Login() {
  const { login } = useAuth();
  const wide = useWide(900);
  const [portal, setPortal] = useState('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) { setError('Enter your user ID/email and password.'); return; }
    setBusy(true); setError('');
    try {
      const user = await login(email.trim(), password, portal);
      router.replace(homeFor(user.role));
    } catch (e) {
      // Activity diagram: invalid credentials → back to login
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[st.wrap, wide && { flexDirection: 'row', alignItems: 'flex-start' }]} keyboardShouldPersistTaps="handled">
          <View style={st.card}>
            <View style={st.pill}><Text style={st.pillText}>KICUKIRO HEALTH CENTER</Text></View>
            <Text style={st.title}>Welcome back</Text>
            <Muted style={{ marginBottom: 18 }}>Sign in to continue to your workspace.</Muted>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {[['patient', 'Patient · Mobile App'], ['staff', 'Staff · Web Portal']].map(([k, label]) => (
                <Pressable key={k} onPress={() => { setPortal(k); setError(''); }} style={[st.toggle, portal === k && st.toggleOn]}>
                  <Text style={st.toggleText}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <ErrorBox message={error} />
            <Field label="User ID / Email" placeholder="e.g. diane.uwase@gmail.com" autoCapitalize="none" keyboardType="email-address"
              autoCorrect={false} value={email} onChangeText={setEmail} />
            <Field label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
            <Button title="Sign in" onPress={submit} loading={busy} style={{ marginTop: 6 }} />

            {portal === 'patient' ? (
              <Pressable onPress={() => router.push('/register')} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: C.green, fontWeight: '700' }}>New patient? Create an account</Text>
              </Pressable>
            ) : (
              <Muted style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>Staff accounts are created by the administrator.</Muted>
            )}

            <View style={st.demo}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8 }}>DEMO ACCOUNTS (tap to fill)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DEMO[portal].map((d) => (
                  <Pressable key={d.email} onPress={() => { setEmail(d.email); setPassword(d.password); }} style={st.demoChip}>
                    <Text style={{ fontWeight: '700', color: C.green, fontSize: 13 }}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={[st.side, !wide && { marginTop: 24 }]}>
            <Text style={st.sideTitle}>One login, three workspaces.</Text>
            <Text style={st.sideText}>
              The same credential store routes patients to the mobile booking app and routes doctors, reception staff,
              and administrators to their dashboards — with role-based access enforced on the server.
            </Text>
            <Text style={[st.sideText, { fontSize: 12, color: C.faint }]}>Server: {API_URL}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, gap: 32, maxWidth: 1100, width: '100%', alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 24, width: '100%', maxWidth: 380, alignSelf: 'center' },
  pill: { backgroundColor: C.amberSoft, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 14 },
  pillText: { color: '#8A5A12', fontWeight: '800', fontSize: 11, letterSpacing: 0.6 },
  title: { fontFamily: serif, fontSize: 24, fontWeight: '700', color: C.text, marginBottom: 2 },
  toggle: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  toggleOn: { backgroundColor: C.greenSoft, borderColor: C.green },
  toggleText: { fontWeight: '700', color: C.text, fontSize: 13 },
  demo: { marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderColor: C.border },
  demoChip: { backgroundColor: C.greenTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  side: { flex: 1, maxWidth: 440, alignSelf: 'center', paddingTop: 6 },
  sideTitle: { fontFamily: serif, fontSize: 28, fontWeight: '700', color: C.greenDark, marginBottom: 12 },
  sideText: { color: C.muted, fontSize: 15, lineHeight: 23, marginBottom: 12 },
});
