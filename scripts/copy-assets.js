const fs = require('fs-extra');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const srcDir = path.join(__dirname, '../src');

// ensure dist directory exists
fs.ensureDirSync(distDir);

// copy manifest.json
fs.copySync(
  path.join(srcDir, 'manifest.json'),
  path.join(distDir, 'manifest.json')
);

// copy icons
if (fs.existsSync(path.join(srcDir, 'icons'))) {
  fs.copySync(
    path.join(srcDir, 'icons'),
    path.join(distDir, 'icons')
  );
}

// copy html files
const htmlFiles = ['popup.html', 'floating.html', 'settings.html'];
htmlFiles.forEach(file => {
  const srcFile = path.join(srcDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copySync(srcFile, path.join(distDir, file));
  }
});

// copy css files
if (fs.existsSync(path.join(srcDir, 'styles'))) {
  fs.copySync(
    path.join(srcDir, 'styles'),
    path.join(distDir, 'styles')
  );
}

console.log('assets copied successfully');
