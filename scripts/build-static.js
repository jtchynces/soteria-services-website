const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.cwd();
const dist = path.join(root, 'dist');

execFileSync(process.execPath, [path.join(root, 'scripts', 'validate-build.js')], {
  stdio: 'inherit'
});

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const files = [
  'index.html',
  'styles.css',
  'app.js',
  'robots.txt',
  'sitemap.xml'
];

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

copyDir(path.join(root, 'assets'), path.join(dist, 'assets'));

console.log('Static site built to dist.');
