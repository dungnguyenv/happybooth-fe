/* ========================================
   Happy Booth — Photobooth Event
   Main JavaScript
   ======================================== */

var _scrollObserver = null;
var _carouselInterval = null;
var _heroMessageCleanup = null;
var _videoObserver = null;
var _lightboxImages = [];
var _lightboxIndex = 0;

document.addEventListener('DOMContentLoaded', function () {
  // One-time inits (header/nav — permanent DOM)
  initMobileNav();
  initHeaderScroll();
  initFloatingContact();

  // Per-page inits (content-specific)
  reinitPage();
});

/* ----------------------------------------
   Exposed API for SPA Router
   ---------------------------------------- */
window.HB = {
  reinitPage: reinitPage,
  cleanup: cleanup
};

function reinitPage() {
  initScrollAnimations();
  initHeroMessages();
  initPhotoWall();
  initAutoplayVideos();
  initRecentJobs();
  initLightbox();
  initFrameGallery();
  initMasonryColumns();
  initPortfolioLoadMore();
  initFAQ();
  initCarousel();
  initLoginForm();
  initAdminPage();
}

function cleanup() {
  if (_heroMessageCleanup) {
    _heroMessageCleanup();
    _heroMessageCleanup = null;
  }
  // Clean up carousel interval
  if (_carouselInterval) {
    clearInterval(_carouselInterval);
    _carouselInterval = null;
  }
  // Clean up scroll observer
  if (_scrollObserver) {
    _scrollObserver.disconnect();
    _scrollObserver = null;
  }
  if (_videoObserver) {
    _videoObserver.disconnect();
    _videoObserver = null;
  }
}

/* ----------------------------------------
   Mobile Navigation
   ---------------------------------------- */
function initMobileNav() {
  var hamburger = document.querySelector('.hamburger');
  var mobileNav = document.querySelector('.mobile-nav');

  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', function () {
    hamburger.classList.toggle('active');
    mobileNav.classList.toggle('active');
    document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
  });

  mobileNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      hamburger.classList.remove('active');
      mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
      hamburger.classList.remove('active');
      mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

/* ----------------------------------------
   Floating Contact Widget (Phone / Zalo / Facebook)
   ---------------------------------------- */
function initFloatingContact() {
  if (document.querySelector('.floating-contact')) return;

  var phoneIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.23 15.26l-2.54-.29a1.99 1.99 0 0 0-1.65.57l-1.84 1.84a15.04 15.04 0 0 1-6.59-6.59l1.85-1.85c.43-.43.64-1.03.57-1.65L8.74 4.77A2 2 0 0 0 6.75 3H5.03c-1.13 0-2.07.94-2 2.07.53 8.54 7.36 15.36 15.89 15.89a1.99 1.99 0 0 0 2.07-2v-1.72c.01-1.02-.76-1.88-1.76-1.98z"/></svg>';
  var zaloIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.27 3 2 8.27 2 14.78c0 3.66 1.86 6.92 4.78 9.07-.18 1.14-.86 3-2.21 4.69-.21.27-.06.66.27.71.31.05.65.06.99.04 2.93-.16 5.03-1.42 6.16-2.27 1.27.31 2.62.49 4.01.49C23.73 27.5 30 22.24 30 15.78 30 8.27 23.73 3 16 3z"/><text x="16" y="19" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="11" fill="#0068ff">Zalo</text></svg>';
  var fbIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>';

  var wrap = document.createElement('div');
  wrap.className = 'floating-contact';
  wrap.innerHTML =
    '<a href="tel:0971842329" class="floating-contact__btn floating-contact__btn--phone" aria-label="Gọi 0971842329" data-i18n-aria-label="common.a11y.callPhone">' + phoneIcon + '</a>' +
    '<a href="https://zalo.me/971842329" target="_blank" rel="noopener" class="floating-contact__btn floating-contact__btn--zalo" aria-label="Zalo">' + zaloIcon + '</a>' +
    '<a href="https://www.facebook.com/happyboothvn" target="_blank" rel="noopener" class="floating-contact__btn floating-contact__btn--facebook" aria-label="Facebook">' + fbIcon + '</a>';

  document.body.appendChild(wrap);
}

