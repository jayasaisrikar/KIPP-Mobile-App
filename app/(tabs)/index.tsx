import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, gradients, spacing } from '../../src/constants/tokens';
import { Orb } from '../../src/components/kipp/Orb';
import { Icon, PressableScale, Screen, Text, type IconName } from '../../src/components/ui';
import { useAppStore } from '../../src/stores/appStore';

const promptGroups: Record<string, string[]> = {
  Reminders: ['Remind me to water the plants every Wednesday at 9 AM', 'Remind me to call mom at 6pm today'],
  Tasks: ['Add a task to renew my passport this month', 'What should I focus on today?'],
  Memory: ['Remember that I prefer window seats', 'What do you remember about me?'],
  Calendar: ['What does my week look like?', 'Am I free tomorrow afternoon?'],
};
const groups = Object.keys(promptGroups);

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

const ask = (prompt?: string) => router.navigate(prompt ? { pathname: '/talk', params: { prompt, t: Date.now().toString() } } : '/talk');

export default function HomeScreen() {
  const user = useAppStore((s) => s.user);
  const tasks = useAppStore((s) => s.tasks);
  const reminders = useAppStore((s) => s.reminders);
  const events = useAppStore((s) => s.events);
  const messages = useAppStore((s) => s.messages);
  const [group, setGroup] = useState(groups[0]);
  const nowIso = new Date().toISOString();
  const openTasks = tasks.filter((t) => t.status === 'todo');
  const activeReminders = reminders.filter((r) => r.enabled && r.triggerAt > nowIso);
  const soonEvents = events.filter((e) => (e.end ?? e.start) > nowIso);

  const upNext = [
    ...soonEvents.slice(0, 3).map((e) => ({ id: e.id, title: e.title, sub: e.allDay ? 'All day' : formatWhen(e.start) })),
    ...activeReminders.slice(0, 3).map((r) => ({ id: r.id, title: r.title, sub: formatWhen(r.triggerAt) })),
  ];
  const lastKipp = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.logo}><Icon name="sparkles" size={14} color={colors.white} /></View>
          <Text style={styles.brandText}>KIPP</Text>
        </View>
        <PressableScale onPress={() => router.navigate('/you')} style={styles.ghostPill}>
          <Text style={styles.ghostPillText}>{user?.nickname || user?.displayName?.split(' ')[0] || 'You'}</Text>
          <Icon name="person" size={14} color={colors.foreground} />
        </PressableScale>
      </View>

      <View style={styles.hero}>
        <Orb size={220} style={styles.heroOrb} />
        <Text style={styles.heroEyebrow}>Your companion</Text>
        <Text style={styles.heroTitle}>What can I do for{'\n'}you today?</Text>
        <PressableScale onPress={() => ask()} style={styles.heroCta}>
          <Text style={styles.heroCtaText}>Chat with KIPP</Text>
          <Icon name="chevronRight" size={14} color="#0B1A1C" />
        </PressableScale>
      </View>

      <View style={styles.tiles}>
        <Tile icon="bell" title={`Reminders`} meta={`${activeReminders.length} active`} onPress={() => router.navigate('/plans')} />
        <Tile icon="task" title="Tasks" meta={`${openTasks.length} open`} onPress={() => router.navigate('/plans')} />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Popular prompts" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          {groups.map((g) => (
            <PressableScale key={g} onPress={() => setGroup(g)} style={[styles.chip, g === group && styles.chipActive]}>
              <Text style={[styles.chipText, g === group && { color: colors.white }]}>{g}</Text>
            </PressableScale>
          ))}
        </ScrollView>
        {promptGroups[group].map((p) => (
          <PressableScale key={p} onPress={() => ask(p)} style={styles.promptRow}>
            <Icon name="chat" size={16} color={colors.mutedForeground} />
            <Text numberOfLines={1} style={styles.promptText}>{p}</Text>
            <Icon name="chevronRight" size={13} color={colors.mutedForeground} />
          </PressableScale>
        ))}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Continue" onPress={() => ask()} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          {lastKipp && (
            <PressableScale onPress={() => ask()} style={styles.convoCard}>
              <Text style={styles.convoTitle} numberOfLines={1}>Last conversation</Text>
              <Text style={styles.convoSub} numberOfLines={2}>“{lastKipp.content}”</Text>
            </PressableScale>
          )}
          {upNext.map((x) => (
            <PressableScale key={x.id} onPress={() => router.navigate('/plans')} style={styles.convoCard}>
              <Text style={styles.convoTitle} numberOfLines={1}>{x.title}</Text>
              <Text style={styles.convoSub} numberOfLines={2}>{x.sub}</Text>
            </PressableScale>
          ))}
          {!lastKipp && upNext.length === 0 && (
            <View style={styles.convoCard}>
              <Text style={styles.convoTitle}>Nothing yet</Text>
              <Text style={styles.convoSub}>Ask KIPP something to get started.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

function SectionTitle({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} disabled={!onPress} style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{title}</Text>
      <Icon name="chevronRight" size={14} color={colors.foreground} />
    </PressableScale>
  );
}

function Tile({ icon, title, meta, onPress }: { icon: IconName; title: string; meta: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.tile}>
      <View style={styles.tileIcon}><Icon name={icon} size={18} color={colors.white} /></View>
      <View style={styles.tileFoot}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>{title}</Text>
          <Text style={styles.tileMeta}>{meta}</Text>
        </View>
        <Icon name="chevronRight" size={14} color={colors.foreground} />
      </View>
    </PressableScale>
  );
}

const glass = { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.08)' } as const;

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: fonts.semibold, fontSize: 22, color: colors.foreground, letterSpacing: -0.4 },
  ghostPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 999, ...glass },
  ghostPillText: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },

  hero: { borderRadius: 22, overflow: 'hidden', padding: 20, minHeight: 200, backgroundImage: gradients.hero },
  heroOrb: { position: 'absolute', right: -62, bottom: -45 },
  heroEyebrow: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroTitle: { fontFamily: fonts.regular, fontSize: 26, lineHeight: 34, color: colors.white, marginTop: 8, letterSpacing: -0.4 },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 'auto', paddingHorizontal: 16, height: 38, borderRadius: 999, backgroundColor: colors.white },
  heroCtaText: { fontFamily: fonts.medium, fontSize: 14, color: '#0B1A1C' },

  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, height: 150, borderRadius: 20, padding: 16, justifyContent: 'space-between', ...glass },
  tileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(23,183,156,0.35)' },
  tileFoot: { flexDirection: 'row', alignItems: 'center' },
  tileTitle: { fontFamily: fonts.regular, fontSize: 16, color: colors.foreground },
  tileMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionText: { fontFamily: fonts.regular, fontSize: 18, color: colors.foreground },
  chipsScroll: { marginHorizontal: -spacing.lg },
  chips: { gap: 10, paddingHorizontal: spacing.lg },
  chip: { height: 44, paddingHorizontal: 20, borderRadius: 999, justifyContent: 'center', ...glass },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.regular, fontSize: 16, color: colors.foreground },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 16, borderRadius: 999, ...glass },
  promptText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },

  convoCard: { width: 180, minHeight: 92, borderRadius: 18, padding: 14, gap: 6, ...glass },
  convoTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.foreground },
  convoSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
});
