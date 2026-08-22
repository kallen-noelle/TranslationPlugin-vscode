// Rasterizes the original plugin logo (media/icon.svg) into a 128x128 PNG.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../media/icon.svg', import.meta.url), 'utf-8');
// Upscale the 32x32 SVG to 128x128.
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 128 }, background: 'transparent' });
const png = resvg.render().asPng();
writeFileSync(new URL('../media/icon.png', import.meta.url), png);
console.log('Wrote media/icon.png', png.length, 'bytes');
