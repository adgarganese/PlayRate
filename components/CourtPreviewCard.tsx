import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { getCourtPreview, type CourtPreview } from '@/lib/courts';

type Props = {
  courtId: string;
  isMine: boolean;
  createdAt: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function CourtPreviewCard({ courtId, isMine, createdAt }: Props) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const [preview, setPreview] = useState<CourtPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCourtPreview(courtId).then((p) => {
      if (!cancelled) setPreview(p);
    });
    return () => { cancelled = true; };
  }, [courtId]);

  const onPress = () => {
    router.push(`/courts/${courtId}` as any);
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
        {/* Header: Court label + icon */}
        <View style={styles.headerRow}>
          <Text style={[styles.courtLabel, { color: colors.textMuted }]}>Court</Text>
          <IconSymbol name="sportscourt.fill" size={16} color={colors.textMuted} />
        </View>
        {/* Title: court name (2 lines max) */}
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">
          {preview.name}
        </Text>
        {/* Subtitle: address (1 line max) */}
        {preview.address ? (
          <Text style={[styles.address, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
            {preview.address}
          </Text>
        ) : null}
        {/* Footer: time + tap hint */}
        <View style={styles.footerRow}>
          <Text
            style={[styles.time, { color: isMine ? 'rgba(255,255,255,0.8)' : colors.textMuted }]}
          >
            {formatTime(createdAt)}
          </Text>
          <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap to open</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 2,
    maxWidth: '80%',
  },
  wrapLeft: { alignItems: 'flex-start' },
  wrapRight: { alignItems: 'flex-end' },
  card: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: 260,
    maxHeight: 180,
    padding: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  loadingCard: {
    padding: Spacing.lg,
    minHeight: 80,
    maxHeight: 180,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  courtLabel: { ...Typography.mutedSmall, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  name: { ...Typography.bodyBold, fontSize: 13, marginBottom: 2 },
  address: { ...Typography.mutedSmall, marginBottom: Spacing.xs },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  time: { ...Typography.mutedSmall, fontSize: 11 },
  tapHint: { ...Typography.mutedSmall, fontSize: 10 },
});
