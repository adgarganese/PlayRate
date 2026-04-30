import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { devError } from '@/lib/logging';
import { logger } from '@/lib/logger';
import { generateVideoThumbnail } from '@/lib/video-thumbnail';
import { compressVideo, assertHighlightVideoUnderMaxBytes } from '@/lib/video-compress';
import { HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE } from '@/lib/config';
import { track } from '@/lib/analytics';
import { UI_UPLOAD_FAILED } from '@/lib/user-facing-errors';
import { prepareHighlightImageForUpload } from '@/lib/image-upload-prepare';
import { resolveMediaUrlForPlayback } from '@/lib/storage-media-url';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import {
  getDraft,
  saveDraft,
  uploadDraftMedia,
  publishDraft,
  deleteDraft,
  type HighlightDraft,
} from '@/lib/highlight-drafts';
import { hapticMedium } from '@/lib/haptics';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

/** Keep in sync with app/(tabs)/_layout.tsx tab bar minHeight pieces (absolute bar overlays scroll). */
const TAB_BAR_ICON_ROW = 58;
const TAB_BAR_PADDING_TOP = 10;
const TAB_BAR_PADDING_BOTTOM = 10;

type IconSymbolName = React.ComponentProps<typeof IconSymbol>['name'];

function ActionCard({
  iconName,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  iconName: IconSymbolName;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        actionCardStyles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && !disabled && actionCardStyles.pressed,
        disabled && actionCardStyles.disabled,
      ]}
    >
      <View style={[actionCardStyles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
        <IconSymbol name={iconName} size={24} color={colors.primary} />
      </View>
      <View style={actionCardStyles.textWrap}>
        <Text style={[actionCardStyles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[actionCardStyles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const actionCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    minHeight: 72,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    ...Typography.bodyBold,
  },
  subtitle: {
    ...Typography.muted,
    marginTop: 2,
  },
});

const TARGET_SIGN_IN = '/sign-in';
const TARGET_HIGHLIGHTS = '/highlights';
const STORAGE_BUCKET_HIGHLIGHTS = 'highlights';
const VIDEO_MAX_DURATION_SEC = 60;
const PICKER_QUALITY = 0.8;
const DEFAULT_HIGHLIGHT_SPORT = 'basketball';

function ComposePreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    try {
      p.loop = true;
      p.play();
    } catch {
      /* */
    }
  });

  useEffect(() => {
    try {
      player.loop = true;
      player.play();
    } catch {
      /* */
    }
  }, [player]);

  useFocusEffect(
    useCallback(() => {
      try {
        player.loop = true;
        player.play();
      } catch {
        /* */
      }
      return () => {
        try {
          player.pause();
        } catch {
          /* NativeSharedObjectNotFoundException */
        }
      };
    }, [player])
  );

  return (
    <VideoView
      player={player}
      style={styles.previewMedia}
      contentFit="cover"
      nativeControls
    />
  );
}