/* ----------------------------------------
   Header Scroll Effect
   ---------------------------------------- */
function initHeaderScroll() {
  var header = document.querySelector('.header');
  if (!header) return;

  window.addEventListener('scroll', function () {
    if (window.pageYOffset > 100) {
      header.style.boxShadow = '0 1px 0 rgba(0,0,0,0.05)';
    } else {
      header.style.boxShadow = 'none';
    }
  }, { passive: true });
}

/* ----------------------------------------
   Scroll Animations (Fade In)
   ---------------------------------------- */
function initScrollAnimations() {
  var elements = document.querySelectorAll('.fade-in:not(.visible)');
  if (!elements.length) return;

  if (_scrollObserver) {
    _scrollObserver.disconnect();
  }

  if (!window.IntersectionObserver || prefersReducedMotion()) {
    elements.forEach(function (el) { el.classList.add('visible'); });
    return;
  }

  _scrollObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        _scrollObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(function (el) {
    el.classList.add('hb-animate');
    _scrollObserver.observe(el);
  });
}

/* ----------------------------------------
   Home — synchronized messages and photo walls
   ---------------------------------------- */
function initHeroMessages() {
  if (_heroMessageCleanup) {
    _heroMessageCleanup();
    _heroMessageCleanup = null;
  }
  var hero = document.querySelector('.home-hero__copy');
  if (!hero) return;
  var buttons = Array.from(hero.querySelectorAll('[data-hero-target]'));
  var messages = Array.from(hero.querySelectorAll('[data-hero-message]'));
  var walls = Array.from(document.querySelectorAll('[data-hero-wall]'));
  var pause = hero.querySelector('[data-hero-pause]');
  if (buttons.length < 2 || !pause) return;
  var active = Math.max(0, buttons.findIndex(function (button) {
    return button.getAttribute('aria-pressed') === 'true';
  }));
  var paused = pause.getAttribute('aria-pressed') === 'true' || prefersReducedMotion();
  var hovered = false;

  function show(index) {
    active = index;
    var target = buttons[index].dataset.heroTarget;
    messages.forEach(function (message) {
      message.setAttribute('aria-hidden', String(message.dataset.heroMessage !== target));
    });
    buttons.forEach(function (button, i) {
      button.setAttribute('aria-pressed', String(i === index));
    });
    walls.forEach(function (wall) {
      wall.hidden = wall.dataset.heroWall !== target;
    });
  }
  function setPaused(value) {
    paused = value;
    var key = paused ? 'home.hero.resume' : 'home.hero.pause';
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('data-i18n', key);
    pause.textContent = (window.i18n && window.i18n.t(key)) || (paused ? 'Chạy tiếp' : 'Tạm dừng');
  }
  function click(e) {
    var button = e.target.closest('[data-hero-target]');
    if (button && hero.contains(button)) {
      show(buttons.indexOf(button));
      setPaused(true);
    } else if (e.target.closest('[data-hero-pause]')) {
      setPaused(!paused);
    }
  }
  function enter() { hovered = true; }
  function leave() { hovered = false; }
  hero.addEventListener('click', click);
  hero.addEventListener('pointerenter', enter);
  hero.addEventListener('pointerleave', leave);
  show(active);
  setPaused(paused);
  var interval = setInterval(function () {
    if (paused || hovered || document.hidden || hero.contains(document.activeElement)) return;
    show((active + 1) % buttons.length);
  }, 8000);
  _heroMessageCleanup = function () {
    clearInterval(interval);
    hero.removeEventListener('click', click);
    hero.removeEventListener('pointerenter', enter);
    hero.removeEventListener('pointerleave', leave);
  };
}

