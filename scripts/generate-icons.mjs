// Regenerates public/icons/*.png. Run: node scripts/generate-icons.mjs
// Uses sharp (already installed as a dependency of Next.js).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const INK = "#12203a";
const CHEESE = "#f6c445";

// The mark is drawn in a 512 box. `scale` shrinks it toward the centre so the
// maskable variant keeps everything inside the 80% safe zone.
function svg(scale) {
  const t = (1 - scale) * 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${INK}"/>
  <g transform="translate(${t} ${t}) scale(${scale})">
    <circle cx="150" cy="170" r="70" fill="${CHEESE}"/>
    <circle cx="362" cy="170" r="70" fill="${CHEESE}"/>
    <circle cx="150" cy="170" r="36" fill="${INK}"/>
    <circle cx="362" cy="170" r="36" fill="${INK}"/>
    <ellipse cx="256" cy="278" rx="146" ry="130" fill="${CHEESE}"/>
    <circle cx="204" cy="262" r="16" fill="${INK}"/>
    <circle cx="308" cy="262" r="16" fill="${INK}"/>
    <circle cx="256" cy="330" r="18" fill="${INK}"/>
  </g>
</svg>`;
}

const jobs = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-maskable-512.png", 512, 0.74],
  ["apple-touch-icon.png", 180, 1],
];

const outDir = new URL("../public/icons/", import.meta.url);
await mkdir(outDir, { recursive: true });
for (const [name, size, scale] of jobs) {
  await sharp(Buffer.from(svg(scale)))
    .resize(size, size)
    .png()
    .toFile(new URL(name, outDir).pathname);
  console.log("wrote", name);
}
