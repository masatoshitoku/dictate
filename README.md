# Typeless Clone

AI-powered voice dictation app for macOS. Speak and have your text automatically transcribed, cleaned up, and typed into any application.

## Features

- **Voice to Text**: Record your voice and have it transcribed using Gemini AI
- **Text Formatting**: Automatically removes filler words (えっと, あの, etc.), handles corrections, and adds punctuation
- **Direct Typing**: Types the result directly into any active application using macOS keystroke simulation
- **Global Hotkey**: Press `Option+Space` from anywhere to start/stop recording
- **System Tray**: Runs in the background with a menu bar icon

## Requirements

- macOS
- Node.js 18+
- Gemini API key (set in `/Users/tokumasatoshi/Documents/Cursor/ClaudeCode.env` as `GEMINI_API`)

## Installation

```bash
cd /Users/tokumasatoshi/Documents/Cursor/typeless-clone
npm install --cache /tmp/npm-cache-temp
```

## Development

```bash
# Start the development server
npm run dev
```

This will:
1. Start the Vite dev server for the renderer process
2. Build and start the Electron main process

## Building for Production

```bash
npm run build
```

## Usage

1. Start the app
2. Grant microphone permission when prompted
3. Grant accessibility permission (System Preferences > Privacy & Security > Accessibility)
4. Press `Option+Space` to start recording
5. Speak your text
6. Press `Option+Space` again to stop recording
7. The transcribed and formatted text will be typed into the active application

## Project Structure

```
typeless-clone/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Main entry point
│   │   ├── tray.ts     # System tray management
│   │   ├── shortcuts.ts # Global hotkey handling
│   │   ├── text-input.ts # AppleScript keystroke
│   │   └── services/
│   │       ├── gemini.ts       # Gemini API integration
│   │       └── audio-recorder.ts
│   ├── preload/        # Electron preload scripts
│   ├── renderer/       # React UI
│   └── shared/         # Shared types
└── resources/          # App icons
```

## Permissions Required

- **Microphone**: For voice recording
- **Accessibility**: For typing text into other applications via AppleScript

## Tech Stack

- Electron + Vite + React + TypeScript
- Gemini API (gemini-2.0-flash) for speech recognition and text formatting
- Tailwind CSS for styling
- Zustand for state management
- electron-store for settings persistence
