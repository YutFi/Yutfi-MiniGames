// Rebuilds the Tailwind utilities that index.html uses and writes them into the <style id="tw-static"> block.
// Why: the Tailwind Play CDN compiles CSS inside the browser and re-scans the page on every DOM change, which made
// phones stutter. A prebuilt stylesheet is the same look with none of that work. Run after adding new Tailwind
// classes to index.html:   cd tools && npm install && npm run css
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const css = execFileSync(path.join(__dirname, 'node_modules', '.bin', 'tailwindcss'),
  ['-c', path.join(__dirname, 'tailwind.config.js'), '-i', path.join(__dirname, 'tailwind.input.css'), '--minify'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let html = fs.readFileSync(file, 'utf8');
const re = /(<style id="tw-static">\/\*TW-START\*\/)[\s\S]*?(\/\*TW-END\*\/<\/style>)/;
if (!re.test(html)) throw new Error('tw-static block not found in index.html');
html = html.replace(re, (_, a, b) => a + css + b);
fs.writeFileSync(file, html);
console.log('tw-static updated: ' + css.length + ' bytes');
