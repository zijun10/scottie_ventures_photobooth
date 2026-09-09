import { describe, expect, it } from 'vitest';
import { coverCrop } from './capture';

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
