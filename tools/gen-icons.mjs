import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'public');

mkdirSync(out, { recursive: true });

const PRIMARY = '#05668D';
const ACCENT = '#00A896';
const MINT = '#02C39A';
const BG = '#f0faf7';
const DARK = '#022b3a';

// Master 1024x1024 rounded tile: gradient + white cross + pulse line
const master = (safe = false) => {
  const pad = safe ? 128 : 0; // maskable safe zone (min 40%/edge)
  const box = 1024 - pad * 2;
  const cx = 512;
  const cy = 512;

  // Cross geometry
  const arm = box * 0.34;        // half-arm length
  const thick = box * 0.20;      // bar thickness
  const r = thick * 0.5;         // rounded end radius

  // Pulse line geometry (ECG spike)
  const pl = box * 0.42;         // half length
  const base = cy;
  const spike = box * 0.16;      // spike height

  const cross = `
    <rect x="${cx - thick / 2}" y="${cx - arm}" width="${thick}" height="${arm * 2}" rx="${r}" fill="#ffffff"/>
    <rect x="${cx - arm}" y="${cx - thick / 2}" width="${arm * 2}" height="${thick}" rx="${r}" fill="#ffffff"/>
  `;

  const pulseWrap = `
    <g stroke="${ACCENT}" stroke-width="${thick * 0.35}" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M ${cx - pl} ${base}
               L ${cx - pl * 0.40} ${base}
               L ${cx - pl * 0.22} ${base - spike}
               L ${cx - pl * 0.02} ${base + spike * 0.55}
               L ${cx + pl * 0.14} ${base}
               L ${cx + pl * 0.42} ${base}
               L ${cx + pl * 0.60} ${base + spike}
               L ${cx + pl * 0.80} ${base}
               L ${cx + pl} ${base}"/>
    </g>
  `;

  const defs = `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${ACCENT}"/>
        <stop offset="0.55" stop-color="${PRIMARY}"/>
        <stop offset="1" stop-color="#043a54"/>
      </linearGradient>
    </defs>
  `;

  const bgRect = safe
    ? `<rect width="1024" height="1024" fill="url(#g)"/>`
    : `<rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${box * 0.18}" fill="url(#g)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${defs}
  ${bgRect}
  ${cross}
  ${pulseWrap}
</svg>`;
};

const svgMaster = master(false);
const svgMaskable = master(true);

// Favicon (inline SVG, 48px viewbox scaled)
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="0.55" stop-color="${PRIMARY}"/>
      <stop offset="1" stop-color="#043a54"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="46" height="46" rx="10" fill="url(#g)"/>
  <rect x="20.5" y="12" width="7" height="24" rx="3.5" fill="#ffffff"/>
  <rect x="12" y="20.5" width="24" height="7" rx="3.5" fill="#ffffff"/>
  <g stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M 9 24 L 17.5 24 L 19.5 19.5 L 21.5 28.5 L 23.5 24 L 30 24 C 32 24 33.5 25 33.5 27"/>
  </g>
</svg>`;

// OG image: flat gradient banner with heartbeat line + mark
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="og" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="0.55" stop-color="${PRIMARY}"/>
      <stop offset="1" stop-color="#043a54"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#d8eef4"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#og)"/>
  <circle cx="150" cy="315" r="135" fill="#fff" fill-opacity="0.10"/>
  <circle cx="1050" cy="80" r="180" fill="#fff" fill-opacity="0.08"/>
  <g transform="translate(200 315)">
    <rect x="-27" y="-52" width="54" height="104" rx="27" fill="url(#tile)"/>
    <rect x="-52" y="-27" width="104" height="54" rx="27" fill="url(#tile)"/>
  </g>
  <g transform="translate(160 315)" stroke="${DARK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M 0 0 L 120 0 L 150 -40 L 200 45 L 245 0 L 420 0"/>
  </g>
  <text x="470" y="300" font-family="Inter, Arial, Helvetica, sans-serif" font-size="86" font-weight="700" fill="#ffffff">MediQueue</text>
  <text x="472" y="360" font-family="Inter, Arial, Helvetica, sans-serif" font-size="34" font-weight="500" fill="#d8f1ef">Hospital queue management, simplified.</text>
</svg>`;

const png = (svg, size, path) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(path);

writeFileSync(join(out, 'favicon.svg'), favicon);
writeFileSync(join(out, 'pwa-maskable.svg'), svgMaskable);
writeFileSync(join(out, 'icon-master.svg'), svgMaster);

await Promise.all([
  png(svgMaster, 192, join(out, 'pwa-192x192.png')),
  png(svgMaster, 512, join(out, 'pwa-512x512.png')),
  png(svgMaskable, 512, join(out, 'pwa-maskable-512x512.png')),
  png(svgMaskable, 180, join(out, 'apple-touch-icon.png')),
  png(og, 1200, join(out, 'og-image.png')),
]);

console.log('Icons generated in', out);