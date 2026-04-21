import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { VideoView, useVideoPlayer, type VideoContentFit } from 'expo-video';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hapticLight } from '@/lib/haptics';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';

type HighlightDetailVideoProps = {
  uri: string;
  posterUri: string | null;
  contentFit: VideoContentFit;
  /** When false (e.g. screen blurred), pause; when true, resume. Default true. */
  isActive?: boolean;
};

/**
 * Highlight detail playback: starts muted, tap corner control to unmute/mute.
 * Native controls remain for scrub / pause.
 */
export function HighlightDetailVideo({
  uri,
  posterUri,
  contentFit,
  isActive = true,
}: HighlightDetailVideoProps) {
  const resolvedPosterUri = useResolvedMediaUri(posterUri);
  const [muted, setMuted] = useState(true);
  const [showPoster, setShowPoster] = useState(!!posterUri?.trim());
  useEffect(() => {
    setShowPoster(!!posterUri?.trim());
  }, [posterUri]);
  const player = useVideoPlayer({ uri }, (p) => {
    try {
      p.loop = true;
      p.muted = true;
      p.play();
    } catch {
      /* NativeSharedObjectNotFoundException if native object torn down */
    }
  });

  useEffect(() => {
    try {
      player.loop = true;
      player.play();
    } catch {
      /* */
    }
  }, [player]);

  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      /* */
    }
  }, [muted, player]);

  useEffect(() => {
    if (!isActive) {
      try {
        player.pause();
      } catch {
        /* */
      }
    } else {
      try {
        player.play();
      } catch {
        /* */
      }
    }
  }, [isActive, player]);

  const toggleMute = () => {
    hapticLight();
    setMuted((m) => !m);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {resolvedPosterUri && showPoster ? (
        <Image
          source={{ uri: resolvedPosterUri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
        />
      ) : null}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        nativeControls
        onFirstFrameRender={() => setShowPoster(false)}
      />
      <TouchableOpacity
        onPress={toggleMute}
        style={styles.muteButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
      >
        <IconSymbol
          name={muted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'}
          size={18}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  muteButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
