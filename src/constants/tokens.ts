// KIPP design tokens — ported from the coss ui dark theme (https://coss.com/ui/docs/styling).
// coss ui is a web (Base UI + Tailwind) library, so its tokens are re-expressed here as RN values.
export const colors = {
  background: '#161616', // neutral-950 95% + white
  card: '#1B1B1B', // background 98% + white
  popover: '#1B1B1B',
  foreground: '#F5F5F5', // neutral-100
  primary: '#F5F5F5',
  primaryForeground: '#262626', // neutral-800
  secondary: 'rgba(255,255,255,0.05)',
  muted: 'rgba(255,255,255,0.04)',
  mutedForeground: '#8A8A8A', // neutral-500 90% + white
  accent: 'rgba(255,255,255,0.06)', // hover / pressed surface
  border: 'rgba(255,255,255,0.08)',
  input: 'rgba(255,255,255,0.10)',
  ring: '#737373',
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
  brand: '#8FA9BC',
  brandTint: 'rgba(143,169,188,0.14)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

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
export const shadows = {
  xs: { shadowColor: colors.black, shadowOpacity: 0.24, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sm: { shadowColor: colors.black, shadowOpacity: 0.28, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  lg: { shadowColor: colors.black, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;

export const motion = {
  fast: 150,
  base: 200,
  slow: 250,
} as const;
