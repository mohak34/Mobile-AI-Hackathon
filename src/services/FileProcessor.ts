/**
 * FileProcessor - File picking and processing utilities
 * 
 * Handles:
 * - Document picker for selecting images and PDFs
 * - File validation
 * - File type detection
 */

import DocumentPicker, {
  types,
  type DocumentPickerResponse,
} from 'react-native-document-picker';

import {
  MAX_FILES,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_PDF_TYPES,
} from '../constants/config';

import type { SelectedFile, FileType } from '../types';

/**
 * Determine file type from MIME type
 */
const getFileType = (mimeType: string): FileType | null => {
  if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
    return 'image';
  }
  if (SUPPORTED_PDF_TYPES.includes(mimeType)) {
    return 'pdf';
  }
  return null;
};

/**
 * Convert DocumentPickerResponse to SelectedFile
 */
const toSelectedFile = (doc: DocumentPickerResponse): SelectedFile | null => {
  const mimeType = doc.type || '';
  const fileType = getFileType(mimeType);

  if (!fileType) {
    console.warn(`[FileProcessor] Unsupported file type: ${mimeType}`);
    return null;
  }

  return {
    uri: doc.uri,
    name: doc.name || 'unknown',
    type: fileType,
    mimeType,
    size: doc.size || 0,
  };
};

/**
 * Open document picker for selecting images and PDFs
 */
export const pickFiles = async (): Promise<SelectedFile[]> => {
  try {
    const results = await DocumentPicker.pick({
      type: [types.images, types.pdf],
      allowMultiSelection: true,
      copyTo: 'cachesDirectory', // Copy to cache for reliable access
    });

    // Filter and convert to SelectedFile
    const selectedFiles: SelectedFile[] = [];

    for (const doc of results) {
      // Use the copied URI if available (more reliable)
      const uri = doc.fileCopyUri || doc.uri;
      
      const selected = toSelectedFile({
        ...doc,
        uri,
      });

      if (selected) {
        selectedFiles.push(selected);
      }

      // Enforce max file limit
      if (selectedFiles.length >= MAX_FILES) {
        console.warn(`[FileProcessor] Max file limit (${MAX_FILES}) reached`);
        break;
      }
    }

    console.log(`[FileProcessor] Selected ${selectedFiles.length} files`);
    return selectedFiles;

  } catch (error) {
    if (DocumentPicker.isCancel(error)) {
      console.log('[FileProcessor] User cancelled picker');
      return [];
    }
    
    console.error('[FileProcessor] Error picking files:', error);
    throw error;
  }
};

/**
 * Validate selected files
 */
export const validateFiles = (files: SelectedFile[]): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (files.length === 0) {
    errors.push('No files selected');
  }

  if (files.length > MAX_FILES) {
    errors.push(`Maximum ${MAX_FILES} files allowed`);
  }

  // Check for unsupported types (should be filtered already, but double-check)
  const unsupported = files.filter(f => !['image', 'pdf'].includes(f.type));
  if (unsupported.length > 0) {
    errors.push(`${unsupported.length} unsupported file(s) detected`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Get file statistics
 */
export const getFileStats = (files: SelectedFile[]): {
  total: number;
  images: number;
  pdfs: number;
  totalSizeMB: number;
} => {
  const images = files.filter(f => f.type === 'image').length;
  const pdfs = files.filter(f => f.type === 'pdf').length;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return {
    total: files.length,
    images,
    pdfs,
    totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
  };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