function ComposeMediaPreview({
  localUri,
  localIsVideo,
  remoteDraft,
  resolvedVideoUrl,
}: {
  localUri: string | null;
  localIsVideo: boolean;
  remoteDraft: HighlightDraft | null;
  resolvedVideoUrl: string | null;
}) {
  const { colors } = useThemeColors();
  const remoteImgRaw =
    remoteDraft?.thumbnail_url?.trim() ||
    (remoteDraft?.media_type === 'image' ? remoteDraft?.media_url?.trim() : null) ||
    null;
  const remoteImgUri = useResolvedMediaUri(remoteImgRaw);

  if (localUri) {
    if (localIsVideo) {
      return <ComposePreviewVideo uri={localUri} />;
    }
    return (
      <Image source={{ uri: localUri }} style={styles.previewMedia} contentFit="cover" />
    );
  }

  if (remoteDraft?.media_type === 'video') {
    if (resolvedVideoUrl) {
      return <ComposePreviewVideo uri={resolvedVideoUrl} />;
    }
    return (
      <View style={[styles.previewMedia, styles.previewPlaceholder, { borderColor: colors.border }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (remoteImgUri) {
    return (
      <Image source={{ uri: remoteImgUri }} style={styles.previewMedia} contentFit="cover" />
    );
  }

  return (
    <View style={[styles.previewMedia, styles.previewPlaceholder, { borderColor: colors.border }]}>
      <IconSymbol name="play.rectangle.fill" size={40} color={colors.textMuted} />
      <Text style={[styles.previewHint, { color: colors.textMuted }]}>No preview</Text>
    </View>
  );
}

/**
 * Create Highlight: pick media → compose (Post / Save draft) or open existing draft.
 */
export default function HighlightCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftIdParam = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;

  const { user, loading } = useAuth();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const hookScrollBottomPad = useScrollContentBottomPadding();
  const minClearAbsoluteTabBar =
    TAB_BAR_ICON_ROW +
    TAB_BAR_PADDING_TOP +
    Math.max(insets.bottom, TAB_BAR_PADDING_BOTTOM) +
    Spacing.lg;
  const scrollBottomPadding = Math.max(hookScrollBottomPad, minClearAbsoluteTabBar);
  const hasRedirectedRef = useRef(false);
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState<'pick' | 'compose'>('pick');
  const [draftBootstrap, setDraftBootstrap] = useState<'idle' | 'loading' | 'done'>('idle');
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [remoteDraft, setRemoteDraft] = useState<HighlightDraft | null>(null);

  const [caption, setCaption] = useState('');
  const [sport, setSport] = useState(DEFAULT_HIGHLIGHT_SPORT);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [localIsVideo, setLocalIsVideo] = useState(false);
  const [localImageDims, setLocalImageDims] = useState<
    { width?: number | null; height?: number | null } | undefined
  >(undefined);

  const [resolvedRemoteVideo, setResolvedRemoteVideo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const authReady = loading === false;
  const busy = uploading || savingDraft || compressing;

  const normSport = useCallback(
    () => sport.trim() || DEFAULT_HIGHLIGHT_SPORT,
    [sport]
  );
  const normCaption = useCallback(
    () => (caption.trim() ? caption.trim() : null),
    [caption]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setCompressingSafe = useCallback((active: boolean) => {
    if (mountedRef.current) setCompressing(active);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (user) return;
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    router.replace(TARGET_SIGN_IN);
  }, [authReady, user, router]);

  useEffect(() => {
    if (!draftIdParam || !user) {
      setDraftBootstrap('idle');
      return;
    }
    let cancelled = false;
    setDraftBootstrap('loading');
    void getDraft(draftIdParam)
      .then((d) => {
        if (cancelled) return;
        if (!d || d.user_id !== user.id) {
          Alert.alert('Draft not found', '', [{ text: 'OK', onPress: () => router.back() }]);
          setDraftBootstrap('done');
          return;
        }
        setLoadedDraftId(d.id);
        setRemoteDraft(d);
        setSport(d.sport?.trim() || DEFAULT_HIGHLIGHT_SPORT);
        setCaption(d.caption ?? '');
        setPhase('compose');
        setLocalUri(null);
        setLocalImageDims(undefined);
        setDraftBootstrap('done');
      })
      .catch(() => {
        if (cancelled) return;
        Alert.alert('Error', 'Could not load draft.', [{ text: 'OK', onPress: () => router.back() }]);
        setDraftBootstrap('done');
      });
    return () => {
      cancelled = true;
    };
  }, [draftIdParam, user, router]);

  useEffect(() => {
    if (localUri || !remoteDraft?.media_url || remoteDraft.media_type !== 'video') {
      setResolvedRemoteVideo(null);
      return;
    }
    let cancelled = false;
    void resolveMediaUrlForPlayback(remoteDraft.media_url)
      .then((url) => {
        if (!cancelled) setResolvedRemoteVideo(url || null);
      })
      .catch(() => {
        if (!cancelled) setResolvedRemoteVideo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [localUri, remoteDraft?.media_url, remoteDraft?.media_type]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera access',
          'To film a highlight, allow camera access in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch {
      Alert.alert(
        'Camera access',
        'Could not request camera permission. Please try again or use Choose from Photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }, []);

  const requestMediaLibraryPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo library access',
          'To choose a photo or video, allow access to your photos in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch {
      Alert.alert('Photo library access', 'Could not request photo library permission.', [
        { text: 'OK' },
      ]);
      return false;
    }
  }, []);

  const onAssetPicked = useCallback(
    (uri: string, isVideo: boolean, dims?: { width?: number | null; height?: number | null }) => {
      setLocalUri(uri);
      setLocalIsVideo(isVideo);
      setLocalImageDims(dims);
      setPhase('compose');
    },
    []
  );

  const openCamera = useCallback(async () => {
    if (!user || busy) return;
    const ok = await requestCameraPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: PICKER_QUALITY,
        videoMaxDuration: VIDEO_MAX_DURATION_SEC,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uri = asset?.uri;
      if (!uri) return;
      const isVideo = asset.type === 'video' || ('duration' in asset && asset.duration != null);
      onAssetPicked(uri, isVideo, { width: asset.width, height: asset.height });
    } catch (e) {
      devError('HighlightCreate', 'Camera error:', e);
      Alert.alert('Error', 'Could not open camera. Try again or use Choose from Photos.');
    }
  }, [user, busy, requestCameraPermission, onAssetPicked]);

  const chooseFromPhotos = useCallback(async () => {
    if (!user || busy) return;
    const ok = await requestMediaLibraryPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: PICKER_QUALITY,
        videoMaxDuration: VIDEO_MAX_DURATION_SEC,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uri = asset?.uri;
      if (!uri) return;
      const isVideo = asset.type === 'video' || ('duration' in asset && asset.duration != null);
      onAssetPicked(uri, isVideo, { width: asset.width, height: asset.height });
    } catch (e) {
      devError('HighlightCreate', 'Library error:', e);
      Alert.alert('Error', 'Could not open photos. Please try again.');
    }
  }, [user, busy, requestMediaLibraryPermission, onAssetPicked]);

  const changeMediaFromLibrary = useCallback(async () => {
    if (!user || busy) return;
    const ok = await requestMediaLibraryPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: PICKER_QUALITY,
        videoMaxDuration: VIDEO_MAX_DURATION_SEC,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uri = asset?.uri;
      if (!uri) return;
      const isVideo = asset.type === 'video' || ('duration' in asset && asset.duration != null);
      setLocalUri(uri);
      setLocalIsVideo(isVideo);
      setLocalImageDims({ width: asset.width, height: asset.height });
    } catch (e) {
      devError('HighlightCreate', 'Replace media error:', e);
      Alert.alert('Error', 'Could not replace media.');
    }
  }, [user, busy, requestMediaLibraryPermission]);

  /** Direct publish to highlights (same storage + insert as before, with caption/sport). */
  const publishNewHighlight = useCallback(async () => {
    if (!user || !localUri?.trim()) return;
    setUploading(true);
    let tripwireByteSize = 0;
    let tripwireContentType: string | null = null;
    let mediaUploadTripwireSent = false;
    const emitMediaUploadTripwire = (success: boolean, error_code: string | null) => {
      if (mediaUploadTripwireSent) return;
      mediaUploadTripwireSent = true;
      track('media_upload_completed', {
        media_kind: 'highlight',
        byte_size: tripwireByteSize,
        content_type: tripwireContentType,
        success,
        error_code,
      });
    };

    try {
      let uploadUri = localUri;
      let fileExt =
        localUri.split('.').pop()?.toLowerCase() || (localIsVideo ? 'mp4' : 'jpg');
      let contentType = localIsVideo
        ? 'video/mp4'
        : `image/${fileExt === 'jpg' ? 'jpeg' : fileExt || 'jpeg'}`;

      if (!localIsVideo) {
        const prepared = await prepareHighlightImageForUpload(localUri, localImageDims);
        if (__DEV__) {
          logger.info('[highlight-upload] prepared image', {
            preparedUri: prepared.uri,
            contentType: prepared.contentType,
            fileExt: prepared.fileExt,
            pickerWidth: localImageDims?.width ?? null,
            pickerHeight: localImageDims?.height ?? null,
          });
        }
        uploadUri = prepared.uri;
        fileExt = prepared.fileExt;
        contentType = prepared.contentType;
      } else {
        setCompressingSafe(true);
        try {
          const prepared = await compressVideo(localUri);
          assertHighlightVideoUnderMaxBytes(prepared.fileSize);
          uploadUri = prepared.uri;
          fileExt = 'mp4';
          contentType = 'video/mp4';
        } finally {
          setCompressingSafe(false);
        }
      }

      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 10);
      const fileName = `${user.id}/${stamp}-${rand}.${fileExt}`;

      let publishedThumbUrl: string | null = null;
      if (localIsVideo) {
        try {
          const thumbLocal = await generateVideoThumbnail(uploadUri);
          if (thumbLocal) {
            const thumbBase64 = await FileSystem.readAsStringAsync(thumbLocal, {
              encoding: FileSystem.EncodingType.Base64,
            });
            if (thumbBase64.length > 0) {
              const thumbBuf = new Uint8Array(decodeBase64(thumbBase64));
              if (__DEV__) {
                logger.info('[highlight-upload] thumbnail bytes', {
                  byteLength: thumbBuf.byteLength,
                });
              }
              const thumbName = `${user.id}/${stamp}-thumb.jpg`;
              const { error: thumbErr } = await supabase.storage
                .from(STORAGE_BUCKET_HIGHLIGHTS)
                .upload(thumbName, thumbBuf, { contentType: 'image/jpeg', upsert: false });
              if (__DEV__) {
                logger.info('[highlight-upload] thumbnail upload result', {
                  path: thumbName,
                  byteLength: thumbBuf.byteLength,
                  error: thumbErr ?? null,
                });
              }
              if (thumbErr) {
                logger.warn('[HighlightCreate] video thumbnail upload failed', { err: thumbErr });
              } else {
                const { data: pt } = supabase.storage
                  .from(STORAGE_BUCKET_HIGHLIGHTS)
                  .getPublicUrl(thumbName);
                if (__DEV__) {
                  logger.info('[highlight-upload] thumbnail public url', { publicUrl: pt.publicUrl });
                }
                publishedThumbUrl = pt.publicUrl;
              }
            }
          }
        } catch (e) {
          logger.warn('[HighlightCreate] video thumbnail pipeline failed', { err: e });
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (__DEV__ && !session) console.warn('[HighlightCreate] no session at upload');
      tripwireContentType = contentType;
      const base64 = await FileSystem.readAsStringAsync(uploadUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (__DEV__) {
        logger.info('[highlight-upload] base64', {
          length: base64.length,
          uploadUri,
          contentType,
        });
      }
      const mainMediaBytes = new Uint8Array(decodeBase64(base64));
      tripwireByteSize = mainMediaBytes.byteLength;
      if (__DEV__) {
        logger.info('[highlight-upload] arrayBuffer', {
          byteLength: mainMediaBytes.byteLength,
        });
      }

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET_HIGHLIGHTS)
        .upload(fileName, mainMediaBytes, { contentType, upsert: false });
      if (__DEV__) {
        logger.info('[highlight-upload] storage upload result', {
          bucket: STORAGE_BUCKET_HIGHLIGHTS,
          path: fileName,
          error: uploadError ?? null,
        });
      }

      if (uploadError) {
        emitMediaUploadTripwire(false, uploadError.message ?? null);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET_HIGHLIGHTS)
        .getPublicUrl(fileName);
      if (__DEV__) {
        logger.info('[highlight-upload] public url', { publicUrl });
      }

      const { error: insertError } = await supabase
        .from('highlights')
        .insert({
          user_id: user.id,
          sport: normSport(),
          media_type: localIsVideo ? 'video' : 'image',
          media_url: publicUrl,
          thumbnail_url: localIsVideo ? publishedThumbUrl : publicUrl,
          caption: normCaption(),
          is_public: true,
        })
        .select('id')
        .single();
      if (__DEV__) {
        logger.info('[highlight-upload] highlights insert result', {
          mediaUrl: publicUrl,
          thumbnailUrl: localIsVideo ? publishedThumbUrl : publicUrl,
          error: insertError ?? null,
        });
      }

      if (insertError) {
        emitMediaUploadTripwire(false, insertError.message ?? null);
        throw insertError;
      }
      emitMediaUploadTripwire(true, null);
      track('highlight_posted', {
        sport: normSport(),
        media_type: localIsVideo ? 'video' : 'image',
        was_draft: false,
      });
      hapticMedium();
      router.replace(TARGET_HIGHLIGHTS);
    } catch (err: unknown) {
      if (!mediaUploadTripwireSent) {
        const msg = err instanceof Error ? err.message : String(err);
        emitMediaUploadTripwire(false, msg.length > 0 ? msg : null);
      }
      const msg = err instanceof Error ? err.message : '';
      if (msg === HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE) {
        Alert.alert('Video too large', HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE);
      } else {
        devError('HighlightCreate', 'Upload error:', err);
        logger.error('[HighlightCreate] publishNewHighlight failed', { err });
        Alert.alert('Upload Failed', UI_UPLOAD_FAILED);
      }
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }, [user, localUri, localIsVideo, localImageDims, normSport, normCaption, router, setCompressingSafe]);

  const handleSaveOrUpdateDraft = useCallback(async () => {
    if (!user) return;
    if (!loadedDraftId && !localUri?.trim()) {
      Alert.alert('Add media', 'Choose a photo or video to save as a draft.');
      return;
    }
    setSavingDraft(true);
    try {
      if (loadedDraftId) {
        if (localUri) {
          const mt = localIsVideo ? 'video' : 'image';
          const { mediaUrl, thumbnailUrl } = await uploadDraftMedia(
            user.id,
            loadedDraftId,
            localUri,
            mt,
            localImageDims,
            { onCompressionState: setCompressingSafe }
          );
          const updated = await saveDraft(user.id, {
            id: loadedDraftId,
            sport: normSport(),
            caption: normCaption(),
            media_type: mt,
            media_url: mediaUrl,
            thumbnail_url: thumbnailUrl,
          });
          setRemoteDraft(updated);
          setLocalUri(null);
          setLocalImageDims(undefined);
        } else {
          const updated = await saveDraft(user.id, {
            id: loadedDraftId,
            sport: normSport(),
            caption: normCaption(),
            media_type: remoteDraft?.media_type ?? null,
            media_url: remoteDraft?.media_url ?? null,
            thumbnail_url: remoteDraft?.thumbnail_url ?? null,
          });
          setRemoteDraft(updated);
        }
      } else {
        const mt = localIsVideo ? 'video' : 'image';
        const row = await saveDraft(user.id, {
          sport: normSport(),
          caption: normCaption(),
          media_type: mt,
        });
        const { mediaUrl, thumbnailUrl } = await uploadDraftMedia(
          user.id,
          row.id,
          localUri!,
          mt,
          localImageDims,
          { onCompressionState: setCompressingSafe }
        );
        await saveDraft(user.id, {
          id: row.id,
          media_url: mediaUrl,
          thumbnail_url: thumbnailUrl,
          media_type: mt,
        });
      }
      router.replace(TARGET_HIGHLIGHTS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE) {
        Alert.alert('Video too large', HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE);
      } else {
        devError('HighlightCreate', 'Save draft error:', err);
        logger.error('[HighlightCreate] save draft failed', { err });
        Alert.alert('Save Failed', UI_UPLOAD_FAILED);
      }
    } finally {
      if (mountedRef.current) setSavingDraft(false);
    }
  }, [
    user,
    loadedDraftId,
    localUri,
    localIsVideo,
    localImageDims,
    normSport,
    normCaption,
    remoteDraft,
    router,
    setCompressingSafe,
  ]);

  const handlePublishDraft = useCallback(async () => {
    if (!user || !loadedDraftId) return;
    const hasMedia = !!localUri?.trim() || !!remoteDraft?.media_url?.trim();
    if (!hasMedia) {
      Alert.alert('Add media', 'This draft needs media before publishing.');
      return;
    }
    setUploading(true);
    try {
      if (localUri) {
        const mt = localIsVideo ? 'video' : 'image';
        const { mediaUrl, thumbnailUrl } = await uploadDraftMedia(
          user.id,
          loadedDraftId,
          localUri,
          mt,
          localImageDims,
          { onCompressionState: setCompressingSafe }
        );
        await saveDraft(user.id, {
          id: loadedDraftId,
          sport: normSport(),
          caption: normCaption(),
          media_type: mt,
          media_url: mediaUrl,
          thumbnail_url: thumbnailUrl,
        });
        setLocalUri(null);
        setLocalImageDims(undefined);
      } else {
        const mt = remoteDraft?.media_type;
        const mu = remoteDraft?.media_url;
        if (!mt || !mu?.trim()) {
          throw new Error('Draft missing media');
        }
        await saveDraft(user.id, {
          id: loadedDraftId,
          sport: normSport(),
          caption: normCaption(),
          media_type: mt,
          media_url: mu,
          thumbnail_url: remoteDraft?.thumbnail_url ?? null,
        });
      }
      await publishDraft(loadedDraftId);
      hapticMedium();
      router.replace(TARGET_HIGHLIGHTS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE) {
        Alert.alert('Video too large', HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE);
      } else {
        devError('HighlightCreate', 'Publish draft error:', err);
        logger.error('[HighlightCreate] publish draft failed', { err });
        Alert.alert('Publish Failed', UI_UPLOAD_FAILED);
      }
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }, [
    user,
    loadedDraftId,
    localUri,
    localIsVideo,
    localImageDims,
    normSport,
    normCaption,
    remoteDraft,
    router,
    setCompressingSafe,
  ]);

  const confirmDeleteDraft = useCallback(() => {
    if (!loadedDraftId) return;
    Alert.alert('Delete draft?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Draft',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteDraft(loadedDraftId);
              router.replace(TARGET_HIGHLIGHTS);
            } catch {
              Alert.alert('Error', 'Could not delete the draft.');
            }
          })();
        },
      },
    ]);
  }, [loadedDraftId, router]);

  const handleHeaderBack = useCallback(() => {
    if (phase === 'compose' && !draftIdParam) {
      setPhase('pick');
      setLocalUri(null);
      setLocalImageDims(undefined);
      return;
    }
    router.back();
  }, [phase, draftIdParam, router]);

  if (!authReady) {
    return (
      <Screen>
        <Header title="Create Highlight" onBackPress={handleHeaderBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <Header title="Create Highlight" onBackPress={handleHeaderBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textMuted }]}>Redirecting…</Text>
        </View>
      </Screen>
    );
  }

  if (draftIdParam && draftBootstrap === 'loading') {
    return (
      <Screen>
        <Header title="Edit Draft" onBackPress={handleHeaderBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading draft…</Text>
        </View>
      </Screen>
    );
  }

  const headerTitle = loadedDraftId ? 'Edit Draft' : 'Create Highlight';
  const canPostOrPublish =
    !!localUri?.trim() || !!(remoteDraft?.media_url && remoteDraft.media_type);
  const primaryLabel = loadedDraftId ? 'Publish' : 'Post';
  const draftButtonLabel = loadedDraftId ? 'Update Draft' : 'Save as Draft';
  const saveDraftDisabled =
    uploading || compressing || (!loadedDraftId && !localUri?.trim());

  const composeView = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding + Spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.previewWrap, { borderColor: colors.border }]}>
        <ComposeMediaPreview
          localUri={localUri}
          localIsVideo={localIsVideo}
          remoteDraft={remoteDraft}
          resolvedVideoUrl={resolvedRemoteVideo}
        />
      </View>
      <TouchableOpacity
        onPress={changeMediaFromLibrary}
        disabled={busy}
        style={styles.changeMediaBtn}
        accessibilityRole="button"
        accessibilityLabel="Change photo or video"
      >
        <Text style={[styles.changeMediaText, { color: colors.primary }]}>Change media</Text>
      </TouchableOpacity>

      <TextInput
        label="Sport"
        placeholder="e.g. basketball"
        value={sport}
        onChangeText={setSport}
        editable={!busy}
        autoCapitalize="none"
        style={styles.field}
      />
      <TextInput
        label="Caption"
        placeholder="Say something about this highlight"
        value={caption}
        onChangeText={setCaption}
        editable={!busy}
        multiline
        numberOfLines={4}
        style={styles.captionInput}
      />

      <Button
        title={primaryLabel}
        onPress={loadedDraftId ? handlePublishDraft : publishNewHighlight}
        variant="primary"
        loading={uploading || compressing}
        disabled={savingDraft || !canPostOrPublish}
        style={styles.primaryBtn}
      />
      <Button
        title={draftButtonLabel}
        onPress={handleSaveOrUpdateDraft}
        variant="secondary"
        loading={savingDraft}
        disabled={saveDraftDisabled}
        style={styles.secondaryBtn}
      />

      {uploading || savingDraft || compressing ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.mutedSmall, { color: colors.textMuted }]}>
            {compressing ? 'Compressing…' : uploading ? 'Working…' : 'Saving…'}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );

  return (
    <Screen>
      <Header
        title={headerTitle}
        onBackPress={handleHeaderBack}
        {...(loadedDraftId
          ? {
              rightElement: (
                <TouchableOpacity
                  onPress={confirmDeleteDraft}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Delete draft"
                  accessibilityRole="button"
                >
                  <IconSymbol name="trash.fill" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              ),
            }
          : {})}
      />
      {phase === 'compose' ? (
        composeView
      ) : (
        <View style={styles.content}>
          <Text style={[styles.lead, { color: colors.textMuted }]}>
            Film or choose a photo or video to share as a highlight.
          </Text>
          <View style={styles.cardsWrap}>
            <ActionCard
              iconName="camera.fill"
              title="Open Camera"
              subtitle="Film a clip or take a photo"
              onPress={openCamera}
              disabled={busy}
            />
            <ActionCard
              iconName="play.rectangle.fill"
              title="Choose from Photos"
              subtitle="Pick a video or photo from your camera roll"
              onPress={chooseFromPhotos}
              disabled={busy}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  lead: {
    ...Typography.body,
    marginBottom: Spacing.xl,
  },
  cardsWrap: {
    gap: Spacing.md,
  },
  previewWrap: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    height: 220,
    backgroundColor: '#000',
  },
  previewMedia: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    gap: Spacing.sm,
  },
  previewHint: {
    ...Typography.mutedSmall,
  },
  changeMediaBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  changeMediaText: {
    ...Typography.bodyBold,
  },
  field: {
    marginBottom: Spacing.md,
  },
  captionInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  primaryBtn: {
    marginBottom: Spacing.sm,
  },
  secondaryBtn: {
    marginBottom: Spacing.md,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  muted: {
    ...Typography.body,
  },
  mutedSmall: {
    ...Typography.mutedSmall,
  },
});
