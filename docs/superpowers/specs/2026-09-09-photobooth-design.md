# Scotty Ventures Photo Booth — Design Spec

**Date:** 2026-09-09
**Status:** Approved pending final review

## Overview

A browser-based photo booth for a Scotty Ventures (school venture capital club) event. A guest activates the booth with a peace sign ✌️ (V for venture capital), the booth takes three photos at 5-second intervals, composes them into a vertical branded photo strip, and displays a QR code that links to a page where the guest can save the digital strip to their phone. No printing.

## Platform & Architecture

- **Next.js (App Router)** web app deployed on **Vercel** (user has an account).
- **Fully client-side booth logic**: webcam preview, hand tracking, gesture recognition, countdown, photo capture, and strip composition all run in the browser on the event laptop.
- **MediaPipe Tasks Vision (Gesture Recognizer)** for hand tracking — its built-in `Victory` gesture category detects the peace sign; no model training.
- **Vercel Blob** stores finished strips (one JPEG per session). Files persist indefinitely (no expiry) until manually deleted from the dashboard.
- **Tiny backend**: one API route to upload a strip; one dynamic page to view/download it.

### Components

| Unit | Purpose |
|------|---------|
| `/` booth page | Fullscreen state machine driving the whole booth experience |
| Gesture module | Wraps MediaPipe: emits landmarks (21 per hand) + "victory held for 1s" events |
| Capture module | Grabs frames from the `<video>` element at countdown zero |
| Strip compositor | Draws 3 photos + frame onto a canvas, exports JPEG |
| `POST /api/strips` | Receives JPEG, stores in Vercel Blob under a random unguessable ID |
| `/strip/[id]` page | Phone-facing: shows strip, Save button, long-press hint for iOS |

## Booth Screen Flow

Fullscreen page with five states:

1. **Attract** — live mirrored camera preview. Overlay tagline (exact copy): **"V stands for venture capital. Activate the photo booth by doing a ✌️"** plus Scotty Ventures branding. A hand-skeleton overlay (dots + connecting lines over the 21 MediaPipe landmarks) tracks visible hands. When `Victory` is recognized, the skeleton turns Scotty red and a progress ring fills during a **1-second hold**; completing the hold starts the session. The hold prevents accidental triggers.
2. **Countdown / capture ×3** — big 5-4-3-2-1 countdown over the live preview; white screen flash at zero; photo captured from the video stream. Repeats three times with a "Photo N of 3" indicator. Hand skeleton is hidden during this state so it never appears in photos.
3. **Composing** — "Making your strip..." while the canvas composes the strip and uploads it.
4. **QR screen** — finished strip on the left, large QR code on the right, "Scan to save your photos!" Auto-returns to Attract after **60 seconds**; a "Done" button returns immediately. A **3-second cooldown** after returning prevents instant re-trigger by people still in frame.
5. **Upload-error fallback** — if upload fails, the strip still displays with a Retry button; the QR appears once retry succeeds. Photos are never lost to a network failure.

## The Strip

- **1200×3000 px vertical JPEG** (2:5, classic booth-strip ratio; crisp for Instagram stories).
- Plain **red border** (`#C8102E` default; adjustable when the club logo arrives) around the strip and between photos.
- Three **4:3 landscape photos stacked**, **mirrored** (selfie orientation).
- Bottom panel (~400 px): **Scotty Ventures logo** (user will supply; text placeholder until then) with the **event date** beneath in small text (date configurable).
- **Frame swap path:** compositor draws the border/logo in code, but first checks for an optional `frame.png` (1200×3000 with transparent photo windows) in the app's public assets. If present, it's drawn over the photos instead of the coded frame — the user can swap in a custom design later with zero code changes.

## QR, Upload & Phone Page

- Strip JPEG POSTs to `/api/strips`; stored in Blob at `strips/<random-id>.jpg` — unguessable ID means links are private to QR holders.
- QR code generated **in the browser** (JS library), encoding `https://<app>.vercel.app/strip/<id>`.
- `/strip/[id]`: strip shown full-width, big **"Save photo"** download button, SV branding, and an iOS hint ("or press and hold the image to save").
- After download, guests do nothing else — booth has already auto-reset to Attract for the next group.

## Physical Setup Notes (non-code)

- Runs fullscreen in Chrome on a laptop; an external TV/monitor simply mirrors it — UI is responsive to either. Webcam location is a hardware choice (laptop cam or USB webcam near the TV); software is unaffected.
- Venue needs internet only for the upload/QR step; everything else works offline.

## Error Handling

- **Camera permission denied / no camera:** attract screen shows explicit instructions instead of a black box.
- **Upload failure:** strip preserved on screen with Retry (see state 5).
- **Gesture false positives:** 1s hold + 3s post-session cooldown.
- **MediaPipe model load failure:** visible error with reload prompt (model files load from CDN at startup).

## Testing

- Unit tests: strip compositor (layout math, frame-override path) and booth state machine (transitions, timers, cooldown).
- Manual/live verification: gesture recognition and full happy path in a real browser with a real webcam.
- Pre-event: full dress rehearsal on the actual event laptop and venue Wi-Fi.

## Out of Scope (YAGNI)

- Printing, photo retakes, filters/effects, gallery of all strips, admin UI, analytics, link expiry.
