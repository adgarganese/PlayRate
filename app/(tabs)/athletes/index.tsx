import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import Profiles from '@/components/profiles';

export default function AthletesTabScreen() {
  useFocusEffect(
    useCallback(() => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, [])
  );
  return <Profiles />;
}
