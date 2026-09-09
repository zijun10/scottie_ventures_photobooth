import { TIMINGS } from './config';

export class HoldTracker {
  private holdStart: number | null = null;
  private cooldownUntil = 0;

  update(isVictory: boolean, now: number): { progress: number; fired: boolean } {
    if (now < this.cooldownUntil || !isVictory) {
      this.holdStart = null;
      return { progress: 0, fired: false };
    }
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
