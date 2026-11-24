export const MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'] as const;
export const MEDIA_LIMIT = 50 * 1024 * 1024;

export function matchingMedia(bytes: Uint8Array, mime: string) {
  const prefix = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const tag = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  switch (mime) {
    case 'image/png': return prefix([137, 80, 78, 71, 13, 10, 26, 10]);
    case 'image/jpeg': return prefix([255, 216, 255]);
    case 'image/webp': return tag(0, 4) === 'RIFF' && tag(8, 12) === 'WEBP';
    case 'video/mp4': return tag(4, 8) === 'ftyp';
    case 'video/webm': return prefix([26, 69, 223, 163]);
    default: return false;
  }
}
