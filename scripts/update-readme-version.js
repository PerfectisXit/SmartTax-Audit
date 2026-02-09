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
const marker = '**Version:**';
if (!readme.includes(marker)) {
  console.error('README.md does not contain version marker');
  process.exit(1);
}

const next = readme.replace(/\*\*Version:\*\*\s*v?[0-9A-Za-z._-]+/, `**Version:** v${version}`);
fs.writeFileSync(readmePath, next);
console.log(`README.md updated to v${version}`);
