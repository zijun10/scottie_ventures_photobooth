export const STRIP = {
  width: 1200,
  height: 3000,
  border: 40,
  photoWidth: 1120,
  photoHeight: 840,
  panelHeight: 360,
  photoCount: 3,
} as const;

export const COLORS = {
  red: '#C8102E',
  white: '#FFFFFF',
} as const;

export const TIMINGS = {
  holdMs: 1000,
  countdownSeconds: 5,
  qrTimeoutMs: 60_000,
  cooldownMs: 3000,
  uploadTimeoutMs: 20_000,
} as const;

export const EVENT = {
  name: 'Scotty Ventures',
  date: 'Fall 2026', // update to the real event date before the event
} as const;

export const TAGLINE =
  'V stands for venture capital. Activate the photo booth by doing a ✌️';
