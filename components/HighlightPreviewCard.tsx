import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { getHighlightPreview, type HighlightPreview } from '@/lib/highlights';

type Props = {
  highlightId: string;
  isMine: boolean;
  createdAt: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function HighlightPreviewCard({ highlightId, isMine, createdAt }: Props) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const [preview, setPreview] = useState<HighlightPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHighlightPreview(highlightId).then((p) => {
      if (!cancelled) setPreview(p);
    });
    return () => { cancelled = true; };
  }, [highlightId]);

  const onPress = () => {
    router.push(`/profile/highlights/${highlightId}` as any);
  };

  if (!preview) {
    return (
      <Pressable onPress={onPress} style={[styles.wrap, isMine ? styles.wrapRight : styles.wrapLeft]}>
        <View style={[styles.card, styles.loadingCard, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[Typography.muted, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.wrap, isMine ? styles.wrapRight : styles.wrapLeft]}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        <View style={styles.thumbRow}>
          {(preview.thumbnail_url || preview.media_url) ? (
            <Image
              source={{ uri: preview.thumbnail_url || preview.media_url }}
              style={styles.thumb}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: colors.surface }]}>
              <IconSymbol name="play.rectangle.fill" size={28} color={colors.textMuted} />
            </View>
          )}
          {preview.media_type === 'video' && (
            <View style={styles.videoBadge}>
              <IconSymbol name="play.rectangle.fill" size={14} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.creator, { color: colors.text }]} numberOfLines={1}>
            {preview.profile_name || preview.profile_username || 'Highlight'}
          </Text>
          {preview.caption ? (
            <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={1}>
              {preview.caption}
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.time,
            { color: isMine ? 'rgba(255,255,255,0.8)' : colors.textMuted },
          ]}
        >
          {formatTime(createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 2,
    maxWidth: '85%',
  },
  wrapLeft: { alignItems: 'flex-start' },
  wrapRight: { alignItems: 'flex-end' },
  card: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: 260,
  },
  loadingCard: {
    padding: Spacing.lg,
    minHeight: 80,
    justifyContent: 'center',
  },
  thumbRow: { position: 'relative' },
  thumb: { width: '100%', aspectRatio: 1, maxHeight: 180 },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  videoBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    padding: 4,
  },
  cardBody: { padding: Spacing.sm, paddingBottom: 0 },
  creator: { ...Typography.bodyBold, fontSize: 13 },
  caption: { ...Typography.mutedSmall, marginTop: 2 },
  time: { ...Typography.mutedSmall, fontSize: 11, marginTop: 2, marginBottom: Spacing.xs, marginHorizontal: Spacing.sm },
});
