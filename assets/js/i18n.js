/* Happy Booth — Vietnamese HTML with optional client-side translations. */
(function () {
  var DEFAULT_LANG = 'vi';
  var STORAGE_KEY = 'hb-lang';
  var cache = {};
  var pending = {};
  var currentLang = DEFAULT_LANG;
  var languageRequest = 0;
  var resolveReady;
  var ready = new Promise(function (resolve) { resolveReady = resolve; });

  function storedLanguage() {
    try { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : DEFAULT_LANG; }
    catch (error) { return DEFAULT_LANG; }
  }

  async function loadTranslations(lang) {
    if (cache[lang]) return true;
    if (pending[lang]) return pending[lang];
    pending[lang] = (async function () {
      try {
        var script = document.querySelector('script[src*="i18n.js"]');
        var url = new URL('../lang/' + lang + '.json', script.src);
        var response = await fetch(url);
        if (!response.ok) throw new Error('Translation request failed');
        var strings = await response.json();
        if (!strings || typeof strings !== 'object' || Array.isArray(strings)) throw new Error('Invalid translations');
        cache[lang] = strings;
        return true;
      } catch (error) {
        console.warn('Happy Booth: translations unavailable for ' + lang);
        return false;
      } finally {
        delete pending[lang];
      }
    })();
    return pending[lang];
  }

  function apply(root) {
    var strings = cache[currentLang];
    if (!strings) return;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (strings[key] !== undefined) el.textContent = strings[key];
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (strings[key] !== undefined) el.innerHTML = strings[key];
    });
    [['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria-label', 'aria-label']].forEach(function (pair) {
      root.querySelectorAll('[' + pair[0] + ']').forEach(function (el) {
        var key = el.getAttribute(pair[0]);
        if (strings[key] !== undefined) el.setAttribute(pair[1], strings[key]);
      });
    });
  }

  function updateToggleUI() {
    document.querySelectorAll('.lang-toggle__btn').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-lang') === currentLang);
    });
  }

  async function setLanguage(lang, persist) {
    if (lang !== 'vi' && lang !== 'en') return;
    var request = ++languageRequest;
    if (!await loadTranslations(lang) || request !== languageRequest) return;
    currentLang = lang;
    apply(document);
    document.documentElement.lang = lang;
    var main = document.getElementById('page-content');
    var title = main && cache[lang]['meta.title.' + main.getAttribute('data-page')];
    if (title) document.title = title;
    updateToggleUI();
    if (persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (error) { /* The page works without storage. */ }
    }
  }

  function init() {
    document.querySelectorAll('.lang-toggle__btn').forEach(function (button) {
      button.addEventListener('click', function () { setLanguage(button.getAttribute('data-lang')); });
    });
    setLanguage(storedLanguage(), false).finally(function () {
      // Native Vietnamese stays visible even when translations cannot load.
      document.documentElement.classList.remove('i18n-loading');
      document.documentElement.classList.add('i18n-ready');
      updateToggleUI();
      resolveReady();
    });
  }

  window.i18n = {
    ready: ready,
    t: function (key) { return cache[currentLang] && cache[currentLang][key] !== undefined ? cache[currentLang][key] : null; },
    currentLang: function () { return currentLang; },
    apply: apply
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
