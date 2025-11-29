/**
 * Type definitions for Recall App
 */

// File Types
export type FileType = 'image' | 'pdf';

export interface SelectedFile {
  uri: string;
  name: string;
  type: FileType;
  mimeType: string;
  size: number;
}

// Database Types
export interface FileRecord {
  id: number;
  uri: string;
  filename: string;
  file_type: FileType;
  caption: string;
  thumbnail: string | null;
  created_at: number;
}

export interface SearchResult extends FileRecord {
  distance: number;
  similarity: number; // 1 - distance for display
}

// Processing Types
export interface ProcessingProgress {
  phase: ProcessingPhase;
  current: number;
  total: number;
  message: string;
  percentage: number;
}

export type ProcessingPhase = 
  | 'idle'
  | 'selecting'
  | 'loading_vision'
  | 'captioning'
  | 'unloading_vision'
  | 'loading_embedding'
  | 'embedding'
  | 'saving'
  | 'complete'
  | 'error';

// Batch Processing Types
export interface CaptionedFile {
  file: SelectedFile;
  caption: string;
  thumbnail: string | null;
}

export interface EmbeddedFile extends CaptionedFile {
  embedding: number[];
}

// Engine State
export interface EngineState {
  isInitialized: boolean;
  isIndexing: boolean;
  isSearching: boolean;
  visionModelLoaded: boolean;
  embeddingModelLoaded: boolean;
  progress: ProcessingProgress;
  error: string | null;
  totalIndexedFiles: number;
  selectedVisionModel: string;
}

// Search State
export interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  lastSearchTime: number;
}

// App Navigation
export type AppScreen = 'home' | 'indexing';

// Model Download State
export interface ModelDownloadState {
  visionModel: {
    isDownloaded: boolean;
    isDownloading: boolean;
    progress: number;
  };
  embeddingModel: {
    isDownloaded: boolean;
    isDownloading: boolean;
    progress: number;
  };
}
