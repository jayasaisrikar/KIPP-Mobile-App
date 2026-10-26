import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../src/constants/tokens';
import { KippFace } from '../src/components/kipp/KippFace';
import { Button, Card, Field, Input, ListItem, Progress, Separator, Text, type IconName } from '../src/components/ui';
import { useAppStore } from '../src/stores/appStore';
import { ensureNotificationPermission } from '../src/lib/actions';
import { setApiKey } from '../src/lib/secrets';

const STEPS = 4;

const permissions: { icon: IconName; title: string; body: string }[] = [
  { icon: 'mic', title: 'Microphone', body: 'Only when you press and hold to talk. No background recording.' },
  { icon: 'bell', title: 'Notifications', body: 'So reminders actually fire. You control quiet hours.' },
  { icon: 'calendar', title: 'Calendar (optional)', body: 'Read agenda and create events after you approve.' },
];

export default function OnboardingScreen() {
  const setUser = useAppStore((s) => s.setUser);
  const setOnboardingDone = useAppStore((s) => s.setOnboardingDone);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [apiKey, setApiKeyDraft] = useState('');

  const finish = () => {
    setUser({
      id: 'local-user',
      displayName: name || 'Friend',
      nickname: nickname || name || 'friend',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      locale: 'en',
      morningTime: '08:00',
      eveningTime: '18:00',
      responseStyle: 'balanced',
      personality: 'balanced',
      memoryEnabled: true,
      retentionDays: 30,
    });
    setOnboardingDone(true);
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          {step > 0 ? (
            <Button variant="ghost" size="icon-sm" icon="chevronLeft" accessibilityLabel="Back" onPress={() => setStep(step - 1)} />
          ) : <View style={{ width: 36 }} />}
          <View style={styles.progress}>
            <Progress value={(step + 1) / STEPS} />
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <KippFace size={96} phase={step === 3 ? 'speaking' : 'idle'} />
            <Text variant="display" style={{ marginTop: spacing.lg }}>KIPP</Text>
            <Text variant="body" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>The little companion that remembers what matters.</Text>
          </View>

          {step === 0 && (
            <View style={styles.section}>
              <Text variant="h2">What should I call you?</Text>
              <Field label="Name">
                <Input value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" textContentType="name" returnKeyType="next" />
              </Field>
              <Field label="Nickname" description="Optional. KIPP will use this in conversation.">
                <Input value={nickname} onChangeText={setNickname} placeholder="e.g. Sam" returnKeyType="done" onSubmitEditing={() => setStep(1)} />
              </Field>
              <View style={styles.actions}>
                <Button label="Continue" onPress={() => setStep(1)} block />
                <Button label="Skip for now" variant="ghost" onPress={() => setStep(3)} block />
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={styles.section}>
              <View>
                <Text variant="h2">Permissions, one at a time</Text>
                <Text variant="bodySm" tone="muted" style={{ marginTop: 4 }}>{"We'll ask for each one only when you first need it."}</Text>
              </View>
              <Card>
                {permissions.map((p, i) => (
                  <React.Fragment key={p.title}>
                    {i > 0 && <Separator inset={spacing.lg + 32 + spacing.md} />}
                    <ListItem icon={p.icon} title={p.title} description={p.body} />
                  </React.Fragment>
                ))}
              </Card>
              <View style={styles.actions}>
                <Button label="Allow notifications" icon="bell" onPress={async () => { await ensureNotificationPermission().catch(() => false); setStep(2); }} block />
                <Button label="Not now" variant="ghost" onPress={() => setStep(2)} block />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.section}>
              <View>
                <Text variant="h2">{"Connect KIPP's brain"}</Text>
                <Text variant="bodySm" tone="muted" style={{ marginTop: 4 }}>Paste your OpenCode Go API key. KIPP uses Muse Spark 1.3 by default; you can change it later in You → Settings.</Text>
              </View>
              <Field label="API key" description="Stored in the device keychain, never shared.">
                <Input value={apiKey} onChangeText={setApiKeyDraft} placeholder="Paste key" secureTextEntry autoCapitalize="none" autoCorrect={false} />
              </Field>
              <View style={styles.actions}>
                <Button label="Save key" icon="check" disabled={!apiKey.trim()} onPress={async () => { await setApiKey(apiKey); setApiKeyDraft(''); setStep(3); }} block />
                <Button label="Skip for now" variant="ghost" onPress={() => setStep(3)} block />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.section}>
              <View>
                <Text variant="h2">{"You're set."}</Text>
                <Text variant="bodySm" tone="muted" style={{ marginTop: 4 }}>KIPP works fully in text mode. Add voice, reminders, and integrations anytime.</Text>
              </View>
              <View style={styles.actions}>
                <Button label="Start using KIPP" size="lg" iconRight="chevronRight" onPress={finish} block />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, height: 48 },
  progress: { width: 120 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', paddingTop: spacing.xl, marginBottom: spacing.xxxl },
  section: { gap: spacing.lg },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
