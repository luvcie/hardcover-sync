const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../src/icons');
const outputFile = path.join(outputDir, 'icon.svg');

// Colors
const BOOKMARK_COLOR = '#6366f1';
const SPARKLE_COLOR = '#312e81';

// Bookmark Path (Original viewbox roughly 16x24)
const bookmarkD = "M1 0H15C15.5523 0 16 0.447715 16 1V22.3398C16 22.8921 15.5523 23.3398 15 23.3398C14.8024 23.3398 14.6092 23.2812 14.4449 23.1715L8.5551 19.2406C8.219 19.0162 7.781 19.0162 7.4449 19.2406L1.55514 23.1715C1.09577 23.4781 0.47484 23.3543 0.16824 22.8949C0.05854 22.7305 0 22.5374 0 22.3398V1C0 0.447715 0.44772 0 1 0z";

// Sparkles Path (Original viewbox 512x512)
const sparklePath1 = "M259.92,262.91,216.4,149.77a9,9,0,0,0-16.8,0L156.08,262.91a9,9,0,0,1-5.17,5.17L37.77,311.6a9,9,0,0,0,0,16.8l113.14,43.52a9,9,0,0,1,5.17,5.17L199.6,490.23a9,9,0,0,0,16.8,0l43.52-113.14a9,9,0,0,1,5.17-5.17L378.23,328.4a9,9,0,0,0,0-16.8L265.09,268.08A9,9,0,0,1,259.92,262.91Z";
const sparklePath2 = "M108 68 L88 16 L68 68 L16 88 L68 108 L88 160 L108 108 L160 88 L108 68 Z";
const sparklePath3 = "M426.67 117.33 L400 48 L373.33 117.33 L304 144 L373.33 170.67 L400 240 L426.67 170.67 L496 144 L426.67 117.33 Z";

// Composite SVG
// Canvas size 24x24.
// Bookmark centered: translate(4, 0).
// Sparkles centered on bookmark: center of bookmark is (8, 12). Global (12, 12).
// Sparkles scale: 512 -> 10 units? Scale 0.02.
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(4, 0)">
    <path d="${bookmarkD}" fill="${BOOKMARK_COLOR}" />
    
    <g transform="translate(9, 10) scale(0.02) translate(-256, -256)">
      <path d="${sparklePath1}" fill="${SPARKLE_COLOR}" />
      
      <path d="${sparklePath3}" fill="${SPARKLE_COLOR}" />
    </g>
  </g>
</svg>`;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, svgContent);
console.log(`Created ${outputFile}`);
