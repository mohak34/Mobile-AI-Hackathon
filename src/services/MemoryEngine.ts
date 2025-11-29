/**
 * MemoryEngine - Core AI and Database Logic for Recall App
 * 
 * Handles:
 * - Model loading/unloading (SmolVLM2 for vision, Qwen3 for embeddings)
 * - Batch processing strategy (vision first, then embeddings)
 * - SQLite + sqlite-vec for vector storage and search
 * - Thermal management with cooldown periods
 * - PDF text extraction using native module
 */

import { open, type DB } from '@op-engineering/op-sqlite';
import { CactusLM } from 'cactus-react-native';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import { NativeModules } from 'react-native';

import {
  DEFAULT_VISION_MODEL,
  EMBEDDING_MODEL,
  CONTEXT_SIZE,
  EMBEDDING_CONTEXT_SIZE,
  COOL_DOWN_VISION_MS,
  COOL_DOWN_EMBED_MS,
  COOL_DOWN_MODEL_SWITCH_MS,
  SEARCH_RESULTS_LIMIT,
  DB_NAME,
  VISION_CAPTION_PROMPT,
  USE_VISION_MODEL,
  VISION_MAX_TOKENS,
  PDF_MAX_CHARS,
} from '../constants/config';

import type {
  SelectedFile,
  FileRecord,
  SearchResult,
  CaptionedFile,
  EmbeddedFile,
  ProcessingProgress,
  ProcessingPhase,
} from '../types';

// Native module for PDF text extraction
const { PdfTextExtractor } = NativeModules;

// Utility to pause execution
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Resize image to reduce memory usage for vision model
const resizeImageForVision = async (uri: string): Promise<string> => {
  try {
    console.log('[MemoryEngine] Resizing image for vision model...');
    const result = await ImageResizer.createResizedImage(
      uri,
      512,  // max width
      512,  // max height
      'JPEG',
      60,   // quality (0-100)
      0,    // rotation
      undefined, // output path (auto)
      false, // keep metadata
    );
    console.log(`[MemoryEngine] Resized image: ${result.size} bytes at ${result.path}`);
    return result.path;
  } catch (error) {
    console.error('[MemoryEngine] Failed to resize image, using original:', error);
    return uri;
  }
};

// Convert content:// URI to a file path that Cactus can read
const getReadableFilePath = async (uri: string, filename: string): Promise<string> => {
  // If it's already a file path, return as-is
  if (uri.startsWith('/') || uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }
  
  // For content:// URIs, copy to a temp file
  const tempDir = RNFS.CachesDirectoryPath;
  const tempPath = `${tempDir}/${Date.now()}_${filename}`;
  
  try {
    await RNFS.copyFile(uri, tempPath);
    console.log(`[MemoryEngine] Copied ${uri} to ${tempPath}`);
    return tempPath;
  } catch (error) {
    console.error('[MemoryEngine] Failed to copy file:', error);
    throw error;
  }
};

// Convert number array to JSON string for storage
const vectorToJson = (vector: number[]): string => {
  return JSON.stringify(vector);
};

// Convert JSON string back to number array
const jsonToVector = (json: string): number[] => {
  return JSON.parse(json);
};

// Calculate cosine similarity between two vectors
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

// Calculate keyword match score between query and text
const keywordMatchScore = (query: string, text: string): number => {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();
  
  if (queryWords.length === 0) return 0;
  
  let matchCount = 0;
  for (const word of queryWords) {
    if (textLower.includes(word)) {
      matchCount++;
    }
  }
  
  return matchCount / queryWords.length; // 0 to 1
};

export class MemoryEngine {
  private db: DB | null = null;
  private visionModel: CactusLM | null = null;
  private embeddingModel: CactusLM | null = null;
  private isInitialized = false;
  
  // Lock to prevent concurrent model operations
  private embeddingModelLoading = false;
  private embeddingModelLoadPromise: Promise<void> | null = null;
  
