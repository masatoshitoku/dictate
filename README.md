# Dictate

AI-powered voice dictation app for macOS. Speak and have your text automatically transcribed, cleaned up, and typed into any application.

## Features

- **Voice to Text**: Record your voice and have it transcribed using Gemini AI
- **Text Formatting**: Automatically removes filler words (えっと, あの, etc.), handles corrections, and adds punctuation
- **Direct Typing**: Types the result directly into any active application using macOS keystroke simulation
- **Global Hotkey**: Press `Option+Space` from anywhere to start/stop recording
- **System Tray**: Runs in the background with a menu bar icon
- **Auto-Update**: Automatically checks for updates from GitHub Releases

## Installation

Download the latest release from [GitHub Releases](https://github.com/MasatoshiToku/dictate/releases).

### Manual Build

```bash
npm install
npm run dist:mac
```

## Requirements

- macOS
- Gemini API key

## Usage

1. Start the app
2. Grant microphone permission when prompted
3. Grant accessibility permission (System Settings > Privacy & Security > Accessibility)
4. Enter your Gemini API key in Settings
5. Press `Option+Space` to start recording
6. Speak your text
7. Press `Option+Space` again to stop recording
8. The transcribed and formatted text will be typed into the active application

## Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build

# Create distribution package
npm run dist:mac
```

## Project Structure

```
dictate/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Main entry point
│   │   ├── tray.ts     # System tray management
│   │   ├── shortcuts.ts # Global hotkey handling
│   │   ├── text-input.ts # AppleScript keystroke
│   │   └── services/
│   │       ├── gemini.ts       # Gemini API integration
│   │       ├── audio-recorder.ts
│   │       └── updater.ts      # Auto-update service
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
- electron-updater for auto-updates

## License

MIT
