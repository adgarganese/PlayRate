import { Video, getRealPath, getFileSize } from 'react-native-compressor';
import { logger } from '@/lib/logger';
import { HIGHLIGHT_VIDEO_MAX_UPLOAD_BYTES, HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE } from '@/lib/config';

/** ~720p long edge (portrait: max height, landscape: max width), aspect preserved by compressor. */
const TARGET_MAX_DIMENSION = 1280;
/** Target video bitrate (bps); manual mode — between 2–4 Mbps. */
const TARGET_VIDEO_BITRATE = 3_000_000;

async function resolveReadableVideoPath(uri: string): Promise<string> {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('assets-library://')
  ) {
    try {
      return await getRealPath(trimmed, 'video');
    } catch (e) {
      logger.warn('[video-compress] getRealPath failed, using original uri', { err: e });
      return trimmed;
    }
  }
  if (!trimmed.startsWith('file://') && trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }
  return trimmed;
}

async function fileSizeBytes(uri: string): Promise<number | null> {
  try {
    const s = await getFileSize(uri);
    const n = parseInt(s, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  } catch (e) {
    logger.debug('video-compress: getFileSize failed', e);
  }
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.size;
  } catch (e) {
    logger.debug('video-compress: fetch blob size failed', e);
    return null;
  }
}

/**
 * Client-side highlight video compression (react-native-compressor).
 * On failure, returns the original URI and best-known size (upload is not blocked).
 */
export async function compressVideo(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<{ uri: string; fileSize: number }> {
  const normalized = await resolveReadableVideoPath(uri);
  const beforeBytes = (await fileSizeBytes(normalized)) ?? (await fileSizeBytes(uri)) ?? 0;
  if (__DEV__) {
    logger.info(
      `[video-compress] before: ${beforeBytes} bytes (${(beforeBytes / (1024 * 1024)).toFixed(2)} MiB)`
    );
  }

  try {
    const outUri = await Video.compress(
      normalized,
      {
        compressionMethod: 'manual',
        maxSize: TARGET_MAX_DIMENSION,
        bitrate: TARGET_VIDEO_BITRATE,
      },
      (p) => {
        onProgress?.(p);
      }
    );
    const afterBytes = (await fileSizeBytes(outUri)) ?? 0;
    if (__DEV__) {
      logger.info(
        `[video-compress] after: ${afterBytes} bytes (${(afterBytes / (1024 * 1024)).toFixed(2)} MiB)`
      );
    }
    return { uri: outUri, fileSize: afterBytes };
  } catch (err) {
    logger.warn('[video-compress] compression failed, using original', { err });
    const fallbackSize = beforeBytes > 0 ? beforeBytes : (await fileSizeBytes(uri)) ?? 0;
    if (__DEV__) {
      logger.info(
        `[video-compress] fallback original: ${fallbackSize} bytes (${(fallbackSize / (1024 * 1024)).toFixed(2)} MiB)`
      );
    }
    return { uri, fileSize: fallbackSize };
  }
}

export function assertHighlightVideoUnderMaxBytes(fileSizeBytes: number): void {
  if (fileSizeBytes > HIGHLIGHT_VIDEO_MAX_UPLOAD_BYTES) {
    throw new Error(HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE);
  }
}
