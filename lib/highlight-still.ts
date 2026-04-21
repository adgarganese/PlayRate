/**
 * Pick a URI that expo-image can load for a highlight tile/poster.
 * Video `media_url` points at a video file — never use it as a still image when `thumbnail_url` is missing.
 */
export function pickHighlightStillImageRaw(
  thumbnailUrl: string | null | undefined,
  mediaUrl: string | null | undefined,
  mediaType: string | null | undefined
): string | null {
  const thumb = thumbnailUrl?.trim();
  if (thumb) return thumb;
  const t = (mediaType ?? '').toLowerCase();
  if (t === 'video') return null;
  return mediaUrl?.trim() || null;
}
