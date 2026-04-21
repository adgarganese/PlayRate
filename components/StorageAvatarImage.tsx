import { useEffect, useState, useRef, type ReactNode } from 'react';
import type { StyleProp, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';

type StorageAvatarImageProps = {
  uriRaw: string;
  style: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill';
  accessibilityLabel?: string;
  fallback: ReactNode;
};

/**
 * Avatar-sized image: resolves Supabase storage URLs (host swap + signed URL) for expo-image.
 */
export function StorageAvatarImage({
  uriRaw,
  style,
  contentFit = 'cover',
  accessibilityLabel,
  fallback,
}: StorageAvatarImageProps) {
  const uri = useResolvedMediaUri(uriRaw);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setFailed(false);
  }, [uriRaw]);

  if (!uri || failed) {
    return <>{fallback}</>;
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      onError={() => {
        if (mountedRef.current) setFailed(true);
      }}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
