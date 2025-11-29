/**
 * App.tsx - Main Application Entry
 * 
 * Simple screen-based navigation using state (no external nav library needed)
 * Connects the MemoryEngine hook to all screens
 */

import React, { useState, useCallback, useEffect } from 'react';

import { useMemoryEngine } from './src/hooks/useMemoryEngine';
import { HomeScreen } from './src/screens/HomeScreen';
import { IndexingScreen } from './src/screens/IndexingScreen';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'indexing'>('home');
  
  const {
    state,
    searchResults,
    allFiles,
    selectedFiles,
    availableVisionModels,
    selectFiles,
    clearSelection,
    startIndexing,
    search,
    clearSearch,
    clearAllData,
    refreshFiles,
    setVisionModel,
  } = useMemoryEngine();

  // Navigate to indexing screen when files are selected
  useEffect(() => {
    if (selectedFiles.length > 0 && currentScreen === 'home') {
      setCurrentScreen('indexing');
    }
  }, [selectedFiles.length, currentScreen]);

  // Navigate to home and refresh files (used after indexing completes)
  const navigateToHome = useCallback(async () => {
    setCurrentScreen('home');
    clearSelection();
    // Refresh files to show newly indexed files
    await refreshFiles();
  }, [clearSelection, refreshFiles]);

  const navigateToIndexing = useCallback(() => {
    setCurrentScreen('indexing');
  }, []);

  // When user clicks + to add files
  const handleAddFiles = useCallback(async () => {
    await selectFiles();
    // The useEffect above will navigate to indexing screen when files are selected
  }, [selectFiles]);

  const handleStartIndexing = useCallback(async () => {
    await startIndexing();
  }, [startIndexing]);

  if (currentScreen === 'indexing') {
    return (
      <IndexingScreen
        progress={state.progress}
        selectedFiles={selectedFiles}
        isIndexing={state.isIndexing}
        onStartIndexing={handleStartIndexing}
        onCancel={navigateToHome}
        availableModels={availableVisionModels}
        selectedModel={state.selectedVisionModel}
        onModelSelect={setVisionModel}
        error={state.error}
      />
    );
  }

  return (
    <HomeScreen
      state={state}
      searchResults={searchResults}
      allFiles={allFiles}
      onSearch={search}
      onClearSearch={clearSearch}
      onAddFiles={handleAddFiles}
      onNavigateToIndexing={navigateToIndexing}
      onClearAllData={clearAllData}
      selectedFilesCount={selectedFiles.length}
    />
  );
};

export default App;