  // Search mutex to serialize search operations
  private searchInProgress = false;
  private searchQueue: Array<{
    query: string;
    resolve: (results: SearchResult[]) => void;
    reject: (error: Error) => void;
  }> = [];
  
  // Progress callback
  private onProgress: ((progress: ProcessingProgress) => void) | null = null;

  constructor() {
    // Engine created, call initialize() to set up database
  }

  /**
   * Initialize the database with required tables
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Open database
      console.log('[MemoryEngine] Opening database...');
      this.db = open({
        name: DB_NAME,
      });
      console.log('[MemoryEngine] Database opened');

      // Create files table for metadata (IF NOT EXISTS - won't drop existing data)
      console.log('[MemoryEngine] Creating files table...');
      this.db.executeSync(`
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uri TEXT NOT NULL,
          filename TEXT NOT NULL,
          file_type TEXT NOT NULL,
          caption TEXT,
          thumbnail TEXT,
          created_at INTEGER NOT NULL
        );
      `);
      console.log('[MemoryEngine] Files table ready');

      // Create vectors table (IF NOT EXISTS - won't drop existing data)
      console.log('[MemoryEngine] Creating vectors table...');
      this.db.executeSync(`
        CREATE TABLE IF NOT EXISTS file_vectors (
          file_id INTEGER PRIMARY KEY,
          embedding TEXT NOT NULL,
          FOREIGN KEY (file_id) REFERENCES files(id)
        );
      `);
      console.log('[MemoryEngine] Vectors table ready');

      // Create index for faster lookups
      this.db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type);
      `);
      console.log('[MemoryEngine] Index ready');

      this.isInitialized = true;
      console.log('[MemoryEngine] Database initialized successfully');
    } catch (error) {
      console.error('[MemoryEngine] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Set progress callback for UI updates
   */
  setProgressCallback(callback: (progress: ProcessingProgress) => void): void {
    this.onProgress = callback;
  }

  /**
   * Report progress to UI
   */
  private reportProgress(
    phase: ProcessingPhase,
    current: number,
    total: number,
    message: string
  ): void {
    const progress: ProcessingProgress = {
      phase,
      current,
      total,
      message,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    };
    
    console.log(`[MemoryEngine] ${phase}: ${message} (${progress.percentage}%)`);
    this.onProgress?.(progress);
  }

  // Currently selected vision model
  private selectedVisionModel: string = DEFAULT_VISION_MODEL;

  /**
   * Set the vision model to use for indexing
   */
  setVisionModel(modelSlug: string): void {
    console.log('[MemoryEngine] Setting vision model to:', modelSlug);
    this.selectedVisionModel = modelSlug;
  }

  /**
   * Get the currently selected vision model
   */
  getSelectedVisionModel(): string {
    return this.selectedVisionModel;
  }

  /**
   * Load the vision model
   */
  private async loadVisionModel(): Promise<void> {
    const modelToLoad = this.selectedVisionModel;
    this.reportProgress('loading_vision', 0, 1, `Loading ${modelToLoad}...`);
    console.log('[MemoryEngine] Creating CactusLM instance with model:', modelToLoad);
    
    try {
      this.visionModel = new CactusLM({
        model: modelToLoad,
        contextSize: CONTEXT_SIZE,
      });
      
      // Check if model is already downloaded
      try {
        const models = await this.visionModel.getModels();
        const visionModelInfo = models.find(m => m.slug === modelToLoad);
        console.log('[MemoryEngine] Vision model info:', visionModelInfo);
        
        if (visionModelInfo?.isDownloaded) {
          console.log('[MemoryEngine] Vision model already downloaded, skipping download');
        } else {
          console.log('[MemoryEngine] Vision model not downloaded, starting download...');
          // Download if not available
          await this.visionModel.download({
            onProgress: (progress) => {
              console.log('[MemoryEngine] Vision model download progress:', Math.round(progress * 100) + '%');
              this.reportProgress(
                'loading_vision',
                Math.round(progress * 100),
                100,
                `Downloading vision model: ${Math.round(progress * 100)}%`
              );
            },
          });
        }
      } catch (e) {
        console.log('[MemoryEngine] Could not check model status, trying download:', e);
        await this.visionModel.download({
          onProgress: (progress) => {
            console.log('[MemoryEngine] Vision model download progress:', Math.round(progress * 100) + '%');
            this.reportProgress(
              'loading_vision',
              Math.round(progress * 100),
              100,
              `Downloading vision model: ${Math.round(progress * 100)}%`
            );
          },
        });
      }
      
      console.log('[MemoryEngine] Initializing vision model...');

      // Initialize the model
      await this.visionModel.init();
      
      this.reportProgress('loading_vision', 1, 1, 'Vision model ready');
      console.log('[MemoryEngine] Vision model loaded successfully');
    } catch (error) {
      console.error('[MemoryEngine] Failed to load vision model:', error);
      throw error;
    }
  }

