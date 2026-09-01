import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Icon sizes for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Apple splash screen sizes (width x height)
const splashScreens = [
  { width: 2048, height: 2732, name: 'apple-splash-2048-2732.png' }, // 12.9" iPad Pro
  { width: 1668, height: 2388, name: 'apple-splash-1668-2388.png' }, // 11" iPad Pro
  { width: 1536, height: 2048, name: 'apple-splash-1536-2048.png' }, // 9.7" iPad
  { width: 1668, height: 2224, name: 'apple-splash-1668-2224.png' }, // 10.5" iPad Pro
  { width: 1620, height: 2160, name: 'apple-splash-1620-2160.png' }, // 10.2" iPad
  { width: 1290, height: 2796, name: 'apple-splash-1290-2796.png' }, // iPhone 15 Pro Max
  { width: 1179, height: 2556, name: 'apple-splash-1179-2556.png' }, // iPhone 15 Pro
  { width: 1170, height: 2532, name: 'apple-splash-1170-2532.png' }, // iPhone 14
  { width: 1125, height: 2436, name: 'apple-splash-1125-2436.png' }, // iPhone X/XS
  { width: 1242, height: 2688, name: 'apple-splash-1242-2688.png' }, // iPhone XS Max
  { width: 828, height: 1792, name: 'apple-splash-828-1792.png' },   // iPhone XR
  { width: 1080, height: 1920, name: 'apple-splash-1080-1920.png' }, // iPhone 8 Plus
  { width: 750, height: 1334, name: 'apple-splash-750-1334.png' },   // iPhone 8
];

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#f7f7f6"/>
  <circle cx="256" cy="256" r="164" fill="#e2472b"/>
  <text x="256" y="298" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-size="188" font-weight="700" fill="#f7f7f6" text-anchor="middle">$</text>
</svg>`;

// Maskable icon (content kept within the safe-zone circle, ~40% of canvas radius)
const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f7f7f6"/>
  <circle cx="256" cy="256" r="128" fill="#e2472b"/>
  <text x="256" y="286" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-size="148" font-weight="700" fill="#f7f7f6" text-anchor="middle">$</text>
</svg>`;

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Create icons directory
  const iconsDir = join(publicDir, 'icons');
  await mkdir(iconsDir, { recursive: true });

  // Generate standard icons
  for (const size of iconSizes) {
    const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created: icons/icon-${size}x${size}.png`);
  }

  // Generate maskable icons
  for (const size of iconSizes) {
    const outputPath = join(iconsDir, `icon-maskable-${size}x${size}.png`);
    await sharp(Buffer.from(svgMaskable))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created: icons/icon-maskable-${size}x${size}.png`);
  }

  // Generate Apple touch icon
  const appleTouchPath = join(publicDir, 'apple-touch-icon.png');
  await sharp(Buffer.from(svgIcon))
    .resize(180, 180)
    .png()
    .toFile(appleTouchPath);
  console.log('Created: apple-touch-icon.png');

  // Generate favicon
  const faviconPath = join(publicDir, 'favicon.ico');
  await sharp(Buffer.from(svgIcon))
    .resize(32, 32)
    .toFormat('png')
    .toFile(join(publicDir, 'favicon-32x32.png'));
  console.log('Created: favicon-32x32.png');

  await sharp(Buffer.from(svgIcon))
    .resize(16, 16)
    .toFormat('png')
    .toFile(join(publicDir, 'favicon-16x16.png'));
  console.log('Created: favicon-16x16.png');

  // Generate splash screens
  console.log('\nGenerating splash screens...');
  const splashDir = join(publicDir, 'splash');
  await mkdir(splashDir, { recursive: true });

  for (const screen of splashScreens) {
    const iconSize = Math.min(screen.width, screen.height) * 0.25;

    // Create splash screen with centered icon
    const splash = await sharp({
      create: {
        width: screen.width,
        height: screen.height,
        channels: 4,
        background: { r: 247, g: 247, b: 246, alpha: 1 } // #f7f7f6
      }
    })
    .composite([{
      input: await sharp(Buffer.from(svgIcon))
        .resize(Math.round(iconSize), Math.round(iconSize))
        .toBuffer(),
      gravity: 'center'
    }])
    .png()
    .toFile(join(splashDir, screen.name));

    console.log(`Created: splash/${screen.name}`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
