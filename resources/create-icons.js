const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a simple 36x36 PNG with white circle and microphone icon
// Using native macOS tools

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="16" fill="none" stroke="#FFFFFF" stroke-width="2"/>
  <path d="M18 8c1.66 0 3 1.34 3 3v6c0 1.66-1.34 3-3 3s-3-1.34-3-3v-6c0-1.66 1.34-3 3-3z" fill="#FFFFFF"/>
  <path d="M24 17v1c0 3.31-2.69 6-6 6s-6-2.69-6-6v-1h-2v1c0 4.08 3.05 7.44 7 7.93V28h-3v2h8v-2h-3v-2.07c3.95-.49 7-3.85 7-7.93v-1h-2z" fill="#FFFFFF"/>
</svg>`;

fs.writeFileSync(path.join(__dirname, 'tray-icon.svg'), svgContent);
console.log('Created tray-icon.svg');

// For development, we'll use the SVG directly
// In production, you'd convert to PNG using tools like sharp or imagemagick
