import { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { IconSymbol } from './ui/icon-symbol';

/** Storage bucket for profile pictures. Must exist in Supabase (Storage). If you see "Bucket not found", create it in the dashboard.
 * Test plan (iPhone TestFlight): Profile → tap avatar → choose photo → upload succeeds or shows clear bucket-message. */
const AVATAR_BUCKET = 'avatars';

type ProfilePictureProps = {
  avatarUrl: string | null;
  size?: number;
  editable?: boolean;
  onUpdate?: (newUrl: string | null) => void;
};

export function ProfilePicture({
  avatarUrl,
  size = 64,
  editable = false,
  onUpdate,
}: ProfilePictureProps) {
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [uploading, setUploading] = useState(false);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photos to set a profile picture.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    if (!editable || !user) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const imageUri = result.assets[0].uri;
      await uploadImage(imageUri);
    } catch (error) {
      if (__DEV__) console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;

    setUploading(true);
    try {
      // Path: avatars/{userId}/{timestamp}.ext for consistent RLS (e.g. allow user to upload to avatars/{userId}/*)
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = (uri.split('.').pop() || 'jpg').toLowerCase();
      const contentType = fileExt === 'jpg' ? 'image/jpeg' : `image/${fileExt}`;
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(fileName, blob, { contentType, upsert: true });

      if (uploadError) {
        if (__DEV__) console.warn('[ProfilePicture] storage error', uploadError.message, uploadError.name, (uploadError as { code?: string }).code);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(fileName);

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) {
        // If avatar_url column doesn't exist, provide helpful error
        if (updateError.message?.includes('avatar_url') || updateError.message?.includes('column')) {
          throw new Error('Profile picture feature requires database update. Please contact support.');
        }
        throw updateError;
      }

      // Call onUpdate callback if provided
      if (onUpdate) {
        onUpdate(publicUrl);
      }
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (__DEV__) console.warn('[ProfilePicture] upload error', err?.message, err?.code);
      const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message?: string }).message) : '';
      const isBucketNotFound = /bucket.*not found|not found|Object not found/i.test(msg);
      const message = isBucketNotFound
        ? `Storage bucket "${AVATAR_BUCKET}" doesn't exist. Create it in Supabase (Storage) and ensure RLS allows authenticated uploads to avatars/{user_id}/*.`
        : (error instanceof Error ? error.message : 'Failed to upload image. Please try again.');
      Alert.alert('Upload Failed', message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    if (!user || !avatarUrl) return;

    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUploading(true);
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('user_id', user.id);

              if (error) {
                if (error.message?.includes('avatar_url') || error.message?.includes('column')) {
                  Alert.alert('Error', 'Profile picture feature requires database update. Please contact support.');
                } else {
                  throw error;
                }
                return;
              }

              if (onUpdate) {
                onUpdate(null);
              }
            } catch (error: unknown) {
              if (__DEV__) console.error('Error removing profile picture:', error);
              const message = error instanceof Error ? error.message : 'Failed to remove profile picture.';
              Alert.alert('Error', message);
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const content = (
    <View style={[styles.container, containerStyle]}>
      {uploading ? (
        <View style={[styles.placeholder, containerStyle]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, containerStyle]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.placeholder, containerStyle]}>
          <IconSymbol
            name="person.fill"
            size={size * 0.5}
            color={colors.textMuted}
          />
        </View>
      )}
      {editable && !uploading && (
        <View style={[styles.editBadge, { width: size * 0.35, height: size * 0.35 }]}>
          <IconSymbol
            name="camera.fill"
            size={size * 0.2}
            color={colors.surface}
          />
        </View>
      )}
    </View>
  );

  if (editable) {
    return (
      <Pressable
        onPress={pickImage}
        onLongPress={avatarUrl ? removeImage : undefined}
        disabled={uploading}
        style={({ pressed }) => [
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
