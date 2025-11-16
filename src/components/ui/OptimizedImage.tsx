import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ImageStyle, StyleProp, ImageProps } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: { uri: string } | number;
  style?: StyleProp<ImageStyle>;
  alt?: string;
  showPlaceholder?: boolean;
  placeholderStyle?: StyleProp<any>;
}

export function OptimizedImage({
  source,
  style,
  alt,
  showPlaceholder = true,
  placeholderStyle,
  ...props
}: OptimizedImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { isDark } = useTheme();

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
  };

  const handleLoadEnd = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <Image
        source={source}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        style={[StyleSheet.absoluteFillObject, StyleSheet.flatten(style)]}
        accessibilityLabel={alt}
        {...props}
      />
      {loading && showPlaceholder && (
        <View
          style={[
            styles.placeholder,
            placeholderStyle,
            StyleSheet.absoluteFillObject,
            { overflow: 'hidden' },
          ]}
        >
          <ImageIcon size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
          <Text style={[styles.placeholderText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Loading...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
  },
});