  /**
   * Unload the vision model to free memory
   */
  private async unloadVisionModel(): Promise<void> {
    if (this.visionModel) {
      this.reportProgress('unloading_vision', 0, 1, 'Freeing memory...');
      await this.visionModel.destroy();
      this.visionModel = null;
      
      // Give the device time to free memory
      await delay(COOL_DOWN_MODEL_SWITCH_MS);
      
      this.reportProgress('unloading_vision', 1, 1, 'Memory freed');
      console.log('[MemoryEngine] Vision model unloaded');
    }
  }

  /**
   * Load the embedding model (Qwen3)
   * Uses a lock to prevent concurrent initialization
   */
  private async loadEmbeddingModel(): Promise<void> {
    // If model is already loaded, return immediately
    if (this.embeddingModel) {
      console.log('[MemoryEngine] Embedding model already loaded');
      return;
    }
    
    // If model is currently loading, wait for it
    if (this.embeddingModelLoading && this.embeddingModelLoadPromise) {
      console.log('[MemoryEngine] Waiting for embedding model to finish loading...');
      await this.embeddingModelLoadPromise;
      return;
    }
    
    // Set loading flag and create promise
    this.embeddingModelLoading = true;
    
    this.embeddingModelLoadPromise = (async () => {
      this.reportProgress('loading_embedding', 0, 1, 'Loading embedding model...');
      
      try {
        this.embeddingModel = new CactusLM({
          model: EMBEDDING_MODEL,
          contextSize: EMBEDDING_CONTEXT_SIZE,
        });

        // Download if not available
        await this.embeddingModel.download({
          onProgress: (progress) => {
            this.reportProgress(
              'loading_embedding',
              Math.round(progress * 100),
              100,
              `Downloading embedding model: ${Math.round(progress * 100)}%`
            );
          },
        });

        // Initialize the model
        await this.embeddingModel.init();
        
        this.reportProgress('loading_embedding', 1, 1, 'Embedding model ready');
        console.log('[MemoryEngine] Embedding model loaded');
      } catch (error) {
        console.error('[MemoryEngine] Failed to load embedding model:', error);
        this.embeddingModel = null;
        throw error;
      } finally {
        this.embeddingModelLoading = false;
      }
    })();
    
    await this.embeddingModelLoadPromise;
  }

  /**
   * Unload the embedding model to free memory
   */
  private async unloadEmbeddingModel(): Promise<void> {
    if (this.embeddingModel) {
      await this.embeddingModel.destroy();
      this.embeddingModel = null;
      console.log('[MemoryEngine] Embedding model unloaded');
    }
  }

  /**
   * Generate caption for a single image using vision model
   */
  private async captionImage(imagePath: string): Promise<string> {
    if (!this.visionModel) {
      throw new Error('Vision model not loaded');
    }

    try {
      console.log('[MemoryEngine] Starting caption generation for:', imagePath);
      const result = await this.visionModel.complete({
        messages: [
          {
            role: 'user',
            content: VISION_CAPTION_PROMPT,
            images: [imagePath],
          },
        ],
        options: {
          maxTokens: VISION_MAX_TOKENS,
          temperature: 0.2,
        },
      });

      console.log('[MemoryEngine] Caption generated successfully');
      // Clean up any model end tokens
      return result.response.trim().replace(/<\|im_end\|>/g, '').trim();
    } catch (error) {
      console.error('[MemoryEngine] Failed to caption image:', error);
      // Return filename as fallback
      const filename = imagePath.split('/').pop() || 'unknown';
      return `Image file: ${filename}`;
    }
  }

