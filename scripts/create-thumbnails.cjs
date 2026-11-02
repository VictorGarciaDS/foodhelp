const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const imageRoot = path.join(__dirname, '..', 'services', 'foodhelp-web', 'public', 'images');

async function main() {
  let originalBytes = 0;
  let thumbnailBytes = 0;
  let count = 0;
  for (const kind of ['recipes', 'foods']) {
    const sourceDirectory = path.join(imageRoot, kind);
    const outputDirectory = path.join(imageRoot, 'thumbnails', kind);
    await fs.mkdir(outputDirectory, { recursive: true });
    for (const file of await fs.readdir(sourceDirectory)) {
      if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) continue;
      const source = path.join(sourceDirectory, file);
      const target = path.join(outputDirectory, file.replace(/\.[^.]+$/, '.webp'));
      const size = kind === 'recipes' ? { width: 76, height: 64 } : { width: 32, height: 32 };
      const result = await sharp(source).rotate().resize({ ...size, fit: 'cover' }).webp({ quality: 45, effort: 4 }).toFile(target);
      originalBytes += (await fs.stat(source)).size;
      thumbnailBytes += result.size;
      count += 1;
    }
  }
  console.log(`Thumbnails: ${count}; originals: ${originalBytes} bytes; thumbnails: ${thumbnailBytes} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});