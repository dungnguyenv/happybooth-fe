// Run with: node --test tests/*.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../assets/js/album-core.js');

const NOW = Date.parse('2026-10-24T10:00:00Z');
const MIN = 60 * 1000;

function album(uploaded, total, createdAt) {
  const files = [];
  for (let i = 0; i < total; i++) {
    files.push({ name: 'IMG_' + i + '.jpg', status: i < uploaded ? 'uploaded' : 'pending' });
  }
  return {
    code: 'k7m2x9qa4n',
    status: 'active',
    created_at: createdAt || '2026-10-24T09:50:00Z',
    expires_at: '2026-11-08T09:50:00Z',
    event: { code: 'demo', name: 'Demo', description: null, banner_url: null },
    total: total,
    uploaded: uploaded,
    files: files
  };
}

function ok(body) {
  return { status: 200, body: body };
}

test('readCode reads ?c= and normalises it', () => {
  assert.equal(core.readCode('?c=K7M2X9QA4N'), 'k7m2x9qa4n');
  assert.equal(core.readCode('?c=%20k7m2x9qa4n%20'), 'k7m2x9qa4n');
  assert.equal(core.readCode('?c=abc'), null);
  assert.equal(core.readCode('?c=k7m2x9qa'), null); // 8-char codes ended 2026-10-24
  assert.equal(core.readCode(''), null);
});

test('short path regex matches album codes only', () => {
  assert.ok(core.SHORT_PATH_RE.test('/k7m2x9qa4n'));
  for (const p of ['/about', '/k7m2x9qa', '/k7m2x9qa40', '/k7m2x9qa4n2', '/price', '/k7m2x9q']) {
    assert.ok(!core.SHORT_PATH_RE.test(p), p);
  }
});

test('404.html redirects the same short paths as SHORT_PATH_RE', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '404.html'), 'utf8');
  assert.ok(html.includes(core.SHORT_PATH_RE.source), '404.html must use SHORT_PATH_RE verbatim');
});

test('apiBase', () => {
  assert.equal(core.apiBase('localhost'), 'http://localhost:8010');
  assert.equal(core.apiBase('127.0.0.1'), 'http://localhost:8010');
  assert.equal(core.apiBase('happybooth.vn'), 'https://api.happybooth.vn');
});

test('deriveState kinds', () => {
  assert.equal(core.deriveState({ status: 404, body: null }, null, NOW).kind, 'not_found');
  const expired = core.deriveState({ status: 410, body: { status: 'expired', event: { name: 'E' } } }, null, NOW);
  assert.equal(expired.kind, 'expired');
  assert.equal(expired.album.event.name, 'E');
  assert.equal(core.deriveState(ok(album(0, 3)), null, NOW).kind, 'empty');
  assert.equal(core.deriveState(ok(album(1, 3)), null, NOW).kind, 'partial');
  assert.equal(core.deriveState(ok(album(3, 3)), null, NOW).kind, 'complete');
  assert.equal(core.deriveState({ status: 500, body: null }, null, NOW).kind, 'error');
  assert.equal(core.deriveState({ status: 0, body: null }, null, NOW).kind, 'error');
});

test('deriveState keeps the previous view when the network drops', () => {
  const prev = core.deriveState(ok(album(1, 3)), null, NOW);
  for (const status of [0, 502, 429]) {
    const s = core.deriveState({ status: status, body: null }, prev, NOW);
    assert.equal(s.kind, 'partial');
    assert.equal(s.album, prev.album);
    // A 429 is not a lost connection: it is rate limiting, shown differently.
    assert.equal(s.offline, status !== 429);
    assert.equal(s.throttled, status === 429);
  }
  assert.equal(core.deriveState(ok(album(2, 3)), prev, NOW).offline, false);
});

test('expiring while the page is open switches to expired', () => {
  const prev = core.deriveState(ok(album(1, 3)), null, NOW);
  assert.equal(core.deriveState({ status: 410, body: { event: {} } }, prev, NOW).kind, 'expired');
});

