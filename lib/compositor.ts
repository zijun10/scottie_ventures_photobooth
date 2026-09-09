import { COLORS, EVENT, STRIP } from './config';
import { panelRect, photoRects } from './layout';

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
}

export function drawStrip(
  ctx: StripCtx,
  photos: CanvasImageSource[],
  assets: StripAssets,
): void {
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, 0, STRIP.width, STRIP.height);

  photoRects().forEach((r, i) => {
    if (photos[i]) ctx.drawImage(photos[i], r.x, r.y, r.width, r.height);
  });

  // A custom frame.png replaces the entire coded frame design.
  if (assets.frameOverlay) {
    ctx.drawImage(assets.frameOverlay, 0, 0, STRIP.width, STRIP.height);
    return;
  }

  const panel = panelRect();
  const centerX = panel.x + panel.width / 2;
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'center';

  if (assets.logo) {
    const pad = 40;
    const dateSpace = 70;
    const maxW = panel.width - 2 * pad;
    const maxH = panel.height - 2 * pad - dateSpace;
    const scale = Math.min(maxW / assets.logo.width, maxH / assets.logo.height);
    const w = assets.logo.width * scale;
    const h = assets.logo.height * scale;
    ctx.drawImage(assets.logo, centerX - w / 2, panel.y + pad, w, h);
  } else {
    ctx.font = 'bold 90px Arial';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCOTTY VENTURES', centerX, panel.y + panel.height / 2 - 30);
  }

  ctx.font = '40px Arial';
  ctx.textBaseline = 'bottom';
  ctx.fillText(EVENT.date, centerX, panel.y + panel.height - 30);
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
