import React from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { colors, shadows } from '../../constants/tokens';
import { useAppStore } from '../../stores/appStore';

type Props = { size?: number; emotion?: string; phase?: string };

// A soft, rounded little robot: big glossy eyes, blush, tiny smile.
// Eyes squint into happy arcs when speaking/happy, glance sideways while thinking.
export function KippFace({ size = 96, emotion = 'neutral', phase = 'idle' }: Props) {
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const [blink] = React.useState(() => new Animated.Value(1));
  const [bob] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (reducedMotion) return;
    const blinking = Animated.loop(
      Animated.sequence([
        Animated.delay(3200),
        Animated.timing(blink, { toValue: 0.1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const bobbing = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    blinking.start();
    bobbing.start();
    return () => { blinking.stop(); bobbing.stop(); };
  }, [reducedMotion, blink, bob]);

  const happy = phase === 'speaking' || emotion === 'happy';
  const glance = phase === 'thinking' ? size * 0.05 : 0;
  const eyeColor = phase === 'listening' ? colors.brand : '#2B2B2B';
  const ringColor = phase === 'listening' ? colors.brandTint : phase === 'thinking' ? colors.warningTint : phase === 'action' ? colors.infoTint : 'transparent';

  const ring = Math.max(3, size * 0.06);
  const eyeW = size * 0.17;
  const eyeH = size * 0.22;
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.025] });

  return (
    <View style={{ width: size + ring * 2, height: size + ring * 2, borderRadius: size * 0.4, backgroundColor: ringColor, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.head, shadows.sm, { width: size, height: size, borderRadius: size * 0.36, transform: [{ translateY }] }]}>
        <View style={{ flexDirection: 'row', gap: size * 0.2, marginTop: size * 0.04, transform: [{ translateX: glance }, { translateY: -glance * 0.6 }] }}>
          {[0, 1].map((i) =>
            happy ? (
              // Happy "^^" eyes: the top half of a thick ring.
              <View key={i} style={{ width: eyeW * 1.15, height: eyeW * 0.62, overflow: 'hidden' }}>
                <View style={{ width: eyeW * 1.15, height: eyeW * 1.15, borderRadius: eyeW, borderWidth: Math.max(2, size * 0.04), borderColor: eyeColor }} />
              </View>
            ) : (
              <Animated.View key={i} style={{ width: eyeW, height: eyeH, borderRadius: eyeW / 2, backgroundColor: eyeColor, transform: [{ scaleY: blink }] }}>
                <View style={{ position: 'absolute', top: eyeH * 0.16, left: eyeW * 0.2, width: eyeW * 0.38, height: eyeW * 0.38, borderRadius: eyeW, backgroundColor: colors.white }} />
              </Animated.View>
            ),
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.1, marginTop: size * 0.05 }}>
          <View style={[styles.blush, { width: size * 0.14, height: size * 0.07, borderRadius: size }]} />
          {/* Tiny smile: bottom half of a ring; an "o" while listening. */}
          {phase === 'listening' ? (
            <View style={{ width: size * 0.08, height: size * 0.08, borderRadius: size, backgroundColor: '#2B2B2B' }} />
          ) : (
            <View style={{ width: size * 0.14, height: size * 0.07, overflow: 'hidden' }}>
              <View style={{ marginTop: -size * 0.07, width: size * 0.14, height: size * 0.14, borderRadius: size, borderWidth: Math.max(1.5, size * 0.025), borderColor: '#2B2B2B' }} />
            </View>
          )}
          <View style={[styles.blush, { width: size * 0.14, height: size * 0.07, borderRadius: size }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: '#F4F1EA', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.6)' },
  blush: { backgroundColor: 'rgba(244,143,143,0.45)' },
});
