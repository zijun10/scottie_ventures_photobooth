import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePhoto, coverCrop } from './capture';

describe('coverCrop', () => {
  it('crops the sides of a 16:9 source to fit 4:3', () => {
    // 1920x1080 -> 4:3 window: keep full height, width = 1080 * 4/3 = 1440
    expect(coverCrop(1920, 1080, 1120, 840)).toEqual({
      sx: 240,
      sy: 0,
      sw: 1440,
      sh: 1080,
    });
  });

  it('crops top/bottom of a source taller than the target aspect', () => {
    // 1000x1000 -> 4:3 window: keep full width, height = 1000 * 3/4 = 750
    expect(coverCrop(1000, 1000, 1120, 840)).toEqual({
      sx: 0,
      sy: 125,
      sw: 1000,
      sh: 750,
    });
  });

  it('is a no-op crop when aspects already match', () => {
    expect(coverCrop(1600, 1200, 1120, 840)).toEqual({
      sx: 0,
      sy: 0,
      sw: 1600,
      sh: 1200,
    });
  });
});

describe('capturePhoto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mirrors the cropped video frame onto a 1120x840 canvas', () => {
    const calls: [string, ...unknown[]][] = [];
    const fakeCtx = {
      translate: (x: number, y: number) => calls.push(['translate', x, y]),
      scale: (x: number, y: number) => calls.push(['scale', x, y]),
      drawImage: (
        img: unknown,
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        dx: number,
        dy: number,
        dw: number,
        dh: number,
      ) => calls.push(['drawImage', sx, sy, sw, sh, dx, dy, dw, dh]),
    };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => fakeCtx,
    };
    vi.stubGlobal('document', {
      createElement: () => fakeCanvas,
    });

    const fakeVideo = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement;
    const canvas = capturePhoto(fakeVideo);

    expect(canvas.width).toBe(1120);
    expect(canvas.height).toBe(840);
    expect(calls).toEqual([
      ['translate', 1120, 0],
      ['scale', -1, 1],
      ['drawImage', 240, 0, 1440, 1080, 0, 0, 1120, 840],
    ]);
  });
});
