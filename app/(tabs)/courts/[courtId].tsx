import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Alert, Pressable, Modal, ScrollView, TouchableOpacity, useWindowDimensions, LayoutAnimation, Share, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { 
  fetchCourtById, 
  checkFollowingCourt, 
  checkInCourt, 
  getUserCheckIn, 
  getTodayCheckInCount, 
  getCourtLeaderboard,
  getCourtRatingInfo,
  submitCourtRating,
  fetchCourtPhotos,
  getPrimaryCourtPhoto,
  type Court,
  type LeaderboardEntry,
  type CourtRatingInfo,
  type CourtPhoto
} from '@/lib/courts';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { CourtChat } from '@/components/CourtChat';
import { AppText } from '@/components/ui/AppText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProfileNavPill } from '@/components/ProfileNavPill';
import { CourtPhotoCarousel } from '@/components/CourtPhotoCarousel';
import { useThemeColors } from '@/contexts/theme-context';
import { GOLD, Spacing, Typography, Radius } from '@/constants/theme';
import { BETA_HIDE_LEADERBOARD } from '@/constants/features';
import { playSubmitBuzz } from '@/lib/haptics';
import { track } from '@/lib/analytics';

const SECTION_GAP = Spacing.lg;

export default function CourtDetailScreen() {
  const { courtId } = useLocalSearchParams<{ courtId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const [court, setCourt] = useState<Court | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingFollow, setTogglingFollow] = useState(false);
  
  // Check-in state
  const [userCheckIn, setUserCheckIn] = useState<string | null>(null);
  const [todayCheckInCount, setTodayCheckInCount] = useState<number>(0);
  const [checkingIn, setCheckingIn] = useState(false);
  const [, setLoadingCheckIn] = useState(false);
  
  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  
  // Rating state
  const [ratingInfo, setRatingInfo] = useState<CourtRatingInfo | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [loadingRating, setLoadingRating] = useState(false);
  const [isEditingRating, setIsEditingRating] = useState(false);
  
  // Photo state
  const [photos, setPhotos] = useState<CourtPhoto[]>([]);
  
  // Card expansion state
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  
  // Section modals (See all photos)
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  // Rating modal (opened from main card rating row)
  const [showRatingModal, setShowRatingModal] = useState(false);
  
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  useEffect(() => {
    if (courtId) {
      loadCourt();
      loadRatingInfo();
      loadPhotos();
      loadCheckInStatus();
      loadTodayCheckInCount();
      if (user) {
        checkFollowing();
      }
      if (!BETA_HIDE_LEADERBOARD) {
        loadLeaderboard();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtId, user]);

  // Calculate responsive rating button size (similar to self-ratings screen)
  const ratingButtonSize = Math.max(28, Math.min(44, Math.floor((screenWidth - 64 - (9 * 8)) / 10)));
  const ratingButtonFontSize = ratingButtonSize <= 30 ? 12 : ratingButtonSize <= 36 ? 14 : 16;

  const loadCourt = async () => {
    if (!courtId) return;

    setLoading(true);
    setError(null);

    try {
      const courtData = await fetchCourtById(courtId);
      if (!courtData) {
        setError('Court not found.');
        return;
      }
      setCourt(courtData);
      const props: Record<string, unknown> = { court_id: courtId, court_name: courtData.name };
      track('court_opened', props);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load court');
    } finally {
      setLoading(false);
    }
  };

  const checkFollowing = async () => {
    if (!courtId || !user) return;

    try {
      const following = await checkFollowingCourt(user.id, courtId);
      setIsFollowing(following);
    } catch (err) {
      if (__DEV__) console.warn('[court-detail:checkFollowing]', err);
    }
  };


  const handleToggleFollow = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'You must be signed in to follow courts.');
      return;
    }

    if (!courtId) return;

    setTogglingFollow(true);

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    try {
      if (wasFollowing) {
        const { error } = await supabase
          .from('court_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('court_id', courtId);

        if (error) {
          setIsFollowing(wasFollowing);
          Alert.alert('Error', 'Unable to unfollow. Please try again.');
          return;
        }
      } else {
        const { error } = await supabase
          .from('court_follows')
          .insert({
            user_id: user.id,
            court_id: courtId,
          });

        if (error) {
          setIsFollowing(wasFollowing);
          
          if (error.code === '23505') {
            setIsFollowing(true);
          } else {
            Alert.alert('Error', 'Unable to follow. Please try again.');
          }
          return;
        }
      }
    } catch (err) {
      setIsFollowing(wasFollowing);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update follow status.');
    } finally {
      setTogglingFollow(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!court || !court.address) return;
    
    try {
      // Use native Clipboard API
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(court.address);
          Alert.alert('Copied', 'Address copied to clipboard');
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = court.address;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          Alert.alert('Copied', 'Address copied to clipboard');
        }
      } else {
        // For React Native, we'll need expo-clipboard or @react-native-clipboard/clipboard
        // For now, just show alert that it would be copied
        Alert.alert('Copy Address', `Address: ${court.address}\n\n(Tap to open maps instead)`, [
          { text: 'OK' },
        ]);
      }
    } catch (error) {
      if (__DEV__) console.warn('[court-detail:copyAddress]', error);
      Alert.alert('Error', 'Unable to copy address');
    }
  };

  const handleOpenMaps = () => {
    if (!court?.address) return;
    
    const encodedAddress = encodeURIComponent(court.address);
    let url: string;
    
    if (Platform.OS === 'ios') {
      url = `maps://maps.apple.com/?q=${encodedAddress}`;
    } else if (Platform.OS === 'android') {
      url = `geo:0,0?q=${encodedAddress}`;
    } else {
      url = `https://maps.google.com/?q=${encodedAddress}`;
    }
    
    Linking.openURL(url).catch(() => {
      // Fallback to web maps
      Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
    });
  };

  const handleDirections = () => {
    if (!court) return;
    
    if (!court.lat || !court.lng) {
      if (court.address) {
        handleOpenMaps();
      }
      return;
    }
    
    let url: string;
    
    if (Platform.OS === 'ios') {
      url = `maps://maps.apple.com/?daddr=${court.lat},${court.lng}`;
    } else if (Platform.OS === 'android') {
      url = `google.navigation:q=${court.lat},${court.lng}`;
    } else {
      url = `https://maps.google.com/?daddr=${court.lat},${court.lng}`;
    }
    
    Linking.openURL(url).catch(() => {
      // Fallback to web maps
      Linking.openURL(`https://maps.google.com/?daddr=${court.lat},${court.lng}`);
    });
  };

  const handleShare = async () => {
    if (!court) return;
    const addressPart = court.address ? ` — ${court.address}` : '';
    const deepLink = `playrate://courts/${court.id}`;
    const message = `Check out ${court.name}${addressPart}. ${deepLink}`;
    try {
      await Share.share({
        title: 'Share Court',
        message,
      });
    } catch (error) {
      if (__DEV__) console.warn('[court-detail:share]', error);
    }
  };

  const loadCheckInStatus = async () => {
    if (!courtId || !user) return;
    
    setLoadingCheckIn(true);
    try {
      const checkIn = await getUserCheckIn(courtId, user.id);
      setUserCheckIn(checkIn);
    } catch (err) {
      if (__DEV__) console.warn('[court-detail:loadCheckInStatus]', err);
    } finally {
      setLoadingCheckIn(false);
    }
  };

  const loadTodayCheckInCount = async () => {
    if (!courtId) return;
    
    try {
      const count = await getTodayCheckInCount(courtId);
      setTodayCheckInCount(count);
    } catch (err) {
      if (__DEV__) console.warn('[court-detail:loadTodayCheckInCount]', err);
    }
  };

  const loadLeaderboard = async () => {
    if (!courtId) return;
    
    setLoadingLeaderboard(true);
    try {
      const topUsers = await getCourtLeaderboard(courtId, 10);
      setLeaderboard(topUsers);
    } catch (err) {
      if (__DEV__) console.warn('[court-detail:loadLeaderboard]', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const loadRatingInfo = async () => {
    if (!courtId) return;
    
    setLoadingRating(true);
    try {
      const info = await getCourtRatingInfo(courtId, user?.id);
      setRatingInfo(info);
      // Set selected rating to user's current rating if exists
      setSelectedRating(info.user_rating);
    } catch (err) {
      if (__DEV__) console.warn('[court-detail:loadRatingInfo]', err);
    } finally {
      setLoadingRating(false);
    }
  };

  const loadPhotos = async () => {
    if (!courtId) return;
    try {
      const courtPhotos = await fetchCourtPhotos(courtId);
      setPhotos(courtPhotos);
    } catch (err) {
      if (__DEV__) console.warn('[court-detail:loadPhotos]', err);
    }
  };

  const handleSubmitRating = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'You must be signed in to rate courts.');
      return;
    }

    if (!courtId || selectedRating === null) {
      Alert.alert('Error', 'Please select a rating.');
      return;
    }

    setSubmittingRating(true);

    try {
      // Optimistic update
      const previousRating = ratingInfo?.user_rating;
      const previousCount = ratingInfo?.rating_count || 0;
      const previousAvg = ratingInfo?.average_rating || 0;
      
      // Calculate new average optimistically
      let newAvg = previousAvg;
      let newCount = previousCount;
      
      if (previousRating == null) {
        // New rating
        newCount = previousCount + 1;
        newAvg = ((previousAvg * previousCount) + selectedRating) / newCount;
      } else {
        // Update existing rating
        newAvg = ((previousAvg * previousCount) - previousRating + selectedRating) / previousCount;
      }
      
      setRatingInfo({
        average_rating: Number(newAvg.toFixed(1)),
        rating_count: newCount,
        user_rating: selectedRating,
      });

      await submitCourtRating(courtId, user.id, selectedRating);
      await playSubmitBuzz();
      
      // Reload to ensure consistency
      await loadRatingInfo();
      
      // Hide picker after successful save
      setIsEditingRating(false);
      
      Alert.alert('Success', 'Your rating has been saved!', [{ text: 'OK', onPress: () => setShowRatingModal(false) }]);
    } catch (err) {
      // Revert optimistic update on error
      await loadRatingInfo();
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleStartEditing = () => {
    if (ratingInfo?.user_rating !== null && ratingInfo?.user_rating !== undefined) {
      setSelectedRating(ratingInfo.user_rating);
      setIsEditingRating(true);
    }
  };

  const handleCancelEditing = () => {
    setIsEditingRating(false);
    // Reset to saved rating
    if (ratingInfo?.user_rating !== null && ratingInfo?.user_rating !== undefined) {
      setSelectedRating(ratingInfo.user_rating);
    } else {
      setSelectedRating(null);
    }
  };

  const handleToggleCard = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCardExpanded(!isCardExpanded);
  };

  const handleCheckIn = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'You must be signed in to check in.');
      return;
    }

    if (!courtId) return;

    setCheckingIn(true);

    try {
      const result = await checkInCourt(courtId);
      
      if (result.success) {
        track('check_in_completed', { run_id: courtId });
        // Optimistic update
        setUserCheckIn(new Date().toISOString());
        setTodayCheckInCount(prev => prev + 1);
        
        // Reload check-in status and leaderboard to ensure consistency
        await Promise.all([
          loadCheckInStatus(),
          loadTodayCheckInCount(),
          loadLeaderboard(),
        ]);
        
        Alert.alert('Success', result.message || 'Checked in!');
      } else {
        Alert.alert('Check-In', result.message || 'Unable to check in.');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to check in.');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatCheckInTime = (dateString: string | null): string => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Build tags array (only if court is loaded)
  const tags: string[] = [];
  if (court) {
    if (court.indoor !== null && court.indoor !== undefined) {
      tags.push(court.indoor ? 'Indoor' : 'Outdoor');
    }
    if (court.cost) {
      tags.push(court.cost === 'Free' ? 'Free' : 'Paid');
    }
    if (court.has_lights) {
      tags.push('Lights');
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading court..." />;
  }

  if (error || !court) {
    return (
      <ErrorScreen
        message={error || 'Court not found.'}
        onRetry={() => loadCourt()}
        retryLabel="Retry"
      />
    );
  }

  const detailItemsCount = tags.length
    + (court.court_type ? 1 : 0)
    + (court.surface_type ? 1 : 0)
    + (court.hoop_count != null && court.hoop_count !== undefined ? 1 : 0)
    + (court.hours ? 1 : 0)
    + (court.parking_type ? 1 : 0)
    + (court.amenities?.length ?? 0);

  return (
    <KeyboardScreen
      ref={scrollRef}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="always"
      keyboardAvoiding={true}
      keyboardVerticalOffset={0}
    >
        <Header title={court.name} />
        
        {/* A) Enhanced Header Section */}
        <Pressable
          onPress={handleToggleCard}
          style={({ pressed }) => [
            styles.cardPressable,
            pressed && styles.cardPressablePressed,
          ]}
        >
          <Card style={styles.headerCard}>
            {/* Court thumbnail + Favorite star - Top Left */}
            <View style={styles.cardThumbnailColumn}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setShowPhotosModal(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [
                  styles.courtThumbnail,
                  { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                  pressed && styles.courtThumbnailPressed,
                ]}
              >
                {photos.length > 0 ? (
                  <>
                    <Image
                      source={{ uri: getPrimaryCourtPhoto(photos)!.url }}
                      style={styles.courtThumbnailImage}
                      contentFit="cover"
                    />
                    {photos.length > 1 && (
                      <View style={[styles.courtThumbnailBadge, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.courtThumbnailBadgeText, { color: colors.textMuted }]} numberOfLines={1}>
                          {photos.length}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <IconSymbol name="sportscourt.fill" size={24} color={colors.textMuted} />
                )}
              </Pressable>
              {user && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleToggleFollow();
                  }}
                  disabled={togglingFollow}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={({ pressed }) => [
                    styles.favoriteStar,
                    pressed && styles.favoriteStarPressed,
                  ]}
                >
                  <IconSymbol
                    name={isFollowing ? "star.fill" : "star"}
                    size={22}
                    color={GOLD}
                  />
                </Pressable>
              )}
            </View>

            {/* Main content */}
            <View style={styles.cardHeaderContent}>
              {/* 1. HEADER ZONE: Address */}
              {court.address && (
                <Pressable onPress={handleCopyAddress} onLongPress={handleOpenMaps} style={styles.addressPressableReorg}>
                  <IconSymbol name="location.fill" size={14} color={colors.textMuted} style={styles.addressIconReorg} />
                  <Text style={[styles.courtAddressReorg, { color: colors.textMuted }]} numberOfLines={1}>{court.address}</Text>
                </Pressable>
              )}

              {/* 2. META ROW: Rating · Check-ins today */}
              <View style={styles.metaRow}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowRatingModal(true);
                  }}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  style={styles.metaItem}
                >
                  <IconSymbol name="chart.bar" size={14} color={colors.textMuted} style={styles.metaIcon} />
                  <Text style={[styles.metaText, { color: colors.text }]} numberOfLines={1}>
                    {loadingRating ? 'Loading...' : ratingInfo && ratingInfo.rating_count > 0 
                      ? `${ratingInfo.average_rating.toFixed(1)} (${ratingInfo.rating_count})`
                      : 'No ratings'}
                  </Text>
                </Pressable>
                
                {todayCheckInCount > 0 && (
                  <>
                    <Text style={[styles.metaDivider, { color: colors.textMuted }]}>·</Text>
                    <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
                      {todayCheckInCount} {todayCheckInCount === 1 ? 'check-in' : 'check-ins'} today
                    </Text>
                  </>
                )}
              </View>

              {/* 3. SPORTS CHIPS (only sports visible when collapsed) */}
              {court.sports.length > 0 && (
                <View style={styles.chipsContainer}>
                  {court.sports.map((sport, index) => (
                    <View key={`sport-${index}`} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                      <Text style={[styles.chipText, { color: colors.text }]}>{sport}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 4. ACTIONS GRID */}
              <View style={styles.actionsGrid}>
                <ProfileNavPill
                  icon="map.fill"
                  label="Directions"
                  onPress={handleDirections}
                  style={styles.actionGridItem}
                />
                <ProfileNavPill
                  icon="square.and.arrow.up"
                  label="Share"
                  onPress={handleShare}
                  style={styles.actionGridItem}
                />
                <Pressable
                  onPress={() => {
                    if (!user) {
                      Alert.alert('Sign In Required', 'You must be signed in to share courts via DM.');
                      return;
                    }
                    router.push({ pathname: '/courts/send-dm', params: { courtId: courtId ?? '' } } as any);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Send via DM"
                  accessibilityRole="button"
                  style={[styles.actionGridItem, styles.dmIconButton, { borderColor: colors.border }]}
                >
                  <IconSymbol name="paperplane.fill" size={16} color={colors.textMuted} />
                </Pressable>
                {user && !userCheckIn && (
                  <ProfileNavPill
                    icon="checkmark.circle.fill"
                    label="Check In"
                    onPress={handleCheckIn}
                    loading={checkingIn}
                    disabled={checkingIn}
                    style={styles.actionGridItem}
                  />
                )}
                {user && userCheckIn && (
                  <View style={[styles.actionGridItem, styles.checkedInIndicator, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={GOLD} />
                    <Text style={[styles.checkedInText, { color: colors.text }]} numberOfLines={1}>
                      Checked in · {formatCheckInTime(userCheckIn)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Expand/Collapse for More Details */}
              <Pressable 
                onPress={(e) => {
                  e.stopPropagation();
                  handleToggleCard();
                }}
                style={styles.expandToggle}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.expandToggleText, { color: colors.primary }]}>
                  {isCardExpanded ? 'Show less' : `More details${detailItemsCount > 0 ? ` (+${detailItemsCount})` : ''}`}
                </Text>
                <IconSymbol
                  name={isCardExpanded ? "chevron.up" : "chevron.down"}
                  size={16}
                  color={colors.primary}
                />
              </Pressable>
            </View>

            {/* Expanded Content - Additional Details */}
            {isCardExpanded && (
              <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
                <View style={styles.quickFactsContainer}>
                  {/* Detail chips (tags, court type, surface, hoops) */}
                  {(tags.length > 0 || court.court_type || court.surface_type || (court.hoop_count != null && court.hoop_count !== undefined)) && (
                    <View style={[styles.chipsContainer, styles.detailChipsInExpand]}>
                      {tags.map((tag, index) => (
                        <View key={`detail-tag-${index}`} style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                          <Text style={[styles.chipText, { color: colors.text }]}>{tag}</Text>
                        </View>
                      ))}
                      {court.court_type && (
                        <View style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                          <Text style={[styles.chipText, { color: colors.text }]}>{court.court_type}</Text>
                        </View>
                      )}
                      {court.surface_type && (
                        <View style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                          <Text style={[styles.chipText, { color: colors.text }]}>{court.surface_type}</Text>
                        </View>
                      )}
                      {court.hoop_count != null && court.hoop_count !== undefined && (
                        <View style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                          <Text style={[styles.chipText, { color: colors.text }]}>{court.hoop_count} {court.hoop_count === 1 ? 'hoop' : 'hoops'}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Hours, Parking, Amenities */}
                  {court.hours && (
                    <View style={styles.expandedDetailRow}>
                      <View style={styles.expandedDetailLabel}>
                        <IconSymbol name="clock.fill" size={16} color={colors.primary} style={styles.expandedDetailIcon} />
                        <AppText variant="bodyBold" color="text">Hours</AppText>
                      </View>
                      <AppText variant="body" color="text" style={styles.expandedDetailValue}>{court.hours}</AppText>
                    </View>
                  )}
                  
                  {court.parking_type && (
                    <View style={styles.expandedDetailRow}>
                      <View style={styles.expandedDetailLabel}>
                        <IconSymbol name="car.fill" size={16} color={colors.primary} style={styles.expandedDetailIcon} />
                        <AppText variant="bodyBold" color="text">Parking</AppText>
                      </View>
                      <AppText variant="body" color="text" style={styles.expandedDetailValue}>{court.parking_type}</AppText>
                    </View>
                  )}

                  {court.amenities && court.amenities.length > 0 && (
                    <View style={styles.expandedDetailRow}>
                      <View style={styles.expandedDetailLabel}>
                        <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} style={styles.expandedDetailIcon} />
                        <AppText variant="bodyBold" color="text">Amenities</AppText>
                      </View>
                      <View style={styles.amenitiesWrap}>
                        {court.amenities.map((amenity, index) => (
                          <View key={index} style={[styles.amenityChipSmall, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                            <AppText variant="mutedSmall" color="text">{amenity}</AppText>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </Card>
        </Pressable>

        {/* Live Chat Hero Section (first under main card) */}
        <View style={StyleSheet.flatten([styles.sectionCard, styles.chatHeroSection, { marginBottom: SECTION_GAP }]) as ViewStyle}>
          <Card style={StyleSheet.flatten([styles.chatHeroCard, { backgroundColor: colors.surfaceElevated }]) as ViewStyle}>
            <View style={StyleSheet.flatten([styles.chatHeroHeader, { borderBottomColor: colors.border }]) as ViewStyle}>
              <Text style={[styles.chatHeroTitle, { color: colors.text }]}>Live Chat</Text>
            </View>
            <CourtChat
              courtId={courtId}
              messageLimit={15}
              emptyMessage="Be the first to message this court"
              containerStyle={StyleSheet.flatten([styles.chatHeroContainer, { borderWidth: 0 }]) as ViewStyle}
              showHeader={false}
              embeddedInScrollView
            />
          </Card>
        </View>

        {/* Leaderboard Section Card (hidden for beta when BETA_HIDE_LEADERBOARD) */}
        {!BETA_HIDE_LEADERBOARD && leaderboard.length > 0 && (
          <View style={[styles.sectionCard, { marginBottom: SECTION_GAP }]}>
            <Card>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Leaderboard</Text>
                <TouchableOpacity onPress={() => setShowLeaderboardModal(true)} hitSlop={8}>
                  <Text style={[styles.sectionAction, { color: colors.primary }]}>See all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.topThree}>
                {leaderboard.slice(0, 3).map((entry, index) => (
                  <View key={entry.user_id} style={[styles.leaderboardEntry, { borderBottomColor: colors.border }]}>
                    {index === 0 && (
                      <IconSymbol name="crown.fill" size={20} color={GOLD} style={styles.crownIcon} />
                    )}
                    <View style={styles.rankBadge}>
                      <AppText variant="bodyBold" color={index === 0 ? 'primary' : 'text'}>
                        #{entry.rank}
                      </AppText>
                    </View>
                    <View style={styles.leaderboardInfo}>
                      <AppText variant="bodyBold" color="text">
                        {entry.display_name || entry.username || 'Anonymous'}
                      </AppText>
                      <AppText variant="mutedSmall" color="textMuted">
                        {entry.total_check_ins} {entry.total_check_ins === 1 ? 'check-in' : 'check-ins'}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
              {leaderboard.length > 3 && (
                <Button
                  title="View Full Leaderboard"
                  onPress={() => setShowLeaderboardModal(true)}
                  variant="secondary"
                  size="medium"
                  style={styles.viewFullButton}
                />
              )}
            </Card>
          </View>
        )}

      {/* Leaderboard Modal (hidden for beta when BETA_HIDE_LEADERBOARD) */}
      {!BETA_HIDE_LEADERBOARD && (
      <Modal
        visible={showLeaderboardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLeaderboardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText variant="h2" color="text">Leaderboard</AppText>
              <TouchableOpacity onPress={() => setShowLeaderboardModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {loadingLeaderboard ? (
                <AppText variant="muted" color="textMuted" style={styles.modalLoadingText}>Loading...</AppText>
              ) : leaderboard.length === 0 ? (
                <AppText variant="muted" color="textMuted" style={styles.emptyText}>No check-ins yet</AppText>
              ) : (
                leaderboard.map((entry, index) => (
                  <View 
                    key={entry.user_id} 
                    style={[
                      styles.modalLeaderboardEntry,
                      { borderBottomColor: colors.border },
                      index === 0 && { backgroundColor: colors.surfaceAlt }
                    ]}
                  >
                    <View style={styles.modalRank}>
                      {index === 0 && (
                        <IconSymbol name="crown.fill" size={20} color={GOLD} style={styles.modalCrown} />
                      )}
                      <AppText variant="bodyBold" color={index === 0 ? 'primary' : 'text'}>
                        #{entry.rank}
                      </AppText>
                    </View>
                    <View style={styles.modalLeaderboardInfo}>
                      <AppText variant="bodyBold" color="text">
                        {entry.display_name || entry.username || 'Anonymous'}
                      </AppText>
                      <AppText variant="mutedSmall" color="textMuted">
                        {entry.total_check_ins} {entry.total_check_ins === 1 ? 'check-in' : 'check-ins'}
                      </AppText>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Card>
        </View>
      </Modal>
      )}

      {/* Photos See All Modal */}
      <Modal
        visible={showPhotosModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotosModal(false)}
      >
        <Pressable 
          style={styles.photosModalOverlay}
          onPress={() => setShowPhotosModal(false)}
        >
          <Pressable 
            style={[styles.photosModalContent, { 
              backgroundColor: colors.surface,
              maxHeight: Math.min(screenHeight * 0.75, 640),
            }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.photosModalHeader, { borderBottomColor: colors.border }]}>
              <AppText variant="h2" color="text">Photos</AppText>
              <TouchableOpacity onPress={() => setShowPhotosModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <CourtPhotoCarousel
              courtId={courtId}
              photos={photos}
              onPhotosChange={loadPhotos}
              variant="carousel"
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Court Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText variant="h2" color="text">Court Rating</AppText>
              <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {loadingRating ? (
              <AppText variant="muted" color="textMuted" style={styles.ratingLoadingText}>Loading...</AppText>
            ) : user ? (
              <>
                {ratingInfo?.user_rating !== null && ratingInfo?.user_rating !== undefined && !isEditingRating && (
                  <View style={styles.userRatingDisplay}>
                    <AppText variant="bodyBold" color="text">Your rating: </AppText>
                    <AppText variant="bodyBold" color="primary">{ratingInfo.user_rating}/10</AppText>
                    <TouchableOpacity onPress={handleStartEditing} style={styles.ratingCompactRateLink}>
                      <Text style={[styles.sectionAction, { color: colors.primary }]}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {(ratingInfo?.user_rating === null || ratingInfo?.user_rating === undefined || isEditingRating) && (
                  <View style={styles.ratingPicker}>
                    <AppText variant="body" color="text" style={styles.ratingPickerLabel}>
                      {isEditingRating ? 'Change your rating:' : 'Rate this court:'}
                    </AppText>
                    <View style={[styles.ratingButtons, { gap: 8 }]}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                        const isSelected = selectedRating === value;
                        return (
                          <TouchableOpacity
                            key={value}
                            activeOpacity={0.7}
                            style={[
                              styles.ratingButton,
                              {
                                width: ratingButtonSize,
                                height: ratingButtonSize,
                                backgroundColor: isSelected ? colors.primary : 'transparent',
                                borderColor: isSelected ? colors.primary : colors.border,
                              },
                            ]}
                            onPress={() => setSelectedRating(value)}
                            disabled={submittingRating}
                          >
                            <Text
                              style={[
                                styles.ratingButtonText,
                                {
                                  fontSize: ratingButtonFontSize,
                                  color: isSelected ? colors.textOnPrimary : colors.text,
                                },
                              ]}
                            >
                              {value}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {selectedRating !== null && selectedRating !== ratingInfo?.user_rating && (
                      <View style={styles.ratingActionButtons}>
                        <Button
                          title={isEditingRating ? "Save" : "Submit Rating"}
                          onPress={handleSubmitRating}
                          variant="primary"
                          loading={submittingRating}
                          disabled={submittingRating}
                          style={styles.submitRatingButton}
                        />
                        {isEditingRating && (
                          <Button
                            title="Cancel"
                            onPress={() => { handleCancelEditing(); setShowRatingModal(false); }}
                            variant="secondary"
                            disabled={submittingRating}
                            style={styles.cancelRatingButton}
                          />
                        )}
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : (
              <AppText variant="muted" color="textMuted" style={styles.signInPrompt}>
                Sign in to rate this court
              </AppText>
            )}
          </Card>
        </View>
      </Modal>

    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  errorTitle: {
    ...Typography.h3,
  },
  errorText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  cardPressable: {
    marginBottom: Spacing.xl,
  },
  cardPressablePressed: {
    opacity: 0.7,
  },
  headerCard: {
    marginBottom: 0,
    position: 'relative',
  },
  cardThumbnailColumn: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    zIndex: 1000,
    flexDirection: 'column',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  courtThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtThumbnailPressed: {
    opacity: 0.7,
  },
  courtThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  courtThumbnailBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  courtThumbnailBadgeText: {
    ...Typography.mutedSmall,
    fontSize: 10,
    fontWeight: '600',
  },
  favoriteStar: {
    padding: Spacing.xs,
  },
  favoriteStarPressed: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderContent: {
    flex: 1,
    paddingLeft: 56, // Space for thumbnail (48) + gap
  },
  courtName: {
    marginBottom: Spacing.xs,
  },
  addressPressableReorg: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  addressIconReorg: {
    marginRight: Spacing.xs,
  },
  courtAddressReorg: {
    ...Typography.mutedSmall,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    ...Typography.mutedSmall,
  },
  metaDivider: {
    ...Typography.mutedSmall,
    marginHorizontal: Spacing.xs,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  detailChipsInExpand: {
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  chipText: {
    ...Typography.mutedSmall,
    fontSize: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionGridItem: {
    flex: 1,
    minWidth: '46%',
  },
  dmIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 'auto',
    flex: 0,
  },
  checkedInIndicator: {
    flex: 1,
    minWidth: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  checkedInText: {
    ...Typography.mutedSmall,
    flex: 1,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  expandToggleText: {
    ...Typography.body,
    fontWeight: '600',
  },
  expandedDetailRow: {
    marginBottom: Spacing.md,
  },
  expandedDetailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  expandedDetailIcon: {
    marginRight: Spacing.xs,
  },
  expandedDetailValue: {
    marginLeft: Spacing.xl,
  },
  amenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginLeft: Spacing.xl,
    marginTop: Spacing.xs,
  },
  amenityChipSmall: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  addressPressable: {
    marginBottom: Spacing.xs,
  },
  chevronIcon: {
    marginLeft: Spacing.md,
    marginTop: Spacing.xs,
  },
  expandedContent: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  quickFactsContainer: {
    marginTop: 0,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  addressIcon: {
    marginRight: Spacing.sm,
  },
  courtAddress: {
    ...Typography.body,
    flex: 1,
  },
  copyIcon: {
    marginLeft: Spacing.sm,
  },
  addressHint: {
    ...Typography.mutedSmall,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xl,
  },
  mainCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  mainCardRatingIcon: {
    marginRight: 0,
  },
  mainCardRatingText: {
    ...Typography.body,
    flex: 1,
    flexShrink: 1,
  },
  mainCardRateLink: {
    ...Typography.body,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  tagText: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.lg,
  },
  sportsLabel: {
    ...Typography.muted,
  },
  sportsText: {
    ...Typography.body,
  },
  actionPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionPillGap: {
    width: Spacing.sm,
  },
  directionsPill: {
    flex: 2,
    minWidth: 0,
  },
  sharePill: {
    flex: 1,
    minWidth: 0,
  },
  checkInPill: {
    alignSelf: 'stretch',
    minHeight: 44,
  },
  checkInRow: {
    marginTop: Spacing.md,
  },
  checkInStatusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  checkInIconInline: {
    marginRight: Spacing.xs,
  },
  checkInTimeInline: {
    marginLeft: 'auto',
  },
  checkInCountInline: {
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionCard: {},
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
  },
  sectionAction: {
    ...Typography.body,
    fontWeight: '600',
  },
  chatHeroSection: {},
  chatHeroCard: {
    padding: 0,
    overflow: 'hidden',
  },
  chatHeroHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  chatHeroTitle: {
    ...Typography.h2,
  },
  chatHeroContainer: {
    minHeight: 480,
  },
  ratingCompactCard: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  ratingCompactSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ratingSummaryIcon: {
    marginRight: Spacing.xs,
  },
  ratingCompactSummaryText: {
    ...Typography.body,
    flex: 1,
  },
  ratingCompactRateLink: {
    marginLeft: 'auto',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  ratingBreakdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  ratingBreakdownToggleText: {
    ...Typography.body,
    fontWeight: '600',
  },
  ratingBreakdownContent: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  factCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: Spacing.md,
  },
  factIcon: {
    marginBottom: Spacing.xs,
  },
  factLabel: {
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  amenitiesSubsection: {
    marginTop: Spacing.md,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  amenityIcon: {
    marginRight: Spacing.xs,
  },
  noAmenitiesText: {
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  topThree: {
    marginBottom: Spacing.md,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  crownIcon: {
    marginRight: Spacing.xs,
  },
  rankBadge: {
    width: 40,
    alignItems: 'center',
  },
  leaderboardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  viewFullButton: {
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  photosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  photosModalContent: {
    width: '100%',
    maxWidth: 520,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  photosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  modalList: {
    maxHeight: 400,
  },
  modalLeaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalRank: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  modalCrown: {
    marginRight: Spacing.xs,
  },
  modalLeaderboardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  modalLoadingText: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  ratingStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  ratingStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  ratingStatDivider: {
    width: 1,
    height: 40,
    marginHorizontal: Spacing.md,
  },
  ratingValue: {
    marginBottom: Spacing.xs,
  },
  noRatingsText: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  userRatingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  ratingPicker: {
    marginTop: Spacing.sm,
  },
  ratingPickerLabel: {
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  ratingButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  ratingLoadingText: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  ratingButton: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingButtonText: {
    ...Typography.bodyBold,
  },
  ratingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  editButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  ratingActionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  submitRatingButton: {
    flex: 1,
  },
  cancelRatingButton: {
    flex: 1,
  },
  signInPrompt: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  ratingSectionLoadingText: {
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  ratingLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
});
