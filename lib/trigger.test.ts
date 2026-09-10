import { describe, expect, it } from 'vitest';
import { evaluateTrigger, isCurled, isSPair, isStacked, type Hand } from './trigger';
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
  it('is false for hands side by side', () => {
    expect(isStacked(hand(0.2, 0.5, 0.7), hand(0.8, 0.5, 0.7))).toBe(false);
  });
  it('is false for hands far apart vertically', () => {
    expect(isStacked(hand(0.5, 0.1, 0.7), hand(0.5, 0.9, 0.7))).toBe(false);
  });
});

describe('isSPair', () => {
  it('is true for stacked hands that touch', () => {
    expect(isSPair(hand(0.5, 0.4, 0.7), hand(0.5, 0.55, 0))).toBe(true);
  });
  it('is false for stacked hands with a gap between them', () => {
    expect(isSPair(hand(0.5, 0.3, 0.7), hand(0.5, 0.58, 0.7))).toBe(false);
  });
});

describe('evaluateTrigger', () => {
  // Top hand curled, bottom hand reads straight (curls toward the camera).
  const sTop = H(hand(0.3, 0.4, 0.7));
  const sBottom = H(hand(0.3, 0.55, 0), 'Open_Palm');
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
    const left = H(hand(0.1, 0.5, 0.7));
    const right = H(hand(0.5, 0.5, 0.7));
    expect(evaluateTrigger([left, right, v]).active).toBe(false);
  });

  it('ignores an extra hand that is not touching the pair', () => {
    const open = H(hand(0.8, 0.2, 0));
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
