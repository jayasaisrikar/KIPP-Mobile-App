import React from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { colors } from '../../constants/tokens';
import { useAppStore } from '../../stores/appStore';

type Props = { size?: number; emotion?: string; phase?: string };

export function KippFace({ size = 96, emotion = 'neutral', phase = 'idle' }: Props) {
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const eyeOffset = phase === 'listening' ? 0.18 : phase === 'thinking' ? 0.28 : phase === 'speaking' ? 0.12 : 0.08;
const blinkRef = React.useRef<Animated.Value | null>(null);
  if (blinkRef.current === null) blinkRef.current = new Animated.Value(1);

  React.useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(blinkRef.current!, { toValue: 0.15, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(blinkRef.current!, { toValue: 1, duration: 120, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
}, [reducedMotion]);

  const eyeColor = phase === 'listening' ? colors.accent : phase === 'thinking' ? colors.warning : colors.text;
  const r = size * 0.34;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSoft }}>
        <View style={{ flexDirection: 'row', gap: size * 0.18 }}>
          {[0, 1].map((i) => (
            <Animated.View
              key={i}
              style={{
                width: r,
                height: r,
                borderRadius: r / 2,
                backgroundColor: eyeColor,
                transform: [{ translateX: i === 0 ? -eyeOffset * size * 0.4 : eyeOffset * size * 0.4 }] as any,
                opacity: phase === 'thinking' ? 0.9 : 1,
              }}
            />
          ))}
        </View>
        <View style={{ marginTop: size * 0.18, width: size * 0.22, height: 3, borderRadius: 2, backgroundColor: colors.textMuted, opacity: 0.6 }} />
      </View>
    </View>
  );
}
