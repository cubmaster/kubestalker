const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, 'src', 'assets', 'icon.svg');
const svg = fs.readFileSync(svgPath);

async function generate() {
  // 256x256 PNG for Electron window icon and electron-builder
  await sharp(svg).resize(256, 256).png().toFile(path.join(__dirname, 'src', 'assets', 'icon.png'));

  // 512x512 for high-res
  await sharp(svg).resize(512, 512).png().toFile(path.join(__dirname, 'src', 'assets', 'icon-512.png'));

  // 1024x1024 for macOS icns source
  await sharp(svg).resize(1024, 1024).png().toFile(path.join(__dirname, 'src', 'assets', 'icon-1024.png'));

  console.log('Icons generated successfully.');
}

generate().catch(console.error);
