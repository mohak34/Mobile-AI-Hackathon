# Recall

A semantic search app for your images and PDFs that runs completely on your phone. No cloud, no internet needed.

## Download

[Download APK](https://github.com/mohak34/Mobile-AI-Hackathon/releases/download/v1.0.0/app-release.apk)

## Demo

[Watch Demo Video](https://drive.google.com/file/d/1aCEBNFkmpVaL2LTEQxYSASCtm2Y3K1Ic/view?usp=drivesdk)

## What it does

1. You pick images or PDFs from your phone
2. The app uses an AI vision model to understand what's in each image and generates a description
3. These descriptions are converted into searchable vectors and stored locally
4. You can then search using natural language like "beach sunset" or "invoice from January" and it finds the matching files

Everything happens on-device. Your files never leave your phone.

## Models Used

| Model | Purpose | Size |
|-------|---------|------|
| LFM2 VL 450M | Generates captions for images (default) | 420 MB |
| LFM2 VL 1.6B | Higher quality captions, uses more RAM | 1440 MB |
| Nomic Embed v2 | Converts text to vectors for search | ~300 MB |

Models are provided by [Cactus SDK](https://github.com/cactus-compute/cactus) and downloaded on first use.

## Tech Stack

- React Native + Expo
- Cactus SDK for on-device AI inference
- SQLite with sqlite-vec for vector storage and search
- TypeScript

## Build

```bash
bun install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

APK will be at `android/app/build/outputs/apk/release/app-release.apk`

## Hackathon

Built for the Mobile AI Hackathon (Cactus x Nothing x Hugging Face) - Track 1: Memory Master
