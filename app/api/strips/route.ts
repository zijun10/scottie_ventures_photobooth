import { put } from '@vercel/blob';
import { customAlphabet } from 'nanoid';

const MAX_BYTES = 10 * 1024 * 1024;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const newId = customAlphabet(alphabet, 12);

export async function POST(request: Request): Promise<Response> {
  const body = await request.blob();
  if (body.size === 0 || body.size > MAX_BYTES) {
    return new Response('Invalid strip upload', { status: 400 });
  }
  const id = newId();
  await put(`strips/${id}.jpg`, body, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/jpeg',
  });
  return Response.json({ id });
}
