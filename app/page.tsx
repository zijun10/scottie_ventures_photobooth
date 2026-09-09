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
  // Intentional: keeps the rAF loop's stale closure reading the latest state
  // without adding it as a dependency and restarting the loop every render.
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = state;

  const [count, setCount] = useState<number>(TIMINGS.countdownSeconds);
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
    setHoldProgress(0);
    holdRef.current.startCooldown(performance.now());
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  // Camera init
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      // Intentional: surfaces the camera-unavailable screen immediately
      // instead of letting the synchronous getUserMedia TypeError below
      // escape the effect and leave a black screen.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCameraError(true);
      return;
    }
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
    // Intentional: resets the visible counter each time a new countdown
    // phase begins.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          signal: AbortSignal.timeout(TIMINGS.uploadTimeoutMs),
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
            Hand tracking failed to load. Check the internet connection, then
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
