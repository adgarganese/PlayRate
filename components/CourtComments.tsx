import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from './Card';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

// Possibly unused: not imported anywhere; fetchCourtComments (lib/courts-api) is also unused.
export type CourtComment = {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  profile: {
    name: string | null;
    username: string | null;
  } | null;
};

type CourtCommentsProps = {
  comments: CourtComment[];
  loading: boolean;
};

function formatCommentDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CourtComments({ comments, loading }: CourtCommentsProps) {
  const { colors } = useThemeColors();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  if (comments.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.noCommentsText, { color: colors.textMuted }]}>No comments yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {comments.map((comment) => (
        <Card key={comment.id} style={styles.commentCard}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentAuthor, { color: colors.text }]}>
              {comment.profile?.name || comment.profile?.username || 'Anonymous'}
            </Text>
            <Text style={[styles.commentDate, { color: colors.textMuted }]}>{formatCommentDate(comment.created_at)}</Text>
          </View>
          <Text style={[styles.commentMessage, { color: colors.text }]}>{comment.message}</Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  loading: {
    marginVertical: Spacing.lg,
  },
  commentCard: {
    marginBottom: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  commentAuthor: {
    ...Typography.bodyBold,
  },
  commentDate: {
    ...Typography.mutedSmall,
  },
  commentMessage: {
    ...Typography.body,
  },
  noCommentsText: {
    ...Typography.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: Spacing.lg,
  },
});
