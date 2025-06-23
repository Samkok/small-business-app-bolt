import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, ImageProps } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Image as ImageIcon } from 'lucide-react-native';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: { uri: string } | number;
  fallbackText?: string;
  showPlaceholder?: boolean;
  alt?: string;
}

export function OptimizedImage({
  source,
  fallbackText = 'No Image',
  showPlaceholder = true,
  alt,
  style,
  ...props
}: OptimizedImageProps) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const placeholderStyle = {
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    borderColor: isDark ? '#4b5563' : '#e5e7eb',
  };

  if (error && showPlaceholder) {
    return (
      <View style={[styles.placeholder, placeholderStyle, style]}>
        <ImageIcon size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
        <Text style={[styles.placeholderText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          {fallbackText}
        </Text>
      </View>
    );
  }

  return (
    <View style={style}>
      <Image
        source={source}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        style={[StyleSheet.absoluteFillObject]}
        accessibilityLabel={alt}
        {...props}
      />
      {loading && showPlaceholder && (
        <View style={[styles.placeholder, placeholderStyle, StyleSheet.absoluteFillObject]}>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 100,
  },
  placeholderText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});