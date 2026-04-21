import { supabase } from './supabase';
import { track } from './analytics';
import { prepareHighlightImageForUpload } from './image-upload-prepare';
import { generateVideoThumbnail } from './video-thumbnail';
import { compressVideo, assertHighlightVideoUnderMaxBytes } from './video-compress';
import { logger } from './logger';

export const HIGHLIGHT_DRAFTS_BUCKET = 'highlights-drafts' as const;
export const HIGHLIGHTS_PUBLISH_BUCKET = 'highlights' as const;

const DEFAULT_HIGHLIGHT_SPORT = 'basketball';

export type HighlightDraft = {
  id: string;
  user_id: string;
  sport: string | null;
  caption: string | null;
  media_type: 'video' | 'image' | null;
  media_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

function assertSameUser(sessionUserId: string, userId: string): void {
  if (sessionUserId !== userId) {
    throw new Error('Not authorized for this user');
  }
}

async function requireSessionUser(expectedUserId: string): Promise<void> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Not authenticated');
  }
  assertSameUser(user.id, expectedUserId);
}

async function requireSession(): Promise<{ id: string }> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Not authenticated');
  }
  return user;
}

function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as (keyof T)[]).forEach((k) => {
    const v = obj[k];
    if (v !== undefined) {
      (out as Record<string, unknown>)[k as string] = v;
    }
  });
  return out;
}