test('isStale after two hours with photos still pending', () => {
  assert.equal(core.isStale(album(1, 3, '2026-10-24T07:59:00Z'), NOW), true);
  assert.equal(core.isStale(album(1, 3, '2026-10-24T08:01:00Z'), NOW), false);
  assert.equal(core.isStale(album(3, 3, '2026-10-24T07:00:00Z'), NOW), false);
  assert.equal(core.deriveState(ok(album(0, 2, '2026-10-24T07:00:00Z')), null, NOW).stale, true);
});

test('nextPollDelay', () => {
  const partial = core.deriveState(ok(album(1, 3)), null, NOW);
  assert.equal(core.nextPollDelay(partial, NOW - 1 * MIN, NOW), 5000);
  assert.equal(core.nextPollDelay(partial, NOW - 11 * MIN, NOW), 30000);
  assert.equal(core.nextPollDelay(core.deriveState(ok(album(3, 3)), null, NOW), NOW, NOW), null);
  assert.equal(core.nextPollDelay(core.deriveState({ status: 404 }, null, NOW), NOW, NOW), null);
  assert.equal(core.nextPollDelay(core.deriveState({ status: 410, body: {} }, null, NOW), NOW, NOW), null);
  assert.equal(core.nextPollDelay(core.deriveState({ status: 0 }, null, NOW), NOW, NOW), 5000);
});

test('indexAfterUpdate keeps the photo being viewed', () => {
  assert.equal(core.indexAfterUpdate([{ name: 'b' }, { name: 'c' }], 1, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]), 2);
  assert.equal(core.indexAfterUpdate([{ name: 'x' }], 0, [{ name: 'a' }]), 0);
  assert.equal(core.indexAfterUpdate([], 0, [{ name: 'a' }]), 0);
});

test('wrapIndex', () => {
  assert.equal(core.wrapIndex(-1, 3), 2);
  assert.equal(core.wrapIndex(3, 3), 0);
  assert.equal(core.wrapIndex(1, 3), 1);
});

test('formatDate uses Vietnam time', () => {
  assert.equal(core.formatDate('2026-11-07T18:30:00Z'), '08/11/2026');
});

test('chooseIndex shows the first photo that arrives until the guest picks one', () => {
  const before = [{ name: 'a', status: 'pending' }, { name: 'b', status: 'pending' }];
  const after = [{ name: 'a', status: 'pending' }, { name: 'b', status: 'uploaded' }];
  assert.equal(core.chooseIndex(before, 0, after, false), 1);
  // Once the guest has picked a photo, never move them.
  assert.equal(core.chooseIndex(before, 0, after, true), 0);
  // Viewing an uploaded photo: stay on it.
  const viewing = [{ name: 'a', status: 'uploaded' }, { name: 'b', status: 'pending' }];
  const later = [{ name: 'a', status: 'uploaded' }, { name: 'b', status: 'uploaded' }];
  assert.equal(core.chooseIndex(viewing, 0, later, false), 0);
  // First load: the first uploaded photo.
  assert.equal(core.chooseIndex(null, 0, after, false), 1);
});

test('apiUrl only lets through URLs on the API origin', () => {
  const api = 'https://api.happybooth.vn';
  const good = 'https://api.happybooth.vn/public/albums/k7m2x9qa4n/files/a.jpg/preview.webp?v=1';
  assert.equal(core.apiUrl(good, api), good);
  assert.equal(core.apiUrl('javascript:alert(1)', api), '');
  assert.equal(core.apiUrl('https://evil.example/x.webp', api), '');
  assert.equal(core.apiUrl('', api), '');
  assert.equal(core.apiUrl(null, api), '');
});

test('deriveState coerces counts to numbers', () => {
  const s = core.deriveState({ status: 200, body: { uploaded: '1<b>', total: '3', files: [], created_at: '2026-10-24T09:50:00Z' } }, null, NOW);
  assert.equal(typeof s.album.uploaded, 'number');
  assert.equal(s.album.uploaded, 0);
  assert.equal(s.album.total, 3);
});

