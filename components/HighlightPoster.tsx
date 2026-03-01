import { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Spacing } from '@/constants/theme';

type HighlightPosterProps = {
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  mediaType: string;
  style?: object;
};

export function HighlightPoster({
  thumbnailUrl,
  mediaUrl,
  mediaType,
  style,
}: HighlightPosterProps) {
  const { colors } = useThemeColors();
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  const uri = thumbnailUrl || mediaUrl;
  const isVideo = mediaType === 'video';

  useEffect(() => {
    if (uri) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [uri, pulseAnim]);

  return (
    <View style={[styles.wrap, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.media, { backgroundColor: colors.surfaceAlt }]}
          resizeMode="cover"
        />
      ) : (
        <Animated.View
          style={[
            styles.skeleton,
            {
              backgroundColor: colors.surfaceAlt,
              opacity: pulseAnim,
            },
          ]}
        />
      )}
      <View style={styles.playOverlay} pointerEvents="none">
        <IconSymbol
          name="play.rectangle.fill"
          size={isVideo ? 48 : 40}
          color="rgba(255,255,255,0.85)"
        />
      </View>
      {isVideo && uri ? (
        <View style={styles.videoBadge}>
          <IconSymbol name="play.rectangle.fill" size={14} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    maxHeight: 360,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  skeleton: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  playOverlay: {
    position: 'absolute',
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
