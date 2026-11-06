import React from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors, radii, spacing } from '../src/constants/tokens';
import { Badge, Button, Card, CardHeader, Empty, ListItem, Progress, Screen, Separator, Text, type IconName } from '../src/components/ui';
import { offersFallback, TEST_DURATION_MS, useAudioDeviceTest } from '../src/hooks/useAudioDeviceTest';
import type { AudioDevice } from '../modules/kipp-audio';

const typeIcon: Record<AudioDevice['type'], IconName> = {
  bluetooth: 'voice',
  wired: 'attach',
  usb: 'attach',
  built_in: 'mic',
  unknown: 'mic',
};

const secs = (ms: number) => `0:${String(Math.floor(ms / 1000)).padStart(2, '0')}`;
const ms = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)} ms`);

export default function AudioTestScreen() {
  const t = useAudioDeviceTest();
  const inputs = t.routing?.availableInputs ?? [];
  const outputs = t.routing?.availableOutputs ?? [];
  const busy = t.phase !== 'idle';
  const recording = t.phase === 'recording' || t.phase === 'stopping';
  const selected = inputs.find((d) => d.id === t.selectedId) ?? null;
  const phoneMic = inputs.find((d) => d.type === 'built_in');

  const player = useAudioPlayer(t.result?.filePath ? { uri: t.result.filePath } : null);
  const playback = useAudioPlayerStatus(player);
  const togglePlay = () => {
    if (playback.playing) return player.pause();
    if (playback.didJustFinish || (playback.duration > 0 && playback.currentTime >= playback.duration - 0.05)) player.seekTo(0);
    player.play();
  };
  const deleteRecording = async () => {
    player.pause();
    await t.discard();
  };

  const close = (
    <Button icon="close" size="icon-sm" variant="ghost" accessibilityLabel="Close audio test" onPress={() => (router.canGoBack() ? router.back() : router.replace('/you?section=devices'))} />
  );

  if (Platform.OS !== 'android' || !t.available) {
    return (
      <Screen title="Audio test" subtitle="Microphone routing diagnostics" right={close}>
        <Card>
          <Empty
            icon="mic"
            title={Platform.OS === 'android' ? 'Native audio module missing' : 'Android only for now'}
            description={
              Platform.OS === 'android'
                ? 'This build doesn\'t include KIPP\'s audio module. Rebuild the development build with npx expo run:android. Expo Go is not supported.'
                : 'Earbud microphone routing is being validated on Android first.'
            }
          />
        </Card>
      </Screen>
    );
  }

  const res = t.result;
  const elapsed = recording ? t.status?.elapsedMs ?? 0 : res?.durationMs ?? 0;
  const actualId = recording ? t.status?.actualInputId : res?.actualInput?.id;
  const confirmed = recording ? !!t.status?.routeConfirmed : !!res?.routeConfirmed;

  const inputBadge = (d: AudioDevice) => {
    if (recording && d.id === actualId && confirmed) return <Badge label="Capturing" variant="success" dot />;
    if (recording && d.id === t.selectedId) return <Badge label={t.phase === 'stopping' ? 'Stopping' : 'Requested'} variant="info" dot />;
    if (d.type === 'bluetooth' && d.isCommunicationDevice === false) return <Badge label="Mic unavailable" variant="warning" />;
    if (d.id === t.selectedId) return <Badge label="Selected" variant="default" />;
    return <Badge label="Connected" variant="outline" />;
  };

  return (
    <Screen title="Audio test" subtitle="Check which microphone KIPP actually hears you through" right={close}>
      {t.permission === 'blocked' || t.error?.code === 'PERMISSION_DENIED' ? (
        <Card>
          <CardHeader
            title="Microphone access needed"
            description={t.permission === 'blocked'
              ? 'Microphone access is turned off for KIPP. Allow it in Settings › Apps › KIPP › Permissions, then come back.'
              : 'KIPP only records when you tap Start test. Nothing leaves this phone.'}
          />
          <View style={styles.actions}>
            {t.permission === 'blocked'
              ? <Button label="Open settings" icon="settings" variant="outline" block onPress={() => Linking.openSettings()} />
              : <Button label="Allow microphone" icon="mic" block onPress={() => t.start()} />}
          </View>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Microphones"
          description="Earbuds already paired in Android Bluetooth settings appear here"
          action={<Button icon="restore" size="icon-sm" variant="ghost" accessibilityLabel="Refresh devices" onPress={t.refresh} disabled={busy} />}
        />
        {inputs.length === 0 ? (
          <Empty icon="mic" title={t.routing ? 'No microphones found' : 'Looking for audio devices…'} description={t.routing ? 'Connect earbuds or a headset — the list updates automatically.' : undefined} />
        ) : inputs.map((d) => (
          <React.Fragment key={d.id}>
            <Separator />
            <ListItem
              icon={typeIcon[d.type]}
              iconColor={d.id === t.selectedId ? colors.primary : undefined}
              title={d.name}
              description={d.typeName + (d.sampleRates.length ? ` · ${d.sampleRates.map((r) => `${r / 1000}k`).join('/')} Hz` : '')}
              trailing={inputBadge(d)}
              onPress={busy ? undefined : () => t.setSelectedId(d.id)}
            />
          </React.Fragment>
        ))}
      </Card>

      <Card>
        <CardHeader title="Microphone test" description={selected ? `Records about 15 seconds from ${selected.name}` : 'Select a microphone first'} />
        <View style={styles.panel}>
          {recording ? (
            <View style={styles.recRow} accessibilityLiveRegion="polite">
              <View style={styles.recDot} />
              <Text variant="label">Recording</Text>
              <Text variant="label" tone="muted">{secs(elapsed)} / {secs(TEST_DURATION_MS)}</Text>
            </View>
          ) : null}
          <Progress value={elapsed / TEST_DURATION_MS} label={recording ? 'Duration' : res ? 'Recorded' : 'Duration'} detail={secs(elapsed)} />
          {recording ? <Progress value={Math.min(1, (t.status?.peakLevel ?? 0) * 1.5)} label="Input level" detail={confirmed ? 'Route confirmed' : 'Confirming route…'} /> : null}
          {recording ? (
            <Button label={t.phase === 'stopping' ? 'Stopping…' : 'Stop test'} icon="stop" variant="destructive" block disabled={t.phase === 'stopping'} onPress={t.stop} />
          ) : (
            <Button label={t.phase === 'starting' ? 'Connecting microphone…' : 'Start test'} icon="mic" block disabled={!selected || t.phase === 'starting'} onPress={() => t.start()} />
          )}
          {res?.filePath && !recording ? (
            <View style={styles.row}>
              <Button label={playback.playing ? 'Pause' : 'Play recording'} icon={playback.playing ? 'stop' : 'voice'} variant="outline" style={{ flex: 1 }} onPress={togglePlay} />
              <Button icon="trash" size="icon" variant="destructive-outline" accessibilityLabel="Delete recording" onPress={deleteRecording} />
            </View>
          ) : null}
        </View>
      </Card>

      {t.error ? (
        <Card>
          <CardHeader title={t.error.code === 'PERMISSION_DENIED' ? 'Permission' : 'Routing problem'} description={t.error.message} />
          <View style={styles.actions}>
            <Text variant="caption" tone="muted">Code: {t.error.code}</Text>
            {offersFallback(t.error.code) && phoneMic && t.error.deviceId !== phoneMic.id ? (
              <Button label="Test with phone microphone instead" icon="mic" variant="outline" block disabled={busy} onPress={() => t.start(phoneMic.id)} />
            ) : null}
            <Button label="Dismiss" variant="ghost" block onPress={t.clearError} />
          </View>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Diagnostics" description="Reported by Android — nothing is estimated" />
        <Separator />
        <View style={styles.panel}>
          <Row k="Requested microphone" v={(recording ? selected?.name : res?.requestedInput.name) ?? '—'} />
          <Row k="Actual recording device" v={(recording ? inputs.find((d) => d.id === actualId)?.name : res?.actualInput?.name) ?? (busy || res ? 'Not reported by Android' : '—')} />
          <Row k="Device type" v={(recording ? inputs.find((d) => d.id === actualId)?.typeName : res?.actualInput?.typeName) ?? '—'} />
          <Row k="Route verified" v={busy || res ? (confirmed ? 'Yes' : 'No') : '—'} />
          <Row k="Sample rate" v={(t.startInfo ?? res) ? `${(t.startInfo ?? res)!.sampleRate} Hz` : '—'} />
          <Row k="Channels / encoding" v={(t.startInfo ?? res) ? `${(t.startInfo ?? res)!.channelCount} · 16-bit PCM` : '—'} />
          <Row k="Audio source" v={(t.startInfo ?? res)?.audioSource ?? '—'} />
          <Row k="Recorded duration" v={busy || res ? `${(elapsed / 1000).toFixed(2)} s` : '—'} />
          <Row k="Captured bytes" v={busy || res ? `${(recording ? t.status?.bytes : res?.bytes) ?? 0}` : '—'} />
          <Row k="Peak level" v={res ? `${Math.round(res.peakLevel * 100)}%${res.peakLevel === 0 ? ' (silence — no signal)' : ''}` : '—'} />
          <Row k="Read errors / empty reads" v={res ? `${res.readErrors} / ${res.zeroReads}` : recording ? `${t.status?.readErrors ?? 0}` : '—'} />
          <Row k="Recording status" v={t.phase !== 'idle' ? t.phase : res ? `${res.status} (${res.stopCode})` : 'idle'} />
          <Row k="Playback status" v={!res?.filePath ? 'No recording' : playback.playing ? 'Playing' : playback.isLoaded ? 'Ready' : 'Loading'} />
          <Row k="Device discovery" v={ms(t.routing?.discoveryMs)} />
          <Row k="Route request → accepted" v={ms((t.startInfo ?? res)?.communicationRouteConfirmMs)} />
          <Row k="Route request → capture confirmed" v={ms(res?.captureConfirmMs)} />
          <Row k="Recorder init" v={ms((t.startInfo ?? res)?.recorderInitMs)} />
          <Row k="Android API" v={t.routing ? String(t.routing.androidSdkInt) : '—'} />
        </View>
      </Card>

      {t.events.length ? (
        <Card>
          <CardHeader title="Route events" description="Routing changes during the last test" />
          <Separator />
          <View style={styles.panel}>
            {t.events.map((e, i) => (
              <Text key={i} variant="caption" tone={e.type === 'stop' || e.type.includes('changed') ? 'warning' : 'muted'}>
                +{e.atMs} ms · {e.message}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Outputs" description="Where Android plays sound. Playback uses the system route." />
        {outputs.map((d) => (
          <React.Fragment key={d.id}>
            <Separator />
            <ListItem
              icon={typeIcon[d.type]}
              title={d.name}
              description={d.typeName}
              trailing={d.id === t.routing?.communicationDeviceId ? <Badge label="Call route" variant="info" dot /> : <Badge label="Connected" variant="outline" />}
            />
          </React.Fragment>
        ))}
      </Card>

      <Text variant="caption" tone="muted" style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}>
        Recordings stay in KIPP&apos;s private storage, are never uploaded, and are deleted when you leave this screen.
      </Text>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text variant="bodySm" tone="muted" style={{ flexShrink: 0 }}>{k}</Text>
      <Text variant="bodySm" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  actions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.destructive },
  kv: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
});
