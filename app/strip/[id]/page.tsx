import { list } from '@vercel/blob';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{12}$/.test(id)) notFound();

  const { blobs } = await list({ prefix: `strips/${id}.jpg`, limit: 1 });
  if (blobs.length === 0) notFound();
  const blob = blobs[0];

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-black p-6">
      <h1 className="text-2xl font-bold text-white">Scotty Ventures</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={blob.url}
        alt="Your Scotty Ventures photo strip"
        className="w-full max-w-sm rounded shadow-lg"
      />
      <a
        href={blob.downloadUrl}
        className="rounded-full bg-[#C8102E] px-10 py-4 text-xl font-bold text-white"
      >
        Save photo
      </a>
      <p className="text-center text-sm text-neutral-400">
        On iPhone? You can also press and hold the image, then tap &ldquo;Save to
        Photos&rdquo;.
      </p>
    </main>
  );
}
