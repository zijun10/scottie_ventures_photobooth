# Scottie Ventures Photo Booth

A kiosk-mode photo booth for Scottie Ventures events. Guests trigger it with a
victory (✌️) hand gesture detected via MediaPipe, the booth counts down and
captures three photos, composites them into a branded strip, uploads the
strip to Vercel Blob, and shows a QR code so guests can scan it on their
phone and save the strip.

## Local development

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # Vitest unit tests
```

`npm run lint` and `npx tsc --noEmit` should stay clean; `npm run build`
produces the production bundle.

## First-time Vercel setup

```bash
npm i -g vercel
vercel login
vercel link
```

Then, in the Vercel dashboard, create a Blob store and connect it to this
project so `BLOB_READ_WRITE_TOKEN` is injected automatically. Pull it down
for local use:

```bash
vercel env pull .env.local
```

Deploy to production when ready:

```bash
vercel deploy --prod
```

## Event-day checklist

- Drop `public/logo.png` in for the strip branding. Optionally add
  `public/frame.png` — a 1200x3000 image with transparent windows over the
  photo slots — to use a full custom frame instead of the default panel.
- Set the real event date in `lib/config.ts` (`EVENT.date`) and, if needed,
  the brand red (`COLORS.red`). The tagline and all booth timings (hold
  duration, countdown length, QR/cooldown timeouts) also live in
  `lib/config.ts`.
- Open the production URL in Chrome on the booth machine, allow camera
  access when prompted, and press F11 for fullscreen.
- The captured photo is a centered 4:3 crop of the camera preview, so coach
  guests to stand centered in frame rather than at the edges.
- Keep the booth machine's internet connection up throughout the event —
  the upload and QR step both require it.

## After the event

The `/api/strips` upload route is public and uploaded blobs never expire, so
once the event is over either:

- delete or pause the Vercel deployment, or
- add a Vercel WAF rate-limit rule on `/api/strips` to stop further uploads.

You can also delete individual strip blobs from the Vercel dashboard if you
want to clear storage.
