/**
 * Recall App Configuration
 * Tuned for CMF Phone (Dimensity 7300)
 */

// Vision Model Options - Available from Cactus SDK
export interface VisionModelOption {
  slug: string;
  name: string;
  sizeMb: number;
  description: string;
  recommended?: boolean;
}

export const VISION_MODELS: VisionModelOption[] = [
  {
    slug: 'lfm2-vl-450m',
    name: 'LFM2 VL 450M',
    sizeMb: 420,
    description: 'Fast & lightweight, good for most images',
    recommended: true,
  },
  {
    slug: 'lfm2-vl-1.6b',
    name: 'LFM2 VL 1.6B',
    sizeMb: 1440,
    description: 'Better quality, slower, uses more RAM',
  },
  // Note: These models are on HuggingFace but may not be in SDK yet
  // Uncomment when available in Cactus SDK
  // {
  //   slug: 'smolvlm2-500m',
  //   name: 'SmolVLM2 500M',
  //   sizeMb: 400,
  //   description: 'HuggingFace SmolVLM, good balance',
  // },
  // {
  //   slug: 'internvl3-1b',
  //   name: 'InternVL3 1B',
  //   sizeMb: 600,
  //   description: 'High quality vision understanding',
  // },
];

// Default Model Configuration
export const DEFAULT_VISION_MODEL = 'lfm2-vl-450m';
export const EMBEDDING_MODEL = 'nomic2-embed-300m';
export const EMBEDDING_DIMENSION = 768;  // Nomic Embed V2 produces 768-dim vectors

export const CONTEXT_SIZE = 128;  // Minimum for vision - reduces RAM usage
export const EMBEDDING_CONTEXT_SIZE = 1024;  // Higher context for better PDF/text embeddings

// Feature Flags
export const USE_VISION_MODEL = true;  // Enable vision model for image captioning

// Vision model settings - increased for better captions
export const VISION_MAX_TOKENS = 100;  // Longer captions for better context

// Thermal Management (CMF Phone optimized)
// Longer cooldowns to allow memory cleanup between operations
export const COOL_DOWN_VISION_MS = 5000;    // 5s between image captions
export const COOL_DOWN_EMBED_MS = 500;      // Between embeddings
export const COOL_DOWN_MODEL_SWITCH_MS = 5000; // 5s between model load/unload

// File Limits
export const MAX_FILES = 50;
export const MIN_FILES = 1;
export const PDF_MAX_CHARS = 4000;  // Max characters to extract from PDF for caption
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const SUPPORTED_PDF_TYPES = ['application/pdf'];

// Search Configuration
export const SEARCH_RESULTS_LIMIT = 10;
export const SEARCH_DEBOUNCE_MS = 300;

// Database
export const DB_NAME = 'recall.db';

// UI Theme (Nothing OS Aesthetic)
export const THEME = {
  background: '#000000',
  surface: '#111111',
  surfaceLight: '#1A1A1A',
  card: '#222222',
  text: '#FFFFFF',
  textSecondary: '#999999',
  textMuted: '#666666',
  accent: '#FF0000',
  accentDim: '#CC0000',
  success: '#00FF00',
  warning: '#FFAA00',
  error: '#FF3333',
  border: '#333333',
} as const;

// Indexing Status Messages
export const STATUS_MESSAGES = {
  IDLE: 'Ready to index',
  LOADING_VISION: 'Loading vision model...',
  PROCESSING_IMAGES: 'Analyzing images...',
  UNLOADING_VISION: 'Freeing memory...',
  LOADING_EMBEDDING: 'Loading embedding model...',
  GENERATING_VECTORS: 'Generating search vectors...',
  SAVING: 'Saving to database...',
  COMPLETE: 'Indexing complete!',
  ERROR: 'Error occurred',
} as const;

// Vision Prompt for image captioning - detailed for better semantic search
export const VISION_CAPTION_PROMPT = `Describe this image in detail for search purposes. Include:
- Main subjects (people, objects, animals)
- Actions or activities happening
- Setting or location (indoor/outdoor, room type, place)
- Notable colors, text, or brands visible
- Mood or context of the scene
Be specific and descriptive.`;

// Vision Prompt for PDF captioning - focused on document content
export const PDF_CAPTION_PROMPT = `This is a page from a PDF document. Describe the content for search purposes. Include:
- Document type (invoice, letter, form, report, article, etc.)
- Key text, titles, or headings visible
- Important data, numbers, or dates
- Names of people, companies, or organizations
- Main topic or subject matter
Be specific about the document content.`;
