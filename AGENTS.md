# AGENTS.md - Recall App

## Hackathon Context
**Mobile AI Hackathon: Cactus x Nothing x Hugging Face** (Nov 28-29, 2025)
- **Track 1: Memory Master** - Shared memory/knowledge base for local LLMs
- **MUST use Cactus SDK** for on-device inference - NO cloud APIs allowed
- **Requirements**: Total privacy (data never leaves device), zero latency, offline-first
- **Deliverable**: Working APK with functional AI features running locally

## What the App Does
**Recall** is a semantic search app for images and PDFs:
1. User selects images/PDFs from device
2. Vision model generates captions for images (on-device)
3. Embedding model converts captions to vectors
4. Vectors stored in SQLite with sqlite-vec
5. User searches with natural language → semantic vector search returns relevant files

## Build & Run Commands
- `bun install` - Install dependencies
- `npx expo start --dev-client` - Start Metro bundler (for development)
- `npx expo run:android` - Build and run debug APK on connected device
- `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` - Build release APK
- `npx tsc --noEmit` - Type check
- **Release APK location**: `android/app/build/outputs/apk/release/app-release.apk`

## Key Fix: Java 17 Required
React Native Gradle plugin doesn't support Java 25. Add this to `android/gradle.properties`:
```
org.gradle.java.home=/usr/lib/jvm/java-17-openjdk
```

## Code Style
- **TypeScript**: Strict mode enabled, use explicit types for function params/returns
- **Imports**: React first, then external libs, then local (`@/*` alias for `src/*`)
- **Components**: Functional components with `React.FC<Props>`, props interface above component
- **Naming**: PascalCase components/types, camelCase functions/variables, SCREAMING_SNAKE constants
- **Files**: Components in `src/components/`, screens in `src/screens/`, business logic in `src/services/`

## Error Handling
- Wrap async operations in try/catch, log with `console.error('[ModuleName] message:', error)`
- Services return empty arrays/null on failure, never throw to UI layer
- Use `executeSync()` for SQLite operations (not async `execute()`)

## Key Architecture

### File Structure
```
src/
├── components/       # Reusable UI components
│   ├── FileCard.tsx
│   ├── MasonryGrid.tsx
│   ├── ProgressIndicator.tsx
│   └── SearchBar.tsx
├── constants/
│   └── config.ts     # All configuration, model options, theme
├── hooks/
│   └── useMemoryEngine.ts  # React hook for engine state
├── screens/
│   ├── HomeScreen.tsx      # Main search interface
│   └── IndexingScreen.tsx  # "Dreaming" phase with model selector
├── services/
│   ├── FileProcessor.ts    # File picking and validation
│   └── MemoryEngine.ts     # Core AI/DB singleton service
└── types/
    └── index.ts      # TypeScript interfaces
```

### Core Services
- **MemoryEngine.ts**: Singleton AI/DB service - use `getMemoryEngine()`
  - `indexFiles(files)` - Main indexing pipeline
  - `search(query)` - Semantic vector search
  - `setVisionModel(slug)` - Select which vision model to use
- **useMemoryEngine.ts**: React hook exposing engine state and actions

### Models (via Cactus SDK)
| Model | Slug | Size | Purpose |
|-------|------|------|---------|
| LFM2 VL 450M | `lfm2-vl-450m` | 420 MB | Vision/captioning (default) |
| LFM2 VL 1.6B | `lfm2-vl-1.6b` | 1440 MB | Better captions, more RAM |
| Qwen3 0.6B | `qwen3-0.6` | 394 MB | Text embeddings |

Models are downloaded on first use from Cactus servers.

## OOM Prevention (CRITICAL)
The vision model crashed on 8GB devices. These fixes are in place:

### Image Resizing (in MemoryEngine.ts)
```typescript
ImageResizer.createResizedImage(
  uri,
  512,   // max width
  512,   // max height
  'JPEG',
  60,    // quality 60%
)
```
This reduces images from ~5-12MB to ~20-50KB before vision model processing.

### Memory Management
| Setting | Value | Location |
|---------|-------|----------|
| Image resize | 512x512 @ 60% | `resizeImageForVision()` |
| Context size | 128 tokens | `config.ts` |
| Max output tokens | 100 | `config.ts` |
| Cooldown between images | 5000ms | `config.ts` |
| Model reset after each image | Yes | `indexFiles()` |
| Unload embedding before vision | Yes | `indexFiles()` |

### Indexing Pipeline
```
1. Unload embedding model (free RAM)
2. Load selected vision model
3. For each image:
   ├── Resize to 512x512 @ 60% JPEG
   ├── Copy to readable temp path
   ├── Generate caption (vision model)
   ├── Delete temp resized file
   ├── Reset model context
   └── Wait 5s cooldown
4. Unload vision model
5. Load embedding model
6. Generate embeddings for all captions
7. Save to SQLite database
```

## Database Schema (SQLite + sqlite-vec)
```sql
-- File metadata
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,  -- 'image' or 'pdf'
  caption TEXT,
  thumbnail TEXT,
  created_at INTEGER NOT NULL
);

-- Vector embeddings (JSON-serialized)
CREATE TABLE file_vectors (
  file_id INTEGER PRIMARY KEY,
  embedding TEXT NOT NULL,  -- JSON array of floats
  FOREIGN KEY (file_id) REFERENCES files(id)
);
```

Search uses brute-force cosine similarity (fast enough for <1000 files).

## PDF Handling
PDFs use filename-based captions (no text extraction):
```typescript
// "invoice_january_2024.pdf" → "PDF document: invoice january 2024"
const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
return `PDF document: ${cleanName}`;
```

## Vision Caption Prompt
Located in `config.ts`:
```
Describe this image in detail for search purposes. Include:
- Main subjects (people, objects, animals)
- Actions or activities happening
- Setting or location (indoor/outdoor, room type, place)
- Notable colors, text, or brands visible
- Mood or context of the scene
Be specific and descriptive.
```

## UI Theme (Nothing OS Aesthetic)
- Black background (#000000)
- Red accent (#FF0000)
- Monospace fonts throughout
- Minimal, clean design

## Debugging
- Check Metro logs: `tail -f /tmp/metro.log`
- Check device logs: `adb logcat | grep -i "memoryengine\|cactus\|reactnative"`
- Query database: 
  ```bash
  adb shell "run-as com.cooperelixer.recallapp cat databases/recall.db" > /tmp/recall.db
  sqlite3 /tmp/recall.db "SELECT id, filename, caption FROM files;"
  ```

## Known Issues & Solutions
| Issue | Solution |
|-------|----------|
| Gradle error "25.0.1" | Java 25 incompatible, use Java 17 |
| Vision model OOM crash | Image resizing to 512x512 @ 60% |
| armeabi-v7a build fails | Build only arm64: `-PreactNativeArchitectures=arm64-v8a` |
| Slow app startup (5-10s) | Normal - DB connection + React init |

## Dependencies
- `cactus-react-native` - On-device LLM inference
- `@op-engineering/op-sqlite` - SQLite with sqlite-vec support
- `react-native-image-resizer` - Image compression before AI processing
- `react-native-document-picker` - File selection
- `react-native-fs` - File system operations
