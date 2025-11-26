// simple icon generator using canvas
// creates basic book-shaped icons for the extension

const fs = require('fs');
const path = require('path');

// try to use canvas if available, otherwise create simple svg placeholders
let useCanvas = false;
let Canvas;

try {
  Canvas = require('canvas');
  useCanvas = true;
  console.log('using canvas to generate png icons');
} catch (e) {
  console.log('canvas not available, creating svg icons instead');
}

const iconsDir = path.join(__dirname, '../src/icons');
const sizes = [16, 32, 48, 128];

// goodreads colors
const bgColor = '#382115';
const fgColor = '#f4f1ea';

if (useCanvas) {
  // generate png icons using canvas
  sizes.forEach(size => {
    const canvas = Canvas.createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // draw a simple book shape
    ctx.strokeStyle = fgColor;
    ctx.fillStyle = fgColor;

    const margin = Math.floor(size / 8);
    const lineWidth = Math.max(1, Math.floor(size / 32));

    // book outline
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(margin, margin, size - margin * 2, size - margin * 2);

    // book spine
    if (size >= 32) {
      const spineX = margin + Math.floor((size - margin * 2) / 4);
      ctx.beginPath();
      ctx.moveTo(spineX, margin);
      ctx.lineTo(spineX, size - margin);
      ctx.stroke();
    }

    // save png
    const buffer = canvas.toBuffer('image/png');
    const filename = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(filename, buffer);
    console.log(`created ${filename}`);
  });
} else {
  // create svg icons and simple placeholder pngs
  sizes.forEach(size => {
    const margin = Math.floor(size / 8);
    const strokeWidth = Math.max(1, Math.floor(size / 32));
    const spineX = margin + Math.floor((size - margin * 2) / 4);

    // create svg
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${bgColor}"/>
  <rect x="${margin}" y="${margin}" width="${size - margin * 2}" height="${size - margin * 2}"
        fill="none" stroke="${fgColor}" stroke-width="${strokeWidth}"/>
  ${size >= 32 ? `<line x1="${spineX}" y1="${margin}" x2="${spineX}" y2="${size - margin}"
        stroke="${fgColor}" stroke-width="${strokeWidth}"/>` : ''}
</svg>`;

    const svgFilename = path.join(iconsDir, `icon${size}.svg`);
    fs.writeFileSync(svgFilename, svg);
    console.log(`created ${svgFilename}`);
  });

  console.log('\nsvg icons created. to convert to png, you can:');
  console.log('1. install canvas: npm install canvas');
  console.log('2. or use an online converter');
  console.log('3. or install imagemagick/inkscape and convert manually');
  console.log('\nfor now, you can try loading the extension - some browsers accept svg icons.');
}

console.log('\nicon generation complete!');
