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
