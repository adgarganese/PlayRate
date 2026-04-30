import { type ReactNode } from 'react';
import { Keyboard, Pressable, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * When true (default), Pressable uses flex:1 so it fills the parent.
   * Set false for shrink-wrapped content (e.g. modal cards).
   */
  expand?: boolean;
};

/**
 * Dismisses the keyboard when the user taps on blank space inside this wrapper.
 * Uses Pressable with accessible={false} so it doesn't interfere with screen readers
 * or with nested touchables (button taps still work — Pressable only fires when no
 * child handles the event).
 */
export function DismissKeyboardView({ children, style, expand = true }: Props) {
  return (
    <Pressable
      accessible={false}
      onPress={Keyboard.dismiss}
      style={[expand && { flex: 1 }, style]}
    >
      {children}
    </Pressable>
  );
}