// Clone each track only once; data-cloned survives the router's DOM snapshots.
function initPhotoWall() {
  document.querySelectorAll('.wall').forEach(function (wall) {
    wall.querySelectorAll('.wall__track').forEach(function (track) {
      if (track.dataset.cloned) return;
      track.dataset.cloned = '1';
      Array.prototype.slice.call(track.children).forEach(function (node) {
        var copy = node.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.querySelectorAll('img').forEach(function (img) { img.alt = ''; });
        track.appendChild(copy);
      });
    });
    var pause = wall.querySelector('.wall__pause');
    if (!pause || pause._hbBound) return;
    pause._hbBound = true;
    pause.addEventListener('click', function () {
      var paused = wall.classList.toggle('is-paused');
      pause.setAttribute('aria-pressed', paused);
      var key = paused ? 'home.wall.resume' : 'home.wall.pause';
      pause.setAttribute('data-i18n', key);
      pause.textContent = (window.i18n && window.i18n.t(key)) || (paused ? 'Chạy tiếp' : 'Tạm dừng');
    });
  });
}

/* ----------------------------------------
   Autoplay videos — play only while on screen. The markup uses
   data-autoplay + preload="none" so the clips don't download on page load
   (a native autoplay attribute fetches every video up front). Reduced
   motion leaves them paused with their controls.
   ---------------------------------------- */
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initAutoplayVideos() {
  if (_videoObserver) {
    _videoObserver.disconnect();
    _videoObserver = null;
  }
  var videos = document.querySelectorAll('#page-content video[data-autoplay]');
  if (!videos.length || prefersReducedMotion()) return;
  videos.forEach(function (v) { v.muted = true; });
  if (!window.IntersectionObserver) {
    videos.forEach(function (v) { v.play().catch(function () {}); });
    return;
  }
  _videoObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.play().catch(function () {});
      else entry.target.pause();
    });
  }, { rootMargin: '200px 0px' });
  videos.forEach(function (v) { _videoObserver.observe(v); });
}

/* ----------------------------------------
   Completed jobs — newest first, up to three
   ---------------------------------------- */
function initRecentJobs() {
  var list = document.querySelector('[data-recent-jobs]');
  if (!list) return;
  var jobs = Array.from(list.querySelectorAll('.recent-job'));
  jobs.sort(function (a, b) {
    return (b.dataset.jobDate || '').localeCompare(a.dataset.jobDate || '');
  });
  jobs.forEach(function (job, index) {
    job.hidden = index >= 3;
    list.appendChild(job);
  });
  list.dataset.jobCount = String(Math.min(jobs.length, 3));
  list.closest('.recent-jobs').hidden = jobs.length === 0;
}

/* ----------------------------------------
   Lightbox
   ---------------------------------------- */
