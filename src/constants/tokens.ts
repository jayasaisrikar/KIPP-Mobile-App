import { Appearance } from 'react-native';
import Storage from '../lib/storage';

// KIPP design tokens — ported from the coss ui themes (https://coss.com/ui/docs/styling).
// coss ui is a web (Base UI + Tailwind) library, so its tokens are re-expressed here as RN values.
//
// The palette is chosen once at startup, because styles are created at module load.
// Changing the theme (or the system appearance, in "system" mode) reloads the app.

// coss ui dark theme.
const dark = {
  // Deep night palette with crimson accents and glassy surfaces.
  background: '#080F1B',
  card: '#222933',
  popover: '#29333E',
  foreground: '#F2F7F7',
  primary: '#DC143C',
  primaryForeground: '#FFFFFF',
  secondary: 'rgba(255,255,255,0.07)',
  muted: 'rgba(255,255,255,0.05)',
  mutedForeground: '#8C9C9F',
  accent: 'rgba(255,255,255,0.09)', // hover / pressed surface
  border: 'rgba(255,255,255,0.09)',
  input: 'rgba(255,255,255,0.12)',
  ring: '#DC143C',
  destructive: '#F15757',
  destructiveForeground: '#F87171',
  destructiveTint: 'rgba(239,68,68,0.10)',
  info: '#3B82F6',
  infoForeground: '#60A5FA',
  infoTint: 'rgba(59,130,246,0.10)',
  success: '#10B981',
  successForeground: '#34D399',
  successTint: 'rgba(16,185,129,0.10)',
  warning: '#F59E0B',
  warningForeground: '#FBBF24',
  warningTint: 'rgba(245,158,11,0.10)',
  // KIPP's own identity colour, used sparingly (face, listening state).
  brand: '#F0435F',
  brandTint: 'rgba(240,67,95,0.16)',
  // Pressed states and KIPP's face, which need per-theme values.
  primaryPressed: '#B01030',
  surfacePressed: '#2A1D22',
  destructivePressed: '#D94B4B',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: 'rgba(255,255,255,0.07)',
  faceHead: '#F4F1EA',
  faceEdge: 'rgba(255,255,255,0.6)',
  faceInk: '#2B2B2B',
  blush: 'rgba(244,143,143,0.45)',
  white: '#FFFFFF',
  black: '#000000',
};

type Palette = Record<keyof typeof dark, string>;

// coss ui light theme.
const light: Palette = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  popover: '#FFFFFF',
  foreground: '#262626', // neutral-800
  primary: '#DC143C',
  primaryForeground: '#FFFFFF',
  secondary: 'rgba(0,0,0,0.04)',
  muted: 'rgba(0,0,0,0.04)',
  mutedForeground: '#6B6B6B', // neutral-500 mixed toward foreground
  accent: 'rgba(0,0,0,0.04)',
  border: 'rgba(0,0,0,0.08)',
  input: 'rgba(0,0,0,0.10)',
  ring: '#A3A3A3',
  destructive: '#EF4444',
  destructiveForeground: '#B91C1C',
  destructiveTint: 'rgba(239,68,68,0.08)',
  info: '#3B82F6',
  infoForeground: '#1D4ED8',
  infoTint: 'rgba(59,130,246,0.08)',
  success: '#10B981',
  successForeground: '#047857',
  successTint: 'rgba(16,185,129,0.08)',
  warning: '#F59E0B',
  warningForeground: '#B45309',
  warningTint: 'rgba(245,158,11,0.10)',
  brand: '#DC143C',
  brandTint: 'rgba(220,20,60,0.12)',
  primaryPressed: '#B0102F',
  surfacePressed: '#F2F2F2',
  destructivePressed: '#DC2626',
  overlay: 'rgba(0,0,0,0.32)',
  skeleton: 'rgba(0,0,0,0.06)',
  faceHead: '#F4F1EA',
  faceEdge: 'rgba(0,0,0,0.08)',
  faceInk: '#2B2B2B',
  blush: 'rgba(244,143,143,0.45)',
  white: '#FFFFFF',
  black: '#000000',
};

export type ThemePreference = 'system' | 'light' | 'dark';
const THEME_KEY = 'kipp-theme';

function readPreference(): ThemePreference {
  try {
    const v = Storage.getItemSync(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export const themePreference = readPreference();
export const resolveScheme = (pref: ThemePreference): 'light' | 'dark' =>
  pref === 'system' ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark') : pref;
export const scheme = resolveScheme(themePreference);
export const saveThemePreference = (pref: ThemePreference) => Storage.setItemSync(THEME_KEY, pref);

export const colors: Palette = scheme === 'light' ? light : dark;

// Ambient screen wash and hero fills (CSS gradient strings, rendered natively via backgroundImage).
export const gradients = scheme === 'light'
  ? {
      screen: 'linear-gradient(180deg, #FBE3E7 0%, #FFFFFF 45%)',
      hero: 'linear-gradient(135deg, #E8344F 0%, #A50E2D 100%)',
      talk: 'radial-gradient(circle at 50% 18%, #F5A3B1 0%, #FBEAED 45%, #FFFFFF 85%)',
    }
  : {
      screen: 'radial-gradient(ellipse at 0% 0%, rgba(220,20,60,0.30) 0%, transparent 30%), radial-gradient(ellipse at 100% 100%, rgba(110,18,42,0.38) 0%, transparent 42%), linear-gradient(180deg, #080F1B 0%, #080F1B 100%)',
      hero: 'linear-gradient(120deg, #C8102E 0%, #E0284A 60%, #9E0C28 100%)',
      talk: 'radial-gradient(ellipse at 18% 12%, #D4173F 0%, rgba(170,16,48,0.75) 19%, transparent 51%), radial-gradient(ellipse at 100% 95%, #3B1520 0%, transparent 42%), linear-gradient(180deg, #3A0C17 0%, #080F1B 62%, #080F1B 100%)',
    };

// coss --radius: 0.625rem → 10
export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  xxl: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodySm: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  overline: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' as const },
} as const;

// coss pairs translucent borders with soft bottom shadows for depth.
const shadowScale = scheme === 'light' ? 0.25 : 1;
export const shadows = {
  xs: { shadowColor: colors.black, shadowOpacity: 0.24 * shadowScale, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sm: { shadowColor: colors.black, shadowOpacity: 0.28 * shadowScale, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  lg: { shadowColor: colors.black, shadowOpacity: 0.4 * shadowScale, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;

// Motion: short, eased, never bouncy. One curve everywhere (iOS-style ease-out).
export const motion = {
  fast: 120,
  base: 200,
  slow: 260,
  easing: [0.25, 0.1, 0.25, 1] as const,
} as const;
