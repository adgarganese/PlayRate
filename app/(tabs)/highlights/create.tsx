import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { devError } from '@/lib/logging';

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

/**
 * Create Highlight: for signed-in users, show Open Camera + Choose from Photos.
 * For signed-out users, redirect once to sign-in.
 */
export default function HighlightCreateScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { colors } = useThemeColors();
  const hasRedirectedRef = useRef(false);
  const [uploading, setUploading] = useState(false);

  const authReady = loading === false;

  // Redirect only when auth is ready and user is missing; at most once per mount.
  useEffect(() => {
    if (!authReady) return;
    if (user) return;
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    router.replace(TARGET_SIGN_IN as any);
  }, [authReady, user]);

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
      Alert.alert('Camera access', 'Could not request camera permission. Please try again or use Choose from Photos.', [{ text: 'OK' }]);
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
      Alert.alert('Photo library access', 'Could not request photo library permission. Please try again.', [{ text: 'OK' }]);
      return false;
    }
  }, []);

  const uploadAsset = useCallback(
    async (uri: string, isVideo: boolean) => {
      if (!user || !uri?.trim()) return;
      setUploading(true);
      try {
        const fileExt = uri.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
        const contentType = isVideo ? 'video/mp4' : `image/${fileExt === 'jpg' ? 'jpeg' : fileExt || 'jpeg'}`;
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET_HIGHLIGHTS)
          .upload(fileName, bytes.buffer, { contentType, upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET_HIGHLIGHTS).getPublicUrl(fileName);

        const { error: insertError } = await supabase
          .from('highlights')
          .insert({
            user_id: user.id,
            sport: DEFAULT_HIGHLIGHT_SPORT,
            media_type: isVideo ? 'video' : 'image',
            media_url: publicUrl,
            thumbnail_url: isVideo ? null : publicUrl,
            caption: null,
            is_public: true,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        router.replace(TARGET_HIGHLIGHTS as any);
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : 'Upload failed.';
        devError('HighlightCreate', 'Upload error:', err);
        Alert.alert('Upload Failed', msg ?? 'Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [user]
  );

  const openCamera = useCallback(async () => {
    if (!user || uploading) return;
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
      await uploadAsset(uri, isVideo);
    } catch (e) {
      devError('HighlightCreate', 'Camera error:', e);
      Alert.alert('Error', 'Could not open camera. Try again or use Choose from Photos.');
    }
  }, [user, uploading, requestCameraPermission, uploadAsset]);

  const chooseFromPhotos = useCallback(async () => {
    if (!user || uploading) return;
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
      await uploadAsset(uri, isVideo);
    } catch (e) {
      devError('HighlightCreate', 'Library error:', e);
      Alert.alert('Error', 'Could not open photos. Please try again.');
    }
  }, [user, uploading, requestMediaLibraryPermission, uploadAsset]);

  // Auth still loading: show stable loading (no redirect yet).
  if (!authReady) {
    return (
      <Screen>
        <Header title="Create Highlight" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  // Not signed in: redirect runs in effect; show brief loading to avoid flash.
  if (!user) {
    return (
      <Screen>
        <Header title="Create Highlight" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textMuted }]}>Redirecting…</Text>
        </View>
      </Screen>
    );
  }

  // Signed in: show two action cards.
  return (
    <Screen>
      <Header title="Create Highlight" />
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
            disabled={uploading}
          />
          <ActionCard
            iconName="play.rectangle.fill"
            title="Choose from Photos"
            subtitle="Pick a video or photo from your camera roll"
            onPress={chooseFromPhotos}
            disabled={uploading}
          />
        </View>
        {uploading && (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.muted, { color: colors.textMuted }]}>Uploading…</Text>
          </View>
        )}
      </View>
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
  lead: {
    ...Typography.body,
    marginBottom: Spacing.xl,
  },
  cardsWrap: {
    gap: Spacing.md,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  muted: {
    ...Typography.body,
  },
});
