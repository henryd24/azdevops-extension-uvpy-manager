// Bumps the extension version in config/release.json and in every src/tasks/*/task.json
// (the agent caches each task by its version, so all of them follow the extension).
// Usage: node .github/scripts/bump-version.mjs <major|minor|patch>
// Prints the new version to stdout and the changed files to stderr. Edits are textual so the
// files keep their formatting.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const kind = process.argv[2];
if (!['major', 'minor', 'patch'].includes(kind)) {
  console.error('Usage: bump-version.mjs <major|minor|patch>');
  process.exit(1);
}

const releasePath = 'config/release.json';
const taskPaths = readdirSync('src/tasks')
  .map((t) => join('src/tasks', t, 'task.json'))
  .filter((p) => existsSync(p))
  .sort();
if (taskPaths.length === 0) throw new Error('No src/tasks/*/task.json found');

const release = readFileSync(releasePath, 'utf8');
const current = /"version":\s*"(\d+)\.(\d+)\.(\d+)"/.exec(release);
if (!current) throw new Error(`No semver version found in ${releasePath}`);
let [major, minor, patch] = current.slice(1).map(Number);
const from = `${major}.${minor}.${patch}`;

const versionBlock = /("version":\s*\{\s*"Major":\s*)(\d+)(,\s*"Minor":\s*)(\d+)(,\s*"Patch":\s*)(\d+)/;
const tasks = taskPaths.map((path) => {
  const text = readFileSync(path, 'utf8');
  const block = versionBlock.exec(text);
  if (!block) throw new Error(`No version block found in ${path}`);
  const version = [block[2], block[4], block[6]].join('.');
  if (version !== from) throw new Error(`Versions differ: ${releasePath}=${from}, ${path}=${version}`);
  return { path, text, block };
});

if (kind === 'major') { major += 1; minor = 0; patch = 0; }
else if (kind === 'minor') { minor += 1; patch = 0; }
else { patch += 1; }

const next = `${major}.${minor}.${patch}`;
writeFileSync(releasePath, release.replace(current[0], `"version": "${next}"`));
for (const { path, text, block } of tasks) {
  writeFileSync(path, text.replace(block[0], `${block[1]}${major}${block[3]}${minor}${block[5]}${patch}`));
}
console.error(`${from} -> ${next}: ${[releasePath, ...taskPaths].join(', ')}`);
console.log(next);
