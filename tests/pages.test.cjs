// Pages under pages/ are published at their front-matter permalink (Jekyll on GitHub Pages).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function pageFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? pageFiles(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}

const pages = pageFiles(path.join(root, 'pages')).map(file => {
  const head = fs.readFileSync(file, 'utf8').match(/^---\npermalink: (\/[^\n]+\.html)\n---\n/);
  return { file: path.relative(root, file), permalink: head && head[1] };
});

test('every page starts with a permalink front matter', () => {
  for (const page of pages) assert.ok(page.permalink, page.file + ' has no permalink front matter');
});

test('permalinks are unique and do not shadow a root file', () => {
  const seen = new Set();
  for (const { file, permalink } of pages) {
    assert.ok(!seen.has(permalink), permalink + ' is used twice');
    seen.add(permalink);
    assert.ok(!fs.existsSync(path.join(root, permalink)), permalink + ' (' + file + ') also exists at the root');
  }
});

test('every router path has a page', () => {
  const router = fs.readFileSync(path.join(root, 'assets/js/router.js'), 'utf8');
  const block = router.match(/var pagePaths = \{([\s\S]*?)\};/)[1];
  const published = new Set(['/index.html', ...pages.map(p => p.permalink)]);
  for (const [, url] of block.matchAll(/'(\/[^']*)'/g)) {
    const file = url === '/' ? '/index.html' : url + '.html';
    assert.ok(published.has(file), 'router path ' + url + ' has no page');
  }
});
