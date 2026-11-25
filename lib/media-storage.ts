import 'server-only';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { query } from './db';

const storageDir = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage'));

export function mediaFilePath(objectKey: string) {
  const file = path.resolve(storageDir, objectKey);
  const relative = path.relative(storageDir, file);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Invalid media object key.');
  }
  return file;
}

async function removeMediaFile(objectKey: string) {
  try {
    await unlink(mediaFilePath(objectKey));
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}

export async function cleanDeletedMedia() {
  try {
    const { rows } = await query<{ object_key: string }>('SELECT object_key FROM portal.media_deletions');
    const removed: string[] = [];
    for (const { object_key } of rows) {
      if (await removeMediaFile(object_key)) removed.push(object_key);
    }
    if (removed.length) {
      await query('DELETE FROM portal.media_deletions WHERE object_key=ANY($1::text[])', [removed]);
    }
    if (removed.length !== rows.length) console.error('Some deleted attachments are awaiting file cleanup.');
  } catch {
    console.error('Deleted attachment cleanup will be retried.');
  }
}
