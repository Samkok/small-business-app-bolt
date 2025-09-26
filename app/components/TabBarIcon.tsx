import { type IconProps } from '@expo/vector-icons/build/createIconSet';
import { type ComponentProps } from 'react';
import { FontAwesome } from '@expo/vector-icons';

export default function TabBarIcon({
  style,
  ...rest
}: IconProps<ComponentProps<typeof FontAwesome>['name']>) {
  return <FontAwesome size={28} style={[{ marginBottom: -3 }, style]} {...rest} />;
}
