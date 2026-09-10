const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for standard PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(crcBuf);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function generatePng(width, height, isMaskable = false) {
  // Generate RGBA buffer
  // Scanline size = 1 filter byte + width * 4 bytes
  const scanlineSize = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = width * (isMaskable ? 0.48 : 0.44);
  const innerR = width * 0.36;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background gradient (indigo #4338ca -> #312e81)
      const gradFactor = (x + y) / (width + height);
      let r = Math.round(79 * (1 - gradFactor) + 49 * gradFactor);
      let g = Math.round(70 * (1 - gradFactor) + 46 * gradFactor);
      let b = Math.round(229 * (1 - gradFactor) + 129 * gradFactor);
      let a = 255;

      if (!isMaskable) {
        // Rounded corners for standard icons
        const cornerR = width * 0.22;
        const cornerDistX = Math.max(0, Math.abs(dx) - (cx - cornerR));
        const cornerDistY = Math.max(0, Math.abs(dy) - (cy - cornerR));
        const cornerDist = Math.sqrt(cornerDistX * cornerDistX + cornerDistY * cornerDistY);
        if (cornerDist > cornerR) {
          a = 0;
        }
      }

      // If within icon shape, draw retention symbol (shield & pulse)
      if (a > 0) {
        // Shield polygon boundary
        const relY = (y - cy * 0.3) / (height * 0.65);
        const relX = Math.abs(dx) / (width * 0.32);
        
        let inShield = false;
        if (relY >= 0 && relY <= 1) {
          if (relY < 0.5) {
            inShield = relX <= 1.0;
          } else {
            // Curving down to bottom point
            inShield = relX <= 1.0 - Math.pow(relY - 0.5, 2) * 3.5;
          }
        }

        if (inShield) {
          // Shield rim or interior
          r = Math.round(r * 0.35 + 24);
          g = Math.round(g * 0.35 + 24);
          b = Math.round(b * 0.35 + 64);

          // Pulse line coordinates: y around cy
          const pulseY = cy + Math.sin(dx / (width * 0.08)) * (width * 0.08) * (Math.abs(dx) < width * 0.22 ? 1 : 0);
          if (Math.abs(y - pulseY) < width * 0.02) {
            // Cyan/white pulse line
            r = 255;
            g = 255;
            b = 255;
          }

          // Center spark dot
          const dotDist = Math.sqrt(dx * dx + (y - cy * 0.7) * (y - cy * 0.7));
          if (dotDist < width * 0.045) {
            r = 56;
            g = 189;
            b = 248; // sky-400
          }
        }

        // Circular aura ring
        if (Math.abs(dist - innerR) < width * 0.015) {
          r = Math.min(255, r + 90);
          g = Math.min(255, g + 90);
          b = 255;
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // Compress rawData
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type 6 (RGBA)
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(__dirname, '../public');

// Generate 192x192
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192, false));
console.log('Created pwa-192x192.png');

// Generate 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512, false));
console.log('Created pwa-512x512.png');

// Generate maskable 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
console.log('Created pwa-maskable-512x512.png');

// Generate Apple Touch Icon 180x180
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180, false));
console.log('Created apple-touch-icon.png');

// Generate favicon.png
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), generatePng(64, 64, false));
console.log('Created favicon.ico');

// Generate screenshots for PWABuilder
fs.writeFileSync(path.join(publicDir, 'screenshot-desktop.png'), generatePng(1280, 720, true));
console.log('Created screenshot-desktop.png');

fs.writeFileSync(path.join(publicDir, 'screenshot-mobile.png'), generatePng(540, 960, true));
console.log('Created screenshot-mobile.png');
