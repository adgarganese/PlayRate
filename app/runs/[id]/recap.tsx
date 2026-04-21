import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import {
  checkRecapEligibility,
  fetchRecapParticipants,
  submitCosign,
  fetchRepRollups,
  getRepProgress,
  COSIGN_ATTRIBUTES,
  COSIGN_ATTRIBUTE_LABELS,
  type RecapParticipant,
  type CosignAttribute,
} from '@/lib/recap';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ListItem } from '@/components/ui/ListItem';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { track, trackOnce } from '@/lib/analytics';
import { logDevError } from '@/lib/dev-log';
import { normalizeCosignTierName, tierRank } from '@/lib/tiers';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

const MAX_COSIGNS = 3;
const MAX_NOTE_LENGTH = 140;

function displayName(p: RecapParticipant): string {
  return p.name?.trim() || p.username || 'Player';
}

export default function RunRecapScreen() {
  const { id: runId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();

  const [phase, setPhase] = useState<'loading' | 'ineligible' | 'recap' | 'completed'>('loading');
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RecapParticipant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<RecapParticipant | null>(null);
  const [selectedAttribute, setSelectedAttribute] = useState<CosignAttribute | null>(null);
  const [note, setNote] = useState('');
  const [cosignsSubmitted, setCosignsSubmitted] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [repRollup, setRepRollup] = useState<{ total_cosigns: number; rep_level: string } | null>(null);
  const [loadingRep, setLoadingRep] = useState(false);
  const recapOpenedFired = useRef(false);
  const initialRepLevelRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadEligibilityAndParticipants = useCallback(async () => {
    if (!runId || !user?.id) return;
    setPhase('loading');
    setEligibilityError(null);
    try {
      const eligibility = await checkRecapEligibility(runId, user.id);
      if (!isMountedRef.current) return;
      if (!eligibility.eligible) {
        setEligibilityError(eligibility.error ?? "You're not eligible for this recap.");
        setPhase('ineligible');
        return;
      }
      const list = await fetchRecapParticipants(runId, user.id);
      if (!isMountedRef.current) return;
      setParticipants(list);
      setPhase('recap');
      // Store initial rep level for rep_level_up detection on completion
      const rollup = await fetchRepRollups(user.id);
      if (isMountedRef.current && rollup) {
        initialRepLevelRef.current = normalizeCosignTierName(rollup.rep_level);
      }
    } catch (error) {
      logDevError('recap:loadEligibilityAndParticipants', error);
      if (isMountedRef.current) {
        setEligibilityError('Something went wrong. Please try again.');
        setPhase('ineligible');
      }
    }
  }, [runId, user?.id]);

  useEffect(() => {
    loadEligibilityAndParticipants();
  }, [loadEligibilityAndParticipants]);

  // Analytics: recap_opened once when user is eligible and in recap phase
  useEffect(() => {
    if (phase === 'recap' && runId && !recapOpenedFired.current) {
      recapOpenedFired.current = true;
      trackOnce('recap_opened', runId, { run_id: runId });
    }
  }, [phase, runId]);

  const handleAddCosign = useCallback(async () => {
    if (!user?.id || !runId || !selectedParticipant || !selectedAttribute) return;
    if (cosignsSubmitted >= MAX_COSIGNS) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitCosign(
      user.id,
      selectedParticipant.user_id,
      runId,
      selectedAttribute,
      note.trim() || null
    );
    if (!isMountedRef.current) return;
    setSubmitting(false);
    if (result.success) {
      track('cosign_given', {
        run_id: runId,
        attribute: selectedAttribute,
        note_used: !!(note?.trim()),
      });
      setCosignsSubmitted((n) => n + 1);
      setSelectedParticipant(null);
      setSelectedAttribute(null);
      setNote('');
    } else {
      setSubmitError(result.error);
    }
  }, [user?.id, runId, selectedParticipant, selectedAttribute, note, cosignsSubmitted]);

  const handleFinishRecap = useCallback(() => {
    track('recap_completed', { run_id: runId, cosigns_count: cosignsSubmitted });
    setPhase('completed');
    setLoadingRep(true);
    if (user?.id) {
      fetchRepRollups(user.id).then((r) => {
        if (!isMountedRef.current) return;
        setLoadingRep(false);
        if (r) {
          setRepRollup({
            total_cosigns: r.total_cosigns,
            rep_level: normalizeCosignTierName(r.rep_level),
          });
          const fromLevel = initialRepLevelRef.current;
          const toTier = normalizeCosignTierName(r.rep_level);
          if (
            fromLevel != null &&
            tierRank(toTier) > tierRank(fromLevel)
          ) {
            track('rep_level_up', {
              from_level: fromLevel,
              to_level: toTier,
              total_cosigns: r.total_cosigns,
            });
          }
        }
      }).catch(() => {
        if (isMountedRef.current) setLoadingRep(false);
      });
    } else {
      setLoadingRep(false);
    }
  }, [user?.id, runId, cosignsSubmitted]);

  const goHome = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  if (authLoading) return <LoadingScreen message="Loading..." />;
  if (!user) return <Redirect href="/sign-in" />;
  if (!runId) {
    return (
      <Screen>
        <Header title="Recap" showBack onBackPress={() => router.back()} />
        <View style={[styles.centered, { backgroundColor: colors.bg }]}>
          <Text style={[Typography.body, { color: colors.textMuted }]}>Run not found.</Text>
        </View>
      </Screen>
    );
  }

  if (phase === 'loading') {
    return <LoadingScreen message="Checking eligibility..." />;
  }

  if (phase === 'ineligible') {
    return (
      <Screen>
        <Header title="Run Recap" showBack onBackPress={() => router.back()} />
        <View style={[styles.centered, styles.padded, { backgroundColor: colors.bg }]}>
          <Text style={[Typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            {eligibilityError}
          </Text>
          <Button title="Go back" onPress={() => router.back()} variant="secondary" style={styles.topButton} />
        </View>
      </Screen>
    );
  }

  if (phase === 'completed') {
    const progress = repRollup ? getRepProgress(repRollup.total_cosigns) : null;
    return (
      <Screen>
        <View style={[styles.completionRoot, { backgroundColor: colors.bg }]}>
          <View style={[styles.completionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[Typography.h3, { color: colors.text, textAlign: 'center', marginBottom: Spacing.md }]}>
              Recap complete. {"You're done for today."}
            </Text>
            {loadingRep ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : progress ? (
              <View style={styles.repBlock}>
                <Text style={[Typography.body, { color: colors.textMuted }]}>
                  Your rep: {repRollup!.total_cosigns} cosigns (last 90 days) • {repRollup!.rep_level}
                </Text>
                <Text style={[Typography.mutedSmall, { color: colors.textMuted, marginTop: Spacing.xs }]}>
                  {progress.label}
                </Text>
              </View>
            ) : null}
            <Button title="Find next run" onPress={goHome} variant="primary" style={styles.topButton} />
          </View>
        </View>
      </Screen>
    );
  }

  const canAddCosign = selectedParticipant && selectedAttribute && cosignsSubmitted < MAX_COSIGNS && !submitting;
  const hasParticipants = participants.length > 0;

  return (
    <Screen>
      <Header title="Run Recap" showBack onBackPress={() => router.back()} />
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          <Text style={[Typography.muted, { color: colors.textMuted, marginBottom: Spacing.md }]}>
            Confirm participants and give up to 3 cosigns. Tap a player to choose an attribute.
          </Text>

          <Text style={[Typography.bodyBold, { color: colors.text, marginBottom: Spacing.sm }]}>
            Participants
          </Text>
          {!hasParticipants ? (
            <Text style={[Typography.muted, { color: colors.textMuted, marginBottom: Spacing.lg }]}>
              No other participants in this run.
            </Text>
          ) : (
            <View style={styles.listBlock}>
              {participants.map((p) => (
                <ListItem
                  key={p.user_id}
                  title={displayName(p)}
                  subtitle={p.username ? `@${p.username}` : undefined}
                  tierRepLevel={p.rep_level}
                  onPress={() => setSelectedParticipant(p)}
                  style={
                    selectedParticipant?.user_id === p.user_id
                      ? { borderColor: colors.primary, borderWidth: 2 }
                      : undefined
                  }
                />
              ))}
            </View>
          )}

          {selectedParticipant && (
            <>
              <Text style={[Typography.bodyBold, { color: colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
                Cosign {displayName(selectedParticipant)} for
              </Text>
              <View style={styles.chipRow}>
                {COSIGN_ATTRIBUTES.map((attr) => {
                  const isSelected = selectedAttribute === attr;
                  return (
                    <Pressable
                      key={attr}
                      onPress={() => setSelectedAttribute(attr)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          Typography.mutedSmall,
                          { color: isSelected ? colors.textOnPrimary : colors.textMuted, fontWeight: '600' },
                        ]}
                      >
                        {COSIGN_ATTRIBUTE_LABELS[attr]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input
                label="Optional note (max 140 characters)"
                placeholder="Nice pass!"
                value={note}
                onChangeText={(t) => setNote(t.slice(0, MAX_NOTE_LENGTH))}
                maxLength={MAX_NOTE_LENGTH}
                multiline
                numberOfLines={2}
                style={styles.noteInput}
              />
              {submitError ? (
                <Text style={[Typography.mutedSmall, { color: '#FF6B6B', marginBottom: Spacing.sm }]}>
                  {submitError}
                </Text>
              ) : null}
              <Button
                title={submitting ? 'Adding…' : 'Add Cosign'}
                onPress={handleAddCosign}
                variant="primary"
                disabled={!canAddCosign}
                loading={submitting}
                style={styles.addButton}
              />
            </>
          )}

          <View style={[styles.footerRow, { borderColor: colors.border }]}>
            <Text style={[Typography.bodyBold, { color: colors.text }]}>
              Cosigns: {cosignsSubmitted}/{MAX_COSIGNS}
            </Text>
            <Button
              title="Finish Recap"
              onPress={handleFinishRecap}
              variant="secondary"
              style={styles.finishButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {},
  padded: { paddingHorizontal: Spacing.lg },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  topButton: {
    marginTop: Spacing.xl,
  },
  listBlock: {
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  noteInput: {
    marginBottom: Spacing.sm,
  },
  addButton: {
    marginBottom: Spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  finishButton: {
    minWidth: 140,
  },
  completionRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  completionCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  repBlock: {
    marginBottom: Spacing.lg,
  },
});