test('swipeDirection: horizontal, deliberate, not zoomed', () => {
  assert.equal(core.swipeDirection(-80, 10, 1), 1);   // swipe left → next
  assert.equal(core.swipeDirection(80, -5, 1), -1);   // swipe right → previous
  assert.equal(core.swipeDirection(30, 0, 1), 0);     // too short
  assert.equal(core.swipeDirection(45, 200, 1), 0);   // a page scroll in an arc
  assert.equal(core.swipeDirection(-120, 10, 2), 0);  // panning a zoomed photo
});

test('isExpired', () => {
  assert.equal(core.isExpired({ expires_at: '2026-10-24T09:59:59Z' }, NOW), true);
  assert.equal(core.isExpired({ expires_at: '2026-11-08T09:50:00Z' }, NOW), false);
  assert.equal(core.isExpired(null, NOW), false);
});

test('rate-limited polls back off', () => {
  const prev = core.deriveState(ok(album(1, 3)), null, NOW);
  const limited = core.deriveState({ status: 429, body: null }, prev, NOW);
  assert.equal(limited.throttled, true);
  assert.equal(core.nextPollDelay(limited, NOW - 1 * MIN, NOW), 30000);
  assert.equal(core.deriveState(ok(album(2, 3)), limited, NOW).throttled, false);
});

// Cloudflare's own 429 carries no CORS header, so the browser reports it as a
// network failure (status 0): repeated failures must back off as well.
test('consecutive network failures back off to the slow poll', () => {
  let view = core.deriveState(ok(album(1, 3)), null, NOW);
  const delays = [];
  for (let i = 0; i < 5; i++) {
    view = core.deriveState({ status: 0, body: null }, view, NOW);
    delays.push(core.nextPollDelay(view, NOW - 1 * MIN, NOW));
  }
  assert.deepEqual(delays, [5000, 10000, 20000, 30000, 30000]);
  assert.equal(view.offline, true);
  assert.equal(view.kind, 'partial');
});

test('a successful poll resets the failure backoff', () => {
  let view = core.deriveState({ status: 0, body: null }, null, NOW);
  view = core.deriveState({ status: 502, body: null }, view, NOW);
  view = core.deriveState({ status: 0, body: null }, view, NOW);
  assert.equal(core.nextPollDelay(view, NOW, NOW), 20000);
  view = core.deriveState(ok(album(1, 3)), view, NOW);
  assert.equal(core.nextPollDelay(view, NOW - 1 * MIN, NOW), 5000);
});

test('fileKind prefers the API kind and falls back to the extension', () => {
  assert.equal(core.fileKind({ name: 'a.jpg', kind: 'video' }), 'video');
  assert.equal(core.fileKind({ name: 'CLIP.MP4' }), 'video');
  assert.equal(core.fileKind({ name: 'LOOP.GIF' }), 'gif');
  assert.equal(core.fileKind({ name: 'a.webp' }), 'photo');
  assert.equal(core.fileKind({ name: 'a.jpg', kind: 'hologram' }), 'photo');
  assert.equal(core.fileKind({ name: 'constructor' }), 'photo');
  assert.equal(core.fileKind({ name: 'x.jpg', kind: 'constructor' }), 'photo');
});

test('albumNoun mentions video only when there is one', () => {
  assert.equal(core.albumNoun([{ name: 'a.jpg' }, { name: 'b.gif' }]), 'ảnh');
  assert.equal(core.albumNoun([{ name: 'a.jpg' }, { name: 'c.mp4', kind: 'video' }]), 'ảnh & video');
});

test('videoErrorRetryable: a dropped connection is worth another tap, a codec is not', () => {
  assert.equal(core.videoErrorRetryable(1), true);  // MEDIA_ERR_ABORTED
  assert.equal(core.videoErrorRetryable(2), true);  // MEDIA_ERR_NETWORK
  assert.equal(core.videoErrorRetryable(3), false); // MEDIA_ERR_DECODE
  assert.equal(core.videoErrorRetryable(4), false); // MEDIA_ERR_SRC_NOT_SUPPORTED
  assert.equal(core.videoErrorRetryable(undefined), false);
});

