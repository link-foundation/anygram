// Recheck archived text without printing credentials found in public reports.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { sanitizeResearch } from './research-redaction.mjs';
const root = 'docs/case-studies/issue-1/data';
for (const path of await readdir(root, { recursive: true })) {
  if (!/\.(?:json|md|js|txt)$/.test(path)) {
    continue;
  }
  const filename = `${root}/${path}`;
  const original = await readFile(filename, 'utf8');
  const sanitized = sanitizeResearch(original);
  if (sanitized !== original) {
    await writeFile(filename, sanitized);
    console.log(`Redacted ${path}`);
  }
}
