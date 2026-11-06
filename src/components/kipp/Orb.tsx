import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useAppStore } from '../../stores/appStore';
import FluidOrb from './FluidOrb';

type Props = { size?: number; phase?: string; style?: StyleProp<ViewStyle> };

export function Orb({ size = 220, phase = 'idle', style }: Props) {
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setSystemReducedMotion(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);

  return (
    <View pointerEvents="none" accessible={false} style={[{ width: size, height: size }, style]}>
      <FluidOrb size={size} phase={phase} running={focused && foreground} reducedMotion={reducedMotion || systemReducedMotion}
        dom={{ scrollEnabled: false, style: { width: size, height: size, backgroundColor: 'transparent' } }} />
    </View>
  );
}
