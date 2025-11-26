// generate png icons using pngjs (pure javascript, no native dependencies)

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const iconsDir = path.join(__dirname, '../src/icons');
const sizes = [16, 32, 48, 128];

// goodreads colors (rgb)
const bgColor = { r: 56, g: 33, b: 21 };   // #382115
const fgColor = { r: 244, g: 241, b: 234 }; // #f4f1ea

// helper to set pixel color
function setPixel(png, x, y, color) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = 255; // alpha
}

// draw a line (bresenham's algorithm)
function drawLine(png, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    setPixel(png, x0, y0, color);

    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// draw a rectangle outline
function drawRect(png, x, y, w, h, color, lineWidth = 1) {
  for (let i = 0; i < lineWidth; i++) {
    // top
    drawLine(png, x + i, y + i, x + w - i, y + i, color);
    // bottom
    drawLine(png, x + i, y + h - i, x + w - i, y + h - i, color);
    // left
    drawLine(png, x + i, y + i, x + i, y + h - i, color);
    // right
    drawLine(png, x + w - i, y + i, x + w - i, y + h - i, color);
  }
}

// generate icons
sizes.forEach(size => {
  const png = new PNG({ width: size, height: size });

  // fill background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(png, x, y, bgColor);
    }
  }

  // draw book shape
  const margin = Math.floor(size / 8);
  const lineWidth = Math.max(1, Math.floor(size / 32));

  // book outline
  drawRect(png, margin, margin, size - margin * 2, size - margin * 2, fgColor, lineWidth);

  // book spine (vertical line)
  if (size >= 32) {
    const spineX = margin + Math.floor((size - margin * 2) / 4);
    for (let i = 0; i < lineWidth; i++) {
      drawLine(png, spineX + i, margin, spineX + i, size - margin, fgColor);
    }
  }

  // save png
  const filename = path.join(iconsDir, `icon${size}.png`);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filename, buffer);
  console.log(`created ${filename}`);
});

console.log('\npng icon generation complete!');