function initFrameGallery() {
  var gallery = document.querySelector('[data-frame-gallery]');
  if (!gallery) return;
  var dialog = gallery.querySelector('.frame-modal');
  if (!dialog || gallery._hbFrameBound) return;
  gallery._hbFrameBound = true;
  // A cached SPA snapshot may contain the dialog's old open attribute.
  if (dialog.open) dialog.close();
  gallery.addEventListener('click', function (e) {
    var preview = e.target.closest('[data-frame-preview]');
    if (!preview || !gallery.contains(preview)) return;
    var card = preview.closest('.frame-card');
    var image = preview.querySelector('img');
    var modalImage = dialog.querySelector('.frame-modal__image');
    modalImage.src = preview.dataset.framePreview;
    modalImage.alt = image.alt;
    dialog.querySelector('.frame-modal__title').textContent = card.querySelector('h2').textContent;
    dialog.querySelector('.frame-modal__source').href = card.querySelector('.frame-card__source').href;
    dialog.showModal();
  });
  dialog.querySelector('[data-frame-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });
}

function getVisibleGalleryItems(origin) {
  var album = origin && origin.closest('[data-project-album]');
  if (album) return Array.from(album.querySelectorAll('.recent-job__photo'));
  var job = origin && origin.closest('.recent-job');
  if (job) {
    return Array.from(job.querySelectorAll('.recent-job__gallery .recent-job__photo'));
  }
  return Array.from(document.querySelectorAll('.gallery__item:not(.gallery__item--hidden), .masonry__item'));
}

function initLightbox() {
  var lightbox = document.getElementById('lightbox');
  // Public pages share this permanent viewer, including when navigation starts
  // on a page that has no gallery of its own.
  if (!lightbox) {
    document.body.insertAdjacentHTML('beforeend', '<div class="lightbox" id="lightbox"><button class="lightbox__close" aria-label="Đóng ảnh" data-i18n-aria-label="common.a11y.closePhoto">&times;</button><button class="lightbox__nav lightbox__prev" aria-label="Ảnh trước" data-i18n-aria-label="common.a11y.previousPhoto">&#8249;</button><img class="lightbox__image" alt=""><button class="lightbox__nav lightbox__next" aria-label="Ảnh tiếp theo" data-i18n-aria-label="common.a11y.nextPhoto">&#8250;</button><div class="lightbox__counter"></div></div>');
    lightbox = document.getElementById('lightbox');
  }

  var lightboxImg = lightbox.querySelector('.lightbox__image');
  var lightboxClose = lightbox.querySelector('.lightbox__close');
  var lightboxPrev = lightbox.querySelector('.lightbox__prev');
  var lightboxNext = lightbox.querySelector('.lightbox__next');
  var lightboxCounter = lightbox.querySelector('.lightbox__counter');
  var returnFocus = null;
  var previousOverflow = '';
  var lightboxAlts = [];
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('data-i18n-aria-label', 'common.a11y.photoViewer');
  lightbox.setAttribute('aria-label', (window.i18n && window.i18n.t('common.a11y.photoViewer')) || 'Trình xem ảnh');
  if (window.i18n) window.i18n.apply(lightbox);

  function updateLightbox() {
    if (!_lightboxImages.length) return;
    lightboxImg.src = _lightboxImages[_lightboxIndex];
    lightboxImg.alt = lightboxAlts[_lightboxIndex] || '';
    lightboxCounter.textContent = (_lightboxIndex + 1) + ' / ' + _lightboxImages.length;
  }

  function openLightbox(index, items, origin) {
    _lightboxImages = items.map(function (item) {
      var img = item.querySelector('img');
      return item.dataset.full || (img ? img.src : null);
    }).filter(Boolean);
    lightboxAlts = items.map(function (item) {
      var img = item.querySelector('img');
      return img ? img.alt : '';
    });
    if (!_lightboxImages.length) return;
    _lightboxIndex = Math.max(0, Math.min(index, _lightboxImages.length - 1));
    updateLightbox();
    lightbox.classList.add('active');
    returnFocus = origin || document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('.lightbox__close').focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = previousOverflow;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  }

  function prevImage() {
    if (!_lightboxImages.length) return;
    _lightboxIndex = (_lightboxIndex - 1 + _lightboxImages.length) % _lightboxImages.length;
    updateLightbox();
  }

  function nextImage() {
    if (!_lightboxImages.length) return;
    _lightboxIndex = (_lightboxIndex + 1) % _lightboxImages.length;
    updateLightbox();
  }

  // Refresh delegated handlers after an SPA swap to keep focus state in sync.
  if (lightbox._galleryClickHandler) {
    document.removeEventListener('click', lightbox._galleryClickHandler);
  }
  {
    lightbox._galleryClickHandler = function (e) {
      var item = e.target.closest('.gallery__item, .masonry__item, .recent-job__photo');
      if (!item || item.classList.contains('gallery__item--hidden')) return;
      var items = getVisibleGalleryItems(item);
      // The cover also appears as the first photo in each job's album.
      if (item.classList.contains('recent-job__cover')) {
        var coverIndex = items.findIndex(function (photo) { return photo.dataset.full === item.dataset.full; });
        if (coverIndex >= 0) openLightbox(coverIndex, items, item);
        return;
      }
      var idx = items.indexOf(item);
      if (idx >= 0) openLightbox(idx, items, item);
    };
    document.addEventListener('click', lightbox._galleryClickHandler);
  }

  // Re-bind nav buttons by cloning to drop stale listeners
  var newClose = lightboxClose.cloneNode(true);
  lightboxClose.parentNode.replaceChild(newClose, lightboxClose);
  newClose.addEventListener('click', closeLightbox);

  var newPrev = lightboxPrev.cloneNode(true);
  lightboxPrev.parentNode.replaceChild(newPrev, lightboxPrev);
  newPrev.addEventListener('click', prevImage);

  var newNext = lightboxNext.cloneNode(true);
  lightboxNext.parentNode.replaceChild(newNext, lightboxNext);
  newNext.addEventListener('click', nextImage);

  lightbox.onclick = function (e) {
    if (e.target === lightbox) closeLightbox();
  };

  if (lightbox._keyHandler) {
    document.removeEventListener('keydown', lightbox._keyHandler);
  }
  {
    lightbox._keyHandler = function (e) {
      if (!lightbox.classList.contains('active')) return;
      switch (e.key) {
        case 'Escape': closeLightbox(); break;
        case 'ArrowLeft': prevImage(); break;
        case 'ArrowRight': nextImage(); break;
        case 'Tab':
          var controls = Array.from(lightbox.querySelectorAll('button'));
          var first = controls[0];
          var last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          break;
      }
    };
    document.addEventListener('keydown', lightbox._keyHandler);
  }

  var touchStartX = 0;
  lightbox.ontouchstart = function (e) {
    touchStartX = e.changedTouches[0].screenX;
  };
  lightbox.ontouchend = function (e) {
    var diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextImage() : prevImage();
    }
  };
}

