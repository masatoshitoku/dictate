#!/bin/bash

# Create app icon from SVG
# Requires: qlmanage (built into macOS) or sips

cd "$(dirname "$0")"

# Create iconset directory
ICONSET="icon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# Use qlmanage to convert SVG to PNG (macOS built-in)
# First create a 1024x1024 PNG from SVG
echo "Converting SVG to PNG..."

# If rsvg-convert is available, use it (more accurate)
if command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w 1024 -h 1024 icon.svg > icon_1024.png
else
    # Fallback: Use macOS qlmanage
    qlmanage -t -s 1024 -o . icon.svg 2>/dev/null
    if [ -f "icon.svg.png" ]; then
        mv icon.svg.png icon_1024.png
    else
        echo "Error: Could not convert SVG to PNG."
        echo "Please install librsvg: brew install librsvg"
        exit 1
    fi
fi

# Check if we have the base PNG
if [ ! -f "icon_1024.png" ]; then
    echo "Error: Failed to create icon_1024.png"
    exit 1
fi

echo "Creating iconset..."

# Generate all required sizes using sips
sips -z 16 16     icon_1024.png --out "$ICONSET/icon_16x16.png" 2>/dev/null
sips -z 32 32     icon_1024.png --out "$ICONSET/icon_16x16@2x.png" 2>/dev/null
sips -z 32 32     icon_1024.png --out "$ICONSET/icon_32x32.png" 2>/dev/null
sips -z 64 64     icon_1024.png --out "$ICONSET/icon_32x32@2x.png" 2>/dev/null
sips -z 128 128   icon_1024.png --out "$ICONSET/icon_128x128.png" 2>/dev/null
sips -z 256 256   icon_1024.png --out "$ICONSET/icon_128x128@2x.png" 2>/dev/null
sips -z 256 256   icon_1024.png --out "$ICONSET/icon_256x256.png" 2>/dev/null
sips -z 512 512   icon_1024.png --out "$ICONSET/icon_256x256@2x.png" 2>/dev/null
sips -z 512 512   icon_1024.png --out "$ICONSET/icon_512x512.png" 2>/dev/null
sips -z 1024 1024 icon_1024.png --out "$ICONSET/icon_512x512@2x.png" 2>/dev/null

echo "Creating icns file..."

# Convert iconset to icns
iconutil -c icns "$ICONSET" -o icon.icns

# Cleanup
rm -rf "$ICONSET"

# Keep the 1024 PNG for reference
mv icon_1024.png icon.png

echo "Done! Created icon.icns and icon.png"
ls -la icon.icns icon.png
