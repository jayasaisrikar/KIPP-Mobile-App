import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../src/constants/tokens';
import { KippFace } from '../src/components/kipp/KippFace';
import { PrimaryButton, GhostButton } from '../src/components/ui/primitives';
import { useAppStore } from '../src/stores/appStore';

export default function OnboardingScreen() {
  const setUser = useAppStore((s) => s.setUser);
  const setOnboardingDone = useAppStore((s) => s.setOnboardingDone);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');

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
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
      <View style={{ alignItems: 'center', marginBottom: spacing.xxxl }}>
        <KippFace size={120} phase="idle" />
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '700', marginTop: spacing.lg }}>KIPP</Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: spacing.sm, textAlign: 'center' }}>The little companion that remembers what matters.</Text>
      </View>

      {step === 0 && (
        <View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: spacing.md }}>What should I call you?</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.textDim} style={{ backgroundColor: colors.surface2, borderRadius: 14, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.text, fontSize: 16, marginBottom: spacing.md }} />
          <TextInput value={nickname} onChangeText={setNickname} placeholder="Nickname (optional)" placeholderTextColor={colors.textDim} style={{ backgroundColor: colors.surface2, borderRadius: 14, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.text, fontSize: 16, marginBottom: spacing.xl }} />
          <PrimaryButton label="Continue" onPress={() => setStep(1)} />
          <View style={{ height: spacing.md }} />
          <GhostButton label="Skip for now" onPress={() => setStep(3)} />
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: spacing.md }}>Permissions, one at a time</Text>
          <PermissionRow title="Microphone" body="Only when you press and hold to talk. No background recording." />
          <PermissionRow title="Notifications" body="So reminders actually fire. You control quiet hours." />
          <PermissionRow title="Calendar (optional)" body="Read agenda and create events after you approve." />
          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label="Continue" onPress={() => setStep(2)} />
          </View>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: spacing.md }}>Connect Google (optional)</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.xl }}>KIPP talks to Google Calendar and Tasks only with your explicit permission. You can skip and connect later.</Text>
          <PrimaryButton label="Connect Google" onPress={() => setStep(3)} />
          <View style={{ height: spacing.md }} />
          <GhostButton label="Skip for now" onPress={() => setStep(3)} />
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: spacing.md }}>{"You're set."}</Text>
<Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.xl }}>KIPP works fully in text mode. Add voice, reminders, and integrations anytime.</Text>
          <PrimaryButton label="Start using KIPP" onPress={finish} />
        </View>
      )}
    </ScrollView>
  );
}

function PermissionRow({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderSoft }}>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{body}</Text>
    </View>
  );
}
