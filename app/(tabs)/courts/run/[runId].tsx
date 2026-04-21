import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { fetchRunById, formatRunTimeLabel, isUserParticipantInRun, joinRun, leaveRun } from '@/lib/runs';
import type { RunRow } from '@/lib/runs';
import { getNotificationPrefs, updateRunReminderPrefs } from '@/lib/notification-prefs';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';
import { trackOnce } from '@/lib/analytics';
import { logger } from '@/lib/logger';

const SKILL_BAND_LABELS: Record<string, string> = {
  casual: 'Casual',
  balanced: 'Balanced',
  competitive: 'Competitive',
};

export default function RunDetailScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [run, setRun] = useState<RunRow | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [runMissing, setRunMissing] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [reminder2h, setReminder2h] = useState(false);
  const [reminder30m, setReminder30m] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const runOpenedFired = useRef(false);

  const loadRun = useCallback(async () => {
    if (!runId) {
      setLoading(false);
      setRun(null);
      setFetchFailed(false);
      setRunMissing(true);
      setParticipantCount(0);
      setIsParticipant(false);
      setReminder2h(false);
      setReminder30m(false);
      return;
    }
    setLoading(true);
    setFetchFailed(false);
    setRunMissing(false);
    try {
      const { run: r, participantCount: count } = await fetchRunById(runId);

      let participant = false;
      let prefs2h = false;
      let prefs30m = false;
      if (user?.id && r) {
        participant = await isUserParticipantInRun(runId, user.id);
        if (participant) {
          const prefs = await getNotificationPrefs(user.id);
          prefs2h = prefs.run_reminder_2h;
          prefs30m = prefs.run_reminder_30m;
        }
      }
      setRun(r ?? null);
      setParticipantCount(count ?? 0);
      setRunMissing(!r);
      setFetchFailed(false);
      setIsParticipant(participant);
      setReminder2h(prefs2h);
      setReminder30m(prefs30m);
    } catch (err) {
      logger.error('run-detail: load failed', { err, runId });
      setFetchFailed(true);
      setRunMissing(false);
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [runId, user?.id]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  const handleReminder2h = useCallback(
    async (value: boolean) => {
      if (!user?.id) return;
      setReminder2h(value);
      await updateRunReminderPrefs(user.id, { run_reminder_2h: value });
    },
    [user?.id]
  );

  const handleReminder30m = useCallback(
    async (value: boolean) => {
      if (!user?.id) return;
      setReminder30m(value);
      await updateRunReminderPrefs(user.id, { run_reminder_30m: value });
    },
    [user?.id]
  );

  // Analytics: run_opened once per mount when run is loaded
  useEffect(() => {
    if (run && !runOpenedFired.current) {
      runOpenedFired.current = true;
      trackOnce('run_opened', run.id, { run_id: run.id, band: run.skill_band });
    }
  }, [run]);

  const spotsLeftForJoin = run
    ? (run.capacity > 0 ? Math.max(0, run.capacity - participantCount) : null)
    : null;
  const canJoin = run && user && !isParticipant && (spotsLeftForJoin === null || spotsLeftForJoin > 0);
  const handleJoinRun = useCallback(async () => {
    if (!runId || !user?.id || !run) return;
    setJoinError(null);
    setJoining(true);
    try {
      const { error } = await joinRun(runId, user.id);
      if (error) {
        logger.error('RunDetail: joinRun returned error', { err: error, runId });
        setJoinError('Could not join this run. Please try again.');
        return;
      }
      setIsParticipant(true);
      setParticipantCount((c) => c + 1);
    } catch (err) {
      logger.error('RunDetail: joinRun threw', { err, runId });
      setJoinError('Something went wrong');
    } finally {
      setJoining(false);
    }
  }, [runId, user?.id, run]);

  const handleLeaveRun = useCallback(async () => {
    if (!runId || !user?.id) return;
    setLeaveError(null);
    setLeaving(true);
    try {
      const { error } = await leaveRun(runId, user.id);
      if (error) {
        logger.error('RunDetail: leaveRun returned error', { err: error, runId });
        setLeaveError('Could not leave this run. Please try again.');
        return;
      }
      setIsParticipant(false);
      setParticipantCount((c) => Math.max(0, c - 1));
    } catch (err) {
      logger.error('RunDetail: leaveRun threw', { err, runId });
      setLeaveError('Something went wrong');
    } finally {
      setLeaving(false);
    }
  }, [runId, user?.id]);

  if (loading) {
    return <LoadingScreen message="Loading run..." />;
  }

  if (fetchFailed) {
    return (
      <Screen>
        <Header title="Run" showBack onBackPress={() => router.back()} />
        <View style={[styles.centered, { backgroundColor: colors.bg }]}>
          <ErrorState onRetry={() => void loadRun()} />
        </View>
      </Screen>
    );
  }

  if (runMissing || !run) {
    return (
      <Screen>
        <Header title="Run" showBack onBackPress={() => router.back()} />
        <View style={[styles.centered, { backgroundColor: colors.bg }]}>
          <EmptyState
            title="No runs scheduled at this court. Create one!"
            subtitle="If this link is old, the run may have been removed."
            actionLabel="Back"
            onAction={() => router.back()}
            icon="figure.run"
          />
        </View>
      </Screen>
    );
  }

  const startLabel = formatRunTimeLabel(run.starts_at);
  const endLabel = new Date(run.ends_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const skillLabel = SKILL_BAND_LABELS[run.skill_band] ?? run.skill_band;
  const spotsLeft = run.capacity > 0 ? Math.max(0, run.capacity - participantCount) : null;

  return (
    <Screen>
      <View style={[styles.page, { backgroundColor: colors.bg }]}>
        <Header title="Run" showBack onBackPress={() => router.back()} />
        <Card style={styles.card}>
          <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.sm }]}>
            {run.court_name ?? 'Unknown court'}
          </Text>
          <Text style={[Typography.body, { color: colors.textMuted, marginBottom: Spacing.xs }]}>
            {startLabel} – {endLabel}
          </Text>
          <Text style={[Typography.muted, { color: colors.textMuted, marginBottom: Spacing.xs }]}>
            {skillLabel}
            {run.skill_min != null && run.skill_max != null && ` • Skill ${run.skill_min}–${run.skill_max}`}
          </Text>
          {spotsLeft != null && (
            <Text style={[Typography.mutedSmall, { color: colors.textMuted }]}>
              {participantCount} joined • {spotsLeft} spots left
            </Text>
          )}
          {run.notes ? (
            <Text style={[Typography.muted, { color: colors.textMuted, marginTop: Spacing.md }]}>
              {run.notes}
            </Text>
          ) : null}
        </Card>

        {canJoin && (
          <Card style={styles.card}>
            {joinError ? (
              <Text style={[Typography.muted, { color: colors.textMuted, marginBottom: Spacing.md }]}>
                {joinError}
              </Text>
            ) : null}
            <Button
              title={joining ? 'Joining…' : 'Join run'}
              onPress={handleJoinRun}
              disabled={joining}
            />
          </Card>
        )}

        {user && isParticipant && (
          <Card style={styles.card}>
            <Text style={[Typography.bodyBold, { color: colors.text, marginBottom: Spacing.md }]}>
              Reminders
            </Text>
            <View style={styles.reminderRow}>
              <View style={styles.reminderLabelBlock}>
                <Text style={[Typography.body, { color: colors.text }]}>2 hours before</Text>
                <Text style={[Typography.mutedSmall, { color: colors.textMuted }]}>
                  Get a reminder before the run starts
                </Text>
              </View>
              <Switch
                value={reminder2h}
                onValueChange={handleReminder2h}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={styles.reminderRow}>
              <View style={styles.reminderLabelBlock}>
                <Text style={[Typography.body, { color: colors.text }]}>30 minutes before</Text>
                <Text style={[Typography.mutedSmall, { color: colors.textMuted }]}>
                  Last-chance reminder
                </Text>
              </View>
              <Switch
                value={reminder30m}
                onValueChange={handleReminder30m}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
            {leaveError ? (
              <Text style={[Typography.muted, { color: colors.textMuted, marginTop: Spacing.md }]}>
                {leaveError}
              </Text>
            ) : null}
            <View style={{ marginTop: Spacing.lg }}>
              <Button
                title={leaving ? 'Leaving…' : 'Leave run'}
                onPress={handleLeaveRun}
                disabled={leaving}
                variant="secondary"
              />
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  card: {
    margin: Spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  reminderLabelBlock: {
    flex: 1,
    marginRight: Spacing.md,
  },
});
