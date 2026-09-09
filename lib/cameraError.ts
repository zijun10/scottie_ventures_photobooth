/** Operator-facing message for a getUserMedia failure, keyed by DOMException name. */
export function cameraErrorMessage(name: string | undefined): string {
  switch (name) {
    case 'NotReadableError':
    case 'AbortError':
      return 'Camera is in use by another app (a video call, an editor preview, another browser tab). Close it, then reload the page.';
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera blocked. Please allow camera access in the browser and reload the page.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera found. Plug in a webcam and reload the page.';
    default:
      return 'Camera unavailable. Reload the page; if it persists, check the camera in another app.';
  }
}
