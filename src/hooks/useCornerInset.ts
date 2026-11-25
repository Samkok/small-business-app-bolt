import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Space to keep clear on the right for the status pill (camera, clock, signal).
 *
 * iPhone Duo puts that pill in the top-right corner of both screens and reports it as a right
 * safe-area inset (84 pt). Regular iPhones report 0 in portrait, so this changes nothing there.
 * Screens get it as right padding from the navigators; the tab bar ignores it because the pill
 * never reaches the bottom of the screen.
 */
export function useCornerInset(): number {
  return useSafeAreaInsets().right;
}
