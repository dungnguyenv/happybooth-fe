/* ========================================
   Happy Booth — Photobooth Event
   SPA Router (Fetch-and-Swap)
   ======================================== */

(function () {
  var TRANSITION_MS = 400;
  var pageCache = {};
  var currentPage = null;
  var navigationId = 0;
  var seoSelector = 'meta[name="description"], meta[name="keywords"], meta[name="author"], meta[name="robots"], meta[name="googlebot"], meta[property^="og:"], meta[property^="article:"], meta[name^="twitter:"], link[rel="canonical"], script[type="application/ld+json"]';

  function snapshot(doc, main) {
    return {
      html: main.outerHTML,
      title: doc.title,
      seo: Array.from(doc.head.querySelectorAll(seoSelector)).map(function (node) {
        return node.outerHTML;
      }).join('\n')
    };
  }

  function syncSEO(page) {
    document.head.querySelectorAll(seoSelector).forEach(function (node) { node.remove(); });
    document.head.insertAdjacentHTML('beforeend', page.seo);
    document.title = page.title;
  }

  function init() {
    var main = document.getElementById('page-content');
    if (main) {
      currentPage = main.getAttribute('data-page');
      // Cache before animations add .visible classes
      var href = pageToHref(currentPage);
      if (href) {
        // Old .html links (search results, shared posts) still load — tidy the address bar
        if (window.location.pathname !== href) {
          history.replaceState(null, '', href + window.location.search + window.location.hash);
        }
        pageCache[href] = snapshot(document, main);
      }

      // Static HTML is already visible. Only SPA navigation adds page-enter.
    }

    interceptLinks();
    window.addEventListener('popstate', onPopState);
    preloadPages();
  }

  // Clean URLs — GitHub Pages serves /about from about.html
  var pagePaths = {
    home: '/', about: '/about', portfolio: '/portfolio',
    frame: '/frame', price: '/price',
    contact: '/contact',
    'du-an-note-group': '/du-an-note-group',
    'du-an-20-10': '/du-an-20-10',
    'thue-photobooth-su-kien-ha-noi': '/thue-photobooth-su-kien-ha-noi'
  };

  function pageToHref(page) {
    return pagePaths[page] || null;
  }

  // '/about', 'about.html', '/index.html' → page name; null if not a site page
  function hrefToPage(href) {
    var path = new URL(href, window.location.href).pathname.replace(/\.html$/, '');
    if (path === '/index') path = '/';
    for (var page in pagePaths) {
      if (pagePaths[page] === path) return page;
    }
    return null;
  }

  function interceptLinks() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href]');
      if (!link) return;

      var href = link.getAttribute('href');
      if (!href) return;

      // Skip: external, anchors, mailto, tel, javascript, target=_blank,
      // query/hash links (a full navigation keeps them)
      if (href.startsWith('http') || href.startsWith('mailto:') ||
          href.startsWith('tel:') || href.startsWith('javascript:') || /[?#]/.test(href)) return;
      if (link.target === '_blank') return;

      // Only handle links to site pages
      var targetPage = hrefToPage(href);
      if (!targetPage) return;

      if (targetPage === currentPage) {
        e.preventDefault();
        window.scrollTo(0, 0);
        return;
      }

      e.preventDefault();
      navigateTo(href, true);
    });
  }

  async function navigateTo(href, pushState) {
    var requestId = ++navigationId;
    var targetPage = hrefToPage(href);
    if (!targetPage) {
      window.location.href = href;
      return;
    }
    var clean = pageToHref(targetPage);

    if (window.i18n && window.i18n.ready) await window.i18n.ready;
    if (requestId !== navigationId) return;

    // Close mobile nav if open
    var hamburger = document.querySelector('.hamburger');
    var mobileNav = document.querySelector('.mobile-nav');
    if (hamburger && hamburger.classList.contains('active')) {
      hamburger.classList.remove('active');
      mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    }

    var main = document.getElementById('page-content');
    if (!main) {
      // Fallback: normal navigation
      window.location.href = clean;
      return;
    }

    // Snapshot current page DOM (incl. async-loaded content like home gallery)
    // before tearing it down, so the back-navigation cache is up-to-date.
    if (currentPage) {
      var currentHref = pageToHref(currentPage);
      if (currentHref) pageCache[currentHref] = snapshot(document, main);
    }

    // Cleanup before swap
    if (window.HB && window.HB.cleanup) {
      window.HB.cleanup();
    }

    // Slide-fade out
    main.classList.add('page-enter');

    // Wait for transition
    await sleep(TRANSITION_MS);
    if (requestId !== navigationId) return;

    // Fetch or use cache
    var page = pageCache[clean];
    if (!page) {
      try {
        var resp = await fetch(clean);
        if (requestId !== navigationId) return;
        if (!resp.ok) {
          window.location.href = clean;
          return;
        }
        var html = await resp.text();
        if (requestId !== navigationId) return;
        // Extract <main> from full HTML
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var newMain = doc.getElementById('page-content');
        if (!newMain) {
          window.location.href = clean;
          return;
        }
        page = snapshot(doc, newMain);
        pageCache[clean] = page;
      } catch (err) {
        if (requestId !== navigationId) return;
        window.location.href = clean;
        return;
      }
    }

    // Swap content
    main.outerHTML = page.html;
    syncSEO(page);

    // Re-query the new main element
    var newMainEl = document.getElementById('page-content');
    currentPage = targetPage;

    // Apply i18n translations instantly (already cached in memory)
    if (window.i18n && window.i18n.apply) {
      window.i18n.apply(newMainEl);
    }

    // Update meta title for i18n
    if (window.i18n) {
      var titleKey = 'meta.title.' + targetPage;
      var translatedTitle = window.i18n.t(titleKey);
      if (translatedTitle) document.title = translatedTitle;
    }

    // Reinit page-specific JS
    if (window.HB && window.HB.reinitPage) {
      window.HB.reinitPage();
    }

    // Update active nav class
    updateActiveNav(clean);

    // Push to history
    if (pushState) {
      history.pushState({ page: targetPage, href: clean }, '', clean);
    }

    // Slide-fade in
    newMainEl.classList.add('page-enter');
    // Force reflow so browser registers the starting state
    newMainEl.offsetHeight;
    newMainEl.classList.remove('page-enter');

    // Scroll to top
    window.scrollTo(0, 0);
  }

  function onPopState(e) {
    if (e.state && e.state.href) {
      navigateTo(e.state.href, false);
    } else {
      // Initial page or unknown state — use current URL
      navigateTo(window.location.pathname, false);
    }
  }

  function updateActiveNav(href) {
    var clean = href;
    if (clean === '/du-an-note-group' || clean === '/du-an-20-10') clean = '/about';
    // Update desktop nav
    document.querySelectorAll('.header__nav a[href]').forEach(function (a) {
      var linkHref = a.getAttribute('href');
      if (linkHref === clean) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
    // Update mobile nav
    document.querySelectorAll('.mobile-nav a[href]').forEach(function (a) {
      var linkHref = a.getAttribute('href');
      if (linkHref === clean) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }

  function preloadPages() {
    var pages = ['/', '/about', '/portfolio', '/frame', '/price', '/contact'];
    var idleCallback = window.requestIdleCallback || function (cb) { setTimeout(cb, 200); };

    idleCallback(function () {
      pages.forEach(function (page) {
        if (pageCache[page]) return;
        fetch(page).then(function (resp) {
          return resp.text();
        }).then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var main = doc.getElementById('page-content');
          if (main) {
            // Do not replace a more recent navigation snapshot with a late preload.
            if (!pageCache[page]) pageCache[page] = snapshot(doc, main);
          }
        }).catch(function () {
          // Silently fail — will fallback to normal navigation
        });
      });
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
