'use strict';
// Nanocompass: all checks. Usage (from the project root): node tests/v8/run_all.cjs
// Uses only Nanocompass sources (src/v8). Each script prints PASS/FAIL lines and sets a non-zero exit code on failure.
const path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
for (const t of ['lesson_physics.cjs', 'magnetometer.cjs', 'magnet_fields.cjs', 'ferrocell.cjs']) {
  try { process.stdout.write(execFileSync('node', [path.join('tests/v8', t)], { cwd: ROOT, encoding: 'utf8' })); }
  catch (e) { failed++; process.stdout.write(e.stdout || String(e)); }
}
if (failed) process.exitCode = 1;