// ---- Partner branding ----

const API = 'http://localhost:8010';
const go = (id) => API + '/public/albums/k7m2x9qa4n/go/' + id;
const asset = (id) => API + '/public/page-assets/' + id + '.webp?v=1';

function brandBody(extra) {
  return Object.assign({
    mode: 'brand',
    org_name: 'Lumi Coffee',
    powered_by: true,
    theme: 'light',
    color: '#7a3e1d',
    logo_url: asset('logo'),
    banners: [{ image_url: asset('b1'), alt: 'Giảm 20%', href: go('k3m9x2pq') }],
    cta: { label: 'Xem menu & đặt bàn', href: go('cta') },
    contact: { hotline: '0909 000 000', website_label: 'lumicoffee.vn', website_href: go('website') },
    social: [{ kind: 'facebook', href: go('facebook') }],
    sponsors: [{ name: 'Sóng Audio', logo_url: asset('s1'), href: go('a8b2c3d4') }]
  }, extra || {});
}

test('inkFor picks the text colour with the higher contrast', () => {
  assert.equal(core.inkFor('#7A3E1D'), '#FFFFFF');
  assert.equal(core.inkFor('#F5D547'), '#000000');
  assert.equal(core.inkFor('#000000'), '#FFFFFF');
  assert.equal(core.inkFor('#FFFFFF'), '#000000');
  assert.equal(core.inkFor('#CB1048'), '#FFFFFF');
});

