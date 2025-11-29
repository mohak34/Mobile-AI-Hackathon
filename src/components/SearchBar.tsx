/**
 * SearchBar Component
 * 
 * Nothing OS styled search input with:
 * - Minimal black/white aesthetic
 * - Red accent on focus
 * - Clear button
 * - Loading indicator during search
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { THEME } from '../constants/config';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  isSearching: boolean;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  isSearching,
  placeholder = 'Search your memories...',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const borderColor = new Animated.Value(0);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.timing(borderColor, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    Animated.timing(borderColor, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, []);

  const animatedBorderColor = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [THEME.border, THEME.accent],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { borderColor: animatedBorderColor },
      ]}
    >
      {/* Search Icon */}
      <View style={styles.iconContainer}>
        <SearchIcon focused={isFocused} />
      </View>

      {/* Input */}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={THEME.textMuted}
        onFocus={handleFocus}
        onBlur={handleBlur}
        selectionColor={THEME.accent}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {/* Right side: Loading or Clear */}
      <View style={styles.rightContainer}>
        {isSearching ? (
          <ActivityIndicator size="small" color={THEME.accent} />
        ) : value.length > 0 ? (
          <TouchableOpacity
            onPress={onClear}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ClearIcon />
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
};

// Simple SVG-like icons using Views
const SearchIcon: React.FC<{ focused: boolean }> = ({ focused }) => (
  <View style={styles.searchIcon}>
    <View
      style={[
        styles.searchCircle,
        { borderColor: focused ? THEME.accent : THEME.textSecondary },
      ]}
    />
    <View
      style={[
        styles.searchHandle,
        { backgroundColor: focused ? THEME.accent : THEME.textSecondary },
      ]}
    />
  </View>
);

const ClearIcon: React.FC = () => (
  <View style={styles.clearIcon}>
    <View style={[styles.clearLine, styles.clearLine1]} />
    <View style={[styles.clearLine, styles.clearLine2]} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 52,
  },
  iconContainer: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: THEME.text,
    fontFamily: 'monospace',
    padding: 0,
  },
  rightContainer: {
    marginLeft: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search Icon Styles
  searchIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  searchHandle: {
    width: 6,
    height: 2,
    borderRadius: 1,
    position: 'absolute',
    bottom: 2,
    right: 0,
    transform: [{ rotate: '45deg' }],
  },
  // Clear Icon Styles
  clearIcon: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearLine: {
    position: 'absolute',
    width: 14,
    height: 2,
    backgroundColor: THEME.textSecondary,
    borderRadius: 1,
  },
  clearLine1: {
    transform: [{ rotate: '45deg' }],
  },
  clearLine2: {
    transform: [{ rotate: '-45deg' }],
  },
});
