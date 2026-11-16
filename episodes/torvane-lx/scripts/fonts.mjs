// Downloads subset woff2 files (Inter for Latin, Noto Sans TC for the characters used in src/content.js) into fonts/
// and writes fonts/fonts.css. The fonts are committed, so a render machine needs no system fonts.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const src = fs.readFileSync(path.join(root, 'src/content.js'), 'utf8');
const cjk = [...new Set([...src].filter((c) => c.charCodeAt(0) > 0x2000))].sort().join('');
let latin = '';
for (let c = 0x20; c < 0x7f; c++) latin += String.fromCharCode(c);

const jobs = [
  {family: 'Inter', weights: [400, 500, 600], text: latin},
  {family: 'Noto Sans TC', weights: [400, 500, 700], text: cjk},
];
let css = '';
for (const j of jobs) {
  const url = `https://fonts.googleapis.com/css2?family=${j.family.replace(/ /g, '+')}:wght@${j.weights.join(';')}&text=${encodeURIComponent(j.text)}`;
  const sheet = await (await fetch(url, {headers: {'User-Agent': UA}})).text();
  const faces = [...sheet.matchAll(/font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/g)];
  if (!faces.length) throw new Error('no font faces for ' + j.family + '\n' + sheet.slice(0, 300));
  for (const [, weight, href] of faces) {
    const file = `${j.family.replace(/ /g, '')}-${weight}.woff2`;
    fs.writeFileSync(path.join(root, 'fonts', file), Buffer.from(await (await fetch(href)).arrayBuffer()));
    css += `@font-face{font-family:'${j.family}';font-style:normal;font-weight:${weight};font-display:block;src:url('./${file}') format('woff2');}\n`;
    console.log(file);
  }
}
fs.writeFileSync(path.join(root, 'fonts/fonts.css'), css);