  /**
   * Extract text from PDF using native module
   */
  private async extractPdfText(uri: string): Promise<string> {
    try {
      console.log('[MemoryEngine] Extracting text from PDF:', uri);
      const text = await PdfTextExtractor.extractText(uri, PDF_MAX_CHARS);
      console.log(`[MemoryEngine] Extracted ${text.length} characters from PDF`);
      return text;
    } catch (error) {
      console.error('[MemoryEngine] Failed to extract PDF text:', error);
      return '';
    }
  }

  /**
   * Generate caption for PDF using text extraction
   * Falls back to filename if extraction fails
   */
  private async generatePdfCaption(file: SelectedFile): Promise<string> {
    try {
      // Try to extract text from PDF
      const extractedText = await this.extractPdfText(file.uri);
      
      if (extractedText && extractedText.length > 20) {
        // Use extracted text as caption
        const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
        return `PDF: ${cleanName}. Content: ${extractedText}`;
      }
      
      // Fallback to filename-based caption
      const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
      return `PDF document: ${cleanName}`;
    } catch (error) {
      console.error('[MemoryEngine] Error generating PDF caption:', error);
      const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
      return `PDF document: ${cleanName}`;
    }
  }

  /**
   * Generate embedding for text using embedding model
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingModel) {
      throw new Error('Embedding model not loaded');
    }

    try {
      console.log(`[MemoryEngine] Generating embedding for text (length: ${text.length})`);
      const result = await this.embeddingModel.embed({ text });
      return result.embedding;
    } catch (error) {
      console.error('[MemoryEngine] Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Read image as base64 thumbnail
   * For now, skip thumbnail to avoid large data in SQLite
   */
  private async createThumbnail(_imagePath: string): Promise<string | null> {
    // Skip thumbnail creation - storing full base64 images causes DB slowdown
    // Just store the URI and load from disk when needed
    console.log('[MemoryEngine] Skipping thumbnail creation (using URI instead)');
    return null;
  }

