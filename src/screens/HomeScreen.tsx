/**
 * HomeScreen
 * 
 * Main search interface with:
 * - Search bar at top
 * - Results grid or all files grid
 * - FAB for adding new files
 * - Nothing OS minimal aesthetic
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { SearchBar } from '../components/SearchBar';
import { MasonryGrid } from '../components/MasonryGrid';
import { ProgressIndicatorCompact } from '../components/ProgressIndicator';
import { THEME } from '../constants/config';
import type { FileRecord, SearchResult, EngineState } from '../types';

interface HomeScreenProps {
  state: EngineState;
  searchResults: SearchResult[];
  allFiles: FileRecord[];
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onAddFiles: () => void;
  onNavigateToIndexing: () => void;
  onClearAllData: () => Promise<void>;
  selectedFilesCount: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  state,
  searchResults,
  allFiles,
  onSearch,
  onClearSearch,
  onAddFiles,
  onNavigateToIndexing,
  onClearAllData,
  selectedFilesCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    onSearch(text);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    onClearSearch();
  }, [onClearSearch]);

  const handleItemPress = useCallback((item: FileRecord | SearchResult) => {
    // Could open a detail view - for now just log
    console.log('[HomeScreen] Item pressed:', item.filename);
  }, []);

  const handleClearAllPress = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will delete all indexed files and their embeddings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: onClearAllData,
        },
      ]
    );
  }, [onClearAllData]);

  const isSearching = searchQuery.length > 0;
  const displayData = isSearching ? searchResults : allFiles;
  const emptyMessage = isSearching
    ? (state.isSearching ? '' : 'No matching memories found')
    : 'No memories yet. Add some files to get started!';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recall</Text>
        <Text style={styles.subtitle}>
          {state.totalIndexedFiles} memories indexed
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearchChange}
          onClear={handleClear}
          isSearching={state.isSearching}
        />
      </View>

      {/* Indexing Progress (if active) */}
      {state.isIndexing && (
        <ProgressIndicatorCompact progress={state.progress} />
      )}

      {/* Error Message */}
      {state.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}

      {/* Search Loading Indicator */}
      {state.isSearching && isSearching && (
        <View style={styles.searchLoadingContainer}>
          <ActivityIndicator size="large" color={THEME.accent} />
          <Text style={styles.searchLoadingText}>Searching...</Text>
        </View>
      )}

      {/* Results Grid */}
      {!(state.isSearching && isSearching) && (
        <MasonryGrid
          data={displayData}
          onItemPress={handleItemPress}
          showSimilarity={isSearching}
          emptyMessage={emptyMessage}
          ListHeaderComponent={
            isSearching && searchResults.length > 0 ? (
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {searchResults.length} results found
                </Text>
              </View>
            ) : undefined
          }
        />
      )}

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        {/* Clear All Button */}
        {allFiles.length > 0 && (
          <TouchableOpacity
            style={styles.actionButtonSecondary}
            onPress={handleClearAllPress}
          >
            <Text style={styles.actionButtonSecondaryText}>Clear All</Text>
          </TouchableOpacity>
        )}

        {/* Add Files FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={onAddFiles}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        {/* Index Button (when files are selected) */}
        {selectedFilesCount > 0 && (
          <TouchableOpacity
            style={styles.indexButton}
            onPress={onNavigateToIndexing}
            activeOpacity={0.8}
          >
            <Text style={styles.indexButtonText}>
              Index {selectedFilesCount} files
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorContainer: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.error,
    marginBottom: 12,
  },
  errorText: {
    color: THEME.error,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  searchLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  searchLoadingText: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
    marginTop: 12,
  },
  resultsHeader: {
    paddingBottom: 12,
  },
  resultsCount: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
  },
  actionBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 32,
    color: THEME.text,
    fontWeight: '300',
    marginTop: -2,
  },
  indexButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: THEME.accent,
    borderRadius: 28,
    elevation: 4,
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  indexButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  actionButtonSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
  },
});
