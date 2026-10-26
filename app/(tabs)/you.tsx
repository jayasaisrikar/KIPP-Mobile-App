import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Share } from 'react-native';
import { reloadAppAsync } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { notifications } from '../../src/lib/notifications';
import * as Speech from 'expo-speech';
import { saveThemePreference, spacing, themePreference, type ThemePreference } from '../../src/constants/tokens';
import { Avatar, Badge, Button, Card, CardHeader, Dialog, Empty, Field, Input, ListItem, Screen, SegmentedControl, Separator, Switch, Text, toast, type IconName } from '../../src/components/ui';
import { getApiKey, setApiKey } from '../../src/lib/secrets';
import { testConnection, KippError } from '../../src/lib/kipp';
import type { UserProfile } from '../../src/types';
import { connectGoogle, disconnectGoogle, googleUnavailableReason } from '../../src/lib/google';
import { syncGoogle } from '../../src/lib/sync';
import { useAppStore, DEFAULT_LLM } from '../../src/stores/appStore';

const sections = [
  { value: 'memories', label: 'Memory' },
  { value: 'apps', label: 'Apps' },
  { value: 'devices', label: 'Devices' },
  { value: 'settings', label: 'Settings' },
] as const;

export default function YouScreen() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const memories = useAppStore((s) => s.memories);
  const setMemories = useAppStore((s) => s.setMemories);
  const device = useAppStore((s) => s.device);
  const voiceEnabled = useAppStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useAppStore((s) => s.setVoiceEnabled);
  const memoryEnabled = user?.memoryEnabled ?? true;
  const params = useLocalSearchParams<{ section?: string }>();
  const sectionFromParam = sections.find((x) => x.value === params.section)?.value;
  const [section, setSection] = useState<(typeof sections)[number]['value']>(sectionFromParam ?? 'memories');
  // Follow deep links like /you?section=settings when the param changes.
  const [lastParam, setLastParam] = useState(params.section);
  if (params.section !== lastParam) {
    setLastParam(params.section);
    if (sectionFromParam) setSection(sectionFromParam);
  }
  const name = user?.displayName || 'KIPP user';
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const cycle = <K extends 'responseStyle' | 'personality'>(key: K, options: UserProfile[K][]) => {
    if (!user) return;
    const next = options[(options.indexOf(user[key]) + 1) % options.length];
    setUser({ ...user, [key]: next });
  };

  const exportData = async () => {
    const { user: u, tasks, reminders, memories: mems, messages } = useAppStore.getState();
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), user: u, tasks, reminders, memories: mems, messages }, null, 2);
    try {
      await Share.share({ title: 'KIPP data export', message: json });
    } catch {
      toast('Could not open the share sheet', { variant: 'error' });
    }
  };

  const deleteAll = async () => {
    await notifications()?.cancelAllScheduledNotificationsAsync().catch(() => {});
    Speech.stop();
    await setApiKey(null);
    await disconnectGoogle();
    useAppStore.getState().reset();
    setConfirmingDelete(false);
    router.replace('/onboarding');
    toast('All data deleted', { variant: 'success' });
  };

  const setMemoryDeleted = (id: string, deleted: boolean) => {
    const current = useAppStore.getState().memories;
    setMemories(current.map((m) => m.id === id ? { ...m, deletedAt: deleted ? new Date().toISOString() : undefined } : m));
  };
  const toggleMemory = (id: string) => {
    const forgetting = !memories.find((m) => m.id === id)?.deletedAt;
    setMemoryDeleted(id, forgetting);
    if (forgetting) toast('Memory forgotten', { action: { label: 'Undo', onPress: () => setMemoryDeleted(id, false) } });
  };

  const themes: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  const cycleTheme = () => {
    const next = themes[(themes.findIndex((t) => t.value === themePreference) + 1) % themes.length].value;
    saveThemePreference(next);
    reloadAppAsync().catch(() => toast('Restart KIPP to apply the theme', { variant: 'info' }));
  };

  return (
    <Screen>
      <View style={styles.profile}>
        <Avatar name={name} size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="h1">{name}</Text>
          <Text variant="bodySm" tone="muted" style={{ marginTop: 2 }}>{user?.timezone || 'UTC'}</Text>
        </View>
      </View>

      <SegmentedControl options={sections} value={section} onChange={setSection} />

      {section === 'memories' && (
        <Card>
          <CardHeader title="Memories" description="What KIPP knows about you" />
          <Separator />
          <ListItem icon="memory" title="Memory enabled" description="KIPP can save things you ask it to remember." trailing={<Switch value={memoryEnabled} accessibilityLabel="Memory enabled" onValueChange={(v) => setUser(user ? { ...user, memoryEnabled: v } : user)} />} />
          <Separator />
          {memories.length === 0 ? (
            <Empty icon="memory" title="Nothing saved yet" description={'Say "remember that…" in Talk.'} />
          ) : (
            memories.map((m, i) => (
              <React.Fragment key={m.id}>
                {i > 0 && <Separator inset={spacing.lg} />}
                <View style={[styles.memory, m.deletedAt ? { opacity: 0.45 } : null]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={m.category} variant="outline" />
                      {m.sensitive ? <Badge label="Sensitive" variant="warning" /> : null}
                    </View>
                    <Text variant="bodySm">{m.text}</Text>
                    <Text variant="caption" tone="muted">{new Date(m.createdAt).toLocaleDateString()} · {m.explicit ? 'explicit' : 'suggested'}</Text>
                  </View>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    icon={m.deletedAt ? 'restore' : 'trash'}
                    accessibilityLabel={m.deletedAt ? 'Restore memory' : 'Forget memory'}
                    onPress={() => toggleMemory(m.id)}
                  />
                </View>
              </React.Fragment>
            ))
          )}
        </Card>
      )}

      {section === 'apps' && <GoogleCard />}

      {section === 'devices' && (
        <Card>
          <CardHeader title="Devices" description="Wearable companion" />
          {device && device.connected ? (
            <>
              <Separator />
              <ListItem icon="device" title={device.name} description={`Battery ${device.battery ?? '?'}%`} trailing={<Badge label="Connected" variant="success" dot />} />
            </>
          ) : (
            <Empty icon="device" title="No KIPP device yet?" description="Everything works on your phone. Pairing arrives when hardware ships." />
          )}
        </Card>
      )}

      {section === 'settings' && (
        <>
          <AiSettings />

          <Card>
            <CardHeader title="Preferences" description="Voice and personality" />
            <Separator />
            <ListItem icon="voice" title="Voice answers" description="KIPP reads replies aloud" trailing={<Switch value={voiceEnabled} accessibilityLabel="Voice answers" onValueChange={setVoiceEnabled} />} />
            <SettingRow icon="talk" label="Response style" value={user?.responseStyle || 'balanced'} onPress={() => cycle('responseStyle', ['concise', 'balanced', 'detailed'])} />
            <SettingRow icon="sparkles" label="Personality" value={user?.personality || 'balanced'} onPress={() => cycle('personality', ['calm', 'balanced', 'playful'])} />
            <SettingRow icon="globe" label="Timezone" value={user?.timezone || 'UTC'} />
          </Card>

          <Card>
            <CardHeader title="Appearance" description="Changing the theme reloads KIPP" />
            <Separator />
            <ListItem
              icon={themePreference === 'light' ? 'sun' : themePreference === 'dark' ? 'moon' : 'contrast'}
              title="Theme"
              onPress={cycleTheme}
              trailing={<Text variant="bodySm" tone="muted">{themes.find((t) => t.value === themePreference)?.label}</Text>}
            />
          </Card>

          <Card>
            <CardHeader title="Privacy & data" description="Everything is stored on this device" />
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
              <Button label="Export my data" icon="share" variant="outline" block onPress={exportData} />
              <Button label="Delete all data" icon="trash" variant="destructive-outline" block onPress={() => setConfirmingDelete(true)} />
            </View>
          </Card>
        </>
      )}

      <Dialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete all data?"
        description="This removes your profile, tasks, reminders, memories, chat history and API key from this device, and disconnects Google. It can't be undone."
        confirmLabel="Delete everything"
        destructive
        onConfirm={deleteAll}
      />
    </Screen>
  );
}

function SettingRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress?: () => void }) {
  return (
    <>
      <Separator inset={spacing.lg + 32 + spacing.md} />
      <ListItem icon={icon} title={label} onPress={onPress} trailing={<Text variant="bodySm" tone="muted" style={{ textTransform: 'capitalize' }}>{value}</Text>} />
    </>
  );
}

function AiSettings() {
  const llm = useAppStore((s) => s.llm);
  const setLlm = useAppStore((s) => s.setLlm);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [model, setModel] = useState(llm.model);
  const [status, setStatus] = useState<{ tone: 'success' | 'destructive' | 'muted'; text: string } | null>(null);

  useEffect(() => { getApiKey().then((k) => setHasKey(!!k)); }, []);

  const save = async () => {
    if (key.trim()) await setApiKey(key);
    setLlm({ model: model.trim() || DEFAULT_LLM.model });
    setKey('');
    const k = await getApiKey();
    setHasKey(!!k);
    setStatus({ tone: 'muted', text: 'Testing connection…' });
    try {
      await testConnection();
      setStatus({ tone: 'success', text: `Connected to ${model.trim() || DEFAULT_LLM.model}.` });
      toast('KIPP is connected', { variant: 'success' });
    } catch (e) {
      setStatus({ tone: 'destructive', text: e instanceof KippError ? e.message : 'Connection failed.' });
    }
  };

  return (
    <Card>
      <CardHeader title="AI model" description="OpenCode Go (OpenAI-compatible)" action={<Badge label={hasKey ? 'Key saved' : 'No key'} variant={hasKey ? 'success' : 'warning'} dot />} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
        <Field label="API key" description="Stored in the device keychain.">
          <Input value={key} onChangeText={setKey} placeholder={hasKey ? '•••••••• (saved — paste to replace)' : 'Paste your OpenCode Go key'} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Field label="Model" description={`Default: ${DEFAULT_LLM.model}`}>
          <Input value={model} onChangeText={setModel} placeholder={DEFAULT_LLM.model} autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Button label="Save & test" icon="check" onPress={save} block />
        {status ? <Text variant="caption" tone={status.tone}>{status.text}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  memory: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});

function GoogleCard() {
  const accounts = useAppStore((s) => s.accounts);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const setEvents = useAppStore((s) => s.setEvents);
  const tasks = useAppStore((s) => s.tasks);
  const setTasks = useAppStore((s) => s.setTasks);
  const google = accounts.find((a) => a.provider === 'google');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'destructive' | 'success' | 'muted'; text: string } | null>(null);
  const unavailable = googleUnavailableReason();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try { await fn(); } catch (e) { setMessage({ tone: 'destructive', text: e instanceof Error ? e.message : 'Something went wrong.' }); }
    setBusy(false);
  };

  const connect = () => run(async () => {
    const account = await connectGoogle();
    if (!account) return;
    setAccounts([...useAppStore.getState().accounts.filter((a) => a.provider !== 'google'), account]);
    await syncGoogle();
    toast('Google connected', { description: 'Calendar and Tasks are synced.', variant: 'success' });
  });

  const sync = () => run(async () => {
    await syncGoogle();
    toast('Synced with Google', { variant: 'success' });
  });

  const disconnect = () => run(async () => {
    await disconnectGoogle();
    setAccounts(accounts.filter((a) => a.provider !== 'google'));
    setEvents([]);
    // Keep Google tasks locally but detach them from the remote list.
    setTasks(tasks.map((t) => (t.externalId ? { ...t, externalId: undefined, source: 'kipp' } : t)));
    toast('Google disconnected');
  });

  return (
    <Card>
      <CardHeader
        title="Google"
        description="Calendar & Tasks"
        action={google ? <Badge label={google.status === 'connected' ? 'Connected' : 'Reconnect needed'} variant={google.status === 'connected' ? 'success' : 'warning'} dot /> : undefined}
      />
      {google ? (
        <>
          <Separator />
          <ListItem icon="person" title={google.name || 'Google account'} description={google.email} />
          <Separator inset={spacing.lg} />
          <ListItem icon="calendar" title="Calendar" description="Primary calendar · events show in Plans → Agenda" />
          <Separator inset={spacing.lg} />
          <ListItem icon="task" title="Tasks" description="Default list · two-way sync" />
          <Separator inset={spacing.lg} />
          <ListItem icon="clock" title="Last sync" description={google.lastSyncAt ? new Date(google.lastSyncAt).toLocaleString() : 'Never'} />
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            {google.status === 'connected'
              ? <Button label={busy ? 'Syncing…' : 'Sync now'} icon="restore" variant="outline" block disabled={busy} onPress={sync} />
              : <Button label="Reconnect" icon="globe" block disabled={busy} onPress={connect} />}
            <Button label="Disconnect" variant="destructive-outline" block disabled={busy} onPress={disconnect} />
            {message ? <Text variant="caption" tone={message.tone}>{message.text}</Text> : null}
          </View>
        </>
      ) : (
        <Empty icon="apps" title="Connect Google" description={unavailable ?? 'See your agenda, add events, and sync tasks. KIPP only writes after you approve.'}>
          <Button label={busy ? 'Connecting…' : 'Connect Google'} icon="globe" disabled={!!unavailable || busy} onPress={connect} />
          {message ? <Text variant="caption" tone={message.tone} style={{ marginTop: spacing.md, textAlign: 'center' }}>{message.text}</Text> : null}
        </Empty>
      )}
    </Card>
  );
}
