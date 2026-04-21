import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import { deleteDraft, type HighlightDraft } from '@/lib/highlight-drafts';
import { pickHighlightStillImageRaw } from '@/lib/highlight-still';
import { formatShortRelativeTime } from '@/lib/format-relative-time';

const CARD_WIDTH = 112;
const THUMB_HEIGHT = 100;

function sportLabel(sport: string | null): string {
  const t = sport?.trim();
  if (t) return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return 'Basketball';
}

function DraftCardThumb({ draft }: { draft: HighlightDraft }) {
  const { colors } = useThemeColors();
  const raw = pickHighlightStillImageRaw(draft.thumbnail_url, draft.media_url, draft.media_type);
  const uri = useResolvedMediaUri(raw);
  const isVideo = draft.media_type === 'video';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumb}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      style={[
        styles.thumb,
        styles.thumbPlaceholder,
        {
          backgroundColor: isVideo ? '#0B0F1A' : colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}
    >
      <IconSymbol
        name={isVideo ? 'play.rectangle.fill' : 'photo'}
        size={28}
        color={isVideo ? 'rgba(255,255,255,0.88)' : colors.textMuted}
      />
    </View>
  );
}

type DraftsListProps = {
  /** Signed-in user; used to guard opening only own drafts. */
  userId: string;
  drafts: HighlightDraft[];
  onRefresh: () => void | Promise<void>;
};

export function DraftsList({ userId, drafts, onRefresh }: DraftsListProps) {
  const { colors } = useThemeColors();
  const router = useRouter();

  const openDraft = useCallback(
    (draft: HighlightDraft) => {
      if (draft.user_id !== userId) return;
      router.push({ pathname: '/highlights/create', params: { draftId: draft.id } });
    },
    [router, userId]
  );

  const confirmDelete = useCallback(
    (draft: HighlightDraft) => {
      Alert.alert('Delete draft?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Draft',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteDraft(draft.id);
                await onRefresh();
              } catch {
                Alert.alert('Error', 'Could not delete the draft. Try again.');
              }
            })();
          },
        },
      ]);
    },
    [onRefresh]
  );

  if (drafts.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      keyboardShouldPersistTaps="handled"
    >
      {drafts.map((draft) => (
        <AnimatedPressable
          key={draft.id}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
            },
            pressed && styles.cardPressed,
          ]}
          onPress={() => openDraft(draft)}
          onLongPress={() => confirmDelete(draft)}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={`Open draft, ${sportLabel(draft.sport)}`}
        >
          <DraftCardThumb draft={draft} />
          <View style={styles.tag}>
            <Text style={[styles.tagText, { color: colors.primary }]} numberOfLines={1}>
              {sportLabel(draft.sport)}
            </Text>
          </View>
          <Text style={[styles.captionPreview, { color: colors.text }]} numberOfLines={2}>
            {draft.caption?.trim() || 'No caption'}
          </Text>
          <Text style={[styles.edited, { color: colors.textMuted }]} numberOfLines={1}>
            {formatShortRelativeTime(draft.updated_at)}
          </Text>
        </AnimatedPressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  cardPressed: {
    opacity: 0.88,
  },
  thumb: {
    width: '100%',
    height: THUMB_HEIGHT,
    backgroundColor: '#000',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  tagText: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  captionPreview: {
    ...Typography.mutedSmall,
    paddingHorizontal: Spacing.sm,
    paddingTop: 2,
    minHeight: 32,
  },
  edited: {
    ...Typography.mutedSmall,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    paddingTop: 2,
  },
});
