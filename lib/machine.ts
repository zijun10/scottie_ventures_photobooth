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
