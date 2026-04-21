import * as VideoThumbnails from 'expo-video-thumbnails';
import { prepareHighlightImageForUpload } from '@/lib/image-upload-prepare';
import { logger } from '@/lib/logger';

/**
 * Extract a JPEG frame from a local (or remote) video URI, then resize/compress like other highlight images.
 * @returns Local file URI of the compressed JPEG, or null on failure (never throws).
 */
export async function generateVideoThumbnail(
  videoUri: string,
  timeMs?: number
): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: timeMs ?? 1000,
    });
    const prepared = await prepareHighlightImageForUpload(uri);
    return prepared.uri;
  } catch (e) {
    logger.warn('[video-thumbnail] generateVideoThumbnail failed', { err: e });
    return null;
  }
}
