import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { Image } from 'expo-image';
import { useThemeColors } from '@/contexts/theme-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Spacing } from '@/constants/theme';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import { pickHighlightStillImageRaw } from '@/lib/highlight-still';

/** Square (non-feed) poster max height so grid/athlete layouts stay bounded. */
const POSTER_SQUARE_MAX_HEIGHT_PX = 360;
const POSTER_IMAGE_TRANSITION_MS = 120;
const SKELETON_PULSE_MS = 800;

const VIDEO_FALLBACK_BG = '#0B0F1A';

type HighlightPosterProps = {
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  mediaType: string;
  /** Shown on video-without-thumbnail fallback (first lines). */
  caption?: string | null;
  style?: object;
  /** Fills parent (feed/detail cards). Omit for square preview tiles. */
  fillContainer?: boolean;
};

export function HighlightPoster({
  thumbnailUrl,
  mediaUrl,
  mediaType,
  caption,
  style,
  fillContainer = false,
}: HighlightPosterProps) {
  const { colors } = useThemeColors();
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const [mediaLoadFailed, setMediaLoadFailed] = useState(false);

  const stillRaw = useMemo(
    () => pickHighlightStillImageRaw(thumbnailUrl, mediaUrl, mediaType),
    [thumbnailUrl, mediaUrl, mediaType]
  );
  const displayUri = useResolvedMediaUri(stillRaw);
  const isVideo = mediaType === 'video';

  useEffect(() => {
    setMediaLoadFailed(false);
  }, [stillRaw]);

  useEffect(() => {
    if (displayUri) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: SKELETON_PULSE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: SKELETON_PULSE_MS,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [displayUri, pulseAnim]);

  const wrapStyle = fillContainer ? styles.wrapFill : styles.wrapSquare;

  const showStillImage = Boolean(displayUri) && !mediaLoadFailed;
  const showBrokenStill = Boolean(displayUri) && mediaLoadFailed;
  const showVideoNoStill = isVideo && !showStillImage;
  const showImageSkeleton = !isVideo && !displayUri && !showBrokenStill;

  return (
    <View style={[wrapStyle, style]}>
      {showStillImage && displayUri ? (
        <Image
          source={{ uri: displayUri }}
          style={styles.media}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={POSTER_IMAGE_TRANSITION_MS}
          recyclingKey={displayUri}
          onError={() => setMediaLoadFailed(true)}
          accessibilityLabel={isVideo ? 'Video thumbnail' : 'Highlight image'}
        />
      ) : showBrokenStill ? (
        <View
          style={[styles.media, styles.errorFallback, { backgroundColor: VIDEO_FALLBACK_BG }]}
          accessibilityLabel="Image unavailable"
        >
          <IconSymbol name={isVideo ? 'play.rectangle.fill' : 'photo'} size={40} color="rgba(255,255,255,0.75)" />
        </View>
      ) : showVideoNoStill ? (
        <View
          style={[styles.media, styles.videoNoThumbFallback]}
          accessibilityLabel="Video highlight"
        >
          <IconSymbol name="play.rectangle.fill" size={52} color="rgba(255,255,255,0.9)" />
          {caption?.trim() ? (
            <Text style={styles.videoNoThumbCaption} numberOfLines={2}>
              {caption.trim()}
            </Text>
          ) : null}
        </View>
      ) : showImageSkeleton ? (
        <Animated.View
          style={[
            styles.skeleton,
            {
              backgroundColor: colors.surfaceAlt,
              opacity: pulseAnim,
            },
          ]}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}
      {!showVideoNoStill ? (
        <View
          style={styles.playOverlay}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <IconSymbol
            name="play.rectangle.fill"
            size={isVideo ? 48 : 40}
            color="rgba(255,255,255,0.85)"
          />
        </View>
      ) : null}
      {isVideo && showStillImage ? (
        <View
          style={styles.videoBadge}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <IconSymbol name="play.rectangle.fill" size={14} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapSquare: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    maxHeight: POSTER_SQUARE_MAX_HEIGHT_PX,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrapFill: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  media: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  errorFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoNoThumbFallback: {
    backgroundColor: VIDEO_FALLBACK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  videoNoThumbCaption: {
    marginTop: Spacing.sm,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  skeleton: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    padding: 4,
  },
});
