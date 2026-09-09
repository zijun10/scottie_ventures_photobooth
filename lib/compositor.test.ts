import { describe, expect, it } from 'vitest';
import { drawStrip, type StripCtx } from './compositor';
import { panelRect, photoRects } from './layout';
import { COLORS, EVENT, STRIP } from './config';

type Call = [string, ...unknown[]];

class StubCtx implements StripCtx {
  fillStyle: string | CanvasGradient | CanvasPattern = '';
  font = '';
  textAlign: CanvasTextAlign = 'left';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  calls: Call[] = [];
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push(['fillRect', this.fillStyle, x, y, w, h]);
  }
  drawImage(_img: CanvasImageSource, x: number, y: number, w: number, h: number): void {
    this.calls.push(['drawImage', x, y, w, h]);
  }
  fillText(text: string, x: number, y: number): void {
    this.calls.push(['fillText', text, x, y]);
  }
}

const fakePhotos = [{}, {}, {}] as unknown as CanvasImageSource[];

const whiteRects = (ctx: StubCtx) =>
  ctx.calls.filter((c) => c[0] === 'fillRect' && c[1] === COLORS.white);

describe('drawStrip', () => {
  it('paints the full canvas red first, then the three photos at their rects', () => {
    const ctx = new StubCtx();
    drawStrip(ctx, fakePhotos, {});
    expect(ctx.calls[0]).toEqual(['fillRect', COLORS.red, 0, 0, STRIP.width, STRIP.height]);
    const rects = photoRects();
    expect(ctx.calls.slice(1, 4)).toEqual(
      rects.map((r) => ['drawImage', r.x, r.y, r.width, r.height]),
    );
  });

  it('draws a white keyline around each photo, on top of the photo', () => {
    const ctx = new StubCtx();
    drawStrip(ctx, fakePhotos, {});
    const k = STRIP.keyline;
    for (const r of photoRects()) {
      // top, bottom, left, right edges
      expect(ctx.calls).toContainEqual(['fillRect', COLORS.white, r.x - k, r.y - k, r.width + 2 * k, k]);
      expect(ctx.calls).toContainEqual(['fillRect', COLORS.white, r.x - k, r.y + r.height, r.width + 2 * k, k]);
      expect(ctx.calls).toContainEqual(['fillRect', COLORS.white, r.x - k, r.y, k, r.height]);
      expect(ctx.calls).toContainEqual(['fillRect', COLORS.white, r.x + r.width, r.y, k, r.height]);
    }
    const firstKeyline = ctx.calls.findIndex((c) => c[0] === 'fillRect' && c[1] === COLORS.white);
    const lastPhoto = ctx.calls.findLastIndex((c) => c[0] === 'drawImage');
    expect(firstKeyline).toBeGreaterThan(lastPhoto);
  });

  it('falls back to text branding when no logo is provided', () => {
    const ctx = new StubCtx();
    drawStrip(ctx, fakePhotos, {});
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('SCOTTIE VENTURES');
    expect(texts).toContain(EVENT.date);
  });

  it('draws the logo fitted inside the panel with a short rule and the date beneath', () => {
    const ctx = new StubCtx();
    const logo = { width: 453, height: 134 } as HTMLImageElement;
    drawStrip(ctx, fakePhotos, { logo });
    const panel = panelRect();
    const logoDraw = ctx.calls.filter((c) => c[0] === 'drawImage')[3];
    const [, x, y, w, h] = logoDraw as [string, number, number, number, number];
    expect(w).toBeLessThanOrEqual(panel.width - 80);
    expect(h).toBeLessThanOrEqual(panel.height - 80 - 70);
    expect(w / h).toBeCloseTo(453 / 134, 3);
    expect(x + w / 2).toBe(panel.x + panel.width / 2);
    expect(y).toBe(panel.y + 40);
    // a centered rule between logo and date
    const rule = whiteRects(ctx).find((c) => c[4] === STRIP.ruleWidth);
    expect(rule).toBeDefined();
    expect(rule![2]).toBe(panel.x + (panel.width - STRIP.ruleWidth) / 2);
    expect(rule![3] as number).toBeGreaterThan(y + h);
    expect(rule![3] as number).toBeLessThan(panel.y + panel.height);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toEqual([EVENT.date]);
  });

  it('draws a full-size frame overlay INSTEAD of the coded panel when provided', () => {
    const ctx = new StubCtx();
    const frameOverlay = {} as HTMLImageElement;
    drawStrip(ctx, fakePhotos, { frameOverlay });
    expect(ctx.calls).toContainEqual(['drawImage', 0, 0, STRIP.width, STRIP.height]);
    expect(ctx.calls.some((c) => c[0] === 'fillText')).toBe(false);
  });
});