  /**
   * MAIN INDEXING FUNCTION
   * Implements batch processing strategy:
   * 1. Load vision model
   * 2. Caption ALL images
   * 3. Unload vision model
   * 4. Extract text from PDFs (no model needed)
   * 5. Load embedding model
   * 6. Embed ALL captions
   * 7. Save to database
   */
  async indexFiles(files: SelectedFile[]): Promise<void> {
    console.log('[MemoryEngine] indexFiles called with', files.length, 'files');
    
    if (!this.isInitialized) {
      console.log('[MemoryEngine] Initializing database...');
      await this.initialize();
      console.log('[MemoryEngine] Database initialized');
    }

    const images = files.filter(f => f.type === 'image');
    const pdfs = files.filter(f => f.type === 'pdf');
    const totalFiles = files.length;
    
    console.log(`[MemoryEngine] Starting indexing: ${images.length} images, ${pdfs.length} PDFs`);

    try {
      // =========================================
      // PHASE 1: Caption all images with vision model
      // =========================================
      const captionedFiles: CaptionedFile[] = [];

      if (images.length > 0) {
        if (USE_VISION_MODEL) {
          // IMPORTANT: Unload embedding model first to free RAM for vision model
          if (this.embeddingModel) {
            console.log('[MemoryEngine] Unloading embedding model to free RAM for vision...');
            await this.unloadEmbeddingModel();
            await delay(2000); // Let memory settle
          }

          // Use AI vision model for captioning
          await this.loadVisionModel();

          for (let i = 0; i < images.length; i++) {
            const file = images[i];
            this.reportProgress(
              'captioning',
              i + 1,
              images.length,
              `Analyzing image ${i + 1}/${images.length}: ${file.name}`
            );

            // Resize image first to reduce memory usage
            const resizedUri = await resizeImageForVision(file.uri);
            
            // Convert to readable file path
            const imagePath = await getReadableFilePath(resizedUri, file.name);
            const caption = await this.captionImage(imagePath);
            
            // Clean up resized temp file
            try {
              if (resizedUri !== file.uri) {
                await RNFS.unlink(resizedUri);
              }
            } catch (e) {
              // Ignore cleanup errors
            }
            
            const thumbnail = await this.createThumbnail(file.uri);

            captionedFiles.push({
              file,
              caption,
              thumbnail,
            });

            console.log(`[MemoryEngine] Captioned: "${caption.substring(0, 50)}..."`);

            // Reset model context to free memory after each image
            if (this.visionModel) {
              console.log('[MemoryEngine] Resetting vision model context...');
              await this.visionModel.reset();
            }

            // Thermal cooldown between images - let device recover
            if (i < images.length - 1) {
              console.log(`[MemoryEngine] Cooling down for ${COOL_DOWN_VISION_MS}ms...`);
              await delay(COOL_DOWN_VISION_MS);
            }
          }

          await this.unloadVisionModel();
        } else {
          // Skip vision model - use filename as caption
          console.log('[MemoryEngine] Skipping vision model, using filenames');
          for (let i = 0; i < images.length; i++) {
            const file = images[i];
            this.reportProgress(
              'captioning',
              i + 1,
              images.length,
              `Processing image ${i + 1}/${images.length}: ${file.name}`
            );

            // Use filename as caption
            const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
            const caption = `Image: ${cleanName}`;
            const thumbnail = await this.createThumbnail(file.uri);

            captionedFiles.push({
              file,
              caption,
              thumbnail,
            });

            console.log(`[MemoryEngine] Using filename caption: "${caption}"`);
          }
        }
      }

      // =========================================
      // PHASE 2: Process PDFs with text extraction (no AI needed)
      // =========================================
      if (pdfs.length > 0) {
        console.log('[MemoryEngine] Processing PDFs with text extraction...');
        
        for (let i = 0; i < pdfs.length; i++) {
          const file = pdfs[i];
          this.reportProgress(
            'captioning',
            images.length + i + 1,
            totalFiles,
            `Extracting text from PDF ${i + 1}/${pdfs.length}: ${file.name}`
          );

          const caption = await this.generatePdfCaption(file);
          
          captionedFiles.push({
            file,
            caption,
            thumbnail: null,
          });

          console.log(`[MemoryEngine] PDF processed: "${caption.substring(0, 80)}..."`);
        }
      }

      // =========================================
      // PHASE 3: Generate embeddings for all captions
      // =========================================
      await this.loadEmbeddingModel();

      const embeddedFiles: EmbeddedFile[] = [];

      for (let i = 0; i < captionedFiles.length; i++) {
        const captioned = captionedFiles[i];
        this.reportProgress(
          'embedding',
          i + 1,
          captionedFiles.length,
          `Generating vector ${i + 1}/${captionedFiles.length}`
        );

        const embedding = await this.generateEmbedding(captioned.caption);

        embeddedFiles.push({
          ...captioned,
          embedding,
        });

        // Thermal cooldown between embeddings
        if (i < captionedFiles.length - 1) {
          await delay(COOL_DOWN_EMBED_MS);
        }
      }

      // =========================================
      // PHASE 4: Save to database
      // =========================================
      this.reportProgress('saving', 0, embeddedFiles.length, 'Saving to database...');

      for (let i = 0; i < embeddedFiles.length; i++) {
        const embedded = embeddedFiles[i];
        await this.saveFileToDatabase(embedded);
        
        this.reportProgress(
          'saving',
          i + 1,
          embeddedFiles.length,
          `Saved ${i + 1}/${embeddedFiles.length}`
        );
      }

      // =========================================
      // PHASE 5: Complete
      // =========================================
      // Note: We keep embedding model loaded for search queries

      this.reportProgress('complete', totalFiles, totalFiles, `${totalFiles} files indexed`);
      console.log(`[MemoryEngine] Indexing complete: ${totalFiles} files processed`);

    } catch (error) {
      this.reportProgress('error', 0, 0, `Error: ${error}`);
      console.error('[MemoryEngine] Indexing failed:', error);
      
      // Cleanup on error
      await this.unloadVisionModel();
      await this.unloadEmbeddingModel();
      
      throw error;
    }
  }

