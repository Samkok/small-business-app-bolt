import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fires once the sheet has fully slid out and unmounted; safe to open another modal here. */
  onDismissed?: () => void;
  /** Rendered at the top of the sheet; dragging it down dismisses the sheet. */
  header?: React.ReactNode;
  children: React.ReactNode;
  backgroundColor: string;
  /** Sheet height as a percentage of the screen (default: content height, max 92%). */
  heightPercent?: number;
  contentStyle?: ViewStyle;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6;

/**
 * Modal bottom sheet with a backdrop that fades in place while only the sheet
 * slides. Dismiss by tapping the backdrop or dragging the header down.
 */
export function BottomSheet({ visible, onClose, onDismissed, header, children, backgroundColor, heightPercent, contentStyle }: BottomSheetProps) {
  // Latest callbacks, so the PanResponder (created once) never calls stale closures
  const onCloseRef = useRef(onClose);
  const onDismissedRef = useRef(onDismissed);
  onCloseRef.current = onClose;
  onDismissedRef.current = onDismissed;
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const animateIn = useCallback(() => {
    closing.current = false;
    translateY.setValue(SCREEN_HEIGHT);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 220, mass: 0.8, useNativeDriver: true }),
    ]).start();
  }, [backdrop, translateY]);

  const animateOut = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setMounted(false);
      onCloseRef.current();
      onDismissedRef.current?.();
    });
  }, [backdrop, translateY]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(animateIn);
    } else if (mounted && !closing.current) {
      // Parent closed it programmatically: slide out, then unmount
      closing.current = true;
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setMounted(false);
        onDismissedRef.current?.();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          animateOut();
        } else {
          Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 260, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 260, useNativeDriver: true }).start();
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={animateOut} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={styles.fill} onPress={animateOut} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor, transform: [{ translateY }] },
            heightPercent ? { height: `${heightPercent}%` } : { maxHeight: '92%' },
          ]}
        >
          <View {...pan.panHandlers} style={styles.dragArea}>
            <View style={styles.grabber} />
            {header}
          </View>
          <View style={[styles.content, contentStyle]}>{children}</View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', marginTop: 'auto' },
  dragArea: { paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.45)', marginBottom: 4 },
  content: { flexShrink: 1 },
});
