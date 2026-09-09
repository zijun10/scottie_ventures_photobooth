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
