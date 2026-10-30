import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// A detector that scans no files must never report a successful quality gate.
const root = fileURLToPath(new globalThis.URL('../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'anygram-duplication-'));
const fixture = `export function summarize(values) {
  const result = [];
  for (const value of values) {
    if (value.enabled) {
      result.push({ name: value.name, count: value.count + 1 });
    }
  }
  return result.sort((left, right) => left.count - right.count);
}
`;

function scan() {
  const result = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=384',
      join(root, 'node_modules/jscpd/bin/jscpd'),
      '--config',
      join(root, '.jscpd.json'),
      '--reporters',
      'json',
      '--output',
      join(directory, 'report'),
      directory,
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  const reportPath = join(directory, 'report/jscpd-report.json');
  return {
    status: result.status,
    report: existsSync(reportPath)
      ? JSON.parse(readFileSync(reportPath, 'utf8'))
      : undefined,
  };
}

try {
  writeFileSync(join(directory, 'first.js'), fixture);
  writeFileSync(join(directory, 'second.js'), fixture);
  const duplicate = scan();
  assert.notEqual(duplicate.status, 0, 'Duplicated source must fail the gate');
  assert.equal(duplicate.report.statistics.total.sources, 2);
  assert.ok(duplicate.report.duplicates.length > 0);
  rmSync(join(directory, 'second.js'));
  const unique = scan();
  assert.equal(unique.status, 0, 'A single unique source must pass the gate');
  assert.equal(unique.report.statistics.total.sources, 1);
  assert.equal(unique.report.duplicates.length, 0);
  console.log('Duplication gate detects clones and scans unique sources');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
