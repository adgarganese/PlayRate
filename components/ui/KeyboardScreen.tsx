import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, KeyboardAvoidingView, ScrollView, View, ViewStyle } from 'react-native';
import type { ScrollView as ScrollViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';
import { DismissKeyboardView } from '@/components/ui/DismissKeyboardView';

type KeyboardScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  paddingHorizontal?: number;
  keyboardVerticalOffset?: number;
  /** Use "always" when screen has inputs inside nested scroll (e.g. chat) so taps focus the input */
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /** When false, skip KeyboardAvoidingView (e.g. when a child like Court Chat handles its own keyboard to avoid double avoidance + blank space) */
  keyboardAvoiding?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export const KeyboardScreen = React.forwardRef<ScrollViewType, KeyboardScreenProps>(function KeyboardScreen({
  children,
  style,
  contentContainerStyle,
  paddingHorizontal = Spacing.lg,
  keyboardVerticalOffset,
  keyboardShouldPersistTaps = 'handled',
  keyboardAvoiding = true,
  onScroll,
}, ref) {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding('default');

  // Use 0 by default: KeyboardScreen is used full-screen with custom Header inside the scroll,
  // so there is no native header above the KAV. Pass explicit offset only when the KAV sits below a native header.
  const effectiveOffset = keyboardVerticalOffset ?? 0;

  const scrollView = (
    <ScrollView
      ref={ref}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[
        {
          flexGrow: 1,
          paddingHorizontal,
        },
        contentContainerStyle,
        { paddingBottom: scrollBottomPadding },
      ]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      {...(Platform.OS === 'ios' && { contentInsetAdjustmentBehavior: 'never' as const })}
    >
      <DismissKeyboardView>{children}</DismissKeyboardView>
    </ScrollView>
  );

  const containerStyle = [
    {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: insets.top,
    },
    style,
  ];

  if (!keyboardAvoiding) {
    return <View pointerEvents="box-none" style={containerStyle}>{scrollView}</View>;
  }

  return (
    <KeyboardAvoidingView
      pointerEvents="box-none"
      style={containerStyle}
      behavior={Platform.OS === 'ios' ? 'position' : 'height'}
      keyboardVerticalOffset={effectiveOffset}
    >
      {scrollView}
    </KeyboardAvoidingView>
  );
});
