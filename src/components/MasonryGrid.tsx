/**
 * MasonryGrid Component
 * 
 * Simple 2-column grid for displaying files
 * Using FlatList with numColumns for performance
 */

import React, { useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ListRenderItem,
} from 'react-native';
import { FileCardCompact } from './FileCard';
import { THEME } from '../constants/config';
import type { FileRecord, SearchResult } from '../types';

interface MasonryGridProps {
  data: (FileRecord | SearchResult)[];
  onItemPress?: (item: FileRecord | SearchResult) => void;
  showSimilarity?: boolean;
  emptyMessage?: string;
  ListHeaderComponent?: React.ReactElement;
}

const CARD_GAP = 8;

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  data,
  onItemPress,
  showSimilarity = false,
  emptyMessage = 'No files found',
  ListHeaderComponent,
}) => {
  const renderItem: ListRenderItem<FileRecord | SearchResult> = useCallback(
    ({ item, index }) => (
      <View style={[
        styles.itemWrapper,
        index % 2 === 0 ? styles.itemLeft : styles.itemRight,
      ]}>
        <FileCardCompact
          item={item}
          onPress={onItemPress}
          showSimilarity={showSimilarity}
        />
      </View>
    ),
    [onItemPress, showSimilarity]
  );

  const keyExtractor = useCallback(
    (item: FileRecord | SearchResult) => `file-${item.id}`,
    []
  );

  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    ),
    [emptyMessage]
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={2}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
      columnWrapperStyle={styles.row}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={8}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  itemWrapper: {
    flex: 1,
    maxWidth: '49%',
  },
  itemLeft: {
    marginRight: CARD_GAP / 2,
  },
  itemRight: {
    marginLeft: CARD_GAP / 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: THEME.textMuted,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
