import type { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const MS_PER_INDEX = 50;
const ENTER_DURATION = 400;

type AnimatedListItemProps = {
  children: ReactNode;
  index: number;
  /** Extra delay (ms) before stagger; stagger adds `index * 50` ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedListItem({
  children,
  index,
  delay = 0,
  style,
}: AnimatedListItemProps) {
  const entering = FadeInDown.duration(ENTER_DURATION)
    .delay(delay + index * MS_PER_INDEX)
    .springify()
    .withInitialValues({
      opacity: 0,
      transform: [{ translateY: 12 }],
    });

  return (
    <Animated.View style={style} entering={entering}>
      {children}
    </Animated.View>
  );
}
