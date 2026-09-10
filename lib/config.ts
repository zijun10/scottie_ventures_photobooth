export const STRIP = {
  width: 1200,
  height: 3000,
  border: 40,
  photoWidth: 1120,
  photoHeight: 840,
  panelHeight: 360,
  photoCount: 3,
  keyline: 4, // white hairline around each photo
  ruleWidth: 240, // short rule between logo and date in the panel
} as const;

export const COLORS = {
  red: '#bd2030',
  white: '#FFFFFF',
} as const;

export const TIMINGS = {
  holdMs: 1000,
  countdownSeconds: 3,
  qrTimeoutMs: 30_000,
  cooldownMs: 3000,
  uploadTimeoutMs: 20_000,
} as const;

export const EVENT = {
  name: 'Scottie Ventures',
  date: '09/10 · Fall 2026',
} as const;

export const TAGLINE =
  'Grab a friend: one of you curls both hands into an S, the other does a ✌️';
