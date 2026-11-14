// Static checks on the album page: the markup album.js relies on, and the bundled preview photos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'pages/album/album.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/js/album.js'), 'utf8');

test('every data-album-* hook album.js reads exists in album.html', () => {
  const hooks = new Set([...js.matchAll(/\[(data-album-[a-z-]+)\]/g)].map((m) => m[1]));
  assert.ok(hooks.size > 20);
  for (const hook of hooks) assert.ok(html.includes(hook), hook + ' is missing from album.html');
});

test('the page starts neutral: brand-dependent elements wait for /page', () => {
  assert.match(html, /<html lang="vi" data-brand="pending">/);
  assert.match(html, /html\[data-brand="pending"\] \.album-bar__brand/);
  assert.match(html, /html\[data-brand="pending"\] \.album-event \.btn/);
  assert.match(html, /html\[data-brand="pending"\] \.album-footer/);
});

test('all four themes are defined', () => {
  for (const theme of ['light', 'dark', 'minimal', 'vivid']) {
    assert.ok(html.includes('html[data-theme="' + theme + '"] {'), theme + ' theme block is missing');
  }
});

test('the serif font is loaded on demand, not in the page head', () => {
  assert.ok(!/<link[^>]+Playfair/i.test(html));
  assert.match(js, /Playfair\+Display/);
});

test('partner text never goes through innerHTML', () => {
  // The only innerHTML writes are fixed markup, HappyBooth's own saved markup or the event name escaped by esc().
  const writes = [...js.matchAll(/\.innerHTML\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
  for (const rhs of writes) {
    assert.ok(!/page\.|\.orgName|\.label|\.alt|\.hotline/.test(rhs), 'partner field written as HTML: ' + rhs);
  }
});

test('the preview photos are bundled WebP files', () => {
  for (const n of [1, 2, 3]) {
    const file = path.join(root, 'assets/images/preview/sample-' + n + '.webp');
    const head = fs.readFileSync(file).subarray(0, 12);
    assert.equal(head.subarray(0, 4).toString(), 'RIFF', file);
    assert.equal(head.subarray(8, 12).toString(), 'WEBP', file);
    assert.ok(fs.statSync(file).size < 60 * 1024, file + ' is larger than it needs to be');
  }
});
