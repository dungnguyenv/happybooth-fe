/* ========================================
   Happy Booth — Album page (happybooth.vn/<code>)
   404.html sends short links here as /album?c=<code>; this page restores the
   short URL, reads the album from the API and polls while photos upload.
   An album holds photos, GIFs and MP4 clips (HBAlbumCore.fileKind).
   ======================================== */

(function () {
  var core = window.HBAlbumCore;
  var HOTLINE = '<a href="tel:+84971842329">0971 842 329</a>';
  var ALT_NOUN = { photo: 'ảnh', gif: 'GIF', video: 'video' };
  var THUMB_NOUN = { photo: 'Ảnh', gif: 'GIF', video: 'Video' };
  var BADGES = {
    gif: 'GIF',
    video: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>'
  };

  var main = document.getElementById('album');
  var els = {
    title: document.querySelector('[data-album-title]'),
    photo: document.querySelector('[data-album-photo]'),
    image: document.querySelector('[data-album-image]'),
    video: document.querySelector('[data-album-video]'),
    play: document.querySelector('[data-album-play]'),
    videoError: document.querySelector('[data-album-video-error]'),
    counter: document.querySelector('[data-album-counter]'),
    message: document.querySelector('[data-album-message]'),
    thumbs: document.querySelector('[data-album-thumbs]'),
    progress: document.querySelector('[data-album-progress]'),
    notice: document.querySelector('[data-album-notice]'),
    event: document.querySelector('[data-album-event]'),
    banner: document.querySelector('[data-album-banner]'),
    eventName: document.querySelector('[data-album-event-name]'),
    eventDesc: document.querySelector('[data-album-event-desc]'),
    expiry: document.querySelector('[data-album-expiry]'),
    download: document.querySelector('[data-album-download]'),
    share: document.querySelector('[data-album-share]'),
    stage: document.querySelector('[data-album-stage]'),
    prev: document.querySelector('[data-album-prev]'),
    next: document.querySelector('[data-album-next]'),
    toast: document.querySelector('[data-album-toast]')
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var code = null;
  var api = null;
  var view = null;          // the current HBAlbumCore state
  var index = 0;            // the photo on stage
  var userPicked = false;   // once the guest chooses a photo, polling never moves them
  var lastUploaded = -1;
  var lastProgressAt = Date.now();
  var timer = null;
  var thumbsKey = '';
  var toastTimer = null;
  var touchX = null;
  var touchY = null;
  var wantedSrc = '';      // the preview the stage should end up showing
  var followThumb = true;  // scroll the strip to the selected thumb on the next render

  function init() {
    code = core.readCode(window.location.search);
    if (!code) {
      apply({ kind: 'not_found', album: null, stale: false, offline: false });
      return;
    }
    // Show the short link, not /album?c=..., so what guests copy is what was printed.
    history.replaceState(null, '', '/' + code);
    api = core.apiBase(window.location.hostname);
    els.thumbs.addEventListener('click', onThumbClick);
    els.prev.addEventListener('click', function () { go(-1); });
    els.next.addEventListener('click', function () { go(1); });
    els.download.addEventListener('click', onDownload);
    els.play.addEventListener('click', onPlay);
    els.video.addEventListener('play', onVideoPlay);
    els.video.addEventListener('error', onVideoError);
    els.share.addEventListener('click', onShare);
    document.addEventListener('keydown', onKey);
    els.stage.addEventListener('touchstart', onTouchStart, { passive: true });
    els.stage.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    refresh();
  }

  /* ---------- Data ---------- */

  function fetchAlbum() {
    return fetch(api + '/public/albums/' + code, { cache: 'no-store' })
      .then(function (res) {
        return res.json()
          .catch(function () { return null; })
          .then(function (body) { return { status: res.status, body: body }; });
      })
      .catch(function () { return { status: 0, body: null }; });
  }

  function refresh() {
    clearTimeout(timer);
    fetchAlbum().then(function (result) {
      apply(core.deriveState(result, view, Date.now()));
      schedule();
    });
  }

  function schedule() {
    clearTimeout(timer);
    if (document.hidden) return;
    var delay = core.nextPollDelay(view, lastProgressAt, Date.now());
    if (delay !== null) timer = setTimeout(refresh, delay);
  }

  function onVisibility() {
    // Every return to the tab re-reads the album, complete ones included, so a
    // link that expired while the tab was in the background shows as expired.
    if (document.hidden) clearTimeout(timer);
    else if (code) refresh();
  }

  function apply(next) {
    var prevFiles = view && view.album && view.album.files;
    var album = next.album;
    if (album && album.files) {
      if (album.uploaded !== lastUploaded) {
        if (lastUploaded >= 0 && album.uploaded > lastUploaded) lastProgressAt = Date.now();
        lastUploaded = album.uploaded;
      }
      var before = index;
      index = core.chooseIndex(prevFiles, index, album.files, userPicked);
      if (index !== before || !prevFiles) followThumb = true;
    }
    view = next;
    render();
  }

  /* ---------- Rendering ---------- */

  function render() {
    var kind = view.kind;
    var album = view.album;
    main.setAttribute('data-state', kind);
    var event = album && album.event;
    var eventName = event && event.name;
    els.title.textContent = eventName || 'Ảnh của bạn';
    document.title = (eventName ? eventName + ' — ' : '') + 'Ảnh của bạn — Happy Booth';

    renderMessage(kind, album);
    renderThumbs(album, kind);
    renderStage();
    renderProgress(album, kind);
    renderNotice();
    renderEvent(album, kind);
  }

  function renderMessage(kind, album) {
    var event = album && album.event;
    var bannerUrl = event && url(event.banner_url);
    var art = bannerUrl
      ? '<img class="album-message__art" src="' + attr(bannerUrl) + '" alt="">'
      : '<img class="album-message__art album-message__art--logo" src="/assets/icons/logo.svg" alt="">';
    var html = '';
    if (kind === 'not_found') {
      html = artLogo() +
        '<p class="album-message__title">Không tìm thấy ảnh</p>' +
        '<p class="album-message__text">Link này không đúng hoặc không tồn tại. Hãy kiểm tra lại mã trên ảnh in của bạn.</p>' +
        '<a href="/" class="btn">Về trang chủ</a>';
    } else if (kind === 'expired') {
      html = art +
        '<p class="album-message__title">Link đã hết hạn</p>' +
        '<p class="album-message__text">' + (event && event.name ? esc(event.name) + ': ' : '') +
        'link xem ảnh chỉ có hiệu lực trong 15 ngày. Cần lấy lại ảnh? Gọi hotline ' + HOTLINE + '.</p>';
    } else if (kind === 'error') {
      html = '<div class="album-spinner" aria-hidden="true"></div>' +
        '<p class="album-message__title">Đang kết nối…</p>' +
        '<p class="album-message__text">Chưa tải được album. Trang sẽ tự thử lại.</p>';
    } else if (kind === 'empty') {
      html = art +
        '<p class="album-message__title">Ảnh đang được tải lên</p>' +
        '<p class="album-message__text">Ảnh của bạn đang được tải lên, trang sẽ tự cập nhật. Bạn có thể giữ trang này mở.</p>' +
        '<div class="album-spinner" aria-hidden="true"></div>';
    } else if (kind === 'loading') {
      html = '<div class="album-skeleton" aria-hidden="true"></div>';
    }
    els.message.innerHTML = html;
    els.message.hidden = html === '';
  }

  function artLogo() {
    return '<img class="album-message__art album-message__art--logo" src="/assets/icons/logo.svg" alt="">';
  }

  function renderStage() {
    var album = view.album;
    var files = album && album.files;
    var showing = (view.kind === 'partial' || view.kind === 'complete') && files && files.length;
    els.download.disabled = true;
    if (!showing) {
      stopVideo();
      return;
    }
    var file = files[index];
    var kind = core.fileKind(file);
    var pending = els.photo.querySelector('.album-pending');
    els.counter.textContent = (index + 1) + '/' + files.length;
    if (file.status === 'uploaded') {
      if (pending) pending.remove();
      if (kind === 'video') {
        showVideo(file);
      } else {
        stopVideo();
        showStill(file, kind);
      }
      preloadAround(files);
      var label = ((album.event && album.event.name) || 'Album') + ' – ' + ALT_NOUN[kind] + ' ' + (index + 1);
      els.image.alt = label;
      els.video.setAttribute('aria-label', label);
      els.download.disabled = false;
    } else {
      stopVideo();
      hideImage();
      if (!pending) {
        pending = document.createElement('div');
        pending.className = 'album-pending';
        pending.innerHTML = '<div class="album-spinner" aria-hidden="true"></div><span></span>';
        els.photo.insertBefore(pending, els.counter);
      }
      pending.querySelector('span').textContent = kind === 'video'
        ? 'Video này đang được tải lên…'
        : 'Ảnh này đang được tải lên…';
    }
  }

  function hideImage() {
    els.image.hidden = true;
    els.image.removeAttribute('src');
    els.image.classList.remove('is-fading');
    wantedSrc = '';
  }

  // A photo, or a GIF: its first frame at once, then the animation once loaded.
  function showStill(file, kind) {
    els.image.hidden = false;
    var preview = url(file.preview_url);
    var media = kind === 'gif' ? url(file.media_url) : '';
    // A poll re-renders the same file: leave it, even once the GIF has taken over.
    if (wantedSrc === preview || (media && wantedSrc === media)) return;
    showImage(preview);
    if (!media) return;
    var loader = new Image();
    loader.onload = function () {
      if (wantedSrc !== preview) return; // the guest has moved on
      wantedSrc = media;
      els.image.src = media;
      els.image.classList.remove('is-fading');
    };
    loader.src = media;
  }

  // The clip waits on its first frame for a tap: phones only play sound after one.
  function showVideo(file) {
    hideImage();
    els.video.hidden = false;
    var media = url(file.media_url);
    // Polling re-renders every few seconds; a clip being watched must not restart.
    if (els.video.dataset.src === media) return;
    els.video.dataset.src = media;
    els.video.poster = url(file.preview_url);
    if (file.width && file.height) {
      els.video.width = file.width;
      els.video.height = file.height;
    }
    els.videoError.hidden = true;
    // Native controls join once it plays, so the poster shows one ▶, not two.
    els.video.controls = false;
    els.play.hidden = false;
    if (media) els.video.src = media;
    else onVideoError();
  }

  function stopVideo() {
    if (els.video.dataset.src !== undefined) {
      delete els.video.dataset.src;
      els.video.pause();
      // Dropping the source also stops the rest of the download.
      els.video.removeAttribute('src');
      els.video.removeAttribute('poster');
      els.video.load();
    }
    els.video.hidden = true;
    els.play.hidden = true;
    els.videoError.hidden = true;
  }

  function onVideoPlay() {
    els.play.hidden = true;
    els.video.controls = true;
  }

  function onPlay() {
    // After a dropped connection the element is in error: fetch the clip again.
    if (els.video.error) els.video.load();
    var started = els.video.play();
    if (started && started.catch) {
      started.catch(function (err) {
        if (err && err.name === 'AbortError') return; // the guest moved on
        // Some in-app browsers refuse even after a tap: hand over the native controls.
        els.play.hidden = true;
        els.video.controls = true;
      });
    }
  }

  function onVideoError() {
    if (els.video.dataset.src === undefined) return; // from stopVideo emptying it
    var error = els.video.error;
    if (core.videoErrorRetryable(error && error.code)) {
      els.play.hidden = false;
      return;
    }
    els.play.hidden = true;
    els.videoError.hidden = false;
  }

  function renderThumbs(album, kind) {
    var files = album && album.files;
    if (!files || kind === 'expired' || kind === 'not_found') {
      els.thumbs.innerHTML = '';
      thumbsKey = '';
      return;
    }
    var key = files.map(function (f) { return f.name + ':' + (f.preview_url || f.status); }).join('|');
    if (key !== thumbsKey) {
      var scroll = els.thumbs.scrollLeft;
      els.thumbs.innerHTML = files.map(function (f, i) {
        var kind = core.fileKind(f);
        var label = THUMB_NOUN[kind] + ' ' + (i + 1) + (f.status === 'uploaded' ? '' : ' (đang tải lên)');
        var inner = f.status === 'uploaded'
          ? '<img src="' + attr(url(f.preview_url)) + '" alt="" loading="lazy" decoding="async">'
          : '<span>Đang tải</span>';
        var badge = BADGES[kind] ? '<span class="album-thumb__badge" aria-hidden="true">' + BADGES[kind] + '</span>' : '';
        return '<li><button type="button" class="album-thumb' + (f.status === 'uploaded' ? '' : ' album-thumb--pending') +
          '" data-index="' + i + '" aria-label="' + label + '">' + inner + badge + '</button></li>';
      }).join('');
      els.thumbs.scrollLeft = scroll;
      thumbsKey = key;
    }
    var buttons = els.thumbs.querySelectorAll('.album-thumb');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-current', i === index ? 'true' : 'false');
    }
    if (followThumb) {
      keepThumbInView(buttons[index]);
      followThumb = false;
    }
  }

  function keepThumbInView(button) {
    if (!button) return;
    var strip = els.thumbs;
    var left = button.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + button.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left - (strip.clientWidth - button.offsetWidth) / 2;
    }
  }

  function renderProgress(album, kind) {
    if (!album || !album.files || kind === 'expired') {
      els.progress.textContent = '';
      return;
    }
    var noun = core.albumNoun(album.files);
    if (album.uploaded < album.total) {
      var dot = document.createElement('span');
      dot.className = 'album-progress__dot';
      dot.setAttribute('aria-hidden', 'true');
      els.progress.textContent = '';
      els.progress.appendChild(dot);
      els.progress.appendChild(document.createTextNode(
        album.uploaded + '/' + album.total + ' ' + noun + ' đã sẵn sàng · trang tự cập nhật'
      ));
    } else {
      els.progress.textContent = album.total + ' ' + noun + ' · chạm vào ảnh nhỏ để xem';
    }
  }

  function renderNotice() {
    var text = '';
    if (view.throttled && view.kind !== 'error') {
      text = 'Nhiều người đang xem cùng lúc, trang sẽ cập nhật chậm hơn một chút…';
    } else if (view.offline && view.kind !== 'error') {
      text = 'Mất kết nối mạng, đang thử lại…';
    } else if (view.stale) {
      text = 'Một số ảnh chưa được tải lên. Vui lòng liên hệ hotline ' + HOTLINE + ' để được hỗ trợ.';
    }
    els.notice.innerHTML = text;
    els.notice.hidden = text === '';
  }

  function renderEvent(album, kind) {
    var event = album && album.event;
    if (!event || kind === 'not_found') return;
    els.eventName.textContent = event.name || '';
    els.eventDesc.textContent = event.description || '';
    els.eventDesc.hidden = !event.description;
    var bannerUrl = url(event.banner_url);
    if (bannerUrl) {
      els.banner.src = bannerUrl;
      els.banner.hidden = false;
    } else {
      els.banner.hidden = true;
    }
    els.event.classList.toggle('album-event--no-banner', !bannerUrl);
    els.expiry.textContent = kind === 'expired'
      ? 'Link xem ảnh đã hết hạn.'
      : album.expires_at ? 'Ảnh được lưu để xem đến ' + core.formatDate(album.expires_at) + '.' : '';
  }

  function onThumbClick(e) {
    var button = e.target.closest('.album-thumb');
    if (!button) return;
    index = Number(button.getAttribute('data-index'));
    userPicked = true;
    followThumb = true;
    render();
  }

  /* ---------- Viewer ---------- */

  function viewing() {
    return view && (view.kind === 'partial' || view.kind === 'complete') && view.album.files.length;
  }

  function go(delta) {
    if (!viewing()) return;
    index = core.wrapIndex(index + delta, view.album.files.length);
    userPicked = true;
    followThumb = true;
    render();
  }

  function showImage(url) {
    wantedSrc = url;
    if (reduceMotion || !els.image.getAttribute('src')) {
      els.image.src = url;
      return;
    }
    els.image.classList.add('is-fading');
    var swap = function () {
      // Quick taps queue several swaps; only the latest photo may land.
      if (wantedSrc !== url) return;
      els.image.src = url;
      els.image.classList.remove('is-fading');
    };
    // Swap once the next photo is decoded, so the fade never shows a blank frame.
    var next = new Image();
    next.onload = next.onerror = function () { setTimeout(swap, 120); };
    next.src = url;
  }

  function preloadAround(files) {
    [-1, 1].forEach(function (delta) {
      var f = files[core.wrapIndex(index + delta, files.length)];
      var preview = f && url(f.preview_url);
      if (preview) new Image().src = preview;
    });
  }

  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.activeElement === els.video) return; // arrows seek the clip
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  }

  function onTouchStart(e) {
    var one = e.touches.length === 1 ? e.touches[0] : null;
    // Once a clip has started, a drag on it is the guest scrubbing its timeline.
    var v = els.video;
    if (one && e.target === v && (!v.paused || v.currentTime > 0)) one = null;
    touchX = one ? one.clientX : null;
    touchY = one ? one.clientY : null;
  }

  function onTouchEnd(e) {
    if (touchX === null) return;
    var t = e.changedTouches[0];
    var scale = window.visualViewport ? window.visualViewport.scale : 1;
    var direction = core.swipeDirection(t.clientX - touchX, t.clientY - touchY, scale);
    touchX = touchY = null;
    if (direction) go(direction);
  }

  function onDownload() {
    if (core.isExpired(view && view.album, Date.now())) {
      refresh();
      return;
    }
    var file = viewing() && view.album.files[index];
    // download_url carries ?download=1: the API answers with
    // Content-Disposition: attachment (the download attribute is ignored
    // cross-origin, notably on iOS), so this saves without leaving the page.
    var download = file && url(file.download_url);
    if (download) window.location.href = download;
  }

  function onShare() {
    var url = window.location.origin + '/' + code;
    var title = (view && view.album && view.album.event && view.album.event.name) || 'Ảnh Happy Booth';
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { toast('Đã copy link'); },
        function () { toast(url); }
      );
    } else {
      toast(url);
    }
  }

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('is-visible'); }, 2400);
  }

  /* ---------- Helpers ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function attr(s) {
    return esc(s);
  }

  function url(u) {
    return core.apiUrl(u, api);
  }

  init();
})();
