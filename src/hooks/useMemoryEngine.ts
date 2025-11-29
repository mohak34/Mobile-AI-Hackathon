/**
 * useMemoryEngine - React hook for Memory Engine
 * 
 * Provides reactive state management for:
 * - Indexing progress
 * - Search functionality
 * - File management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CactusLM } from 'cactus-react-native';
import { getMemoryEngine, MemoryEngine } from '../services/MemoryEngine';
import { pickFiles, validateFiles, getFileStats } from '../services/FileProcessor';
import { SEARCH_DEBOUNCE_MS, DEFAULT_VISION_MODEL, VISION_MODELS } from '../constants/config';
import type {
  SelectedFile,
  FileRecord,
  SearchResult,
  ProcessingProgress,
  EngineState,
} from '../types';

interface UseMemoryEngineReturn {
  // State
  state: EngineState;
  searchResults: SearchResult[];
  allFiles: FileRecord[];
  selectedFiles: SelectedFile[];
  availableVisionModels: typeof VISION_MODELS;
  
  // Actions
  selectFiles: () => Promise<void>;
  clearSelection: () => void;
  startIndexing: () => Promise<void>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  refreshFiles: () => Promise<void>;
  clearAllData: () => Promise<void>;
  setVisionModel: (modelSlug: string) => void;
}

const initialProgress: ProcessingProgress = {
  phase: 'idle',
  current: 0,
  total: 0,
  message: 'Ready',
  percentage: 0,
};

const initialState: EngineState = {
  isInitialized: false,
  isIndexing: false,
  isSearching: false,
  visionModelLoaded: false,
  embeddingModelLoaded: false,
  progress: initialProgress,
  error: null,
  totalIndexedFiles: 0,
  selectedVisionModel: DEFAULT_VISION_MODEL,
};

export const useMemoryEngine = (): UseMemoryEngineReturn => {
  const engineRef = useRef<MemoryEngine | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<EngineState>(initialState);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allFiles, setAllFiles] = useState<FileRecord[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  // Initialize engine on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Debug: List available models
        try {
          const tempLM = new CactusLM();
          const models = await tempLM.getModels({ forceRefresh: true });
          console.log('[useMemoryEngine] Available Cactus models:');
          models.forEach(m => {
            console.log(`  - ${m.slug}: ${m.sizeMb}MB, vision:${m.supportsVision}, downloaded:${m.isDownloaded}`);
          });
          await tempLM.destroy();
        } catch (e) {
          console.log('[useMemoryEngine] Could not list models:', e);
        }

        engineRef.current = getMemoryEngine();
        await engineRef.current.initialize();
        
        // Set up progress callback
        engineRef.current.setProgressCallback((progress) => {
          setState(prev => ({
            ...prev,
            progress,
            isIndexing: !['idle', 'complete', 'error'].includes(progress.phase),
          }));
        });

        // Get initial file count
        const count = await engineRef.current.getFileCount();
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
          totalIndexedFiles: count,
        }));

        // Load all files
        const files = await engineRef.current.getAllFiles();
        setAllFiles(files);

      } catch (error) {
        console.error('[useMemoryEngine] Initialization failed:', error);
        setState(prev => ({
          ...prev,
          error: String(error),
        }));
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Select files using document picker
   */
  const selectFiles = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const files = await pickFiles();
      
      if (files.length === 0) {
        return;
      }

      const validation = validateFiles(files);
      if (!validation.valid) {
        setState(prev => ({
          ...prev,
          error: validation.errors.join(', '),
        }));
        return;
      }

      const stats = getFileStats(files);
      console.log(`[useMemoryEngine] Selected: ${stats.images} images, ${stats.pdfs} PDFs`);
      
      setSelectedFiles(files);
    } catch (error) {
      console.error('[useMemoryEngine] File selection failed:', error);
      setState(prev => ({
        ...prev,
        error: String(error),
      }));
    }
  }, []);

  /**
   * Clear selected files
   */
  const clearSelection = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  /**
   * Start indexing selected files
   */
  const startIndexing = useCallback(async () => {
    if (!engineRef.current || selectedFiles.length === 0) {
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        isIndexing: true,
        error: null,
        progress: {
          ...initialProgress,
          phase: 'selecting',
          message: 'Starting indexing...',
        },
      }));

      await engineRef.current.indexFiles(selectedFiles);

      // Refresh file list after indexing
      const files = await engineRef.current.getAllFiles();
      const count = await engineRef.current.getFileCount();
      
      setAllFiles(files);
      setSelectedFiles([]);
      
      setState(prev => ({
        ...prev,
        isIndexing: false,
        totalIndexedFiles: count,
        progress: {
          phase: 'complete',
          current: selectedFiles.length,
          total: selectedFiles.length,
          message: 'Indexing complete!',
          percentage: 100,
        },
      }));

    } catch (err) {
      console.error('[useMemoryEngine] Indexing failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState(prev => ({
        ...prev,
        isIndexing: false,
        error: errorMessage,
        progress: {
          phase: 'error',
          current: 0,
          total: 0,
          message: `Error: ${errorMessage}`,
          percentage: 0,
        },
      }));
    }
  }, [selectedFiles]);

  /**
   * Search for files (debounced)
   */
  const search = useCallback(async (query: string) => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setState(prev => ({ ...prev, isSearching: false }));
      return;
    }

    // Clear previous results and show loading immediately
    setSearchResults([]);
    setState(prev => ({ ...prev, isSearching: true }));

    // Debounce the search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        if (!engineRef.current) return;
        
        const results = await engineRef.current.search(query);
        setSearchResults(results);
        
        setState(prev => ({ ...prev, isSearching: false }));
      } catch (error) {
        console.error('[useMemoryEngine] Search failed:', error);
        setState(prev => ({
          ...prev,
          isSearching: false,
          error: String(error),
        }));
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchResults([]);
    setState(prev => ({ ...prev, isSearching: false }));
  }, []);

  /**
   * Refresh files from database
   */
  const refreshFiles = useCallback(async () => {
    if (!engineRef.current) return;

    try {
      const files = await engineRef.current.getAllFiles();
      const count = await engineRef.current.getFileCount();
      
      setAllFiles(files);
      setState(prev => ({ ...prev, totalIndexedFiles: count }));
    } catch (error) {
      console.error('[useMemoryEngine] Refresh failed:', error);
    }
  }, []);

  /**
   * Clear all indexed data
   */
  const clearAllData = useCallback(async () => {
    if (!engineRef.current) return;

    try {
      await engineRef.current.clearAll();
      setAllFiles([]);
      setSearchResults([]);
      setState(prev => ({
        ...prev,
        totalIndexedFiles: 0,
        progress: initialProgress,
      }));
    } catch (error) {
      console.error('[useMemoryEngine] Clear failed:', error);
      setState(prev => ({
        ...prev,
        error: String(error),
      }));
    }
  }, []);

  /**
   * Set the vision model to use for indexing
   */
  const setVisionModel = useCallback((modelSlug: string) => {
    if (!engineRef.current) return;
    
    console.log('[useMemoryEngine] Setting vision model to:', modelSlug);
    engineRef.current.setVisionModel(modelSlug);
    setState(prev => ({
      ...prev,
      selectedVisionModel: modelSlug,
    }));
  }, []);

  return {
    state,
    searchResults,
    allFiles,
    selectedFiles,
    availableVisionModels: VISION_MODELS,
    selectFiles,
    clearSelection,
    startIndexing,
    search,
    clearSearch,
    refreshFiles,
    clearAllData,
    setVisionModel,
  };
};
