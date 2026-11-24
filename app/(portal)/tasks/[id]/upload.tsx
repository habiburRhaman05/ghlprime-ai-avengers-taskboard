'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MEDIA_LIMIT, MEDIA_TYPES } from '@/lib/media';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

async function submit(payload: object) {
  const response = await fetch('/api/media', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Upload could not be completed.');
  return result;
}
export function Upload({ taskId }: { taskId: string }) {
  const [pending, setPending] = useState(false);
  const [finishId, setFinishId] = useState<string>();
  const [error, setError] = useState('');
  const router = useRouter();
  return <form className="stack upload-form" aria-busy={pending} onSubmit={async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get('media');
    setPending(true);
    setError('');
    try {
      let id = finishId;
      if (!id) {
        if (!(file instanceof File) || !file.size || file.size > MEDIA_LIMIT ||
          !MEDIA_TYPES.some((type) => type === file.type)) {
          throw new Error('Choose a PNG, JPEG, WebP, MP4, or WebM file up to 50 MB.');
        }
        const reservation = await submit({ action: 'begin', taskId,
          mime: file.type, filename: file.name, bytes: file.size });
        const uploadResponse = await fetch(reservation.path, {
          method: 'PUT', body: file, headers: { 'Content-Type': file.type },
        });
        if (!uploadResponse.ok) throw new Error('Upload failed. Check your connection and retry.');
        id = reservation.id;
        setFinishId(id);
      }
      await submit({ action: 'finish', taskId, id });
      setFinishId(undefined);
      form.reset();
      router.refresh();
      toast.success('Media uploaded.');
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Upload failed.';
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }}>
    <label>Attach an image or video
      <Input name="media" type="file" accept={MEDIA_TYPES.join(',')} required disabled={pending}
        onChange={() => setFinishId(undefined)} />
      <small>PNG, JPEG, WebP, MP4, or WebM · up to 50 MB each</small>
    </label>
    {error && <p role="alert" className="error">{error}</p>}
    <div><Button variant="secondary" type="submit" disabled={pending}><UploadCloud size={16} aria-hidden="true" />{pending ? 'Uploading…' : finishId ? 'Retry verification' : 'Upload media'}</Button></div>
  </form>;
}
