import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/Button';
import { ProfileNavPill } from '@/components/ProfileNavPill';
import { getOrCreateConversation } from '@/lib/dms';
import type { ViewStyle } from 'react-native';

type MessageButtonProps = {
  targetUserId: string;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  /** When true, renders as a pill (icon + label, same style as ProfileNavPill / court action pills) */
  pill?: boolean;
};

/**
 * Starts or opens a 1:1 conversation with targetUserId and navigates to the chat screen.
 * Use on other users' profiles only (not on own profile).
 */
export function MessageButton({
  targetUserId,
  variant = 'primary',
  size = 'medium',
  style,
  pill = false,
}: MessageButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePress = useCallback(async () => {
    if (!user?.id || !targetUserId || user.id === targetUserId) return;
    setLoading(true);
    try {
      const conversationId = await getOrCreateConversation(user.id, targetUserId);
      router.push(`/chat/${conversationId}`);
    } catch (e) {
      if (__DEV__) console.error('Open conversation:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, targetUserId, router]);

  if (!user || user.id === targetUserId) return null;

  if (pill) {
    return (
      <ProfileNavPill
        icon="message.fill"
        label="Message"
        onPress={handlePress}
        loading={loading}
        disabled={loading}
        showChevron={false}
        style={style}
      />
    );
  }

  return (
    <Button
      title="Message"
      onPress={handlePress}
      variant={variant}
      size={size}
      loading={loading}
      disabled={loading}
      style={style}
    />
  );
}
