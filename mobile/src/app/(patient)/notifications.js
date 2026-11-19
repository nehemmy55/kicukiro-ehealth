// Automated booking confirmations received by the patient.
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { get, patch } from '../../lib/api';
import { C, serif } from '../../lib/theme';
import { stamp } from '../../lib/dates';
import { Card, Empty, ErrorBox, Loading, Muted, Screen } from '../../components/ui';

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const r = await get('/notifications');
        setItems(r.items);
        if (r.unread) await patch('/notifications/read-all');
      } catch (e) { setError(e.message); }
    })();
  }, []));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.green }}>
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()}><Text style={{ color: '#fff', fontSize: 22 }}>‹</Text></Pressable>
          <Text style={{ color: '#fff', fontFamily: serif, fontSize: 20, fontWeight: '700' }}>Notifications</Text>
        </View>
      </SafeAreaView>
      <Screen maxWidth={560}>
        <ErrorBox message={error} />
        {!items ? <Loading /> : !items.length ? <Card><Empty title="No notifications yet" /></Card> : items.map((n) => (
          <Card key={n.id} style={!n.is_read && { borderColor: C.amber }}>
            <Text style={{ color: C.text, lineHeight: 21 }}>{n.message}</Text>
            <Muted style={{ fontSize: 12, marginTop: 6 }}>{stamp(n.created_at)}</Muted>
          </Card>
        ))}
      </Screen>
    </View>
  );
}
