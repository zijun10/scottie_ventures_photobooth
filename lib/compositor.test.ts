import { describe, expect, it } from 'vitest';
import { drawStrip, type StripCtx } from './compositor';
import { photoRects } from './layout';
import { COLORS, STRIP } from './config';

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

  it('falls back to text branding when no logo is provided', () => {
    const ctx = new StubCtx();
    drawStrip(ctx, fakePhotos, {});
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('SCOTTY VENTURES');
  });

  it('draws a full-size frame overlay INSTEAD of the coded panel when provided', () => {
    const ctx = new StubCtx();
    const frameOverlay = {} as HTMLImageElement;
    drawStrip(ctx, fakePhotos, { frameOverlay });
    expect(ctx.calls).toContainEqual(['drawImage', 0, 0, STRIP.width, STRIP.height]);
    expect(ctx.calls.some((c) => c[0] === 'fillText')).toBe(false);
  });
});
