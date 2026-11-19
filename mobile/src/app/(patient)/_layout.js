// Patient workspace — only accounts with the "patient" role may enter (RBAC).
import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth, homeFor } from '../../lib/auth';
import { Loading } from '../../components/ui';

export default function PatientLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'patient') return <Redirect href={homeFor(user.role)} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
