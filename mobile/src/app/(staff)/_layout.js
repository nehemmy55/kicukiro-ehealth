// Staff workspace (doctors, reception, administrators). Each role only sees
// the modules it is allowed to use (Role-Based Access Control, §2.1.6).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, homeFor, ROLE_LABEL } from '../../lib/auth';
import { C, serif } from '../../lib/theme';
import { confirm } from '../../lib/dialogs';
import { Loading } from '../../components/ui';

// Which tabs each role can open
const ACCESS = {
  dashboard: ['doctor', 'reception', 'admin'],
  schedule: ['doctor'],
  records: ['doctor', 'admin'],
  queue: ['reception', 'admin'],
  'walk-in': ['reception'],
  reports: ['reception', 'admin'],
  users: ['admin'],
  system: ['admin'],
};

const TABS = [
  { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline' },
  { name: 'schedule', title: 'My Schedule', icon: 'calendar-outline' },
  { name: 'queue', title: 'Queue', icon: 'people-outline' },
  { name: 'walk-in', title: 'Walk-in', icon: 'person-add-outline' },
  { name: 'records', title: 'Records', icon: 'document-text-outline' },
  { name: 'reports', title: 'Reports', icon: 'bar-chart-outline' },
  { name: 'users', title: 'Users', icon: 'id-card-outline' },
  { name: 'system', title: 'System', icon: 'settings-outline' },
];

const canOpen = (role, tab) => (ACCESS[tab] || []).includes(role);

export default function StaffLayout() {
  const { user, ready, logout } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'patient') return <Redirect href={homeFor('patient')} />;

  const signOut = async () => {
    if (await confirm('Sign out', 'Do you want to sign out?', 'Sign out')) { await logout(); router.replace('/login'); }
  };

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.green },
        headerTintColor: '#fff',
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ backgroundColor: C.amber, borderRadius: 6, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: serif, fontWeight: '700', color: C.greenDark }}>KE</Text>
            </View>
            <View>
              <Text style={{ color: '#fff', fontFamily: serif, fontWeight: '700', fontSize: 16 }}>Kicukiro E-Health</Text>
              <Text style={{ color: '#A9CBBE', fontSize: 11 }} numberOfLines={1}>{ROLE_LABEL[user.role].toUpperCase()} · {user.full_name}</Text>
            </View>
          </View>
        ),
        headerRight: () => (
          <Pressable onPress={signOut} style={{ paddingHorizontal: 16 }} accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </Pressable>
        ),
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { borderTopColor: C.border },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            href: canOpen(user.role, t.name) ? undefined : null,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} size={size} color={color} />,
          }}
        />
      ))}
      <Tabs.Screen name="patient/[id]" options={{ href: null, title: 'Patient record' }} />
    </Tabs>
  );
}
