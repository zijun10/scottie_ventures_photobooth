import { describe, expect, it } from 'vitest';
import { evaluateTrigger, isCurled, isSPair, toSquare, type Hand } from './trigger';
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

/** Curled hand, fingers up, palm center near (cx, cy). */
const curledHand = (cx: number, cy: number) => hand(cx, cy + 0.08, 0.7);

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

describe('isSPair (rotation 0)', () => {
  it('accepts a directly stacked, touching pair', () => {
    expect(isSPair(curledHand(0.5, 0.44), curledHand(0.5, 0.56), 0)).toBe(true);
  });
  it('accepts a slightly offset stacked pair', () => {
    expect(isSPair(curledHand(0.48, 0.44), curledHand(0.5, 0.58), 0)).toBe(true);
  });
  it('rejects a diagonal (45°) pair', () => {
    expect(isSPair(curledHand(0.4, 0.44), curledHand(0.5, 0.54), 0)).toBe(false);
  });
  it('rejects hands side by side', () => {
    expect(isSPair(curledHand(0.3, 0.5), curledHand(0.6, 0.52), 0)).toBe(false);
  });
  it('rejects stacked hands that are far apart', () => {
    expect(isSPair(curledHand(0.5, 0.15), curledHand(0.5, 0.85), 0)).toBe(false);
  });
});

describe('isSPair rotation', () => {
  const top = curledHand(0.5, 0.44);
  const bottom = curledHand(0.5, 0.56);
  const pivot = { x: 0.5, y: 0.5 };
  const rot = (lm: Point[], deg: number) => {
    const r = (deg * Math.PI) / 180;
    return lm.map((p) => ({
      x: pivot.x + (p.x - pivot.x) * Math.cos(r) - (p.y - pivot.y) * Math.sin(r),
      y: pivot.y + (p.x - pivot.x) * Math.sin(r) + (p.y - pivot.y) * Math.cos(r),
    }));
  };
  it('a pose rotated by the template angle still matches', () => {
    expect(isSPair(rot(top, 10), rot(bottom, 10), 10)).toBe(true);
    expect(isSPair(rot(top, 40), rot(bottom, 40), 40)).toBe(true);
  });
  it('a pose rotated well past the tolerance does not match', () => {
    expect(isSPair(rot(top, 45), rot(bottom, 45), 0)).toBe(false);
  });
  it('a straight-vertical pose still matches with the 10° template', () => {
    expect(isSPair(top, bottom, 10)).toBe(true);
  });
});

describe('toSquare', () => {
  it('scales x by the aspect ratio and leaves y alone', () => {
    expect(toSquare([{ x: 0.5, y: 0.5 }], 16 / 9)).toEqual([{ x: (0.5 * 16) / 9, y: 0.5 }]);
  });
});

describe('evaluateTrigger', () => {
  // Vertically stacked; S_ROTATION_DEG is small enough that it still fits.
  const sTop = H(curledHand(0.3, 0.44));
  const sBottom = H(curledHand(0.3, 0.56));
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
    const left = H(curledHand(0.1, 0.5));
    const right = H(curledHand(0.5, 0.5));
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
