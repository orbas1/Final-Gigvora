export const colorTokens = {
  brand: {
    50: '#f0f6ff',
    100: '#dceaff',
    200: '#b9d4ff',
    300: '#88b3ff',
    400: '#5591ff',
    500: '#2a73ff',
    600: '#155ded',
    700: '#104cd1',
    800: '#103fa6',
    900: '#0f3785',
  },
  neutral: {
    50: '#f6f9fc',
    100: '#edf2f9',
    200: '#d9e1ec',
    300: '#b8c5d6',
    400: '#8a9cb8',
    500: '#5c6f8a',
    600: '#43536e',
    700: '#2f3b52',
    800: '#1d283a',
    900: '#0f1729',
  },
  support: {
    success: '#0f9d58',
    warning: '#fbbc05',
    danger: '#ea4335',
    info: '#2a73ff',
  },
}

export const spacingTokens = {
  '3xs': 2,
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
}

export const radiiTokens = {
  xs: 6,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 40,
  pill: 999,
}

export const typographyTokens = {
  fontFamily: {
    sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    '2xl': '1.75rem',
    '3xl': '2.25rem',
    '4xl': '3rem',
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.32,
    normal: 1.48,
    relaxed: 1.64,
  },
  letterSpacing: {
    tight: '-0.01em',
    normal: '0em',
    wide: '0.015em',
  },
}

export const elevationTokens = {
  sm: '0 8px 24px rgba(15, 55, 133, 0.06)',
  md: '0 16px 40px rgba(15, 55, 133, 0.08)',
  lg: '0 32px 80px rgba(15, 55, 133, 0.12)',
}

export const breakpointTokens = {
  xs: 360,
  sm: 600,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

export const zIndexTokens = {
  base: 0,
  raised: 5,
  overlay: 10,
  modal: 100,
  toast: 110,
  tooltip: 120,
}

export const durationTokens = {
  fast: 120,
  standard: 220,
  slow: 320,
}

export const easingTokens = {
  standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
}

export const tokens = {
  color: colorTokens,
  spacing: spacingTokens,
  radii: radiiTokens,
  typography: typographyTokens,
  elevation: elevationTokens,
  breakpoint: breakpointTokens,
  zIndex: zIndexTokens,
  duration: durationTokens,
  easing: easingTokens,
}

export default tokens
