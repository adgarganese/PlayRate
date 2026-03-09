import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, FlatList, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { devError } from '@/lib/logging';
import { useTabBarSafeBottom } from '@/hooks/use-tab-bar-safe-bottom';

const GRID_COLUMNS = 3;
const GRID_GAP = 2;

type Highlight = {
  id: string;
  user_id: string;
  sport: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  like_count: number;
};

export default function MyHighlightsScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const fabBottom = useTabBarSafeBottom(Spacing.lg);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadHighlights = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: viewData, error: viewError } = await supabase
        .from('highlights_with_counts')
        .select('id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at, like_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (viewError) {
        const { data, error } = await supabase
          .from('highlights')
          .select('id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const ids = (data || []).map((h) => h.id);
        const likeCounts: Record<string, number> = {};
        if (ids.length > 0) {
          const { data: likes } = await supabase
            .from('highlight_likes')
            .select('highlight_id')
            .in('highlight_id', ids);
          (likes || []).forEach((l: { highlight_id: string }) => {
            likeCounts[l.highlight_id] = (likeCounts[l.highlight_id] || 0) + 1;
          });
        }

        setHighlights(
          (data || []).map((h) => ({
            ...h,
            like_count: likeCounts[h.id] || 0,
          }))
        );
      } else {
        setHighlights(viewData || []);
      }
    } catch (err) {
      if (__DEV__) console.warn('[profile-highlights] load', err);
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTimeout(() => router.replace('/sign-in'), 100);
      return;
    }
    loadHighlights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your media library to add highlights.');
      return false;
    }
    return true;
  };

  const pickMedia = async () => {
    if (!user || uploading) return;
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets[0]) return;

      if (__DEV__) console.log('[HighlightPost] submit pressed');
      setUploading(true);

      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || ('duration' in asset && asset.duration != null);
      const uri = asset.uri;
      const fileExt = uri.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
      const contentType = isVideo ? 'video/mp4' : `image/${fileExt === 'jpg' ? 'jpeg' : (fileExt || 'jpeg')}`;
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      // Use fetch + arrayBuffer for iOS production (file/ph asset URIs); FileSystem base64 can fail on device.
      // Test plan (iPhone TestFlight): Pick image/video from library or camera → upload → see in My Highlights and feed.
      if (__DEV__) console.log('[HighlightPost] upload starting', { fileName, contentType });
      const { data: { session } } = await supabase.auth.getSession();
      if (__DEV__ && !session) console.warn('[HighlightPost] no session at upload');
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('highlights')
        .upload(fileName, arrayBuffer, { contentType, upsert: false });

      if (uploadError) {
        if (__DEV__) console.log('[HighlightPost] upload error', uploadError);
        throw uploadError;
      }
      const { data: { publicUrl } } = supabase.storage.from('highlights').getPublicUrl(fileName);
      if (__DEV__) console.log('[HighlightPost] upload success', publicUrl);

      const insertPayload = {
        user_id: user.id,
        sport: 'basketball',
        media_type: isVideo ? 'video' : 'image',
        media_url: publicUrl,
        thumbnail_url: isVideo ? null : publicUrl,
        caption: null,
        is_public: true,
      };
      if (__DEV__) console.log('[HighlightPost] db insert starting', { ...insertPayload, media_url: '[url]' });

      const { data: inserted, error: insertError } = await supabase
        .from('highlights')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertError) {
        if (__DEV__) console.log('[HighlightPost] db insert error', insertError);
        throw insertError;
      }
      if (__DEV__) console.log('[HighlightPost] db insert success', inserted?.id);

      await loadHighlights();
      if (__DEV__) console.log('[HighlightPost] navigate back + refresh');
      router.replace('/highlights');
    } catch (err: unknown) {
      const supabaseError = err && typeof err === 'object' && 'message' in err ? err as { message?: string; code?: string; details?: string; hint?: string } : null;
      const message = supabaseError?.message ?? (err instanceof Error ? err.message : 'Please try again.');
      if (__DEV__) console.log('[HighlightPost] failure', { err, message, code: supabaseError?.code, details: supabaseError?.details });
      devError('HighlightPost', 'Highlight post error:', err);
      Alert.alert('Upload Failed', message);
    } finally {
      setUploading(false);
    }
  };

  const screenWidth = Dimensions.get('window').width;
  const itemSize = (screenWidth - Spacing.lg * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  if (authLoading || !user) return null;

  return (
    <Screen>
      <Header
        title="My Highlights"
        showBack={false}
      />
      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading highlights...</Text>
        </View>
      ) : (
        <FlatList
          data={highlights}
          numColumns={GRID_COLUMNS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.gridItem, { width: itemSize, height: itemSize, backgroundColor: colors.surfaceAlt }]}
              onPress={() => router.push(`/profile/highlights/${item.id}` as any)}
              activeOpacity={0.8}
            >
              {item.thumbnail_url || item.media_url ? (
                <Image
                  source={{ uri: item.thumbnail_url || item.media_url }}
                  style={styles.thumbnail}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
                  <IconSymbol name="play.rectangle.fill" size={32} color={colors.textMuted} />
                </View>
              )}
              {item.media_type === 'video' && (
                <View style={styles.videoBadge}>
                  <IconSymbol name="play.rectangle.fill" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No highlights yet"
              subtitle="Add your best plays to share with others."
            />
          }
        />
      )}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            bottom: fabBottom,
            right: Spacing.lg,
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => router.push('/highlights/create' as any)}
        activeOpacity={0.8}
        accessibilityLabel="Create highlight"
        accessibilityRole="button"
      >
        <IconSymbol name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  loadingText: { ...Typography.body },
  grid: { padding: Spacing.lg, paddingBottom: Spacing.xxl + 64 },
  row: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { borderRadius: Radius.xs, overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  videoBadge: { position: 'absolute', bottom: 4, right: 4 },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
