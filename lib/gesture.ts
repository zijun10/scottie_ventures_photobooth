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
