'use strict';
// Nanocompass v8.0 build: expands @@INCLUDE:path@@ slots in src/v8/app-shell.html into one offline HTML file.
// @@TEXT:a+b@@ inserts files as one JavaScript string literal (used for the Web Worker source).
// Reads only files inside this project. Writes build/v8/Nanocompass_v<version>.html and build/v8/deploy/index.html.
// Usage (from the project root): node tools/v8/build.cjs
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const label = version.replace(/^(\d+\.\d+)\.0(?=$|-)/, '$1'); // 8.0.0-dev → 8.0-dev
function read(name) {
  const p = path.resolve(ROOT, name);
  if (!p.startsWith(ROOT + path.sep)) throw Error('Build input outside project: ' + name);
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}
// Keep "</script" inside included code from closing the page's script element.
const guard = text => text.replace(/<\/script/gi, '<\\/script');
function expand(name, stack = []) {
  if (stack.includes(name)) throw Error('Include cycle: ' + name);
  return read(name)
    .replace(/@@TEXT:([^@]+)@@/g, (_, files) => guard(JSON.stringify(files.split('+').map(f => read(f.trim())).join('\n'))))
    .replace(/@@INCLUDE:([^@]+)@@/g, (_, file) => guard(expand(file, [...stack, name])));
}
const html = expand('src/v8/app-shell.html').replace(/@@VERSION@@/g, label);
if (/@@[A-Z]+[:@]/.test(html)) throw Error('Unexpanded build slot');
const out = path.join(ROOT, 'build/v8');
fs.mkdirSync(path.join(out, 'deploy'), { recursive: true });
const name = 'Nanocompass_v' + label + '.html';
fs.writeFileSync(path.join(out, name), html);
fs.writeFileSync(path.join(out, 'deploy/index.html'), html);
console.log(JSON.stringify({ version: label, file: 'build/v8/' + name, bytes: Buffer.byteLength(html) }));
