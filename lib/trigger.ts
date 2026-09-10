/**
 * Two-person "S V" trigger for Scottie Ventures.
 *
 *  S — one person curls both hands into C shapes and stacks them vertically,
 *      touching, so together they read as an S (MediaPipe has no class for
 *      this, so it is detected from landmark geometry).
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
const MAX_DX = 1.5;
const MIN_DY = 0.5;
const MAX_DY = 3;
/** Closest landmarks of the two hands must be within this many hand sizes. */
const MAX_GAP = 0.5;

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

/** Smallest distance between any landmark of a and any landmark of b. */
export function minGap(a: Point[], b: Point[]): number {
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, dist(p, q));
  return best;
}

/** Two hands stacked vertically and touching (or nearly). */
export function isSPair(a: Point[], b: Point[]): boolean {
  if (!isStacked(a, b)) return false;
  const size = (dist(a[0], a[9]) + dist(b[0], b[9])) / 2;
  return minGap(a, b) <= MAX_GAP * size;
}

/** Two hands roughly one above the other. */
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

  // Live testing showed a C-shaped hand curling toward the camera looks
  // straight in 2D landmarks, so finger bend is not a usable signal. The S
  // is recognized purely by two non-V hands stacked vertically and touching.
  const cands = hands
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.category !== V_GESTURE && h.landmarks.length >= 21);
  let hasS = false;
  outer: for (let a = 0; a < cands.length; a++) {
    for (let b = a + 1; b < cands.length; b++) {
      if (isSPair(cands[a].h.landmarks, cands[b].h.landmarks)) {
        hasS = true;
        matched[cands[a].i] = true;
        matched[cands[b].i] = true;
        break outer;
      }
    }
  }

  return { active: hasS && hasV, hasS, hasV, matched };
}

/**
 * Dev-only diagnostics: per-hand category/curl and, for every pair of
 * curled hands, the raw geometry the S check looks at (in hand sizes).
 */
export function describeHands(hands: readonly Hand[]): unknown {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const center = (lm: Point[]) => {
    const ids = [0, 5, 9, 13, 17];
    return {
      x: ids.reduce((s, i) => s + lm[i].x, 0) / ids.length,
      y: ids.reduce((s, i) => s + lm[i].y, 0) / ids.length,
    };
  };
  const r = (n: number) => Math.round(n * 100) / 100;
  const per = hands.map((h) => {
    const lm = h.landmarks;
    const c = center(lm);
    const wrist = { dx: r(lm[0].x - lm[9].x), dy: r(lm[0].y - lm[9].y) };
    const curl = FINGERS.map(([mcp, pip, dip, tip]) => {
      const length = d(lm[mcp], lm[pip]) + d(lm[pip], lm[dip]) + d(lm[dip], lm[tip]);
      return r(d(lm[mcp], lm[tip]) / length);
    });
    return { cat: h.category, curled: isCurled(lm), curl, center: { x: r(c.x), y: r(c.y) }, wristDir: wrist };
  });
  const pairs: unknown[] = [];
  for (let a = 0; a < hands.length; a++) {
    for (let b = a + 1; b < hands.length; b++) {
      const A = hands[a].landmarks;
      const B = hands[b].landmarks;
      const size = (d(A[0], A[9]) + d(B[0], B[9])) / 2;
      const ca = center(A);
      const cb = center(B);
      let gap = Infinity;
      for (const p of A) for (const q of B) gap = Math.min(gap, d(p, q));
      pairs.push({
        hands: [a, b],
        dx: r(Math.abs(ca.x - cb.x) / size),
        dy: r(Math.abs(ca.y - cb.y) / size),
        gap: r(gap / size),
        stacked: isStacked(A, B),
        sPair: isSPair(A, B),
      });
    }
  }
  return { hands: per, pairs, trigger: evaluateTrigger(hands) };
}
