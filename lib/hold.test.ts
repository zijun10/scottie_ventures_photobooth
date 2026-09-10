import { describe, expect, it } from 'vitest';
import { HoldTracker } from './hold';

describe('HoldTracker', () => {
  it('fires after the gesture is held for 1000ms', () => {
    const t = new HoldTracker();
    expect(t.update(true, 0)).toEqual({ progress: 0, fired: false });
    expect(t.update(true, 500)).toEqual({ progress: 0.5, fired: false });
    expect(t.update(true, 1000)).toEqual({ progress: 1, fired: true });
  });

  it('resets progress when the gesture drops mid-hold for longer than the grace window', () => {
    const t = new HoldTracker();
    t.update(true, 0);
    t.update(true, 600);
    expect(t.update(false, 1000)).toEqual({ progress: 0, fired: false });
    // hold must restart from scratch
    expect(t.update(true, 1100)).toEqual({ progress: 0, fired: false });
    expect(t.update(true, 1600)).toEqual({ progress: 0.5, fired: false });
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

  it('survives a detection gap shorter than the grace window', () => {
    const t = new HoldTracker();
    t.update(true, 0);
    t.update(true, 400);
    expect(t.update(false, 500).progress).toBeCloseTo(0.5);
    expect(t.update(true, 700).progress).toBeCloseTo(0.7);
    expect(t.update(true, 1000).fired).toBe(true);
  });

  it('resets after a detection gap longer than the grace window', () => {
    const t = new HoldTracker();
    t.update(true, 0);
    t.update(true, 400);
    expect(t.update(false, 800)).toEqual({ progress: 0, fired: false });
    expect(t.update(true, 900).progress).toBe(0);
  });
});
