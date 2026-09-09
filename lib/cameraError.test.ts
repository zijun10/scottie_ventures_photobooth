import { describe, expect, it } from 'vitest';
import { cameraErrorMessage } from './cameraError';

describe('cameraErrorMessage', () => {
  it('tells the operator another app holds the camera on NotReadableError', () => {
    expect(cameraErrorMessage('NotReadableError')).toMatch(/another app/i);
  });

  it('asks for permission on NotAllowedError', () => {
    expect(cameraErrorMessage('NotAllowedError')).toMatch(/allow camera access/i);
  });

  it('reports no camera on NotFoundError', () => {
    expect(cameraErrorMessage('NotFoundError')).toMatch(/no camera/i);
  });

  it('falls back to a generic reload message for anything else', () => {
    expect(cameraErrorMessage('SomethingElse')).toMatch(/reload/i);
    expect(cameraErrorMessage(undefined)).toMatch(/reload/i);
  });
});
