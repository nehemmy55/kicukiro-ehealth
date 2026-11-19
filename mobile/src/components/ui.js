// Reusable building blocks styled after the Chapter 5 interface figures.
import React from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { C, serif, STATUS } from '../lib/theme';
import { initials } from '../lib/dates';

export function Screen({ children, refreshing = false, onRefresh, maxWidth = 1120, padded = true, style }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[{ padding: padded ? 16 : 0, paddingBottom: 40, width: '100%', maxWidth, alignSelf: 'center' }, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export const useWide = (min = 760) => useWindowDimensions().width >= min;

export function Card({ children, style, title, right }) {
  return (
    <View style={[s.card, style]}>
      {(title || right) && (
        <View style={s.cardHead}>
          {title ? <Text style={s.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export const H1 = ({ children, style }) => <Text style={[s.h1, style]}>{children}</Text>;
export const Muted = ({ children, style, numberOfLines }) => <Text numberOfLines={numberOfLines} style={[s.muted, style]}>{children}</Text>;
export const Label = ({ children }) => <Text style={s.label}>{children}</Text>;

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style, small }) {
  const v = {
    primary: { bg: C.green, fg: '#fff', border: C.green },
    amber: { bg: C.amber, fg: C.text, border: C.amber },
    outline: { bg: '#fff', fg: C.text, border: C.border },
    danger: { bg: '#fff', fg: C.red, border: '#E6B9AD' },
    soft: { bg: C.greenSoft, fg: C.green, border: C.greenSoft },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall,
        { backgroundColor: off && variant === 'primary' ? '#DCE6E1' : v.bg, borderColor: off && variant === 'primary' ? '#DCE6E1' : v.border },
        pressed && !off && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} size="small" /> : (
        <Text style={[s.btnText, small && { fontSize: 13 }, { color: off && variant === 'primary' ? C.muted : v.fg }]}>
          {icon ? `${icon} ` : ''}{title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, style, multiline, ...props }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={C.faint}
        multiline={multiline}
        style={[s.input, multiline && { minHeight: 78, textAlignVertical: 'top', paddingTop: 12 }]}
        {...props}
      />
    </View>
  );
}

export function Chip({ label, active, onPress, style }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive, style]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ options, value, onChange, scroll = true }) {
  const inner = options.map((o) => (
    <Chip key={String(o.value)} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} />
  ));
  return scroll
    ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>{inner}</ScrollView>
    : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{inner}</View>;
}

export function StatusBadge({ status }) {
  const st = STATUS[status] || { label: status, fg: C.muted, bg: '#eee' };
  return (
    <View style={[s.badge, { backgroundColor: st.bg }]}>
      <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, active }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }, active && { backgroundColor: '#C9DED5' }]}>
      <Text style={{ fontWeight: '700', color: C.text, fontSize: size * 0.32 }}>{initials(name)}</Text>
    </View>
  );
}

export function Segmented({ tabs, value, onChange }) {
  return (
    <View style={s.segment}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Pressable key={t.value} onPress={() => onChange(t.value)} style={[s.segItem, on && s.segItemOn]}>
            <Text style={[s.segText, on && { color: C.text, fontWeight: '700' }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Loading({ text = 'Loading…' }) {
  return (
    <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={C.green} />
      <Muted>{text}</Muted>
    </View>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={s.error}>
      <Text style={{ color: C.red, flex: 1 }}>{message}</Text>
      {onRetry ? <Text onPress={onRetry} style={{ color: C.red, fontWeight: '700' }}>Retry</Text> : null}
    </View>
  );
}

export function Empty({ title, text }) {
  return (
    <View style={{ padding: 28, alignItems: 'center' }}>
      <Text style={{ fontWeight: '700', color: C.text, marginBottom: 4 }}>{title}</Text>
      {text ? <Muted style={{ textAlign: 'center' }}>{text}</Muted> : null}
    </View>
  );
}

export const Row = ({ children, style, gap = 10 }) => <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
  cardTitle: { fontFamily: serif, fontSize: 17, fontWeight: '700', color: C.text, flexShrink: 1 },
  h1: { fontFamily: serif, fontSize: 24, fontWeight: '700', color: C.text },
  muted: { color: C.muted, fontSize: 14 },
  label: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, backgroundColor: '#FAFBFA', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  btnText: { fontWeight: '700', fontSize: 15 },
  chip: { borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { fontWeight: '700', color: C.text, fontSize: 14 },
  badge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  avatar: { backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.border },
  segItem: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
  segItemOn: { borderColor: C.amber },
  segText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  error: { flexDirection: 'row', gap: 10, backgroundColor: C.redSoft, borderRadius: 10, padding: 12, marginBottom: 12 },
});
