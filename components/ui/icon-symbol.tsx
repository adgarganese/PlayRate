// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'person.fill': 'person',
  'person.badge.plus.fill': 'person-add',
  'person.2.fill': 'people',
  'person.2': 'people-outline',
  'person.3.fill': 'people',
  'person.circle.fill': 'account-circle',
  'sportscourt.fill': 'sports-basketball',
  'play.rectangle.fill': 'play-circle-filled',
  /** Small play badge (e.g. highlight tiles); Material equivalent */
  'play.fill': 'play-arrow',
  /** FAB / toolbar plus */
  plus: 'add',
  'plus.circle.fill': 'add-circle',
  'arrow.right.square.fill': 'logout',
  'figure.run': 'directions-run',
  'star.fill': 'star',
  'star': 'star-border',
  'heart.fill': 'favorite',
  'info.circle.fill': 'info',
  'bell.fill': 'notifications',
  'envelope.fill': 'mail',
  'pencil': 'edit',
  'camera.fill': 'camera-alt',
  'magnifyingglass': 'search',
  'xmark.circle.fill': 'cancel',
  'trash.fill': 'delete',
  'map.fill': 'directions',
  'square.and.arrow.up': 'share',
  'arrow.2.squarepath': 'repeat',
  'checkmark.circle.fill': 'check-circle',
  'location.fill': 'place',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
  'chart.bar': 'bar-chart',
  'medal.fill': 'emoji-events',
  'message.fill': 'chat-bubble',
  'bubble.left.fill': 'chat-bubble',
  'bubble.left.and.bubble.right.fill': 'forum',
  'mappin.and.ellipse': 'place',
  /** Map view (Courts finder); Material `map` ≈ outline map icon */
  map: 'map',
  'exclamationmark.triangle.fill': 'warning',
  'eye.fill': 'visibility',
  'eye.slash.fill': 'visibility-off',
  'speaker.slash.fill': 'volume-off',
  'speaker.wave.2.fill': 'volume-up',
  'gearshape.fill': 'settings',
  photo: 'image',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
