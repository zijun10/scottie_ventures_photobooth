import { STRIP } from './config';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function photoRects(): Rect[] {
  const { border, photoWidth, photoHeight, photoCount } = STRIP;
  return Array.from({ length: photoCount }, (_, i) => ({
    x: border,
    y: border + i * (photoHeight + border),
    width: photoWidth,
    height: photoHeight,
  }));
}

export function panelRect(): Rect {
  return {
    x: 0,
    y: STRIP.height - STRIP.panelHeight,
    width: STRIP.width,
    height: STRIP.panelHeight,
  };
}
