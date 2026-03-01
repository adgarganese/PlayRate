import { useState, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Modal, Pressable, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius } from '@/constants/theme';
import { IconSymbol } from './ui/icon-symbol';
import { AppText } from './ui/AppText';
import { uploadCourtPhoto, deleteCourtPhoto, type CourtPhoto } from '@/lib/courts';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
/** Carousel slide width with horizontal breathing room */
const PHOTO_WIDTH = SCREEN_WIDTH - (Spacing.lg * 2);
/** Max height for carousel slides: sized to fit phone screens comfortably */
const CAROUSEL_MAX_HEIGHT = Math.min(320, Math.round(SCREEN_HEIGHT * 0.5));
const STRIP_THUMB_SIZE = 72;
const STRIP_GAP = Spacing.sm;

type CourtPhotoCarouselProps = {
  courtId: string;
  photos: CourtPhoto[];
  onPhotosChange: () => void;
  /** 'carousel' = full-width paging; 'strip' = horizontal thumbnail strip */
  variant?: 'carousel' | 'strip';
};

export function CourtPhotoCarousel({ courtId, photos, onPhotosChange, variant = 'carousel' }: CourtPhotoCarouselProps) {
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const slots: { slot: number; photo: CourtPhoto | null }[] = Array.from(
    { length: 4 },
    (_, i) => ({ slot: i + 1, photo: photos.find((p) => p.slot === i + 1) ?? null })
  );

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photos to add court photos.'
      );
      return false;
    }
    return true;
  };

  const pickAndUploadImage = async (slot: number) => {
    if (!user) {
      Alert.alert('Sign In Required', 'You must be signed in to add photos.');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setUploadingSlot(slot);
      await uploadCourtPhoto(courtId, user.id, slot, result.assets[0].uri);
      onPhotosChange();
    } catch (error: any) {
      if (__DEV__) console.error('Error uploading photo:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleDeletePhoto = async (slot: number, photo: CourtPhoto) => {
    if (!user) return;

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingSlot(slot);
              await deleteCourtPhoto(courtId, slot, user.id);
              onPhotosChange();
            } catch (error: unknown) {
              if (__DEV__) console.error('Error deleting photo:', error);
              const message = error instanceof Error ? error.message : 'Failed to delete photo.';
              Alert.alert('Error', message);
            } finally {
              setUploadingSlot(null);
            }
          },
        },
      ]
    );
  };

  const renderPhotoSlot = ({ item }: { item: { slot: number; photo: CourtPhoto | null } }) => {
    const { slot, photo } = item;
    const isUploading = uploadingSlot === slot;
    const canEdit = user !== null;
    const isStrip = variant === 'strip';

    const containerStyle = isStrip
      ? [styles.stripThumbContainer, { width: STRIP_THUMB_SIZE, height: STRIP_THUMB_SIZE, marginRight: STRIP_GAP }]
      : [styles.photoContainer, { width: PHOTO_WIDTH, height: CAROUSEL_MAX_HEIGHT }];

    return (
      <View style={containerStyle}>
        {isUploading ? (
          <View style={[styles.photoPlaceholder, { backgroundColor: colors.surfaceAlt }, isStrip && styles.stripPlaceholder]}>
            <ActivityIndicator size={isStrip ? 'small' : 'large'} color={colors.primary} />
            {!isStrip && (
              <AppText variant="muted" color="textMuted" style={styles.uploadingText}>
                Uploading...
              </AppText>
            )}
          </View>
        ) : photo ? (
          <View style={[styles.photoWrapper, isStrip && styles.stripWrapper]}>
            <TouchableOpacity
              onPress={() => setFullScreenPhoto(photo.url || '')}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: photo.url }}
                style={[styles.photo, isStrip && styles.stripPhoto]}
                contentFit={isStrip ? 'cover' : 'contain'}
              />
            </TouchableOpacity>
            {canEdit && !isStrip && (
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surface }]}
                  onPress={() => pickAndUploadImage(slot)}
                >
                  <IconSymbol name="pencil" size={16} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surface }]}
                  onPress={() => handleDeletePhoto(slot, photo)}
                >
                  <IconSymbol name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.photoPlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, isStrip && styles.stripPlaceholder]}
            onPress={() => canEdit && pickAndUploadImage(slot)}
            disabled={!canEdit || isUploading}
          >
            {canEdit ? (
              <>
                <IconSymbol name="camera.fill" size={isStrip ? 24 : 32} color={colors.textMuted} />
                {!isStrip && (
                  <AppText variant="muted" color="textMuted" style={styles.addPhotoText}>
                    Add Photo
                  </AppText>
                )}
              </>
            ) : (
              !isStrip && (
                <AppText variant="muted" color="textMuted" style={styles.addPhotoText}>
                  No photo
                </AppText>
              )
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (variant === 'strip') {
    return (
      <>
        <FlatList
          ref={flatListRef}
          data={slots}
          renderItem={renderPhotoSlot}
          keyExtractor={(item) => `slot-${item.slot}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripList}
        />
        <Modal
          visible={fullScreenPhoto !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setFullScreenPhoto(null)}
        >
          <Pressable
            style={styles.fullScreenContainer}
            onPress={() => setFullScreenPhoto(null)}
          >
            {fullScreenPhoto && (
              <View style={styles.fullScreenPhotoWrapper}>
                <Image
                  source={{ uri: fullScreenPhoto }}
                  style={styles.fullScreenPhoto}
                  contentFit="contain"
                />
              </View>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setFullScreenPhoto(null)}
            >
              <IconSymbol name="xmark.circle.fill" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <>
      <FlatList
        ref={flatListRef}
        data={slots}
        renderItem={renderPhotoSlot}
        keyExtractor={(item) => `slot-${item.slot}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={PHOTO_WIDTH + Spacing.md}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
      />

      {/* Full-screen photo viewer */}
      <Modal
        visible={fullScreenPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenPhoto(null)}
      >
        <Pressable
          style={styles.fullScreenContainer}
          onPress={() => setFullScreenPhoto(null)}
        >
          {fullScreenPhoto && (
            <View style={styles.fullScreenPhotoWrapper}>
              <Image
                source={{ uri: fullScreenPhoto }}
                style={styles.fullScreenPhoto}
                contentFit="contain"
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setFullScreenPhoto(null)}
          >
            <IconSymbol name="xmark.circle.fill" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  carousel: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  stripList: {
    paddingRight: Spacing.md,
  },
  photoContainer: {
    marginRight: Spacing.md,
  },
  stripThumbContainer: {},
  stripPlaceholder: {
    minHeight: STRIP_THUMB_SIZE,
    minWidth: STRIP_THUMB_SIZE,
  },
  photoWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    padding: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stripWrapper: {
    width: STRIP_THUMB_SIZE,
    height: STRIP_THUMB_SIZE,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
  },
  stripPhoto: {
    width: STRIP_THUMB_SIZE,
    height: STRIP_THUMB_SIZE,
    borderRadius: Radius.sm,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  photoActions: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addPhotoText: {
    marginTop: Spacing.xs,
  },
  uploadingText: {
    marginTop: Spacing.sm,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenPhotoWrapper: {
    flex: 1,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.5,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenPhoto: {
    width: '80%',
    height: '80%',
    maxWidth: (SCREEN_WIDTH - Spacing.lg * 2) * 0.8,
    maxHeight: SCREEN_HEIGHT * 0.5 * 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.xl,
  },
});
