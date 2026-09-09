import { STRIP } from './config';

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Source rect that "cover"-fits src into a dst aspect ratio, centered. */
export function coverCrop(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): CropRect {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (srcAspect > dstAspect) {
    const sw = srcH * dstAspect;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / dstAspect;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

/**
 * Grab the current video frame as a mirrored (selfie) 1120x840 canvas.
 * Browser-only; verified manually via the booth page.
 */
export function capturePhoto(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = STRIP.photoWidth;
  canvas.height = STRIP.photoHeight;
  const ctx = canvas.getContext('2d')!;
  const { sx, sy, sw, sh } = coverCrop(
    video.videoWidth,
    video.videoHeight,
    STRIP.photoWidth,
    STRIP.photoHeight,
  );
  ctx.translate(STRIP.photoWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, STRIP.photoWidth, STRIP.photoHeight);
  return canvas;
}
