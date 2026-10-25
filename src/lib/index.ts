import { colors } from '../constants/tokens';

export const kippFace = {
  idle: { left: 0.45, right: 0.55 },
  listening: { left: 0.3, right: 0.7 },
  thinking: { left: 0.2, right: 0.8 },
  speaking: { left: 0.4, right: 0.6 },
} as const;

export function emotionColor(e: string) {
  switch (e) {
    case 'happy': return colors.success;
    case 'curious': return colors.brand;
    case 'skeptical': return colors.warning;
    case 'concerned': return colors.destructive;
    default: return colors.mutedForeground;
  }
}
