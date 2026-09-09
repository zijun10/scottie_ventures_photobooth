import { COLORS, EVENT, STRIP } from './config';
import { panelRect, photoRects, type Rect } from './layout';

/** The subset of CanvasRenderingContext2D the compositor uses (stub-testable). */
export interface StripCtx {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(img: CanvasImageSource, x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
}

export interface StripAssets {
  logo?: HTMLImageElement;
  frameOverlay?: HTMLImageElement;
  /** CSS font-family for panel text (the page passes its loaded brand serif). */
  fontFamily?: string;
}

const DEFAULT_FONT_FAMILY = 'Georgia, serif';

export function drawStrip(
  ctx: StripCtx,
  photos: CanvasImageSource[],
  assets: StripAssets,
): void {
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, 0, STRIP.width, STRIP.height);

  const rects = photoRects();
  rects.forEach((r, i) => {
    if (photos[i]) ctx.drawImage(photos[i], r.x, r.y, r.width, r.height);
  });

  // A custom frame.png replaces the entire coded frame design.
  if (assets.frameOverlay) {
    ctx.drawImage(assets.frameOverlay, 0, 0, STRIP.width, STRIP.height);
    return;
  }

  ctx.fillStyle = COLORS.white;
  rects.forEach((r) => drawKeyline(ctx, r, STRIP.keyline));

  const panel = panelRect();
  const centerX = panel.x + panel.width / 2;
  const pad = 40;
  const dateSpace = 70;
  const family = assets.fontFamily ?? DEFAULT_FONT_FAMILY;
  ctx.textAlign = 'center';

  if (assets.logo) {
    const maxW = panel.width - 2 * pad;
    const maxH = panel.height - 2 * pad - dateSpace;
    const scale = Math.min(maxW / assets.logo.width, maxH / assets.logo.height);
    const w = assets.logo.width * scale;
    const h = assets.logo.height * scale;
    ctx.drawImage(assets.logo, centerX - w / 2, panel.y + pad, w, h);
    // short rule between the logo and the date
    ctx.fillRect(centerX - STRIP.ruleWidth / 2, panel.y + pad + h + 22, STRIP.ruleWidth, 2);
  } else {
    ctx.font = `bold 90px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(EVENT.name.toUpperCase(), centerX, panel.y + panel.height / 2 - 30);
  }

  ctx.font = `40px ${family}`;
  ctx.textBaseline = 'bottom';
  ctx.fillText(EVENT.date, centerX, panel.y + panel.height - 30);
}

/** Thin border drawn just outside a rect (four fills; no strokeRect in StripCtx). */
function drawKeyline(ctx: StripCtx, r: Rect, k: number): void {
  ctx.fillRect(r.x - k, r.y - k, r.width + 2 * k, k); // top
  ctx.fillRect(r.x - k, r.y + r.height, r.width + 2 * k, k); // bottom
  ctx.fillRect(r.x - k, r.y, k, r.height); // left
  ctx.fillRect(r.x + r.width, r.y, k, r.height); // right
}

/** Browser-only: compose the final strip JPEG. */
export async function composeStrip(
  photos: CanvasImageSource[],
  assets: StripAssets = {},
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = STRIP.width;
  canvas.height = STRIP.height;
  drawStrip(canvas.getContext('2d')!, photos, assets);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      0.92,
    );
  });
}

/** Resolves undefined (never rejects) if the image is missing or fails to load. */
export function loadOptionalImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}