/* ----------------------------------------
   Portfolio Masonry — flex-based columns
   - Visible items distributed by SHORTEST column (declared sizes, re-checked after load)
   - Hidden items in a pool outside the grid
   - Load more pops from pool, places in currently shortest column
   - Result: no reflow of existing items + balanced column heights
   ---------------------------------------- */
function getMasonryColumnCount() {
  var w = window.innerWidth;
  if (w <= 768) return 2;
  if (w <= 1024) return 3;
  return 4;
}

function findShortestColumnIdx(heights) {
  var idx = 0;
  for (var i = 1; i < heights.length; i++) {
    if (heights[i] < heights[idx]) idx = i;
  }
  return idx;
}

function estimateItemHeight(item, colWidth) {
  var img = item.querySelector('img');
  if (img && img.naturalWidth > 0) {
    return Math.round(colWidth * img.naturalHeight / img.naturalWidth);
  }
  // Unloaded images: use the declared width/height attributes
  var w = img ? parseInt(img.getAttribute('width'), 10) : 0;
  var h = img ? parseInt(img.getAttribute('height'), 10) : 0;
  if (w > 0 && h > 0) return Math.round(colWidth * h / w);
  // Fallback: assume 4:5 portrait (typical photobooth aspect)
  return Math.round(colWidth * 1.25);
}

function rebalanceVisibleByHeight(grid) {
  var cols = Array.prototype.slice.call(grid.querySelectorAll('.gallery__col'));
  if (cols.length === 0) return;
  var colWidth = cols[0].offsetWidth;

  var visible = Array.prototype.slice.call(grid.querySelectorAll('.gallery__item:not(.gallery__item--hidden)'));
  visible.sort(function (a, b) {
    return parseInt(a.dataset.order, 10) - parseInt(b.dataset.order, 10);
  });

  var estHeights = cols.map(function () { return 0; });
  visible.forEach(function (item) {
    var idx = findShortestColumnIdx(estHeights);
    cols[idx].appendChild(item);
    estHeights[idx] += estimateItemHeight(item, colWidth);
  });
}

