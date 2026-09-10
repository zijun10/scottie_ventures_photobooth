/**
 * Two-person "S V" trigger for Scottie Ventures.
 *
 *  S — one person curls both hands into C shapes and stacks them vertically
 *      so together they read as an S: one hand comes in from the side
 *      (wrist horizontal), the other from below (wrist pointing down).
 *      MediaPipe has no class for this, so it is detected from landmarks.
 *  V — another person holds up a ✌️ (MediaPipe's "Victory" class).
 *
 * The booth triggers only when both are visible in the same frame.
 */
import type { Point } from './skeleton';

export const V_GESTURE = 'Victory';

export interface Hand {
  landmarks: Point[];
  /** Recognizer category name, e.g. 'Victory', 'None'. */
  category: string;
}

export interface TriggerResult {
  /** Both halves present — start/continue the hold. */
  active: boolean;
  /** S half found (two curled, stacked hands). */
  hasS: boolean;
  /** V half found (a Victory hand). */
  hasV: boolean;
  /** Per-hand: part of a recognized S or V, for highlighting. */
  matched: boolean[];
}

const FINGERS: ReadonlyArray<readonly [number, number, number, number]> = [
  [5, 6, 7, 8],     // index
  [9, 10, 11, 12],  // middle
  [13, 14, 15, 16], // ring
];
/** Tip-to-knuckle distance below this fraction of finger length = bent. */
const CURL_RATIO = 0.85;
/** Stacking tolerances, in multiples of the hand size (wrist → middle MCP). */
const MAX_DX = 0.35;
const MIN_DY = 0.5;
const MAX_DY = 3;
/** Max deviation (degrees) from exactly horizontal / exactly downward. */
const MAX_TILT_DEG = 35;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Index, middle and ring fingers all bent (a C / claw shape, or a fist). */
export function isCurled(lm: Point[]): boolean {
  if (lm.length < 21) return false;
  return FINGERS.every(([mcp, pip, dip, tip]) => {
    const length = dist(lm[mcp], lm[pip]) + dist(lm[pip], lm[dip]) + dist(lm[dip], lm[tip]);
    return dist(lm[mcp], lm[tip]) < CURL_RATIO * length;
  });
}

function palmCenter(lm: Point[]): Point {
  const ids = [0, 5, 9, 13, 17];
  return {
    x: ids.reduce((s, i) => s + lm[i].x, 0) / ids.length,
    y: ids.reduce((s, i) => s + lm[i].y, 0) / ids.length,
  };
}

/**
 * Which way the forearm leaves the hand: the vector from the middle knuckle
 * (landmark 9) to the wrist (landmark 0). 'horizontal' = hand enters from the
 * side, 'down' = hand comes up from below (image y grows downward).
 */
export function wristDirection(lm: Point[]): 'horizontal' | 'down' | 'other' {
  const dx = lm[0].x - lm[9].x;
  const dy = lm[0].y - lm[9].y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 'other';
  const tilt = Math.tan((MAX_TILT_DEG * Math.PI) / 180);
  if (Math.abs(dy) <= Math.abs(dx) * tilt) return 'horizontal';
  if (dy > 0 && Math.abs(dx) <= dy * tilt) return 'down';
  return 'other';
}

/**
 * Two curled hands form an S: stacked vertically, one wrist running
 * horizontally and the other pointing straight down.
 */
export function isSPair(a: Point[], b: Point[]): boolean {
  if (!isStacked(a, b)) return false;
  const da = wristDirection(a);
  const db = wristDirection(b);
  return (da === 'horizontal' && db === 'down') || (da === 'down' && db === 'horizontal');
}

/** Two curled hands roughly one above the other. */
export function isStacked(a: Point[], b: Point[]): boolean {
  const size = (dist(a[0], a[9]) + dist(b[0], b[9])) / 2;
  if (size === 0) return false;
  const ca = palmCenter(a);
  const cb = palmCenter(b);
  const dx = Math.abs(ca.x - cb.x) / size;
  const dy = Math.abs(ca.y - cb.y) / size;
  return dx < MAX_DX && dy > MIN_DY && dy < MAX_DY;
}

export function evaluateTrigger(hands: readonly Hand[]): TriggerResult {
  const matched = hands.map(() => false);
  let hasV = false;
  hands.forEach((h, i) => {
    if (h.category === V_GESTURE) {
      hasV = true;
      matched[i] = true;
    }
  });

  const curled = hands
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.category !== V_GESTURE && isCurled(h.landmarks));
  let hasS = false;
  outer: for (let a = 0; a < curled.length; a++) {
    for (let b = a + 1; b < curled.length; b++) {
      if (isSPair(curled[a].h.landmarks, curled[b].h.landmarks)) {
        hasS = true;
        matched[curled[a].i] = true;
        matched[curled[b].i] = true;
        break outer;
      }
    }
  }

  return { active: hasS && hasV, hasS, hasV, matched };
}