test('contrastRatio follows WCAG', () => {
  assert.equal(core.contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(core.contrastRatio('#FFFFFF', '#000000'), 21);
  assert.equal(core.contrastRatio('#7A3E1D', '#7A3E1D'), 1);
  assert.ok(Math.abs(core.contrastRatio('#777777', '#FFFFFF') - 4.48) < 0.02);
  assert.equal(core.contrastRatio('nope', '#FFFFFF'), 1);
});

test('carouselIndex wraps in both directions', () => {
  assert.equal(core.carouselIndex(0, 1, 3), 1);
  assert.equal(core.carouselIndex(2, 1, 3), 0);
  assert.equal(core.carouselIndex(0, -1, 3), 2);
  assert.equal(core.carouselIndex(0, 1, 1), 0);
  assert.equal(core.carouselIndex(0, 1, 0), 0);
});

test('previewOriginAllowed: the admin, or a local origin when the site itself is local', () => {
  assert.equal(core.previewOriginAllowed('https://admin.happybooth.vn', 'happybooth.vn'), true);
  assert.equal(core.previewOriginAllowed('https://admin.happybooth.vn', 'localhost'), true);
  assert.equal(core.previewOriginAllowed('http://localhost:5173', 'happybooth.vn'), false);
  assert.equal(core.previewOriginAllowed('http://localhost:5173', 'localhost'), true);
  assert.equal(core.previewOriginAllowed('http://127.0.0.1:5173', '127.0.0.1'), true);
  assert.equal(core.previewOriginAllowed('https://evil.example', 'localhost'), false);
  assert.equal(core.previewOriginAllowed('http://localhost.evil.example', 'localhost'), false);
  assert.equal(core.previewOriginAllowed('http://localhost:5173@evil.example', 'localhost'), false);
  assert.equal(core.previewOriginAllowed('https://localhost:5173', 'localhost'), false);
  assert.equal(core.previewOriginAllowed('https://admin.happybooth.vn.evil.example', 'happybooth.vn'), false);
  assert.equal(core.previewOriginAllowed(undefined, 'localhost'), false);
});

test('the /page fetch gives up after 3 seconds', () => {
  assert.equal(core.pageFetchTimeoutMs, 3000);
});

test('pageView: default, malformed and unknown bodies mean the HappyBooth page', () => {
  const opts = { base: API };
  assert.equal(core.pageView({ mode: 'default' }, opts), null);
  assert.equal(core.pageView(null, opts), null);
  assert.equal(core.pageView('brand', opts), null);
  assert.equal(core.pageView({}, opts), null);
  assert.equal(core.pageView({ mode: 'brand' }, opts), null);
  assert.equal(core.pageView(brandBody({ theme: 'neon' }), opts), null);
  assert.equal(core.pageView(brandBody({ color: 'red' }), opts), null);
  assert.equal(core.pageView(brandBody({ color: '#FFF' }), opts), null);
  assert.equal(core.pageView(brandBody({ org_name: '  ' }), opts), null);
  assert.equal(core.pageView(brandBody({ banners: 'many' }), opts), null);
  assert.equal(core.pageView(brandBody({ sponsors: {} }), opts), null);
});

test('pageView turns a C2 body into what to draw', () => {
  const v = core.pageView(brandBody(), { base: API });
  assert.equal(v.orgName, 'Lumi Coffee');
  assert.equal(v.poweredBy, true);
  assert.equal(v.theme, 'light');
  assert.equal(v.color, '#7A3E1D');
  assert.equal(v.ink, '#FFFFFF');
  assert.equal(v.logoUrl, asset('logo'));
  assert.deepEqual(v.banners, [{ imageUrl: asset('b1'), alt: 'Giảm 20%', href: go('k3m9x2pq') }]);
  assert.deepEqual(v.cta, { label: 'Xem menu & đặt bàn', href: go('cta') });
  assert.equal(v.hotline, '0909 000 000');
  assert.equal(v.hotlineHref, 'tel:0909000000');
  assert.deepEqual(v.website, { label: 'lumicoffee.vn', href: go('website') });
  assert.deepEqual(v.social, [{ kind: 'facebook', href: go('facebook') }]);
  assert.deepEqual(v.sponsors, [{ name: 'Sóng Audio', logoUrl: asset('s1'), href: go('a8b2c3d4') }]);
});

test('pageView copes with empty blocks and a white-label page', () => {
  const v = core.pageView({
    mode: 'brand', org_name: 'Lumi', powered_by: false, theme: 'vivid', color: '#F5D547', logo_url: null,
    banners: [], cta: null, contact: { hotline: null, website_label: null, website_href: null }, social: [], sponsors: []
  }, { base: API });
  assert.equal(v.poweredBy, false);
  assert.equal(v.ink, '#000000');
  assert.equal(v.logoUrl, '');
  assert.equal(v.cta, null);
  assert.equal(v.hotline, '');
  assert.equal(v.hotlineHref, '');
  assert.equal(v.website, null);
  assert.deepEqual([v.banners, v.social, v.sponsors], [[], [], []]);
});

test('pageView drops items whose URLs leave the API (but keeps a sponsor without a link)', () => {
  const evil = 'https://evil.example/x';
  const v = core.pageView(brandBody({
    logo_url: evil,
    banners: [
      { image_url: asset('b1'), alt: 'ok', href: go('aaaaaaaa') },
      { image_url: evil, alt: 'bad image', href: go('bbbbbbbb') },
      { image_url: asset('b3'), alt: 'bad link', href: evil },
      { image_url: asset('b4'), alt: 'js', href: 'javascript:alert(1)' }
    ],
    cta: { label: 'Go', href: evil },
    contact: { hotline: '0909', website_label: 'x.vn', website_href: evil },
    social: [{ kind: 'facebook', href: evil }, { kind: 'zalo', href: go('zalo') }, { kind: 'myspace', href: go('myspace') }, { kind: 'zalo', href: go('zalo') }],
    sponsors: [
      { name: 'A', logo_url: asset('s1'), href: null },
      { name: 'B', logo_url: asset('s2'), href: evil },
      { name: 'C', logo_url: evil, href: null }
    ]
  }), { base: API });
  assert.equal(v.logoUrl, '');
  assert.deepEqual(v.banners.map((b) => b.alt), ['ok']);
  assert.equal(v.cta, null);
  assert.equal(v.website, null);
  assert.deepEqual(v.social, [{ kind: 'zalo', href: go('zalo') }]);
  assert.deepEqual(v.sponsors, [{ name: 'A', logoUrl: asset('s1'), href: '' }]);
});

test('pageView in preview mode keeps partner URLs as given, http(s) only', () => {
  const v = core.pageView(brandBody({
    logo_url: API + '/img/logo.webp',
    banners: [
      { image_url: API + '/img/b.webp', alt: 'a', href: 'https://lumicoffee.vn/khuyen-mai' },
      { image_url: API + '/img/b.webp', alt: 'js', href: 'javascript:alert(1)' }
    ],
    cta: { label: 'Go', href: 'https://lumicoffee.vn/menu' },
    contact: { hotline: '0909 000 000', website_label: 'lumicoffee.vn', website_href: 'https://lumicoffee.vn' },
    social: [{ kind: 'facebook', href: 'https://facebook.com/lumi' }],
    sponsors: [{ name: 'A', logo_url: API + '/img/s.webp', href: 'https://a.example' }]
  }), { preview: true });
  assert.equal(v.logoUrl, API + '/img/logo.webp');
  assert.deepEqual(v.banners.map((b) => b.href), ['https://lumicoffee.vn/khuyen-mai']);
  assert.equal(v.cta.href, 'https://lumicoffee.vn/menu');
  assert.equal(v.website.href, 'https://lumicoffee.vn/');
  assert.equal(v.social[0].href, 'https://facebook.com/lumi');
  assert.equal(v.sponsors[0].href, 'https://a.example/');
});

test('partner text is passed through as plain strings, trimmed to the limits', () => {
  const v = core.pageView(brandBody({
    org_name: '<img src=x onerror=alert(1)>',
    banners: [{ image_url: asset('b1'), alt: '<script>alert(2)</script>' + 'x'.repeat(200), href: go('aaaaaaaa') }],
    cta: { label: '<b>hi</b>'.repeat(20), href: go('cta') }
  }), { base: API });
  assert.equal(v.orgName, '<img src=x onerror=alert(1)>');
  assert.equal(v.banners[0].alt.length, 120);
  assert.equal(v.cta.label.length, 40);
});

test('telHref keeps digits and a leading plus only', () => {
  assert.equal(core.telHref('0909 000 000'), 'tel:0909000000');
  assert.equal(core.telHref('+84 909.000-000'), 'tel:+84909000000');
  assert.equal(core.telHref('0909;rm -rf'), 'tel:0909');
  assert.equal(core.telHref('hotline'), '');
  assert.equal(core.telHref(null), '');
});

test('pageTitle: only a white-label page drops the HappyBooth name', () => {
  const brand = core.pageView(brandBody(), { base: API });
  const white = core.pageView(brandBody({ powered_by: false }), { base: API });
  assert.equal(core.pageTitle('Tiệc', null), 'Tiệc — Ảnh của bạn — Happy Booth');
  assert.equal(core.pageTitle(undefined, null), 'Ảnh của bạn — Happy Booth');
  assert.equal(core.pageTitle('Tiệc', brand), 'Tiệc — Ảnh của bạn — Happy Booth');
  assert.equal(core.pageTitle('Tiệc', white), 'Tiệc — Lumi Coffee');
  assert.equal(core.pageTitle('', white), 'Ảnh của bạn — Lumi Coffee');
});

test('themeColor follows the bar the browser UI sits on', () => {
  const v = (theme) => core.pageView(brandBody({ theme }), { base: API });
  assert.equal(core.themeColor(null), '#FFFFFF');
  assert.equal(core.themeColor(v('light')), '#7A3E1D');
  assert.equal(core.themeColor(v('vivid')), '#7A3E1D');
  assert.equal(core.themeColor(v('dark')), '#141414');
  assert.equal(core.themeColor(v('minimal')), '#FBFAF7');
});