function initMasonryColumns() {
  var grid = document.querySelector('.gallery__grid');
  if (!grid) return;

  var targetCols = getMasonryColumnCount();
  if (grid.dataset.colCount && parseInt(grid.dataset.colCount, 10) === targetCols) return;

  // Collect all items from both grid (columns) and pool
  var items = Array.prototype.slice.call(grid.querySelectorAll('.gallery__item'));
  var pool = grid.parentNode.querySelector('.gallery__pool');
  if (pool) {
    Array.prototype.slice.call(pool.querySelectorAll('.gallery__item')).forEach(function (it) {
      items.push(it);
    });
  }
  if (items.length === 0) return;

  // Assign data-order on first run so we can re-sort after a re-layout
  if (!grid.dataset.colCount) {
    items.forEach(function (it, idx) { it.dataset.order = String(idx); });
  }
  items.sort(function (a, b) {
    return parseInt(a.dataset.order, 10) - parseInt(b.dataset.order, 10);
  });

  var visible = items.filter(function (it) { return !it.classList.contains('gallery__item--hidden'); });
  var hidden = items.filter(function (it) { return it.classList.contains('gallery__item--hidden'); });

  // Rebuild grid: clear and create N column divs
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  var colDivs = [];
  for (var i = 0; i < targetCols; i++) {
    var col = document.createElement('div');
    col.className = 'gallery__col';
    grid.appendChild(col);
    colDivs.push(col);
  }

  // Distribute VISIBLE items by their declared heights, so the post-load
  // rebalance below finds nothing to move (no layout shift)
  var colWidth = colDivs[0].offsetWidth;
  var estHeights = colDivs.map(function () { return 0; });
  visible.forEach(function (item) {
    var idx = findShortestColumnIdx(estHeights);
    colDivs[idx].appendChild(item);
    estHeights[idx] += estimateItemHeight(item, colWidth);
  });

  // Pool hidden items outside the grid (display:none container)
  if (!pool) {
    pool = document.createElement('div');
    pool.className = 'gallery__pool';
    pool.hidden = true;
    grid.parentNode.insertBefore(pool, grid.nextSibling);
  }
  while (pool.firstChild) pool.removeChild(pool.firstChild);
  hidden.forEach(function (it) { pool.appendChild(it); });

  grid.dataset.colCount = String(targetCols);

  // After visible images load, rebalance by ACTUAL heights (one-time settle)
  var visibleImgs = Array.prototype.slice.call(grid.querySelectorAll('.gallery__item img'));
  var pending = visibleImgs.filter(function (img) { return !img.complete; }).length;
  var settle = function () { requestAnimationFrame(function () { rebalanceVisibleByHeight(grid); }); };
  if (pending === 0) {
    settle();
  } else {
    visibleImgs.forEach(function (img) {
      if (img.complete) return;
      var done = function () {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        pending--;
        if (pending === 0) settle();
      };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    });
  }

  // Attach resize handler once (singleton)
  if (!initMasonryColumns._resizeBound) {
    initMasonryColumns._resizeBound = true;
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(initMasonryColumns, 200);
    });
  }
}

/* ----------------------------------------
   Portfolio "Load more" pagination
   ---------------------------------------- */
function initPortfolioLoadMore() {
  var button = document.querySelector('.gallery__load-more');
  if (!button) return;
  // No dataset guard here: the router caches this page's HTML when leaving it,
  // so a stored flag would come back without its click listener.

  var wrapper = button.closest('.gallery__more');
  var batchSize = 30;

  function updateButtonState() {
    var remaining = document.querySelectorAll('.gallery__item--hidden').length;
    if (remaining === 0 && wrapper) wrapper.classList.add('is-done');
  }

  button.addEventListener('click', function () {
    var grid = document.querySelector('.gallery__grid');
    if (!grid) return;
    var pool = grid.parentNode.querySelector('.gallery__pool');
    if (!pool) return;
    var cols = Array.prototype.slice.call(grid.querySelectorAll('.gallery__col'));
    if (cols.length === 0) return;
    var colWidth = cols[0].offsetWidth;

    // Start from currently rendered heights so we extend existing balance
    var estHeights = cols.map(function (c) { return c.offsetHeight; });
    var toReveal = Array.prototype.slice.call(pool.children).slice(0, batchSize);

    toReveal.forEach(function (item) {
      var idx = findShortestColumnIdx(estHeights);
      item.classList.remove('gallery__item--hidden');
      var img = item.querySelector('img');
      if (img && img.loading === 'lazy') img.loading = 'eager';
      cols[idx].appendChild(item);
      estHeights[idx] += estimateItemHeight(item, colWidth);
    });
    updateButtonState();
  });

  // Initial check in case page was loaded with no hidden items
  updateButtonState();
}

