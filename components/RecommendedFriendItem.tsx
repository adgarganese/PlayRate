import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { ListItem } from './ui/ListItem';
import { ProfilePicture } from './ProfilePicture';
import { Button } from './ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { hapticLight } from '@/lib/haptics';

type RecommendedFriendItemProps = {
  userId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  subtitle?: string;
  onPress: () => void;
};

export function RecommendedFriendItem({
  userId,
  name,
  username,
  avatarUrl,
  subtitle = 'Suggested',
  onPress,
}: RecommendedFriendItemProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFollow = useCallback(async () => {
    if (!user || loading) return;

    const wasFollowing = isFollowing;
    hapticLight();
    // Optimistic update
    setIsFollowing(!wasFollowing);
    setLoading(true);

    try {
      if (wasFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (error) throw error;
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: userId,
          });

        if (error) {
          // Handle duplicate key error (already following)
          if (error.code === '23505') {
            setIsFollowing(true);
            return;
          }
          throw error;
        }
      }
    } catch (error) {
      if (__DEV__) console.warn('[RecommendedFriendItem:toggleFollow]', error);
      setIsFollowing(wasFollowing);
      Alert.alert('Error', 'Unable to update follow status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, userId, isFollowing, loading]);

  return (
    <ListItem
      title={name || 'Unknown'}
      subtitle={`@${username || 'user'} • ${subtitle}`}
      showChevron
      onPress={onPress}
      leftContent={
        <ProfilePicture
          avatarUrl={avatarUrl}
          size={44}
          editable={false}
        />
      }
      rightContent={
        <Button
          title={isFollowing ? 'Following' : 'Follow'}
          onPress={handleFollow}
          variant={isFollowing ? 'secondary' : 'primary'}
          size="small"
          loading={loading}
          disabled={loading}
        />
      }
    />
  );
}
