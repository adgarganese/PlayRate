import React from 'react';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Tab bar button with haptics. Forwards ref and passes onPress/children so navigation
 * always fires. Must render children so the tab bar icon/label are inside the pressable.
 */
export const HapticTab = React.forwardRef<React.ComponentRef<typeof Pressable>, BottomTabBarButtonProps>(
  function HapticTab(props, ref) {
    const { onPress, onPressIn, children, style, ...rest } = props;
    return (
      <Pressable
        ref={ref}
        {...rest}
        style={style}
        onPress={onPress}
        onPressIn={(ev) => {
          if (process.env.EXPO_OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPressIn?.(ev);
        }}
      >
        {children}
      </Pressable>
    );
  }
);
