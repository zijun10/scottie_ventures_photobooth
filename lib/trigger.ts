/**
 * Two-person "S V" trigger for Scottie Ventures.
 *
 *  S — one person curls both hands into C shapes, one above the other and
 *      touching, so together they read as an S (MediaPipe has no class for
 *      this, so it is detected from landmarks).
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
/**
 * S-pair geometry in multiples of the hand size (wrist → middle knuckle):
 * the two hands must be stacked vertically and close together.
 */
const MIN_DY = 0.4;
const MAX_DY = 3;
/** |dx| may be at most this multiple of dy (0.6 ≈ 31° off vertical). */
const MAX_DX_PER_DY = 0.6;
/** Closest landmarks of the two hands must be within this distance. */
const MAX_GAP = 1.0;
/**
 * The whole S template is rotated by this much before checking. Positive
 * rotates the expected pose clockwise on screen (in raw, unmirrored camera
 * coordinates); flip the sign if the booth wants the lean the other way.
 */
export const S_ROTATION_DEG = 10;

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

/** Rotate points about a pivot by `deg` (screen coords, y down). */
function rotateAbout(lm: Point[], pivot: Point, deg: number): Point[] {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return lm.map((p) => ({
    x: pivot.x + (p.x - pivot.x) * cos - (p.y - pivot.y) * sin,
    y: pivot.y + (p.x - pivot.x) * sin + (p.y - pivot.y) * cos,
  }));
}

function minGap(a: Point[], b: Point[]): number {
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, dist(p, q));
  return best;
}

/**
 * Two curled hands form an S when they are stacked vertically (one directly
 * above the other, within ~30° of vertical after the template rotation) and
 * touching or nearly touching. Landmarks must already be aspect-corrected
 * (see `toSquare`).
 */
export function isSPair(a0: Point[], b0: Point[], rotationDeg = S_ROTATION_DEG): boolean {
  const size = (dist(a0[0], a0[9]) + dist(b0[0], b0[9])) / 2;
  if (size === 0) return false;
  // Un-rotate the observed hands by the template rotation so the checks
  // below can stay axis-aligned.
  const c0 = palmCenter(a0);
  const c1 = palmCenter(b0);
  const pivot = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
  const a = rotateAbout(a0, pivot, -rotationDeg);
  const b = rotateAbout(b0, pivot, -rotationDeg);
  const ca = palmCenter(a);
  const cb = palmCenter(b);
  const dx = Math.abs(ca.x - cb.x) / size;
  const dy = Math.abs(ca.y - cb.y) / size;
  if (dy < MIN_DY || dy > MAX_DY) return false;
  if (dx > dy * MAX_DX_PER_DY) return false;
  return minGap(a, b) / size <= MAX_GAP;
}

/**
 * MediaPipe landmarks are normalized 0..1 on each axis, so on a 16:9 frame a
 * horizontal offset is squashed relative to a vertical one. Scale x by the
 * frame's aspect ratio so distances and angles are true.
 */
export function toSquare(lm: Point[], aspect: number): Point[] {
  return lm.map((p) => ({ x: p.x * aspect, y: p.y }));
}

export function evaluateTrigger(hands: readonly Hand[], aspect = 1): TriggerResult {
  const matched = hands.map(() => false);
  let hasV = false;
  hands.forEach((h, i) => {
    if (h.category === V_GESTURE) {
      hasV = true;
      matched[i] = true;
    }
  });

  const curled = hands
    .map((h, i) => ({ lm: toSquare(h.landmarks, aspect), i, category: h.category }))
    .filter(({ lm, category }) => category !== V_GESTURE && isCurled(lm));
  let hasS = false;
  outer: for (let a = 0; a < curled.length; a++) {
    for (let b = a + 1; b < curled.length; b++) {
      if (isSPair(curled[a].lm, curled[b].lm)) {
        hasS = true;
        matched[curled[a].i] = true;
        matched[curled[b].i] = true;
        break outer;
      }
    }
  }

  return { active: hasS && hasV, hasS, hasV, matched };
}
