import { describe, expect, it } from 'vitest';
import { HoldTracker } from './hold';

describe('HoldTracker', () => {
  it('fires after the gesture is held for 1000ms', () => {
    const t = new HoldTracker();
    expect(t.update(true, 0)).toEqual({ progress: 0, fired: false });
    expect(t.update(true, 500)).toEqual({ progress: 0.5, fired: false });
    expect(t.update(true, 1000)).toEqual({ progress: 1, fired: true });
  });

  it('resets progress when the gesture drops mid-hold', () => {
    const t = new HoldTracker();
    t.update(true, 0);
    t.update(true, 600);
    expect(t.update(false, 700)).toEqual({ progress: 0, fired: false });
    // hold must restart from scratch
    expect(t.update(true, 800)).toEqual({ progress: 0, fired: false });
    expect(t.update(true, 1300)).toEqual({ progress: 0.5, fired: false });
  });

  it('does not fire again on the frame after firing', () => {
    const t = new HoldTracker();
    t.update(true, 0);
    expect(t.update(true, 1000).fired).toBe(true);
    // next frame starts a fresh hold, not another fire
    expect(t.update(true, 1016).fired).toBe(false);
  });

  it('ignores gestures during the 3s cooldown', () => {
    const t = new HoldTracker();
    t.startCooldown(10_000);
    expect(t.update(true, 11_000)).toEqual({ progress: 0, fired: false });
    expect(t.update(true, 12_999)).toEqual({ progress: 0, fired: false });
    // cooldown over at 13_000 — hold can begin
    expect(t.update(true, 13_000)).toEqual({ progress: 0, fired: false });
    expect(t.update(true, 14_000)).toEqual({ progress: 1, fired: true });
  });
});