  /**
   * Save a single embedded file to the database
   */
  private async saveFileToDatabase(embedded: EmbeddedFile): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      console.log(`[MemoryEngine] Saving file: ${embedded.file.name}`);
      
      // Insert file metadata - use executeSync to avoid async hanging
      console.log('[MemoryEngine] Inserting file metadata...');
      const result = this.db.executeSync(
        `INSERT INTO files (uri, filename, file_type, caption, thumbnail, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          embedded.file.uri,
          embedded.file.name,
          embedded.file.type,
          embedded.caption,
          embedded.thumbnail,
          Date.now(),
        ]
      );

      const fileId = result.insertId!;
      console.log(`[MemoryEngine] File metadata saved with ID: ${fileId}`);

      // Insert vector - use executeSync
      console.log(`[MemoryEngine] Inserting vector (${embedded.embedding.length} dimensions)...`);
      const vectorJson = vectorToJson(embedded.embedding);
      console.log(`[MemoryEngine] Vector JSON length: ${vectorJson.length} chars`);
      
      this.db.executeSync(
        `INSERT INTO file_vectors (file_id, embedding) VALUES (?, ?)`,
        [fileId, vectorJson]
      );

      console.log(`[MemoryEngine] Saved file ${fileId}: ${embedded.file.name}`);
    } catch (error) {
      console.error('[MemoryEngine] Failed to save file:', error);
      throw error;
    }
  }

  /**
   * Search for files matching the query
   * Uses brute-force cosine similarity (good enough for <1000 files)
   * Serializes concurrent searches to prevent race conditions
   */
  async search(query: string): Promise<SearchResult[]> {
    if (!this.db) {
      await this.initialize();
    }

    if (!query.trim()) {
      return [];
    }

    // If a search is already in progress, queue this one
    if (this.searchInProgress) {
      console.log(`[MemoryEngine] Search already in progress, queueing: "${query}"`);
      return new Promise((resolve, reject) => {
        // Clear any existing queued searches (only keep the latest)
        this.searchQueue = [];
        this.searchQueue.push({ query, resolve, reject });
      });
    }

    this.searchInProgress = true;

    try {
      const results = await this.executeSearch(query);
      return results;
    } finally {
      this.searchInProgress = false;
      
      // Process next queued search if any
      if (this.searchQueue.length > 0) {
        const next = this.searchQueue.shift()!;
        console.log(`[MemoryEngine] Processing queued search: "${next.query}"`);
        this.search(next.query).then(next.resolve).catch(next.reject);
      }
    }
  }

  /**
   * Internal search implementation
   * Uses hybrid approach: semantic similarity + keyword matching
   */
  private async executeSearch(query: string): Promise<SearchResult[]> {
    try {
      // Ensure embedding model is loaded for query vectorization
      if (!this.embeddingModel) {
        console.log('[MemoryEngine] Loading embedding model for search...');
        await this.loadEmbeddingModel();
      }

      // Generate query embedding for semantic search
      console.log(`[MemoryEngine] Generating embedding for query: "${query}"`);
      const queryEmbedding = await this.generateEmbedding(query);
      console.log(`[MemoryEngine] Query embedding generated, ${queryEmbedding.length} dimensions`);

      // Get all files with their vectors using sync execution
      console.log('[MemoryEngine] Fetching files from database...');
      const results = this.db!.executeSync(
        `SELECT 
          f.id,
          f.uri,
          f.filename,
          f.file_type,
          f.caption,
          f.thumbnail,
          f.created_at,
          v.embedding
         FROM files f
         INNER JOIN file_vectors v ON f.id = v.file_id`
      );

      console.log(`[MemoryEngine] Found ${results.rows?.length || 0} files in database`);

      if (!results.rows || results.rows.length === 0) {
        console.log('[MemoryEngine] No files in database');
        return [];
      }

      // Calculate hybrid score (semantic + keyword) for each file
      const scored = results.rows.map((row: any) => {
        const fileEmbedding = jsonToVector(row.embedding);
        const semanticScore = cosineSimilarity(queryEmbedding, fileEmbedding);
        
        // Keyword matching on caption and filename
        const captionKeywordScore = keywordMatchScore(query, row.caption || '');
        const filenameKeywordScore = keywordMatchScore(query, row.filename || '');
        const keywordScore = Math.max(captionKeywordScore, filenameKeywordScore);
        
        // Hybrid score: 60% semantic + 40% keyword boost
        // If keywords match, boost the score significantly
        const hybridScore = semanticScore * 0.6 + keywordScore * 0.4;
        
        // Normalize to 0-1 range and boost for display
        const displaySimilarity = Math.min(1, hybridScore * 1.5);
        
        return {
          id: row.id,
          uri: row.uri,
          filename: row.filename,
          file_type: row.file_type as 'image' | 'pdf',
          caption: row.caption,
          thumbnail: row.thumbnail,
          created_at: row.created_at,
          distance: 1 - displaySimilarity,
          similarity: displaySimilarity,
        };
      });

      // Sort by similarity (highest first) and take top K
      const searchResults = scored
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, SEARCH_RESULTS_LIMIT);

      console.log(`[MemoryEngine] Search "${query}" returned ${searchResults.length} results`);
      return searchResults;

    } catch (error) {
      console.error('[MemoryEngine] Search failed:', error);
      return []; // Return empty results on error instead of throwing
    }
  }

  /**
   * Get all indexed files
   */
  async getAllFiles(): Promise<FileRecord[]> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      console.log('[MemoryEngine] Getting all files...');
      const results = this.db!.executeSync(
        `SELECT id, uri, filename, file_type, caption, thumbnail, created_at
         FROM files
         ORDER BY created_at DESC`
      );

      const files = (results.rows || []).map((row: any) => ({
        id: row.id,
        uri: row.uri,
        filename: row.filename,
        file_type: row.file_type as 'image' | 'pdf',
        caption: row.caption,
        thumbnail: row.thumbnail,
        created_at: row.created_at,
      }));
      
      console.log(`[MemoryEngine] Retrieved ${files.length} files`);
      return files;
    } catch (error) {
      console.error('[MemoryEngine] Failed to get all files:', error);
      return [];
    }
  }

  /**
   * Get count of indexed files
   */
  async getFileCount(): Promise<number> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const result = this.db!.executeSync('SELECT COUNT(*) as count FROM files');
      const count = (result.rows?.[0] as any)?.count || 0;
      console.log(`[MemoryEngine] File count: ${count}`);
      return count;
    } catch (error) {
      console.error('[MemoryEngine] Failed to get file count:', error);
      return 0;
    }
  }

  /**
   * Clear all indexed data
   */
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      this.db!.executeSync('DELETE FROM file_vectors');
      this.db!.executeSync('DELETE FROM files');
      console.log('[MemoryEngine] All data cleared');
    } catch (error) {
      console.error('[MemoryEngine] Failed to clear data:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.unloadVisionModel();
    await this.unloadEmbeddingModel();
    
    if (this.db) {
      // op-sqlite doesn't have explicit close, handled by GC
      this.db = null;
    }
    
    this.isInitialized = false;
    console.log('[MemoryEngine] Destroyed');
  }
}

// Singleton instance
let engineInstance: MemoryEngine | null = null;

export const getMemoryEngine = (): MemoryEngine => {
  if (!engineInstance) {
    engineInstance = new MemoryEngine();
  }
  return engineInstance;
};
