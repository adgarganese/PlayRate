/**
 * REINTRODUCTION STEP 5: Real Athletes screen. Haptic on tab focus (iOS) restored.
 */
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import { Platform } from 'react-native';
import Profiles from '@/components/profiles';

export default function AthletesTabScreen() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, [])
  );
  return <Profiles />;
}
