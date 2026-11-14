/* ========================================
   Happy Booth — Album page
   Pure logic (no DOM): tested with `node --test tests/*.test.cjs`
   ======================================== */

(function (root, factory) {
  var core = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = core;
  } else {
    root.HBAlbumCore = core;
  }
})(this, function () {
  // Same alphabet as the API: no 0, o, 1, l, i (codes are read off prints).
  var CODE_RE = /^[2-9a-hjkmnp-z]{10}$/;
  // 404.html repeats this pattern inline; keep the two in step.
  var SHORT_PATH_RE = /^\/[2-9a-hjkmnp-z]{10}$/;
  var STALE_AFTER_MS = 2 * 60 * 60 * 1000;
  var FAST_POLL_MS = 5000;
  var SLOW_POLL_MS = 30000;
  var SLOW_AFTER_MS = 10 * 60 * 1000;
  var SWIPE_MIN_PX = 40;
  var DATE_FORMAT = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // ---- Partner branding (GET /public/albums/{code}/page) ----
  var PAGE_FETCH_TIMEOUT_MS = 3000;
  var THEMES = ['light', 'dark', 'minimal', 'vivid'];
  var SOCIAL_KINDS = ['facebook', 'instagram', 'tiktok', 'zalo', 'youtube'];
  var COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
  var ADMIN_ORIGIN = 'https://admin.happybooth.vn';
  var LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
  // Bar background of the themes that do not use the partner colour for it.
  var THEME_COLOR = { dark: '#141414', minimal: '#FBFAF7' };

  function readCode(search) {
    var raw = new URLSearchParams(search || '').get('c');
    var code = (raw || '').trim().toLowerCase();
    return CODE_RE.test(code) ? code : null;
  }

  function apiBase(hostname) {
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8010';
    }
    return 'https://api.happybooth.vn';
  }

  // Image and download URLs come from the API; only ever use them on its origin.
  function apiUrl(url, base) {
    if (!url) return '';
    try {
      var parsed = new URL(url, base);
      return parsed.origin === new URL(base).origin ? parsed.href : '';
    } catch (e) {
      return '';
    }
  }

  function count(n) {
    var v = Number(n);
    return isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  function isStale(album, now) {
    if (!album || album.uploaded >= album.total) return false;
    return now - Date.parse(album.created_at) > STALE_AFTER_MS;
  }

  function isExpired(album, now) {
    return !!(album && album.expires_at) && Date.parse(album.expires_at) <= now;
  }

  function state(kind, album, now) {
    return {
      kind: kind,
      album: album,
      stale: isStale(album, now),
      offline: false,
      throttled: false,
      failures: 0
    };
  }

  // result: { status, body } from one fetch; status 0 = network failure.
  function deriveState(result, prev, now) {
    var status = result && result.status;
    var body = result && result.body;
    if (status === 404) return state('not_found', null, now);
    if (status === 410) return state('expired', body || {}, now);
    if (status === 200 && body) {
      body.uploaded = count(body.uploaded);
      body.total = count(body.total);
      if (body.uploaded === 0) return state('empty', body, now);
      if (body.uploaded < body.total) return state('partial', body, now);
      return state('complete', body, now);
    }
    // Anything else (offline, 5xx, 429): keep showing what we had.
    var failures = ((prev && prev.failures) || 0) + 1;
    if (prev && prev.album && prev.kind !== 'error') {
      return {
        kind: prev.kind,
        album: prev.album,
        stale: isStale(prev.album, now),
        offline: status !== 429,
        throttled: status === 429,
        failures: failures
      };
    }
    return {
      kind: 'error',
      album: null,
      stale: false,
      offline: status !== 429,
      throttled: status === 429,
      failures: failures
    };
  }

  function nextPollDelay(current, lastProgressAt, now) {
    var kind = current && current.kind;
    if (kind === 'complete' || kind === 'expired' || kind === 'not_found') return null;
    // Guests on one venue Wi-Fi share an IP: when rate-limited, back off.
    if (current.throttled) return SLOW_POLL_MS;
    // Cloudflare's 429 has no CORS header and reaches us as a network failure,
    // so failures in a row back off too: 5s, 10s, 20s, then 30s.
    if (current.failures > 1) {
      return Math.min(FAST_POLL_MS * Math.pow(2, current.failures - 1), SLOW_POLL_MS);
    }
    return now - lastProgressAt < SLOW_AFTER_MS ? FAST_POLL_MS : SLOW_POLL_MS;
  }

  // After a refresh, stay on the photo the guest was looking at.
  function indexAfterUpdate(prevFiles, currentIndex, nextFiles) {
    var current = prevFiles && prevFiles[currentIndex];
    if (current) {
      for (var i = 0; i < nextFiles.length; i++) {
        if (nextFiles[i].name === current.name) return i;
      }
    }
    return Math.max(0, Math.min(currentIndex, nextFiles.length - 1));
  }

  function firstUploaded(files) {
    for (var i = 0; i < files.length; i++) {
      if (files[i].status === 'uploaded') return i;
    }
    return 0;
  }

  // Which photo to show after new data arrives. Until the guest picks one,
  // a pending placeholder gives way to the first photo that has arrived.
  function chooseIndex(prevFiles, currentIndex, nextFiles, userPicked) {
    if (!prevFiles) return firstUploaded(nextFiles);
    var i = indexAfterUpdate(prevFiles, currentIndex, nextFiles);
    var current = nextFiles[i];
    if (!userPicked && current && current.status !== 'uploaded') return firstUploaded(nextFiles);
    return i;
  }

  // 1 = next, -1 = previous, 0 = not a swipe: too short, mostly vertical (a
  // page scroll in an arc), or the photo is pinch-zoomed (the guest is panning).
  function swipeDirection(dx, dy, scale) {
    if (scale > 1.01) return 0;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= 1.5 * Math.abs(dy)) return 0;
    return dx < 0 ? 1 : -1;
  }

  function wrapIndex(i, n) {
    return ((i % n) + n) % n;
  }

  function formatDate(iso) {
    return DATE_FORMAT.format(new Date(iso));
  }

  // 'photo' | 'gif' | 'video'. The API sends `kind`; an older API (or a cached
  // payload from before it did) leaves it out, and the extension says the same.
  function fileKind(file) {
    var kind = file && file.kind;
    if (kind === 'photo' || kind === 'gif' || kind === 'video') return kind;
    var name = String((file && file.name) || '').toLowerCase();
    if (/\.mp4$/.test(name)) return 'video';
    if (/\.gif$/.test(name)) return 'gif';
    return 'photo';
  }

  // MediaError codes: 1 aborted and 2 network (a venue connection dropping
  // mid-clip) are worth another tap; 3 decode and 4 unsupported mean this
  // browser cannot play the clip at all.
  function videoErrorRetryable(code) {
    return code === 1 || code === 2;
  }

  // How the album counts its files: a GIF is still a photo to a guest.
  function albumNoun(files) {
    for (var i = 0; i < files.length; i++) {
      if (fileKind(files[i]) === 'video') return 'ảnh & video';
    }
    return 'ảnh';
  }

  // ---------- Partner branding ----------

  function channel(v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function luminance(hex) {
    if (typeof hex !== 'string' || !COLOR_RE.test(hex)) return null;
    return 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) +
      0.7152 * channel(parseInt(hex.slice(3, 5), 16)) +
      0.0722 * channel(parseInt(hex.slice(5, 7), 16));
  }

  // WCAG contrast ratio of two #RRGGBB colours (1 when either is not one).
  function contrastRatio(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    if (la === null || lb === null) return 1;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // Text colour on top of `hex`: the one of black and white that reads better.
  function inkFor(hex) {
    return contrastRatio(hex, '#000000') > contrastRatio(hex, '#FFFFFF') ? '#000000' : '#FFFFFF';
  }

  function carouselIndex(i, delta, n) {
    return n > 0 ? wrapIndex(i + delta, n) : 0;
  }

  // The admin editor (and, locally, its dev server) may drive the preview page.
  function previewOriginAllowed(origin, hostname) {
    if (origin === ADMIN_ORIGIN) return true;
    var local = hostname === 'localhost' || hostname === '127.0.0.1';
    return local && LOCAL_ORIGIN_RE.test(String(origin));
  }

  // tel: link built from the hotline's digits (and a leading +) only.
  function telHref(hotline) {
    var raw = String(hotline || '').trim();
    var digits = raw.replace(/\D/g, '');
    return digits ? 'tel:' + (raw.charAt(0) === '+' ? '+' : '') + digits : '';
  }

  // Preview only: the admin hands over partner URLs as they are; they are
  // shown, never followed (the page turns every click into a toast).
  function previewUrl(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch (e) {
      return '';
    }
  }

  function pageUrl(url, opts) {
    return opts.preview ? previewUrl(url) : apiUrl(url, opts.base);
  }

  function clean(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  function listOf(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : null;
  }

  // GET /page body -> what to draw, or null (HappyBooth default: `default`, malformed).
  // opts: { base } the API origin links and images must stay on, or { preview: true }.
  function pageView(body, opts) {
    opts = opts || {};
    if (!body || typeof body !== 'object' || body.mode !== 'brand') return null;
    if (THEMES.indexOf(body.theme) < 0) return null;
    if (typeof body.color !== 'string' || !COLOR_RE.test(body.color)) return null;
    var orgName = clean(body.org_name, 120);
    if (!orgName) return null;
    var banners = listOf(body.banners);
    var social = listOf(body.social);
    var sponsors = listOf(body.sponsors);
    if (banners === null || social === null || sponsors === null) return null;
    var contact = body.contact && typeof body.contact === 'object' ? body.contact : {};

    function pick(u) { return u ? pageUrl(String(u), opts) : ''; }

    var view = {
      orgName: orgName,
      poweredBy: body.powered_by !== false,
      theme: body.theme,
      color: body.color.toUpperCase(),
      ink: inkFor(body.color),
      logoUrl: pick(body.logo_url),
      banners: [],
      cta: null,
      hotline: clean(contact.hotline, 20),
      hotlineHref: '',
      website: null,
      social: [],
      sponsors: []
    };
    view.hotlineHref = telHref(view.hotline);
    if (!view.hotlineHref) view.hotline = '';

    banners.forEach(function (b) {
      var image = pick(b && b.image_url);
      var href = pick(b && b.href);
      if (image && href) view.banners.push({ imageUrl: image, alt: clean(b.alt, 120), href: href });
    });

    var cta = body.cta;
    if (cta && typeof cta === 'object') {
      var ctaHref = pick(cta.href);
      var label = clean(cta.label, 40);
      if (ctaHref && label) view.cta = { label: label, href: ctaHref };
    }

    var siteHref = pick(contact.website_href);
    var siteLabel = clean(contact.website_label, 120);
    if (siteHref && siteLabel) view.website = { label: siteLabel, href: siteHref };

    var seen = {};
    social.forEach(function (s) {
      var kind = s && s.kind;
      var href = pick(s && s.href);
      if (SOCIAL_KINDS.indexOf(kind) >= 0 && !seen[kind] && href) {
        seen[kind] = true;
        view.social.push({ kind: kind, href: href });
      }
    });

    sponsors.forEach(function (sp) {
      var name = clean(sp && sp.name, 60);
      var logo = pick(sp && sp.logo_url);
      var hasHref = sp && sp.href !== null && sp.href !== undefined && sp.href !== '';
      var href = hasHref ? pick(sp.href) : '';
      if (name && logo && (!hasHref || href)) view.sponsors.push({ name: name, logoUrl: logo, href: href });
    });
    return view;
  }

  // document.title: a white-label page carries the partner's name only.
  function pageTitle(eventName, view) {
    if (view && !view.poweredBy) return (eventName || 'Ảnh của bạn') + ' — ' + view.orgName;
    return (eventName ? eventName + ' — ' : '') + 'Ảnh của bạn — Happy Booth';
  }

  // <meta name="theme-color">: the colour of the bar the browser UI sits on.
  function themeColor(view) {
    if (!view) return '#FFFFFF';
    return THEME_COLOR[view.theme] || view.color;
  }

  return {
    SHORT_PATH_RE: SHORT_PATH_RE,
    readCode: readCode,
    apiBase: apiBase,
    apiUrl: apiUrl,
    deriveState: deriveState,
    isStale: isStale,
    isExpired: isExpired,
    swipeDirection: swipeDirection,
    nextPollDelay: nextPollDelay,
    indexAfterUpdate: indexAfterUpdate,
    chooseIndex: chooseIndex,
    wrapIndex: wrapIndex,
    formatDate: formatDate,
    fileKind: fileKind,
    albumNoun: albumNoun,
    videoErrorRetryable: videoErrorRetryable,
    pageFetchTimeoutMs: PAGE_FETCH_TIMEOUT_MS,
    inkFor: inkFor,
    contrastRatio: contrastRatio,
    carouselIndex: carouselIndex,
    previewOriginAllowed: previewOriginAllowed,
    telHref: telHref,
    previewUrl: previewUrl,
    pageView: pageView,
    pageTitle: pageTitle,
    themeColor: themeColor
  };
});
