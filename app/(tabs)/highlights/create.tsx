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
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
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
      return (
        <Video
          source={{ uri: localUri }}
          style={styles.previewMedia}
          useNativeControls
          resizeMode={ResizeMode.COVER}
        />
      );
    }
    return (
      <Image source={{ uri: localUri }} style={styles.previewMedia} contentFit="cover" />
    );
  }

  if (remoteDraft?.media_type === 'video') {
    if (resolvedVideoUrl) {
      return (
        <Video
          source={{ uri: resolvedVideoUrl }}
          style={styles.previewMedia}
          useNativeControls
          resizeMode={ResizeMode.COVER}
        />
      );
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
  const hasRedirectedRef = useRef(false);

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

  const authReady = loading === false;
  const busy = uploading || savingDraft;

  const normSport = useCallback(
    () => sport.trim() || DEFAULT_HIGHLIGHT_SPORT,
    [sport]
  );
  const normCaption = useCallback(
    () => (caption.trim() ? caption.trim() : null),
    [caption]
  );

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
    try {
      let uploadUri = localUri;
      let fileExt =
        localUri.split('.').pop()?.toLowerCase() || (localIsVideo ? 'mp4' : 'jpg');
      let contentType = localIsVideo
        ? 'video/mp4'
        : `image/${fileExt === 'jpg' ? 'jpeg' : fileExt || 'jpeg'}`;

      if (!localIsVideo) {
        const prepared = await prepareHighlightImageForUpload(localUri, localImageDims);
        uploadUri = prepared.uri;
        fileExt = prepared.fileExt;
        contentType = prepared.contentType;
      }

      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (__DEV__ && !session) console.warn('[HighlightCreate] no session at upload');
      const response = await fetch(uploadUri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET_HIGHLIGHTS)
        .upload(fileName, arrayBuffer, { contentType, upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET_HIGHLIGHTS)
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('highlights')
        .insert({
          user_id: user.id,
          sport: normSport(),
          media_type: localIsVideo ? 'video' : 'image',
          media_url: publicUrl,
          thumbnail_url: localIsVideo ? null : publicUrl,
          caption: normCaption(),
          is_public: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      hapticMedium();
      router.replace(TARGET_HIGHLIGHTS);
    } catch (err: unknown) {
      devError('HighlightCreate', 'Upload error:', err);
      Alert.alert('Upload Failed', UI_UPLOAD_FAILED);
    } finally {
      setUploading(false);
    }
  }, [user, localUri, localIsVideo, localImageDims, normSport, normCaption, router]);

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
          const url = await uploadDraftMedia(
            user.id,
            loadedDraftId,
            localUri,
            mt,
            localImageDims
          );
          const thumb = localIsVideo ? null : url;
          const updated = await saveDraft(user.id, {
            id: loadedDraftId,
            sport: normSport(),
            caption: normCaption(),
            media_type: mt,
            media_url: url,
            thumbnail_url: thumb,
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
        const url = await uploadDraftMedia(user.id, row.id, localUri!, mt, localImageDims);
        const thumb = localIsVideo ? null : url;
        await saveDraft(user.id, {
          id: row.id,
          media_url: url,
          thumbnail_url: thumb,
          media_type: mt,
        });
      }
      router.replace(TARGET_HIGHLIGHTS);
    } catch (err: unknown) {
      devError('HighlightCreate', 'Save draft error:', err);
      Alert.alert('Save Failed', UI_UPLOAD_FAILED);
    } finally {
      setSavingDraft(false);
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
        const url = await uploadDraftMedia(
          user.id,
          loadedDraftId,
          localUri,
          mt,
          localImageDims
        );
        const thumb = localIsVideo ? null : url;
        await saveDraft(user.id, {
          id: loadedDraftId,
          sport: normSport(),
          caption: normCaption(),
          media_type: mt,
          media_url: url,
          thumbnail_url: thumb,
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
      devError('HighlightCreate', 'Publish draft error:', err);
      Alert.alert('Publish Failed', UI_UPLOAD_FAILED);
    } finally {
      setUploading(false);
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
    uploading || (!loadedDraftId && !localUri?.trim());

  const composeView = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
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
        loading={uploading}
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

      {uploading || savingDraft ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.mutedSmall, { color: colors.textMuted }]}>
            {uploading ? 'Working…' : 'Saving…'}
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
    paddingBottom: Spacing.xxl,
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
