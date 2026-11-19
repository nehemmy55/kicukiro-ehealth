// Activity diagram (Figure 8): Open app → Login → on success, the user's
// own workspace (dashboard). Already-signed-in users skip straight there.
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth, homeFor } from '../lib/auth';
import { Loading } from '../components/ui';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading text="Starting Kicukiro E-Health…" />;
  return <Redirect href={user ? homeFor(user.role) : '/login'} />;
}
