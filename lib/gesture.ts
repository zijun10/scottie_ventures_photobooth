import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import { evaluateTrigger, type Hand, type TriggerResult } from './trigger';

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const MIN_SCORE = 0.6;

export interface GestureFrame {
  hands: Hand[];
  trigger: TriggerResult;
}

export interface GestureEngine {
  detect(video: HTMLVideoElement, timestampMs: number): GestureFrame;
}

export async function createGestureEngine(): Promise<GestureEngine> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = {
    runningMode: 'VIDEO' as const,
    // S (two hands) + V (one hand) needs at least three; allow a spare.
    numHands: 4,
  };
  let recognizer;
  try {
    recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      ...options,
    });
  } catch {
    // Some devices/browsers lack a usable GPU delegate; retry on CPU
    // before giving up and letting the caller show the model-error banner.
    recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      ...options,
    });
  }
  return {
    detect(video, timestampMs) {
      const result = recognizer.recognizeForVideo(video, timestampMs);
      const hands: Hand[] = result.landmarks.map((landmarks, i) => {
        const top = result.gestures[i]?.[0];
        const category = top && top.score >= MIN_SCORE ? top.categoryName : 'None';
        return { landmarks, category };
      });
      return { hands, trigger: evaluateTrigger(hands) };
    },
  };
}
