import { describe, expect, it } from 'vitest';
import { photoRects, panelRect } from './layout';
import { STRIP } from './config';

describe('photoRects', () => {
  it('returns three 1120x840 rects inset by the border', () => {
    const rects = photoRects();
    expect(rects).toHaveLength(3);
    for (const r of rects) {
      expect(r.x).toBe(40);
      expect(r.width).toBe(1120);
      expect(r.height).toBe(840);
    }
    expect(rects.map((r) => r.y)).toEqual([40, 920, 1800]);
  });

  it('tiles exactly: last photo bottom edge meets the panel top', () => {
    const last = photoRects()[2];
    expect(last.y + last.height).toBe(panelRect().y);
  });
});

describe('panelRect', () => {
  it('is a full-width 360px panel at the bottom of the strip', () => {
    expect(panelRect()).toEqual({ x: 0, y: 2640, width: 1200, height: 360 });
    expect(panelRect().y + panelRect().height).toBe(STRIP.height);
  });
});
