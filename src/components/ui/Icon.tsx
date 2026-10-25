import React from 'react';
import type { ColorValue } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { colors } from '../../constants/tokens';

// One name per concept, mapped to SF Symbols (iOS) and Material Symbols (Android / web).
const icons = {
  home: { ios: 'house', android: 'home' },
  talk: { ios: 'bubble.left.and.bubble.right', android: 'forum' },
  plans: { ios: 'checklist', android: 'checklist' },
  you: { ios: 'person.crop.circle', android: 'account_circle' },
  send: { ios: 'arrow.up', android: 'arrow_upward' },
  mic: { ios: 'mic', android: 'mic' },
  check: { ios: 'checkmark', android: 'check' },
  close: { ios: 'xmark', android: 'close' },
  stop: { ios: 'stop.fill', android: 'stop' },
  bell: { ios: 'bell', android: 'notifications' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  clock: { ios: 'clock', android: 'schedule' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  memory: { ios: 'brain', android: 'psychology' },
  apps: { ios: 'square.grid.2x2', android: 'apps' },
  device: { ios: 'applewatch', android: 'watch' },
  settings: { ios: 'gearshape', android: 'settings' },
  trash: { ios: 'trash', android: 'delete' },
  restore: { ios: 'arrow.uturn.backward', android: 'undo' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left' },
  inbox: { ios: 'tray', android: 'inbox' },
  globe: { ios: 'globe', android: 'public' },
  shield: { ios: 'lock.shield', android: 'shield' },
  voice: { ios: 'waveform', android: 'graphic_eq' },
  person: { ios: 'person', android: 'person' },
  task: { ios: 'checkmark.circle', android: 'check_circle' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 18, color = colors.foreground }: { name: IconName; size?: number; color?: ColorValue }) {
  const { ios, android } = icons[name];
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} style={{ width: size, height: size }} />;
}
