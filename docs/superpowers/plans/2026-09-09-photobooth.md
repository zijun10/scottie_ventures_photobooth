# Scotty Ventures Photo Booth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-based photo booth that triggers on a ✌️ gesture, takes 3 photos at 5-second intervals, composes a branded vertical strip, and shows a QR code linking to a phone download page.

**Architecture:** Next.js App Router app on Vercel. All booth logic (webcam, MediaPipe gesture recognition, countdown, canvas strip composition) runs client-side on the event laptop. One API route uploads the finished JPEG to Vercel Blob under a random ID; a server-rendered `/strip/[id]` page serves it to phones.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind), `@mediapipe/tasks-vision` (GestureRecognizer, built-in `Victory` category), `@vercel/blob`, `qrcode`, `nanoid`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-photobooth-design.md`

## Global Constraints

- Strip dimensions: **1200×3000 px** JPEG; photos **1120×840** (4:3), border **40 px**, bottom panel **360 px**.
- Brand red: **`#C8102E`** (single source of truth in `lib/config.ts`).
- Attract-screen tagline, verbatim: **"V stands for venture capital. Activate the photo booth by doing a ✌️"**
- Photos are **mirrored** (selfie orientation) — mirrored at capture time; the compositor never flips.
- Timings: **5 s** countdown per photo, **1 s** gesture hold to trigger, **3 s** cooldown after reset, **60 s** QR-screen auto-reset.
- Blob IDs are random alphanumeric (**12 chars**, unguessable); files stored at `strips/<id>.jpg`, public access, no expiry.
- Optional asset overrides in `public/`: `logo.png` (panel logo) and `frame.png` (full 1200×3000 overlay replacing the coded frame). Missing files must degrade gracefully to the coded design.
- No printing, no retakes, no filters, no gallery, no admin UI (spec's out-of-scope list).
- Windows/PowerShell dev environment; tests run with `npm test` (Vitest, node environment — no DOM APIs in unit tests).

---

### Task 1: Scaffold app, test tooling, and config constants

**Files:**
- Create: entire Next.js scaffold (via `create-next-app`), `vitest.config.ts`, `lib/config.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `lib/config.ts` exporting `STRIP`, `COLORS`, `TIMINGS`, `EVENT`, `TAGLINE` (exact shapes below) — every later task imports from here. Path alias `@/*` → repo root works in both Next and Vitest.

- [ ] **Step 1: Scaffold Next.js (directory contains `docs/` which create-next-app rejects — move it aside temporarily)**

```powershell
Move-Item docs ..\__pb_docs_tmp
npx create-next-app@latest . --typescript --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
Move-Item ..\__pb_docs_tmp docs
```

- [ ] **Step 2: Install Vitest and add test script**

```powershell
npm install -D vitest
```

In `package.json` scripts, add: `"test": "vitest run"`

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 4: Create `lib/config.ts`**

```ts
export const STRIP = {
  width: 1200,
  height: 3000,
  border: 40,
  photoWidth: 1120,
  photoHeight: 840,
  panelHeight: 360,
  photoCount: 3,
} as const;

export const COLORS = {
  red: '#C8102E',
  white: '#FFFFFF',
} as const;

export const TIMINGS = {
  holdMs: 1000,
  countdownSeconds: 5,
  qrTimeoutMs: 60_000,
  cooldownMs: 3000,
} as const;

export const EVENT = {
  name: 'Scotty Ventures',
  date: 'Fall 2026', // update to the real event date before the event
} as const;

export const TAGLINE =
  'V stands for venture capital. Activate the photo booth by doing a ✌️';
```

- [ ] **Step 5: Verify build and test runner work**

Run: `npm run build` — Expected: builds successfully.
Run: `npm test` — Expected: exits cleanly (Vitest reports "no test files found" — pass with `--passWithNoTests` not needed; if it exits non-zero for no tests, that's fine for this step only).

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and booth config"
```

---

### Task 2: Strip layout math

**Files:**
- Create: `lib/layout.ts`
- Test: `lib/layout.test.ts`

**Interfaces:**
- Consumes: `STRIP` from `@/lib/config`
- Produces: `interface Rect { x: number; y: number; width: number; height: number }`, `photoRects(): Rect[]` (3 rects, top to bottom), `panelRect(): Rect` — used by Task 6 (compositor).

- [ ] **Step 1: Write the failing test — `lib/layout.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { photoRects, panelRect } from './layout';
import { STRIP } from './config';

describe('photoRects', () => {
  it('returns three 1120x840 rects inset by the border', () => {
    const rects = photoRects();
    expect(rects).toHaveLength(3);
    for (const r of rects) {
      expect(r.x).toBe(40);
      expect(r.width).toBe(1120);
      expect(r.height).toBe(840);
    }
    expect(rects.map((r) => r.y)).toEqual([40, 920, 1800]);
  });

  it('tiles exactly: last photo bottom edge meets the panel top', () => {
    const last = photoRects()[2];
    expect(last.y + last.height).toBe(panelRect().y);
  });
});

describe('panelRect', () => {
  it('is a full-width 360px panel at the bottom of the strip', () => {
    expect(panelRect()).toEqual({ x: 0, y: 2640, width: 1200, height: 360 });
    expect(panelRect().y + panelRect().height).toBe(STRIP.height);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/layout.test.ts`
Expected: FAIL — cannot resolve `./layout`.

- [ ] **Step 3: Write `lib/layout.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/layout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/layout.ts lib/layout.test.ts
git commit -m "feat: strip layout math (photo rects + logo panel)"
```

---

### Task 3: Cover-crop math and photo capture

**Files:**
- Create: `lib/capture.ts`
- Test: `lib/capture.test.ts`

**Interfaces:**
- Consumes: `STRIP` from `@/lib/config`
- Produces: `coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number }` (pure, tested) and `capturePhoto(video: HTMLVideoElement): HTMLCanvasElement` (browser-only, returns a mirrored 1120×840 canvas) — used by Task 10 (booth page). Captured photos are already mirrored; the compositor must not flip them again.

- [ ] **Step 1: Write the failing test — `lib/capture.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/capture.test.ts`
Expected: FAIL — cannot resolve `./capture`.

- [ ] **Step 3: Write `lib/capture.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/capture.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/capture.ts lib/capture.test.ts
git commit -m "feat: cover-crop math and mirrored photo capture"
```

---

### Task 4: Booth state machine

**Files:**
- Create: `lib/machine.ts`
- Test: `lib/machine.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces (used by Task 10):

```ts
type BoothState =
  | { name: 'attract' }
  | { name: 'countdown'; photoIndex: number } // 0, 1, 2
  | { name: 'composing' }
  | { name: 'qr'; stripUrl: string }
  | { name: 'uploadError' };

type BoothEvent =
  | { type: 'TRIGGER' }
  | { type: 'PHOTO_CAPTURED' }
  | { type: 'UPLOAD_SUCCEEDED'; stripUrl: string }
  | { type: 'UPLOAD_FAILED' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

function reduce(state: BoothState, event: BoothEvent): BoothState;
```

- [ ] **Step 1: Write the failing test — `lib/machine.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { reduce, type BoothState } from './machine';

describe('booth state machine', () => {
  it('attract -> countdown(0) on TRIGGER', () => {
    expect(reduce({ name: 'attract' }, { type: 'TRIGGER' })).toEqual({
      name: 'countdown',
      photoIndex: 0,
    });
  });

  it('counts through 3 photos then composes', () => {
    let s: BoothState = { name: 'countdown', photoIndex: 0 };
    s = reduce(s, { type: 'PHOTO_CAPTURED' });
    expect(s).toEqual({ name: 'countdown', photoIndex: 1 });
    s = reduce(s, { type: 'PHOTO_CAPTURED' });
    expect(s).toEqual({ name: 'countdown', photoIndex: 2 });
    s = reduce(s, { type: 'PHOTO_CAPTURED' });
    expect(s).toEqual({ name: 'composing' });
  });

  it('composing -> qr with the strip url on success', () => {
    expect(
      reduce({ name: 'composing' }, { type: 'UPLOAD_SUCCEEDED', stripUrl: 'https://x/strip/abc' }),
    ).toEqual({ name: 'qr', stripUrl: 'https://x/strip/abc' });
  });

  it('composing -> uploadError on failure; RETRY goes back to composing', () => {
    const err = reduce({ name: 'composing' }, { type: 'UPLOAD_FAILED' });
    expect(err).toEqual({ name: 'uploadError' });
    expect(reduce(err, { type: 'RETRY' })).toEqual({ name: 'composing' });
  });

  it('qr and uploadError return to attract on RESET', () => {
    expect(reduce({ name: 'qr', stripUrl: 'u' }, { type: 'RESET' })).toEqual({ name: 'attract' });
    expect(reduce({ name: 'uploadError' }, { type: 'RESET' })).toEqual({ name: 'attract' });
  });

  it('ignores irrelevant events (no accidental transitions)', () => {
    expect(reduce({ name: 'attract' }, { type: 'PHOTO_CAPTURED' })).toEqual({ name: 'attract' });
    expect(reduce({ name: 'countdown', photoIndex: 1 }, { type: 'TRIGGER' })).toEqual({
      name: 'countdown',
      photoIndex: 1,
    });
    expect(reduce({ name: 'qr', stripUrl: 'u' }, { type: 'TRIGGER' })).toEqual({
      name: 'qr',
      stripUrl: 'u',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/machine.test.ts`
Expected: FAIL — cannot resolve `./machine`.

- [ ] **Step 3: Write `lib/machine.ts`**

```ts
export type BoothState =
  | { name: 'attract' }
  | { name: 'countdown'; photoIndex: number }
  | { name: 'composing' }
  | { name: 'qr'; stripUrl: string }
  | { name: 'uploadError' };

export type BoothEvent =
  | { type: 'TRIGGER' }
  | { type: 'PHOTO_CAPTURED' }
  | { type: 'UPLOAD_SUCCEEDED'; stripUrl: string }
  | { type: 'UPLOAD_FAILED' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function reduce(state: BoothState, event: BoothEvent): BoothState {
  switch (state.name) {
    case 'attract':
      return event.type === 'TRIGGER' ? { name: 'countdown', photoIndex: 0 } : state;
    case 'countdown':
      if (event.type !== 'PHOTO_CAPTURED') return state;
      return state.photoIndex < 2
        ? { name: 'countdown', photoIndex: state.photoIndex + 1 }
        : { name: 'composing' };
    case 'composing':
      if (event.type === 'UPLOAD_SUCCEEDED') return { name: 'qr', stripUrl: event.stripUrl };
      if (event.type === 'UPLOAD_FAILED') return { name: 'uploadError' };
      return state;
    case 'qr':
      return event.type === 'RESET' ? { name: 'attract' } : state;
    case 'uploadError':
      if (event.type === 'RETRY') return { name: 'composing' };
      if (event.type === 'RESET') return { name: 'attract' };
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/machine.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/machine.ts lib/machine.test.ts
git commit -m "feat: booth state machine"
```

---

### Task 5: Gesture hold tracker with cooldown

**Files:**
- Create: `lib/hold.ts`
- Test: `lib/hold.test.ts`

**Interfaces:**
- Consumes: `TIMINGS` from `@/lib/config`
- Produces (used by Task 10): `class HoldTracker` with `update(isVictory: boolean, now: number): { progress: number; fired: boolean }` (progress 0–1; `fired: true` exactly once when the 1 s hold completes) and `startCooldown(now: number): void` (ignore gestures for the next 3 s).

- [ ] **Step 1: Write the failing test — `lib/hold.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/hold.test.ts`
Expected: FAIL — cannot resolve `./hold`.

- [ ] **Step 3: Write `lib/hold.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/hold.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/hold.ts lib/hold.test.ts
git commit -m "feat: gesture hold tracker with post-session cooldown"
```

---

### Task 6: Strip compositor

**Files:**
- Create: `lib/compositor.ts`
- Test: `lib/compositor.test.ts`

**Interfaces:**
- Consumes: `STRIP`, `COLORS`, `EVENT` from `@/lib/config`; `photoRects`, `panelRect` from `@/lib/layout`
- Produces (used by Task 10):
  - `interface StripAssets { logo?: HTMLImageElement; frameOverlay?: HTMLImageElement }`
  - `drawStrip(ctx: StripCtx, photos: CanvasImageSource[], assets: StripAssets): void` — pure drawing against a minimal ctx interface (testable with a stub)
  - `composeStrip(photos: CanvasImageSource[], assets?: StripAssets): Promise<Blob>` — browser-only, JPEG quality 0.92
  - `loadOptionalImage(src: string): Promise<HTMLImageElement | undefined>` — resolves `undefined` on 404/error (graceful frame/logo fallback)

- [ ] **Step 1: Write the failing test — `lib/compositor.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { drawStrip, type StripCtx } from './compositor';
import { photoRects } from './layout';
import { COLORS, STRIP } from './config';

type Call = [string, ...unknown[]];

class StubCtx implements StripCtx {
  fillStyle: string | CanvasGradient | CanvasPattern = '';
  font = '';
  textAlign: CanvasTextAlign = 'left';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  calls: Call[] = [];
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push(['fillRect', this.fillStyle, x, y, w, h]);
  }
  drawImage(_img: CanvasImageSource, x: number, y: number, w: number, h: number): void {
    this.calls.push(['drawImage', x, y, w, h]);
  }
  fillText(text: string, x: number, y: number): void {
    this.calls.push(['fillText', text, x, y]);
  }
}

const fakePhotos = [{}, {}, {}] as unknown as CanvasImageSource[];

describe('drawStrip', () => {
  it('paints the full canvas red first, then the three photos at their rects', () => {
    const ctx = new StubCtx();
    drawStrip(ctx, fakePhotos, {});
    expect(ctx.calls[0]).toEqual(['fillRect', COLORS.red, 0, 0, STRIP.width, STRIP.height]);
    const rects = photoRects();
    expect(ctx.calls.slice(1, 4)).toEqual(
      rects.map((r) => ['drawImage', r.x, r.y, r.width, r.height]),
    );
  });

  it('falls back to text branding when no logo is provided', () => {
    const ctx = new StubCtx();
    drawStrip(ctx, fakePhotos, {});
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('SCOTTY VENTURES');
  });

  it('draws a full-size frame overlay INSTEAD of the coded panel when provided', () => {
    const ctx = new StubCtx();
    const frameOverlay = {} as HTMLImageElement;
    drawStrip(ctx, fakePhotos, { frameOverlay });
    expect(ctx.calls).toContainEqual(['drawImage', 0, 0, STRIP.width, STRIP.height]);
    expect(ctx.calls.some((c) => c[0] === 'fillText')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/compositor.test.ts`
Expected: FAIL — cannot resolve `./compositor`.

- [ ] **Step 3: Write `lib/compositor.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/compositor.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/compositor.ts lib/compositor.test.ts
git commit -m "feat: strip compositor with coded frame and frame.png override"
```

---

### Task 7: Upload API route

**Files:**
- Create: `app/api/strips/route.ts`
- Test: `app/api/strips/route.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `POST /api/strips` — body is the raw JPEG; response `200 { id: string }` (12-char alphanumeric) or `400` for empty/oversized bodies. Stores to Vercel Blob at `strips/<id>.jpg` (public, no random suffix). Task 8's page looks blobs up by that exact pathname prefix; Task 10 fetches this route.

- [ ] **Step 1: Install dependencies**

```powershell
npm install @vercel/blob nanoid
```

- [ ] **Step 2: Write the failing test — `app/api/strips/route.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.example/strips/x.jpg' }),
}));

import { put } from '@vercel/blob';
import { POST } from './route';

describe('POST /api/strips', () => {
  beforeEach(() => vi.mocked(put).mockClear());

  it('stores the JPEG at strips/<id>.jpg and returns the id', async () => {
    const body = new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });
    const res = await POST(new Request('http://localhost/api/strips', { method: 'POST', body }));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    expect(id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(put).toHaveBeenCalledWith(
      `strips/${id}.jpg`,
      expect.anything(),
      expect.objectContaining({ access: 'public', addRandomSuffix: false, contentType: 'image/jpeg' }),
    );
  });

  it('rejects an empty body with 400', async () => {
    const res = await POST(new Request('http://localhost/api/strips', { method: 'POST' }));
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects bodies over 10MB with 400', async () => {
    const body = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]);
    const res = await POST(new Request('http://localhost/api/strips', { method: 'POST', body }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- app/api/strips/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 4: Write `app/api/strips/route.ts`**

```ts
import { put } from '@vercel/blob';
import { customAlphabet } from 'nanoid';

const MAX_BYTES = 10 * 1024 * 1024;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const newId = customAlphabet(alphabet, 12);

export async function POST(request: Request): Promise<Response> {
  const body = await request.blob();
  if (body.size === 0 || body.size > MAX_BYTES) {
    return new Response('Invalid strip upload', { status: 400 });
  }
  const id = newId();
  await put(`strips/${id}.jpg`, body, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/jpeg',
  });
  return Response.json({ id });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- app/api/strips/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test`
Expected: all tests pass.

```powershell
git add package.json package-lock.json app/api/strips/route.ts app/api/strips/route.test.ts
git commit -m "feat: strip upload API storing JPEGs in Vercel Blob"
```

---

### Task 8: Phone download page `/strip/[id]`

**Files:**
- Create: `app/strip/[id]/page.tsx`

**Interfaces:**
- Consumes: blobs stored at `strips/<id>.jpg` by Task 7 (looked up server-side via `list({ prefix })`; blob's `downloadUrl` serves with `Content-Disposition: attachment` so the Save button truly downloads cross-origin)
- Produces: the public page QR codes point at (`/strip/<id>`). No later task depends on its internals.

- [ ] **Step 1: Write `app/strip/[id]/page.tsx`**

```tsx
import { list } from '@vercel/blob';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{12}$/.test(id)) notFound();

  const { blobs } = await list({ prefix: `strips/${id}.jpg`, limit: 1 });
  if (blobs.length === 0) notFound();
  const blob = blobs[0];

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-black p-6">
      <h1 className="text-2xl font-bold text-white">Scotty Ventures</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={blob.url}
        alt="Your Scotty Ventures photo strip"
        className="w-full max-w-sm rounded shadow-lg"
      />
      <a
        href={blob.downloadUrl}
        className="rounded-full bg-[#C8102E] px-10 py-4 text-xl font-bold text-white"
      >
        Save photo
      </a>
      <p className="text-center text-sm text-neutral-400">
        On iPhone? You can also press and hold the image, then tap &ldquo;Save to
        Photos&rdquo;.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify it builds and 404s cleanly without a blob token**

Run: `npm run build`
Expected: build passes. (Live behavior is verified in Task 11 once `BLOB_READ_WRITE_TOKEN` exists — `list()` throws without it, which `force-dynamic` defers to request time.)

- [ ] **Step 3: Commit**

```powershell
git add app/strip
git commit -m "feat: phone-facing strip download page"
```

---

### Task 9: Gesture engine and hand skeleton overlay

**Files:**
- Create: `lib/gesture.ts`, `lib/skeleton.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces (used by Task 10):
  - `createGestureEngine(): Promise<GestureEngine>` where `GestureEngine = { detect(video: HTMLVideoElement, timestampMs: number): GestureFrame }` and `GestureFrame = { landmarks: { x: number; y: number }[][]; isVictory: boolean }` (landmarks in normalized 0–1 video coordinates, un-mirrored)
  - `drawSkeleton(ctx: CanvasRenderingContext2D, hands: { x: number; y: number }[][], color: string, width: number, height: number): void` — clears the canvas and draws mirrored dots + bones (mirrored so it aligns with the CSS-mirrored video preview)

No unit tests (thin wrappers over MediaPipe and canvas); verified live in Task 11.

- [ ] **Step 1: Install MediaPipe**

```powershell
npm install @mediapipe/tasks-vision
```

- [ ] **Step 2: Write `lib/gesture.ts`**

```ts
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const MIN_SCORE = 0.6;

export interface GestureFrame {
  landmarks: { x: number; y: number }[][];
  isVictory: boolean;
}

export interface GestureEngine {
  detect(video: HTMLVideoElement, timestampMs: number): GestureFrame;
}

export async function createGestureEngine(): Promise<GestureEngine> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  });
  return {
    detect(video, timestampMs) {
      const result = recognizer.recognizeForVideo(video, timestampMs);
      const isVictory = result.gestures.some(
        (g) => g[0]?.categoryName === 'Victory' && g[0].score >= MIN_SCORE,
      );
      return { landmarks: result.landmarks, isVictory };
    },
  };
}
```

- [ ] **Step 3: Write `lib/skeleton.ts`**

```ts
/** Bone pairs for MediaPipe's 21 hand landmarks. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],        // index
  [5, 9], [9, 10], [10, 11], [11, 12],   // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20],// pinky
  [0, 17],                               // palm edge
];

export interface Point {
  x: number;
  y: number;
}

/**
 * Draws hand skeletons mirrored horizontally, matching the CSS-mirrored
 * selfie preview (display x = 1 - landmark x).
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  hands: Point[][],
  color: string,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  for (const hand of hands) {
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo((1 - hand[a].x) * width, hand[a].y * height);
      ctx.lineTo((1 - hand[b].x) * width, hand[b].y * height);
      ctx.stroke();
    }
    for (const p of hand) {
      ctx.beginPath();
      ctx.arc((1 - p.x) * width, p.y * height, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
```

- [ ] **Step 4: Verify build and commit**

Run: `npm run build`
Expected: build passes.

```powershell
git add package.json package-lock.json lib/gesture.ts lib/skeleton.ts
git commit -m "feat: MediaPipe gesture engine and hand skeleton overlay"
```

---

### Task 10: Booth page (full UI wiring)

**Files:**
- Create: `app/page.tsx` (replace the scaffold home page entirely)
- Modify: `app/layout.tsx` only if the scaffold added header/footer chrome (it shouldn't; leave metadata title as "Scotty Ventures Photo Booth")

**Interfaces:**
- Consumes: everything — `reduce`/`BoothState`/`BoothEvent` (Task 4), `HoldTracker` (Task 5), `capturePhoto` (Task 3), `composeStrip`/`loadOptionalImage` (Task 6), `createGestureEngine` (Task 9), `drawSkeleton` (Task 9), `POST /api/strips` (Task 7), `COLORS`/`TAGLINE`/`TIMINGS`/`STRIP` (Task 1). Also `npm install qrcode @types/qrcode` here.
- Produces: the complete booth experience at `/`.

- [ ] **Step 1: Install QR dependency**

```powershell
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Write `app/page.tsx`** (full file — replaces scaffold content)

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { COLORS, TAGLINE, TIMINGS } from '@/lib/config';
import { reduce, type BoothEvent, type BoothState } from '@/lib/machine';
import { HoldTracker } from '@/lib/hold';
import { capturePhoto } from '@/lib/capture';
import { composeStrip, loadOptionalImage } from '@/lib/compositor';
import { createGestureEngine, type GestureEngine } from '@/lib/gesture';
import { drawSkeleton } from '@/lib/skeleton';

const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function BoothPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GestureEngine | null>(null);
  const holdRef = useRef(new HoldTracker());
  const photosRef = useRef<HTMLCanvasElement[]>([]);
  const stripBlobRef = useRef<Blob | null>(null);

  const [state, setState] = useState<BoothState>({ name: 'attract' });
  const stateRef = useRef(state);
  stateRef.current = state;

  const [count, setCount] = useState(TIMINGS.countdownSeconds);
  const [flash, setFlash] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [stripPreview, setStripPreview] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [modelError, setModelError] = useState(false);

  const dispatch = useCallback(
    (e: BoothEvent) => setState((s) => reduce(s, e)),
    [],
  );

  const reset = useCallback(() => {
    photosRef.current = [];
    stripBlobRef.current = null;
    setStripPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setQrDataUrl(null);
    holdRef.current.startCooldown(performance.now());
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  // Camera init
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
      })
      .then((s) => {
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          video.play();
        }
      })
      .catch(() => setCameraError(true));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // Gesture + skeleton loop (active on the attract screen only)
  useEffect(() => {
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        if (!engineRef.current) engineRef.current = await createGestureEngine();
      } catch {
        setModelError(true); // spec: visible error + reload prompt on model load failure
        return;
      }
      const loop = () => {
        if (stopped) return;
        raf = requestAnimationFrame(loop);
        const video = videoRef.current;
        const overlay = overlayRef.current;
        if (!video || !overlay || video.readyState < 2) return;
        if (stateRef.current.name !== 'attract') {
          overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
          return;
        }
        if (overlay.width !== video.videoWidth) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
        }
        const now = performance.now();
        const frame = engineRef.current!.detect(video, now);
        const { progress, fired } = holdRef.current.update(frame.isVictory, now);
        setHoldProgress(progress);
        drawSkeleton(
          overlay.getContext('2d')!,
          frame.landmarks,
          frame.isVictory ? COLORS.red : COLORS.white,
          overlay.width,
          overlay.height,
        );
        if (fired) dispatch({ type: 'TRIGGER' });
      };
      loop();
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [dispatch]);

  // Countdown + capture (re-runs for each photoIndex because state is a new object)
  useEffect(() => {
    if (state.name !== 'countdown') return;
    setCount(TIMINGS.countdownSeconds);
    const start = Date.now();
    const interval = setInterval(() => {
      const remaining =
        TIMINGS.countdownSeconds - Math.floor((Date.now() - start) / 1000);
      if (remaining > 0) {
        setCount(remaining);
        return;
      }
      clearInterval(interval);
      const video = videoRef.current;
      if (video) photosRef.current.push(capturePhoto(video));
      setFlash(true);
      setTimeout(() => setFlash(false), 300);
      dispatch({ type: 'PHOTO_CAPTURED' });
    }, 100);
    return () => clearInterval(interval);
  }, [state, dispatch]);

  // Compose + upload + QR
  useEffect(() => {
    if (state.name !== 'composing') return;
    let cancelled = false;
    (async () => {
      try {
        if (!stripBlobRef.current) {
          const [logo, frameOverlay] = await Promise.all([
            loadOptionalImage('/logo.png'),
            loadOptionalImage('/frame.png'),
          ]);
          stripBlobRef.current = await composeStrip(photosRef.current, {
            logo,
            frameOverlay,
          });
          setStripPreview(URL.createObjectURL(stripBlobRef.current));
        }
        const res = await fetch('/api/strips', {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: stripBlobRef.current,
        });
        if (!res.ok) throw new Error(`upload failed: ${res.status}`);
        const { id } = (await res.json()) as { id: string };
        const link = `${window.location.origin}/strip/${id}`;
        const qr = await QRCode.toDataURL(link, { width: 480, margin: 1 });
        if (!cancelled) {
          setQrDataUrl(qr);
          dispatch({ type: 'UPLOAD_SUCCEEDED', stripUrl: link });
        }
      } catch {
        if (!cancelled) dispatch({ type: 'UPLOAD_FAILED' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, dispatch]);

  // QR screen auto-reset
  useEffect(() => {
    if (state.name !== 'qr') return;
    const t = setTimeout(reset, TIMINGS.qrTimeoutMs);
    return () => clearTimeout(t);
  }, [state, reset]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
      />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black p-12 text-center">
          <p className="text-3xl text-white">
            Camera unavailable. Please allow camera access in the browser and
            reload the page.
          </p>
        </div>
      )}

      {modelError && !cameraError && (
        <div className="absolute inset-x-0 top-0 bg-[#C8102E] p-4 text-center">
          <p className="text-xl font-semibold text-white">
            Hand tracking failed to load — check the internet connection and
            reload the page.
          </p>
        </div>
      )}

      {state.name === 'attract' && !cameraError && (
        <>
          <div className="absolute inset-x-0 top-10 text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-lg">
              Scotty Ventures
            </h1>
          </div>
          <div className="absolute inset-x-0 bottom-12 px-8 text-center">
            <p className="text-3xl font-semibold text-white drop-shadow-lg">
              {TAGLINE}
            </p>
          </div>
          {holdProgress > 0 && (
            <svg
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              width="160"
              height="160"
              viewBox="0 0 160 160"
            >
              <circle cx="80" cy="80" r={RING_RADIUS} stroke="#ffffff55" strokeWidth="10" fill="none" />
              <circle
                cx="80"
                cy="80"
                r={RING_RADIUS}
                stroke={COLORS.red}
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={(1 - holdProgress) * RING_CIRCUMFERENCE}
                transform="rotate(-90 80 80)"
              />
            </svg>
          )}
        </>
      )}

      {state.name === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[14rem] font-extrabold leading-none text-white drop-shadow-2xl">
            {count}
          </p>
          <p className="text-4xl font-semibold text-white drop-shadow-lg">
            Photo {state.photoIndex + 1} of 3
          </p>
        </div>
      )}

      {state.name === 'composing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="animate-pulse text-5xl font-bold text-white">
            Making your strip...
          </p>
        </div>
      )}

      {state.name === 'qr' && (
        <div className="absolute inset-0 flex items-center justify-center gap-16 bg-black p-8">
          {stripPreview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={stripPreview} alt="Your photo strip" className="h-[85vh] rounded shadow-2xl" />
          )}
          <div className="flex flex-col items-center gap-6">
            <p className="text-4xl font-bold text-white">Scan to save your photos!</p>
            {qrDataUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qrDataUrl} alt="QR code to your photo strip" className="h-80 w-80 rounded bg-white p-3" />
            )}
            <button
              onClick={reset}
              className="rounded-full bg-[#C8102E] px-10 py-4 text-2xl font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {state.name === 'uploadError' && (
        <div className="absolute inset-0 flex items-center justify-center gap-16 bg-black p-8">
          {stripPreview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={stripPreview} alt="Your photo strip" className="h-[85vh] rounded shadow-2xl" />
          )}
          <div className="flex flex-col items-center gap-6">
            <p className="text-3xl font-semibold text-white">
              Upload failed — your photos are safe.
            </p>
            <button
              onClick={() => dispatch({ type: 'RETRY' })}
              className="rounded-full bg-[#C8102E] px-10 py-4 text-2xl font-bold text-white"
            >
              Try again
            </button>
            <button onClick={reset} className="text-lg text-neutral-400 underline">
              Start over
            </button>
          </div>
        </div>
      )}

      {flash && <div className="absolute inset-0 bg-white" />}
    </main>
  );
}
```

- [ ] **Step 3: Update metadata title in `app/layout.tsx`**

Change the `metadata` export's `title` to `'Scotty Ventures Photo Booth'` and `description` to `'V stands for venture capital.'`. Touch nothing else.

- [ ] **Step 4: Verify build and full test suite**

Run: `npm run build` — Expected: passes.
Run: `npm test` — Expected: all tests pass.

- [ ] **Step 5: Smoke-test locally (no blob token yet — upload will fail, which exercises the error path)**

Run: `npm run dev`, open `http://localhost:3000` in Chrome.
Expected: camera preview appears mirrored; white hand skeleton tracks your hand; holding ✌️ turns it red, fills the ring, and starts the 5-4-3-2-1 countdown ×3 with flashes; then "Making your strip..." → the **upload-error screen** showing your composed strip with a red border and "SCOTTY VENTURES" panel (upload fails without a token — expected). Verify "Start over" returns to attract and ✌️ is ignored for ~3 s.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: booth page wiring gesture trigger, countdown, strip, and QR flow"
```

---

### Task 11: Blob store, deploy, and end-to-end verification

**Files:**
- Create: `.env.local` (via `vercel env pull` — never committed; scaffold `.gitignore` already excludes it)

**Interfaces:**
- Consumes: the deployed app + a connected Vercel Blob store providing `BLOB_READ_WRITE_TOKEN`
- Produces: the live production URL used on event day.

- [ ] **Step 1: Install the Vercel CLI and link the project**

```powershell
npm install -g vercel
vercel link
```

Follow the prompts (the user's existing Vercel account; create a new project named `scotty-ventures-photobooth`).

- [ ] **Step 2: Create and connect a Blob store**

In the Vercel dashboard: project → **Storage** → **Create Database** → **Blob** → name it (e.g. `photobooth-strips`) → connect to the project for all environments. This injects `BLOB_READ_WRITE_TOKEN`.

- [ ] **Step 3: Pull env vars locally and verify the full local flow**

```powershell
vercel env pull .env.local
npm run dev
```

Expected: same flow as Task 10 Step 5, but the upload now succeeds — the QR screen appears with strip + QR code. Scan the QR with a phone (phone must reach the laptop — if `localhost` doesn't work from the phone, skip and verify on the deployed URL in Step 5).

- [ ] **Step 4: Deploy to production**

```powershell
vercel deploy --prod
```

Expected: deploy succeeds; note the production URL.

- [ ] **Step 5: End-to-end verification on the production URL (manual checklist)**

- [ ] Camera permission prompt → preview appears mirrored, fullscreen.
- [ ] White skeleton dots/bones track hands; tagline reads exactly: "V stands for venture capital. Activate the photo booth by doing a ✌️".
- [ ] Holding ✌️ ~1 s: skeleton turns red, ring fills, countdown starts.
- [ ] Three photos captured 5 s apart, flash each time, "Photo N of 3" indicator correct.
- [ ] Strip: red `#C8102E` border, 3 mirrored photos stacked, SCOTTY VENTURES panel with date.
- [ ] QR scans from a phone → `/strip/<id>` shows the strip; **Save photo** downloads it; long-press works on iPhone.
- [ ] QR screen auto-returns to attract after 60 s; "Done" returns immediately; ✌️ ignored for ~3 s after.
- [ ] Error path: with DevTools → Network → Offline during composing, the strip is preserved and **Try again** succeeds after going back online.
- [ ] Denying camera permission shows the instruction message, not a black screen.

- [ ] **Step 6: Commit any final tweaks and record the production URL**

```powershell
git add -A
git commit -m "chore: production deployment configuration"
```

Report the production URL to the user, plus reminders: send the `logo.png` (drop into `public/`), set the real event date in `lib/config.ts`, and do a dress rehearsal on the event laptop + venue Wi-Fi.
