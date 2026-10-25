// KIPP design tokens — Apple-inspired, matte, restrained.
export const colors = {
  bg: '#101317',
  bgElev: '#171B21',
  bgElev2: '#1F242C',
  surface: '#1A1F26',
  surface2: '#242A33',
  border: '#2A313B',
  borderSoft: '#232933',
  text: '#F4F3F0',
  textMuted: '#A8ADB5',
  textDim: '#6B7280',
  accent: '#8FA9BC', // misty blue
  accentSoft: '#8FA9BC22',
  olive: '#78856B',
  danger: '#C97A7A',
  success: '#7FA08A',
  warning: '#C9A86A',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
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

export const typography = {
  display: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '600' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.2 },
} as const;

export const motion = {
  fast: 150,
  base: 200,
  slow: 250,
} as const;
