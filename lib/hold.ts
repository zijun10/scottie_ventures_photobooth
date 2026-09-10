import { TIMINGS } from './config';

/**
 * Hand tracking flickers frame to frame, so a hold survives short gaps in
 * detection instead of restarting on every dropped frame.
 */
const GRACE_MS = 300;

export class HoldTracker {
  private holdStart: number | null = null;
  private lastSeen = 0;
  private cooldownUntil = 0;

  update(active: boolean, now: number): { progress: number; fired: boolean } {
    if (now < this.cooldownUntil) {
      this.holdStart = null;
      return { progress: 0, fired: false };
    }
    if (!active) {
      if (this.holdStart === null || now - this.lastSeen > GRACE_MS) {
        this.holdStart = null;
        return { progress: 0, fired: false };
      }
      // Within the grace window: keep the hold alive at its current progress.
      return { progress: Math.min((now - this.holdStart) / TIMINGS.holdMs, 1), fired: false };
    }
    this.lastSeen = now;
    if (this.holdStart === null) this.holdStart = now;
    const progress = Math.min((now - this.holdStart) / TIMINGS.holdMs, 1);
    if (progress >= 1) {
      this.holdStart = null;
      return { progress: 1, fired: true };
    }
    return { progress, fired: false };
  }

  startCooldown(now: number): void {
    this.cooldownUntil = now + TIMINGS.cooldownMs;
  }
}