/* ----------------------------------------
   FAQ Accordion
   ---------------------------------------- */
function initFAQ() {
  var faqItems = document.querySelectorAll('.faq__item');
  if (!faqItems.length) return;

  faqItems.forEach(function (item) {
    var question = item.querySelector('.faq__question');
    if (!question) return;

    question.addEventListener('click', function () {
      var isActive = item.classList.contains('active');
      faqItems.forEach(function (other) { other.classList.remove('active'); });
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

/* ----------------------------------------
   Contact Page Carousel
   ---------------------------------------- */
function initCarousel() {
  var carousel = document.getElementById('contactCarousel');
  if (!carousel) return;

  var images = carousel.querySelectorAll('img');
  if (images.length <= 1) return;

  var currentSlide = 0;

  if (_carouselInterval) clearInterval(_carouselInterval);

  _carouselInterval = setInterval(function () {
    images[currentSlide].classList.remove('carousel-active');
    currentSlide = (currentSlide + 1) % images.length;
    images[currentSlide].classList.add('carousel-active');
  }, 4000);
}

/* ----------------------------------------
   Contact Form Submit (moved from inline)
   ---------------------------------------- */
function handleSubmit(e) {
  e.preventDefault();
  var msg = (window.i18n && window.i18n.t('contact.form.successAlert'))
    || 'Thank you for your inquiry! We will get back to you soon.';
  alert(msg);
  e.target.reset();
  return false;
}

/* ----------------------------------------
   Login Form
   ---------------------------------------- */
function initLoginForm() {
  var form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errorEl = document.getElementById('loginError');

    errorEl.style.display = 'none';
    errorEl.textContent = '';

    if (!email || !password) {
      showLoginError(errorEl, 'auth.error.emptyFields', 'Please enter email and password.');
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '...';

    window.auth.login(email, password).then(function () {
      window.location.href = '/admin';
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = (window.i18n && window.i18n.t('auth.login.submit')) || 'Sign In';

      var msgKey = 'auth.error.generic';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' ||
          err.code === 'auth/invalid-credential') {
        msgKey = 'auth.error.invalidCredentials';
      } else if (err.code === 'auth/too-many-requests') {
        msgKey = 'auth.error.tooManyRequests';
      } else if (err.code === 'auth/invalid-email') {
        msgKey = 'auth.error.invalidEmail';
      }
      showLoginError(errorEl, msgKey, getDefaultErrorMessage(err.code));
    });
  });
}

function showLoginError(el, i18nKey, fallback) {
  var msg = (window.i18n && window.i18n.t(i18nKey)) || fallback;
  el.textContent = msg;
  el.style.display = 'block';
}

function getDefaultErrorMessage(code) {
  var map = {
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'Invalid email or password.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/invalid-email': 'Please enter a valid email address.'
  };
  return map[code] || 'An error occurred. Please try again.';
}

/* ----------------------------------------
   Admin Page
   ---------------------------------------- */
function initAdminPage() {
  var logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', function () {
    window.auth.logout().then(function () {
      window.location.href = '/login';
    });
  });
}

/* Sharing is delegated so it works after SPA navigation too. */
document.addEventListener('click', async function (event) {
  var button = event.target.closest('[data-wd-copy]');
  if (!button) return;
  var status = button.closest('.wd-share').querySelector('[role="status"]');
  try {
    await navigator.clipboard.writeText(button.getAttribute('data-wd-copy'));
    status.textContent = 'Đã sao chép liên kết bài viết.';
  } catch (error) {
    status.textContent = 'Liên kết bài viết: ' + button.getAttribute('data-wd-copy');
  }
});
