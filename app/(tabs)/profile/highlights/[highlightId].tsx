import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { HighlightDetailVideo } from '@/components/HighlightDetailVideo';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { resolveMediaUrlForPlayback } from '@/lib/storage-media-url';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { ProfilePicture } from '@/components/ProfilePicture';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';
import { toggleHighlightLike } from '@/lib/highlights';
import { logger } from '@/lib/logger';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

/** In-app video playback (no external browser). How to verify on iPhone TestFlight: open a video highlight → plays inside the app. */
function HighlightVideo({
  uri,
  thumbnailUri,
  isActive,
}: {
  uri: string;
  thumbnailUri: string | null;
  isActive: boolean;
}) {
  if (!uri) {
    return <Image source={{ uri: thumbnailUri || undefined }} style={StyleSheet.absoluteFill} contentFit="contain" />;
  }
  return (
    <HighlightDetailVideo
      uri={uri}
      posterUri={thumbnailUri}
      contentFit="contain"
      isActive={isActive}
    />
  );
}

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
  profile_name: string | null;
  profile_username: string | null;
  profile_avatar_url: string | null;
};

export default function HighlightDetailScreen() {
  const { highlightId } = useLocalSearchParams<{ highlightId: string }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlightLoadError, setHighlightLoadError] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [togglingLike, setTogglingLike] = useState(false);

  const loadHighlight = useCallback(async () => {
    if (!highlightId) return;
    setLoading(true);
    setHighlightLoadError(false);
    try {
      const { data: h, error } = await supabase
        .from('highlights')
        .select('id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at')
        .eq('id', highlightId)
        .maybeSingle();

      if (error) {
        logger.error('[profile-highlight-detail] primary fetch failed', { err: error, highlightId });
        setHighlight(null);
        setPlaybackUri(null);
        setHighlightLoadError(true);
        setLoading(false);
        return;
      }
      if (!h) {
        setHighlight(null);
        setPlaybackUri(null);
        setHighlightLoadError(false);
        setLoading(false);
        return;
      }

      const { count } = await supabase
        .from('highlight_likes')
        .select('*', { count: 'exact', head: true })
        .eq('highlight_id', highlightId);

      let userLiked = false;
      if (user) {
        const { data: like } = await supabase
          .from('highlight_likes')
          .select('user_id')
          .eq('highlight_id', highlightId)
          .eq('user_id', user.id)
          .maybeSingle();
        userLiked = !!like;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, username, avatar_url')
        .eq('user_id', h.user_id)
        .maybeSingle();

      setHighlight({
        ...h,
        like_count: count || 0,
        profile_name: profile?.name || null,
        profile_username: profile?.username || null,
        profile_avatar_url: profile?.avatar_url || null,
      });
      setLikeCount(count || 0);
      setIsLiked(userLiked);
      try {
        const resolved = await resolveMediaUrlForPlayback(h.media_url);
        setPlaybackUri(resolved);
      } catch {
        setPlaybackUri(h.media_url);
      }
    } catch (err) {
      logger.error('[profile-highlight-detail] load threw', { err, highlightId });
      setHighlight(null);
      setPlaybackUri(null);
      setHighlightLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [highlightId, user]);

  useEffect(() => {
    void loadHighlight();
  }, [loadHighlight]);

  const toggleLike = async () => {
    if (!user || !highlightId || togglingLike) return;
    hapticLight();

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    setTogglingLike(true);

    try {
      const { success, newLikedState } = await toggleHighlightLike(
        highlightId,
        user.id,
        wasLiked
      );
      if (!success) {
        setIsLiked(wasLiked);
        setLikeCount((c) => c + (wasLiked ? 1 : -1));
        Alert.alert('Error', 'Could not update like.');
      } else {
        setIsLiked(newLikedState);
      }
    } catch (error) {
      if (__DEV__) console.warn('[profile-highlight:toggleLike]', error);
      setIsLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
      Alert.alert('Error', 'Could not update like.');
    } finally {
      setTogglingLike(false);
    }
  };

  const screenWidth = Dimensions.get('window').width;

  if (loading) {
    return (
      <Screen>
        <Header title="Highlight" showBack={false} />
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (highlightLoadError) {
    return (
      <Screen>
        <Header title="Highlight" showBack={false} />
        <View style={[styles.center, { flex: 1 }]}>
          <ErrorState onRetry={() => void loadHighlight()} />
        </View>
      </Screen>
    );
  }

  if (!highlight) {
    return (
      <Screen>
        <Header title="Highlight" showBack={false} />
        <View style={[styles.center, { flex: 1 }]}>
          <EmptyState
            title="This highlight isn't available"
            subtitle="It may have been deleted or you may not have access."
            actionLabel="Go back"
            onAction={() => router.back()}
            icon="play.rectangle.fill"
          />
        </View>
      </Screen>
    );
  }

  const isOwn = user?.id === highlight.user_id;

  return (
    <Screen>
      <Header title="Highlight" showBack={false} />
      <Card style={styles.card}>
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => router.push(`/athletes/${highlight.user_id}/profile` as any)}
          activeOpacity={0.7}
        >
          <ProfilePicture avatarUrl={highlight.profile_avatar_url} size={40} editable={false} />
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: colors.text }]}>{highlight.profile_name || 'Unknown'}</Text>
            <Text style={[styles.profileUsername, { color: colors.textMuted }]}>@{highlight.profile_username || 'user'}</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.mediaContainer, { width: screenWidth - Spacing.lg * 2, aspectRatio: 1 }]}>
          {highlight.media_type === 'video' ? (
            <HighlightVideo
              uri={playbackUri || highlight.media_url}
              thumbnailUri={highlight.thumbnail_url}
              isActive={isFocused}
            />
          ) : (
            <Image source={{ uri: playbackUri || highlight.media_url }} style={styles.image} contentFit="contain" />
          )}
        </View>

        <View style={styles.actions}>
          {!isOwn && (
            <TouchableOpacity style={styles.likeButton} onPress={toggleLike} disabled={togglingLike}>
              <IconSymbol
                name={isLiked ? 'star.fill' : 'star'}
                size={24}
                color={isLiked ? colors.accentPink : colors.textMuted}
              />
            </TouchableOpacity>
          )}
          <Text style={[styles.likeCount, { color: colors.textMuted }]}>{likeCount} likes</Text>
        </View>

        {highlight.caption && (
          <Text style={[styles.caption, { color: colors.text }]}>{highlight.caption}</Text>
        )}

        <Text style={[styles.sport, { color: colors.textMuted }]}>{highlight.sport}</Text>
        <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(highlight.created_at).toLocaleDateString()}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  errorText: { ...Typography.body },
  card: { margin: Spacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  profileText: { marginLeft: Spacing.md },
  profileName: { ...Typography.bodyBold },
  profileUsername: { ...Typography.mutedSmall },
  mediaContainer: { alignSelf: 'center', borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: '#000' },
  videoContainer: { width: '100%', height: '100%', position: 'relative' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  likeButton: { marginRight: Spacing.sm },
  likeCount: { ...Typography.muted },
  shareDmRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: Spacing.sm },
  actionButton: { padding: Spacing.xs },
  caption: { ...Typography.body, marginTop: Spacing.sm },
  sport: { ...Typography.mutedSmall, marginTop: Spacing.xs },
  date: { ...Typography.mutedSmall, marginTop: Spacing.xs },
});
