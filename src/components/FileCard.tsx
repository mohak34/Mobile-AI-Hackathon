/**
 * FileCard Component
 * 
 * Displays a single file/image in the grid with:
 * - Thumbnail preview
 * - Caption overlay
 * - Similarity score badge (for search results)
 * - Nothing OS minimal styling
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { THEME } from '../constants/config';
import type { FileRecord, SearchResult } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 8;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / NUM_COLUMNS;

interface FileCardProps {
  item: FileRecord | SearchResult;
  onPress?: (item: FileRecord | SearchResult) => void;
  showSimilarity?: boolean;
}

const isSearchResult = (item: FileRecord | SearchResult): item is SearchResult => {
  return 'similarity' in item;
};

export const FileCard: React.FC<FileCardProps> = memo(({
  item,
  onPress,
  showSimilarity = false,
}) => {
  const handlePress = () => {
    onPress?.(item);
  };

  const similarity = isSearchResult(item) ? item.similarity : null;
  const isImage = item.file_type === 'image';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {isImage && item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : isImage && item.uri ? (
          <Image
            source={{ uri: item.uri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.pdfPlaceholder}>
            <Text style={styles.pdfIcon}>PDF</Text>
          </View>
        )}

        {/* Similarity Badge */}
        {showSimilarity && similarity !== null && (
          <View style={styles.similarityBadge}>
            <Text style={styles.similarityText}>
              {Math.round(similarity * 100)}%
            </Text>
          </View>
        )}

        {/* Type Badge */}
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>
            {item.file_type.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Caption */}
      <View style={styles.captionContainer}>
        <Text style={styles.filename} numberOfLines={1}>
          {item.filename}
        </Text>
        <Text style={styles.caption} numberOfLines={2}>
          {item.caption}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

FileCard.displayName = 'FileCard';

// Compact card for grid view
export const FileCardCompact: React.FC<FileCardProps> = memo(({
  item,
  onPress,
  showSimilarity = false,
}) => {
  const handlePress = () => {
    onPress?.(item);
  };

  const similarity = isSearchResult(item) ? item.similarity : null;
  const isImage = item.file_type === 'image';

  return (
    <TouchableOpacity
      style={styles.compactContainer}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Thumbnail */}
      {isImage && (item.thumbnail || item.uri) ? (
        <Image
          source={{ uri: item.thumbnail || item.uri }}
          style={styles.compactThumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.compactPdfPlaceholder}>
          <Text style={styles.compactPdfIcon}>PDF</Text>
        </View>
      )}

      {/* Similarity Badge */}
      {showSimilarity && similarity !== null && (
        <View style={styles.compactSimilarityBadge}>
          <Text style={styles.compactSimilarityText}>
            {Math.round(similarity * 100)}%
          </Text>
        </View>
      )}

      {/* Caption Overlay */}
      <View style={styles.compactOverlay}>
        <Text style={styles.compactCaption} numberOfLines={2}>
          {item.caption}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

FileCardCompact.displayName = 'FileCardCompact';

const styles = StyleSheet.create({
  // Full Card Styles
  container: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: THEME.surface,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  pdfPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.surfaceLight,
  },
  pdfIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.accent,
    fontFamily: 'monospace',
  },
  similarityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: THEME.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  similarityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
  },
  captionContainer: {
    padding: 12,
  },
  filename: {
    fontSize: 12,
    color: THEME.textMuted,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    color: THEME.text,
    lineHeight: 20,
  },

  // Compact Card Styles
  compactContainer: {
    width: CARD_WIDTH,
    aspectRatio: 0.85,
    backgroundColor: THEME.card,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  compactThumbnail: {
    width: '100%',
    height: '100%',
  },
  compactPdfPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.surfaceLight,
  },
  compactPdfIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.accent,
    fontFamily: 'monospace',
  },
  compactSimilarityBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: THEME.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactSimilarityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  compactOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 8,
  },
  compactCaption: {
    fontSize: 11,
    color: THEME.text,
    lineHeight: 15,
  },
});
