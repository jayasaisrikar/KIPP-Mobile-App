import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { colors, spacing } from '../../src/constants/tokens';
import { Card, SectionTitle } from '../../src/components/ui/primitives';
import { useAppStore } from '../../src/stores/appStore';

export default function YouScreen() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const accounts = useAppStore((s) => s.accounts);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const memories = useAppStore((s) => s.memories);
  const setMemories = useAppStore((s) => s.setMemories);
  const device = useAppStore((s) => s.device);
  const voiceEnabled = useAppStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useAppStore((s) => s.setVoiceEnabled);
  const memoryEnabled = user?.memoryEnabled ?? true;
  const [section, setSection] = useState<'memories' | 'apps' | 'devices' | 'settings'>('memories');

  const toggleMemory = (id: string) => {
    setMemories(memories.map((m) => m.id === id ? { ...m, deletedAt: m.deletedAt ? undefined : new Date().toISOString() } : m));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>You</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>{user?.displayName || 'KIPP user'} · {user?.timezone || 'UTC'}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
        {(['memories', 'apps', 'devices', 'settings'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setSection(t)} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 16, backgroundColor: section === t ? colors.accent : colors.surface2 }}>
            <Text style={{ color: section === t ? colors.bg : colors.textMuted, fontWeight: '600', fontSize: 13, textTransform: 'capitalize' }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {section === 'memories' && (
        <Card>
          <SectionTitle title="Memories" subtitle="What KIPP knows about you" />
          {memories.length === 0 ? (
            <View style={{ paddingVertical: spacing.xl }}>
              <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>Nothing saved yet. Say remember that in Talk.</Text>
            </View>
          ) : (
            memories.map((m) => (
              <View key={m.id} style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, opacity: m.deletedAt ? 0.4 : 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 }}>{m.category.toUpperCase()}{m.sensitive ? ' · SENSITIVE' : ''}</Text>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{m.text}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 4 }}>{new Date(m.createdAt).toLocaleDateString()} · {m.explicit ? 'explicit' : 'suggested'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleMemory(m.id)} style={{ marginLeft: spacing.md }}>
                    <Text style={{ color: m.deletedAt ? colors.success : colors.danger, fontSize: 12, fontWeight: '600' }}>{m.deletedAt ? 'Restore' : 'Forget'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: 14 }}>Memory enabled</Text>
            <Switch value={memoryEnabled} onValueChange={(v) => setUser(user ? { ...user, memoryEnabled: v } : user)} trackColor={{ false: colors.surface2, true: colors.accent }} thumbColor={colors.text} />
          </View>
        </Card>
      )}

      {section === 'apps' && (
        <Card>
          <SectionTitle title="Connected apps" subtitle="Google Calendar & Tasks" />
          {accounts.length === 0 ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: spacing.md }}>No accounts connected.</Text>
              <TouchableOpacity onPress={() => setAccounts([{ id: 'g1', provider: 'google', scopes: ['calendar.readonly'], status: 'connected', selectedCalendars: ['primary'], selectedTaskLists: [] }])} style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl }}>
                <Text style={{ color: colors.bg, fontWeight: '600' }}>Connect Google (demo)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            accounts.map((a) => (
              <View key={a.id} style={{ paddingVertical: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Google</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{a.status} · {a.scopes.join(', ')}</Text>
                    {a.lastSyncAt && <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>Last sync {new Date(a.lastSyncAt).toLocaleString()}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => setAccounts(accounts.filter((x) => x.id !== a.id))}>
                    <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: spacing.md }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Selected calendars: {a.selectedCalendars.join(', ') || 'none'}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Selected task lists: {a.selectedTaskLists.join(', ') || 'none'}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      )}

      {section === 'devices' && (
        <Card>
          <SectionTitle title="Devices" subtitle="Wearable companion" />
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: spacing.sm }}>No KIPP device yet?</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>Everything works on your phone. Pairing arrives when hardware ships.</Text>
            {device && device.connected && (
              <View style={{ marginTop: spacing.lg, width: '100%' }}>
                <Text style={{ color: colors.text, fontSize: 14 }}>Connected: {device.name} · {device.battery ?? '?'}%</Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {section === 'settings' && (
        <Card>
          <SectionTitle title="Settings" subtitle="Voice, privacy, data" />
          <SettingRow label="Voice answers" value={voiceEnabled} onToggle={setVoiceEnabled} />
          <SettingRow label="Response style" value={user?.responseStyle || 'balanced'} />
          <SettingRow label="Personality" value={user?.personality || 'balanced'} />
          <SettingRow label="Timezone" value={user?.timezone || 'UTC'} />
          <View style={{ marginTop: spacing.lg }}>
            <TouchableOpacity style={{ backgroundColor: colors.surface2, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Export my data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: colors.danger + '22', borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: spacing.md, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function SettingRow({ label, value, onToggle }: { label: string; value: any; onToggle?: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
      {typeof value === 'boolean' && onToggle ? (
        <Switch value={value} onValueChange={onToggle} trackColor={{ false: colors.surface2, true: colors.accent }} thumbColor={colors.text} />
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: 14, textTransform: 'capitalize' }}>{String(value)}</Text>
      )}
    </View>
  );
}
