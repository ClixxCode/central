import sharp from "sharp";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const PUBLIC_DIR = join(process.cwd(), "public");
const ICONS_DIR = join(PUBLIC_DIR, "icons");

async function generateIcons() {
  console.log("Generating PWA icons...");

  // Ensure icons directory exists
  await mkdir(ICONS_DIR, { recursive: true });

  // Read the SVG source
  const svgPath = join(ICONS_DIR, "icon.svg");
  const svgBuffer = await readFile(svgPath);

  // Generate icons for each size
  for (const size of ICON_SIZES) {
    const outputPath = join(ICONS_DIR, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Generated: icon-${size}x${size}.png`);
  }

  // Generate Apple touch icon (180x180)
  const appleTouchIconPath = join(PUBLIC_DIR, "apple-touch-icon.png");
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(appleTouchIconPath);
  console.log("  Generated: apple-touch-icon.png");

  // Generate favicon (32x32)
  const faviconPath = join(PUBLIC_DIR, "favicon.ico");
  await sharp(svgBuffer)
    .resize(32, 32)
    .toFile(faviconPath);
  console.log("  Generated: favicon.ico");

  // Generate favicon-16x16 and favicon-32x32
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(join(PUBLIC_DIR, "favicon-16x16.png"));
  console.log("  Generated: favicon-16x16.png");

  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(join(PUBLIC_DIR, "favicon-32x32.png"));
  console.log("  Generated: favicon-32x32.png");

  // Generate shortcut icons
  await generateShortcutIcon("tasks", "#3b82f6");
  await generateShortcutIcon("clients", "#8b5cf6");

  console.log("\nAll icons generated successfully!");
}

async function generateShortcutIcon(name: string, color: string) {
  const size = 96;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="16" fill="${color}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="white" fill-opacity="0.9"/>
  </svg>`;

  const outputPath = join(ICONS_DIR, `shortcut-${name}.png`);
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`  Generated: shortcut-${name}.png`);
}

// Generate placeholder screenshots
async function generateScreenshots() {
  console.log("\nGenerating placeholder screenshots...");

  await mkdir(join(PUBLIC_DIR, "screenshots"), { recursive: true });

  // Desktop screenshot placeholder
  const desktopSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#f8fafc"/>
    <rect x="0" y="0" width="256" height="720" fill="#0f172a"/>
    <rect x="256" y="0" width="1024" height="64" fill="#ffffff"/>
    <text x="640" y="400" font-family="sans-serif" font-size="24" fill="#64748b" text-anchor="middle">
      Central - Desktop View
    </text>
  </svg>`;

  await sharp(Buffer.from(desktopSvg))
    .resize(1280, 720)
    .png()
    .toFile(join(PUBLIC_DIR, "screenshots", "desktop.png"));
  console.log("  Generated: screenshots/desktop.png");

  // Mobile screenshot placeholder
  const mobileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 1334">
    <rect width="750" height="1334" fill="#f8fafc"/>
    <rect x="0" y="0" width="750" height="64" fill="#0f172a"/>
    <text x="375" y="700" font-family="sans-serif" font-size="24" fill="#64748b" text-anchor="middle">
      Central - Mobile View
    </text>
  </svg>`;

  await sharp(Buffer.from(mobileSvg))
    .resize(750, 1334)
    .png()
    .toFile(join(PUBLIC_DIR, "screenshots", "mobile.png"));
  console.log("  Generated: screenshots/mobile.png");
}

async function main() {
  try {
    await generateIcons();
    await generateScreenshots();
  } catch (error) {
    console.error("Error generating icons:", error);
    process.exit(1);
  }
}

main();
