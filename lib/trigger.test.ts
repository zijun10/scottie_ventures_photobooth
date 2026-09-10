import { describe, expect, it } from 'vitest';
import { evaluateTrigger, isCurled, isSPair, isStacked, wristDirection, type Hand } from './trigger';
import type { Point } from './skeleton';

/**
 * Synthetic hand: wrist at (cx, cy), fingers pointing up (−y).
 * `curl` 0 = straight fingers, 1 = tips folded back to the knuckles.
 */
function hand(cx: number, cy: number, curl: number, size = 0.1): Point[] {
  const lm: Point[] = Array.from({ length: 21 }, () => ({ x: cx, y: cy }));
  lm[0] = { x: cx, y: cy };
  const seg = size * 0.35;
  const fingerX = [cx - size * 0.3, cx - size * 0.1, cx + size * 0.1, cx + size * 0.3, cx + size * 0.45];
  const bases = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  bases.forEach((ids, f) => {
    const x = fingerX[f];
    const mcpY = cy - size;
    lm[ids[0]] = { x, y: mcpY };
    // Straight: each joint climbs `seg`. Curled: the chain folds back so the
    // tip ends up close to the MCP again.
    lm[ids[1]] = { x, y: mcpY - seg };
    lm[ids[2]] = { x: x + seg * curl, y: mcpY - seg * (2 - 2 * curl) };
    lm[ids[3]] = { x: x + seg * curl, y: mcpY - seg * (3 - 3 * curl) };
  });
  return lm;
}

/** Rotate a hand about its wrist. 0 = fingers up (wrist below the hand). */
function rotate(lm: Point[], deg: number): Point[] {
  const r = (deg * Math.PI) / 180;
  const w = lm[0];
  return lm.map((p) => ({
    x: w.x + (p.x - w.x) * Math.cos(r) - (p.y - w.y) * Math.sin(r),
    y: w.y + (p.x - w.x) * Math.sin(r) + (p.y - w.y) * Math.cos(r),
  }));
}
/** Curled hand entering from the side (wrist horizontal), palm center near (cx, cy). */
const sideHand = (cx: number, cy: number) => rotate(hand(cx - 0.07, cy, 0.7), 90);
/** Curled hand coming up from below (wrist pointing down). */
const belowHand = (cx: number, cy: number) => hand(cx, cy + 0.07, 0.7);

const H = (landmarks: Point[], category = 'None'): Hand => ({ landmarks, category });

describe('isCurled', () => {
  it('is false for straight fingers', () => {
    expect(isCurled(hand(0.5, 0.5, 0))).toBe(false);
  });
  it('is true for a C-shaped hand', () => {
    expect(isCurled(hand(0.5, 0.5, 0.7))).toBe(true);
  });
  it('is true for a closed fist too', () => {
    expect(isCurled(hand(0.5, 0.5, 1))).toBe(true);
  });
});

describe('isStacked', () => {
  it('is true for two hands one above the other', () => {
    expect(isStacked(hand(0.5, 0.4, 0.7), hand(0.5, 0.6, 0.7))).toBe(true);
  });
  it('is false for hands stacked but offset diagonally', () => {
    // 0.05 apart horizontally is half a hand-size at size 0.1 — too far sideways.
    expect(isStacked(hand(0.45, 0.4, 0.7), hand(0.5, 0.6, 0.7))).toBe(false);
  });
  it('is true for hands stacked with a slight offset', () => {
    expect(isStacked(hand(0.49, 0.4, 0.7), hand(0.5, 0.6, 0.7))).toBe(true);
  });
  it('is false for hands side by side', () => {
    expect(isStacked(hand(0.2, 0.5, 0.7), hand(0.8, 0.5, 0.7))).toBe(false);
  });
  it('is false for hands far apart vertically', () => {
    expect(isStacked(hand(0.5, 0.1, 0.7), hand(0.5, 0.9, 0.7))).toBe(false);
  });
});

describe('wristDirection', () => {
  it('is down for an upright hand', () => {
    expect(wristDirection(hand(0.5, 0.5, 0))).toBe('down');
  });
  it('is horizontal for a hand rotated 90 degrees either way', () => {
    expect(wristDirection(rotate(hand(0.5, 0.5, 0), 90))).toBe('horizontal');
    expect(wristDirection(rotate(hand(0.5, 0.5, 0), -90))).toBe('horizontal');
  });
  it('tolerates a modest tilt', () => {
    expect(wristDirection(rotate(hand(0.5, 0.5, 0), 25))).toBe('down');
    expect(wristDirection(rotate(hand(0.5, 0.5, 0), 70))).toBe('horizontal');
  });
  it('is other for a diagonal or upside-down hand', () => {
    expect(wristDirection(rotate(hand(0.5, 0.5, 0), 45))).toBe('other');
    expect(wristDirection(rotate(hand(0.5, 0.5, 0), 180))).toBe('other');
  });
});

describe('isSPair', () => {
  it('is true for a side hand above a from-below hand', () => {
    expect(isSPair(sideHand(0.5, 0.4), belowHand(0.5, 0.6))).toBe(true);
  });
  it('is false when both wrists point down', () => {
    expect(isSPair(belowHand(0.5, 0.4), belowHand(0.5, 0.6))).toBe(false);
  });
  it('is false when both wrists are horizontal', () => {
    expect(isSPair(sideHand(0.5, 0.4), sideHand(0.5, 0.6))).toBe(false);
  });
  it('is false for the right orientations but not stacked', () => {
    expect(isSPair(sideHand(0.2, 0.5), belowHand(0.8, 0.5))).toBe(false);
  });
});

describe('evaluateTrigger', () => {
  const sTop = H(sideHand(0.3, 0.4));
  const sBottom = H(belowHand(0.3, 0.6));
  const v = H(hand(0.8, 0.5, 0), 'Victory');

  it('fires when a stacked curled pair and a Victory hand are all present', () => {
    expect(evaluateTrigger([sTop, sBottom, v])).toEqual({
      active: true,
      hasS: true,
      hasV: true,
      matched: [true, true, true],
    });
  });

  it('does not fire on a Victory alone', () => {
    expect(evaluateTrigger([v])).toMatchObject({ active: false, hasS: false, hasV: true });
  });

  it('does not fire on the S alone', () => {
    expect(evaluateTrigger([sTop, sBottom])).toMatchObject({ active: false, hasS: true, hasV: false });
  });

  it('does not count two side-by-side curled hands as an S', () => {
    const left = H(sideHand(0.1, 0.5));
    const right = H(belowHand(0.5, 0.5));
    expect(evaluateTrigger([left, right, v]).active).toBe(false);
  });

  it('ignores an open, unrecognized extra hand', () => {
    const open = H(hand(0.6, 0.2, 0));
    expect(evaluateTrigger([sTop, open, sBottom, v])).toEqual({
      active: true,
      hasS: true,
      hasV: true,
      matched: [true, false, true, true],
    });
  });

  it('is inactive with no hands', () => {
    expect(evaluateTrigger([])).toEqual({ active: false, hasS: false, hasV: false, matched: [] });
  });
});
