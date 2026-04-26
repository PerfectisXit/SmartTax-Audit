const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const readmePath = path.join(root, 'README.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = String(pkg.version || '').trim();
if (!version) {
  console.error('package.json version not found');
  process.exit(1);
}

const readme = fs.readFileSync(readmePath, 'utf8');
const changes = [
  {
    pattern: /version-v[0-9A-Za-z._-]+-blue/g,
    replace: `version-v${version}-blue`,
  },
  {
    pattern: /release-v[0-9A-Za-z._-]+-success/g,
    replace: `release-v${version}-success`,
  },
  {
    pattern: /releases\/tag\/v[0-9A-Za-z._-]+/g,
    replace: `releases/tag/v${version}`,
  },
];

let next = readme;
let matched = 0;
for (const item of changes) {
  const hasMatch = item.pattern.test(next);
  item.pattern.lastIndex = 0;
  if (hasMatch) matched += 1;
  next = next.replace(item.pattern, item.replace);
}

if (matched === 0) {
  console.error('README structure mismatch: no version badge fields updated');
  process.exit(1);
}

fs.writeFileSync(readmePath, next);
console.log(`README badges updated to v${version}`);
