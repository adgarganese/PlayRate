import { Image as RNImage } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/** Canonical resize/compress settings for Supabase Storage uploads (Issue #17). */
export const IMAGE_UPLOAD_PROFILES = {
  avatar: { maxLongestSide: 400, compress: 0.8 },
  courtPhoto: { maxLongestSide: 1200, compress: 0.8 },
  highlightImage: { maxLongestSide: 1080, compress: 0.85 },
} as const;

function buildResizeActions(
  width: number,
  height: number,
  maxLongestSide: number
): ImageManipulator.Action[] {
  const longest = Math.max(width, height);
  if (longest <= maxLongestSide) return [];
  if (width >= height) {
    return [{ resize: { width: maxLongestSide } }];
  }
  return [{ resize: { height: maxLongestSide } }];
}

async function resolveDimensions(
  uri: string,
  pickerWidth?: number | null,
  pickerHeight?: number | null
): Promise<{ width: number; height: number }> {
  if (
    typeof pickerWidth === 'number' &&
    typeof pickerHeight === 'number' &&
    pickerWidth > 0 &&
    pickerHeight > 0
  ) {
    return { width: pickerWidth, height: pickerHeight };
  }
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      (e) => reject(e ?? new Error('Could not read image dimensions'))
    );
  });
}

/**
 * Resize (longest side capped), re-encode as JPEG. Always returns a new local file URI suitable for `fetch`.
 */
export async function prepareImageForUpload(
  uri: string,
  config: { maxLongestSide: number; compress: number },
  pickerDimensions?: { width?: number | null; height?: number | null }
): Promise<{ uri: string; contentType: 'image/jpeg'; fileExt: 'jpg' }> {
  const { width, height } = await resolveDimensions(
    uri,
    pickerDimensions?.width,
    pickerDimensions?.height
  );
  const actions = buildResizeActions(width, height, config.maxLongestSide);
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: config.compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, contentType: 'image/jpeg', fileExt: 'jpg' };
}

export function prepareAvatarImageForUpload(
  uri: string,
  pickerDimensions?: { width?: number | null; height?: number | null }
) {
  return prepareImageForUpload(uri, IMAGE_UPLOAD_PROFILES.avatar, pickerDimensions);
}

export function prepareCourtPhotoImageForUpload(
  uri: string,
  pickerDimensions?: { width?: number | null; height?: number | null }
) {
  return prepareImageForUpload(uri, IMAGE_UPLOAD_PROFILES.courtPhoto, pickerDimensions);
}

export function prepareHighlightImageForUpload(
  uri: string,
  pickerDimensions?: { width?: number | null; height?: number | null }
) {
  return prepareImageForUpload(uri, IMAGE_UPLOAD_PROFILES.highlightImage, pickerDimensions);
}