/** Path inside bucket from a public object URL, or null if not this bucket. */
export function parsePublicStoragePath(
  url: string | null | undefined,
  bucket: string
): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  const needle = `/object/public/${bucket}/`;
  const i = u.indexOf(needle);
  if (i === -1) return null;
  let path = u.slice(i + needle.length);
  const q = path.indexOf('?');
  if (q !== -1) path = path.slice(0, q);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function guessContentType(objectPath: string): string {
  const ext = objectPath.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return 'application/octet-stream';
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Returns true if listing succeeded (even when folder is empty). */
async function removeDraftFolder(userId: string, draftId: string): Promise<boolean> {
  const prefix = `${userId}/${draftId}`;
  const { data: files, error } = await supabase.storage.from(HIGHLIGHT_DRAFTS_BUCKET).list(prefix);
  if (error) {
    if (__DEV__) console.warn('[highlight-drafts] list draft folder', error);
    logger.warn('[highlight-drafts] list draft folder failed', { err: error });
    return false;
  }
  const paths = (files ?? [])
    .filter((f) => f.id)
    .map((f) => `${prefix}/${f.name}`);
  if (paths.length === 0) return true;
  const { error: rmErr } = await supabase.storage.from(HIGHLIGHT_DRAFTS_BUCKET).remove(paths);
  if (rmErr) {
    if (__DEV__) console.warn('[highlight-drafts] remove draft objects', rmErr);
    logger.warn('[highlight-drafts] remove draft objects failed', { err: rmErr });
  }
  return true;
}

async function removeParsedDraftObject(url: string | null | undefined): Promise<void> {
  const path = parsePublicStoragePath(url, HIGHLIGHT_DRAFTS_BUCKET);
  if (!path) return;
  const { error } = await supabase.storage.from(HIGHLIGHT_DRAFTS_BUCKET).remove([path]);
  if (error) {
    if (__DEV__) console.warn('[highlight-drafts] remove single draft object', error);
    logger.warn('[highlight-drafts] remove single draft object failed', { err: error });
  }
}

async function copyDraftObjectToHighlights(
  sourcePath: string,
  destPath: string
): Promise<void> {
  const contentType = guessContentType(sourcePath);
  const { data, error } = await supabase.storage.from(HIGHLIGHT_DRAFTS_BUCKET).download(sourcePath);
  if (error) throw error;
  const ab = await data.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(HIGHLIGHTS_PUBLISH_BUCKET)
    .upload(destPath, ab, { contentType, upsert: false });
  if (upErr) throw upErr;
}

/**
 * Insert or update a draft. `userId` must match the signed-in user.
 * Omit `id` to create; include `id` to update. Always refreshes `updated_at`.
 */
export async function saveDraft(
  userId: string,
  draft: Partial<HighlightDraft> & { id?: string }
): Promise<HighlightDraft> {
  await requireSessionUser(userId);
  const now = new Date().toISOString();

  const fields = pickDefined({
    sport: draft.sport,
    caption: draft.caption,
    media_type: draft.media_type,
    media_url: draft.media_url,
    thumbnail_url: draft.thumbnail_url,
  } as Record<string, unknown>);

  if (draft.id) {
    const { data, error } = await supabase
      .from('highlight_drafts')
      .update({ ...fields, updated_at: now })
      .eq('id', draft.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (__DEV__) console.warn('[highlight-drafts] saveDraft update', error);
      logger.warn('[highlight-drafts] saveDraft update failed', { err: error });
      throw error;
    }
    return data as HighlightDraft;
  }

  const { data, error } = await supabase
    .from('highlight_drafts')
    .insert({
      user_id: userId,
      sport: (fields.sport as string | null | undefined) ?? null,
      caption: (fields.caption as string | null | undefined) ?? null,
      media_type: (fields.media_type as 'video' | 'image' | null | undefined) ?? null,
      media_url: (fields.media_url as string | null | undefined) ?? null,
      thumbnail_url: (fields.thumbnail_url as string | null | undefined) ?? null,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    if (__DEV__) console.warn('[highlight-drafts] saveDraft insert', error);
    logger.warn('[highlight-drafts] saveDraft insert failed', { err: error });
    throw error;
  }
  return data as HighlightDraft;
}

/** All drafts for the user, newest `updated_at` first. */
export async function getDrafts(userId: string): Promise<HighlightDraft[]> {
  await requireSessionUser(userId);
  const { data, error } = await supabase
    .from('highlight_drafts')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    if (__DEV__) console.warn('[highlight-drafts] getDrafts', error);
    logger.warn('[highlight-drafts] getDrafts failed', { err: error });
    throw error;
  }
  return (data ?? []) as HighlightDraft[];
}

/** Single draft by id, or null if missing / not owned (RLS). */
export async function getDraft(draftId: string): Promise<HighlightDraft | null> {
  await requireSession();
  const { data, error } = await supabase
    .from('highlight_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.warn('[highlight-drafts] getDraft', error);
    logger.warn('[highlight-drafts] getDraft failed', { err: error });
    throw error;
  }
  return (data as HighlightDraft) ?? null;
}

/**
 * Deletes the draft row and removes objects in `highlights-drafts/{userId}/{draftId}/`.
 * Best-effort storage cleanup; also attempts URL-based delete if listing fails.
 */
export async function deleteDraft(draftId: string): Promise<void> {
  const user = await requireSession();
  const existing = await getDraft(draftId);
  if (!existing || existing.user_id !== user.id) {
    throw new Error('Draft not found');
  }

  const listedOk = await removeDraftFolder(user.id, draftId);
  if (!listedOk) {
    await removeParsedDraftObject(existing.media_url);
    if (
      existing.thumbnail_url &&
      existing.thumbnail_url.trim() !== (existing.media_url ?? '').trim()
    ) {
      await removeParsedDraftObject(existing.thumbnail_url);
    }
  }

  const { error } = await supabase
    .from('highlight_drafts')
    .delete()
    .eq('id', draftId)
    .eq('user_id', user.id);

  if (error) {
    if (__DEV__) console.warn('[highlight-drafts] deleteDraft', error);
    logger.warn('[highlight-drafts] deleteDraft failed', { err: error });
    throw error;
  }
}

export type UploadDraftMediaResult = {
  mediaUrl: string;
  /** Same as `mediaUrl` for images; draft `thumb.jpg` public URL for video when generation succeeds. */
  thumbnailUrl: string | null;
};

export type UploadDraftMediaHooks = {
  /** Called while client-side video compression runs (before storage upload). */
  onCompressionState?: (active: boolean) => void;
};

/**
 * Uploads media to `highlights-drafts/{userId}/{draftId}/media.{ext}`.
 * Images are compressed via `prepareHighlightImageForUpload`.
 * Videos are compressed via `compressVideo` before upload; thumbnails use the compressed file.
 */
export async function uploadDraftMedia(
  userId: string,
  draftId: string,
  fileUri: string,
  mediaType: 'image' | 'video',
  imagePickerDimensions?: { width?: number | null; height?: number | null },
  hooks?: UploadDraftMediaHooks
): Promise<UploadDraftMediaResult> {
  await requireSessionUser(userId);

  let uploadUri = fileUri;
  let fileExt =
    fileUri.split('.').pop()?.toLowerCase() || (mediaType === 'video' ? 'mp4' : 'jpg');
  let contentType =
    mediaType === 'video' ? 'video/mp4' : `image/${fileExt === 'jpg' ? 'jpeg' : fileExt || 'jpeg'}`;

  if (mediaType === 'image') {
    try {
      const prepared = await prepareHighlightImageForUpload(fileUri, imagePickerDimensions);
      uploadUri = prepared.uri;
      fileExt = prepared.fileExt;
      contentType = prepared.contentType;
    } catch (e) {
      if (__DEV__) console.warn('[highlight-drafts] prepare image', e);
      logger.warn('[highlight-drafts] prepare image failed', { err: e });
      throw e instanceof Error ? e : new Error('Could not process image for upload');
    }
  } else {
    hooks?.onCompressionState?.(true);
    try {
      const { uri, fileSize } = await compressVideo(fileUri);
      assertHighlightVideoUnderMaxBytes(fileSize);
      uploadUri = uri;
      fileExt = 'mp4';
      contentType = 'video/mp4';
    } finally {
      hooks?.onCompressionState?.(false);
    }
  }

  const objectPath = `${userId}/${draftId}/media.${fileExt}`;
  let arrayBuffer: ArrayBuffer;
  try {
    const response = await fetch(uploadUri);
    if (!response.ok) {
      throw new Error(`Failed to read media file (${response.status})`);
    }
    arrayBuffer = await response.arrayBuffer();
  } catch (e) {
    if (__DEV__) console.warn('[highlight-drafts] read file for upload', e);
    logger.warn('[highlight-drafts] read file for upload failed', { err: e });
    throw e instanceof Error ? e : new Error('Could not read media file');
  }

  const { error: uploadError } = await supabase.storage
    .from(HIGHLIGHT_DRAFTS_BUCKET)
    .upload(objectPath, arrayBuffer, { contentType, upsert: true });

  if (uploadError) {
    if (__DEV__) console.warn('[highlight-drafts] uploadDraftMedia', uploadError);
    logger.warn('[highlight-drafts] uploadDraftMedia failed', { err: uploadError });
    throw uploadError;
  }

  const { data: pub } = supabase.storage.from(HIGHLIGHT_DRAFTS_BUCKET).getPublicUrl(objectPath);
  const mediaUrl = pub.publicUrl;

  let thumbnailUrl: string | null = null;
  if (mediaType === 'image') {
    thumbnailUrl = mediaUrl;
  } else {
    try {
      const thumbLocalUri = await generateVideoThumbnail(uploadUri);
      if (thumbLocalUri) {
        const thumbPath = `${userId}/${draftId}/thumb.jpg`;
        const thumbResponse = await fetch(thumbLocalUri);
        if (!thumbResponse.ok) {
          throw new Error(`Failed to read thumbnail file (${thumbResponse.status})`);
        }
        const thumbBuffer = await thumbResponse.arrayBuffer();
        const { error: thumbErr } = await supabase.storage
          .from(HIGHLIGHT_DRAFTS_BUCKET)
          .upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg', upsert: true });
        if (thumbErr) {
          if (__DEV__) console.warn('[highlight-drafts] upload draft video thumbnail', thumbErr);
          logger.warn('[highlight-drafts] upload draft video thumbnail failed', { err: thumbErr });
        } else {
          const { data: pubT } = supabase.storage
            .from(HIGHLIGHT_DRAFTS_BUCKET)
            .getPublicUrl(thumbPath);
          thumbnailUrl = pubT.publicUrl;
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[highlight-drafts] draft video thumbnail pipeline', e);
      logger.warn('[highlight-drafts] draft video thumbnail pipeline failed', { err: e });
    }
  }

  return { mediaUrl, thumbnailUrl };
}

/**
 * Publishes the draft as a real highlight: copies files from `highlights-drafts` to `highlights`,
 * inserts into `public.highlights`, then removes the draft row and draft storage.
 * If the highlight insert fails, uploaded highlight-bucket objects are removed and the draft is kept.
 */
export async function publishDraft(draftId: string): Promise<void> {
  const user = await requireSession();
  const draft = await getDraft(draftId);
  if (!draft || draft.user_id !== user.id) {
    throw new Error('Draft not found');
  }
  if (!draft.media_url?.trim() || !draft.media_type) {
    throw new Error('Draft is missing media; cannot publish');
  }

  const mediaPath = parsePublicStoragePath(draft.media_url, HIGHLIGHT_DRAFTS_BUCKET);
  if (!mediaPath) {
    throw new Error('Draft media URL is invalid or not in highlights-drafts bucket');
  }

  const thumbPath =
    draft.thumbnail_url?.trim() &&
    draft.thumbnail_url.trim() !== draft.media_url.trim()
      ? parsePublicStoragePath(draft.thumbnail_url, HIGHLIGHT_DRAFTS_BUCKET)
      : null;

  const extMain = mediaPath.split('.').pop() ?? (draft.media_type === 'video' ? 'mp4' : 'jpg');
  const destMedia = `${user.id}/${Date.now()}-${randomSuffix()}.${extMain}`;
  const stagedHighlightPaths: string[] = [];

  try {
    await copyDraftObjectToHighlights(mediaPath, destMedia);
    stagedHighlightPaths.push(destMedia);

    let publishedThumbnailUrl: string | null = null;

    if (draft.media_type === 'image') {
      const { data: pub } = supabase.storage.from(HIGHLIGHTS_PUBLISH_BUCKET).getPublicUrl(destMedia);
      publishedThumbnailUrl = pub.publicUrl;
    } else if (thumbPath) {
      const extThumb = thumbPath.split('.').pop() ?? 'jpg';
      const destThumb = `${user.id}/${Date.now()}-${randomSuffix()}-thumb.${extThumb}`;
      await copyDraftObjectToHighlights(thumbPath, destThumb);
      stagedHighlightPaths.push(destThumb);
      const { data: pubT } = supabase.storage
        .from(HIGHLIGHTS_PUBLISH_BUCKET)
        .getPublicUrl(destThumb);
      publishedThumbnailUrl = pubT.publicUrl;
    }

    const { data: pubM } = supabase.storage.from(HIGHLIGHTS_PUBLISH_BUCKET).getPublicUrl(destMedia);
    const publishedMediaUrl = pubM.publicUrl;

    const sport =
      draft.sport?.trim() && draft.sport.trim().length > 0
        ? draft.sport.trim()
        : DEFAULT_HIGHLIGHT_SPORT;
    const caption = draft.caption?.trim() ? draft.caption.trim() : null;

    const { error: insertError } = await supabase.from('highlights').insert({
      user_id: user.id,
      sport,
      media_type: draft.media_type,
      media_url: publishedMediaUrl,
      thumbnail_url: publishedThumbnailUrl,
      caption,
      is_public: true,
    });

    if (insertError) {
      throw insertError;
    }

    const mediaType: 'video' | 'image' = draft.media_type === 'video' ? 'video' : 'image';
    track('highlight_posted', {
      sport,
      media_type: mediaType,
      was_draft: true,
    });
  } catch (err) {
    if (stagedHighlightPaths.length > 0) {
      const { error: rmErr } = await supabase.storage
        .from(HIGHLIGHTS_PUBLISH_BUCKET)
        .remove(stagedHighlightPaths);
      if (rmErr) {
        if (__DEV__) console.warn('[highlight-drafts] publish rollback storage', rmErr);
        logger.warn('[highlight-drafts] publish rollback storage failed', { err: rmErr });
      }
    }
    if (__DEV__) console.warn('[highlight-drafts] publishDraft', err);
    logger.warn('[highlight-drafts] publishDraft failed', { err });
    throw err;
  }

  const { error: delErr } = await supabase
    .from('highlight_drafts')
    .delete()
    .eq('id', draftId)
    .eq('user_id', user.id);

  if (delErr) {
    if (__DEV__) console.warn('[highlight-drafts] publishDraft delete row', delErr);
    logger.warn('[highlight-drafts] publishDraft delete row failed', { err: delErr });
    throw delErr;
  }

  await removeDraftFolder(user.id, draftId);
}

