/* ============================================================
   ALL MEN SALON — shared chrome + language + auth UI
   Pages set <body data-page="…"> and may define window.PageInit()
   which runs after the header/footer render and auth resolves once.
   ============================================================ */

/* --- tiny helpers --- */
window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Returns HTML — the official riyal symbol as a masked <span class="sar"> */
window.fmtPrice = (n) => n + ' <span class="sar" role="img" aria-label="' + (window.LANG === 'ar' ? 'ريال سعودي' : 'Saudi riyal') + '"></span>';
window.fmtWhen = (dateIso, time) => {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return t('days.long')[dt.getDay()] + ' ' + d + ' ' + t('months.short')[m - 1] + ' · ' + time;
};
window.serviceById = (id) => window.SERVICES.find((s) => s.id === id);
window.barberById = (id) => window.BARBERS.find((b) => b.id === id);

/* --- header / footer --- */
function chromeHeader() {
  return `
  <div class="site-header__bar">
    <a href="index.html" class="brand"><span class="dot"></span><span data-i18n="brand">${esc(t('brand'))}</span></a>
    <nav class="nav" aria-label="Primary">
      <a href="index.html"    data-nav="home"     data-i18n="nav.home">${esc(t('nav.home'))}</a>
      <a href="services.html" data-nav="services" data-i18n="nav.services">${esc(t('nav.services'))}</a>
      <a href="location.html" data-nav="location" data-i18n="nav.location">${esc(t('nav.location'))}</a>
      <a href="hours.html"    data-nav="hours"    data-i18n="nav.hours">${esc(t('nav.hours'))}</a>
    </nav>
    <div class="header-actions">
      <a class="auth-chip" id="auth-chip" href="signin.html" data-i18n="nav.signin">${esc(t('nav.signin'))}</a>
      <button class="lang-toggle" id="lang-toggle" type="button">${window.LANG === 'en' ? 'عربي' : 'EN'}</button>
      <a href="reserve.html" class="btn btn--light btn--sm"><span data-i18n="nav.book">${esc(t('nav.book'))}</span><span class="arr arr--ext">↗</span></a>
    </div>
  </div>`;
}

/* Standalone admin header — no customer nav, no book button, no auth chip.
   The admin area is a page on its own, reached directly at admin.html. */
function chromeHeaderAdmin() {
  return `
  <div class="site-header__bar">
    <span class="brand"><span class="dot"></span><span data-i18n="brand">${esc(t('brand'))}</span></span>
    <div class="header-actions">
      <button class="lang-toggle" id="lang-toggle" type="button">${window.LANG === 'en' ? 'عربي' : 'EN'}</button>
    </div>
  </div>`;
}

function chromeFooter() {
  return `
  <div class="shell">
    <div class="footer__grid">
      <div>
        <div class="footer__brand" data-i18n="brand">${esc(t('brand'))}</div>
        <p data-i18n="footer.tag">${esc(t('footer.tag'))}</p>
      </div>
      <div class="footer__col">
        <h4 data-i18n="footer.visit">${esc(t('footer.visit'))}</h4>
        <a href="location.html" data-i18n="nav.location">${esc(t('nav.location'))}</a>
        <a href="hours.html" data-i18n="nav.hours">${esc(t('nav.hours'))}</a>
      </div>
      <div class="footer__col">
        <h4 data-i18n="footer.book">${esc(t('footer.book'))}</h4>
        <a href="services.html" data-i18n="nav.services">${esc(t('nav.services'))}</a>
        <a href="reserve.html" data-i18n="nav.book">${esc(t('nav.book'))}</a>
        <a href="account.html" data-i18n="nav.account">${esc(t('nav.account'))}</a>
      </div>
      <div class="footer__col">
        <h4 data-i18n="footer.talk">${esc(t('footer.talk'))}</h4>
        <span dir="ltr">${esc(window.LOCATION.phone)}</span>
        <span dir="ltr">${esc(window.LOCATION.instagram)}</span>
      </div>
    </div>
    <div class="footer__legal">
      <span data-i18n="footer.legal">${esc(t('footer.legal'))}</span>
      <span data-i18n="footer.craft">${esc(t('footer.craft'))}</span>
    </div>
  </div>`;
}

/* --- language --- */
function applyLanguage() {
  document.documentElement.lang = window.LANG;
  document.documentElement.dir = window.LANG === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = window.LANG === 'en' ? 'عربي' : 'EN';
  updateAuthChip();
  if (typeof window.onLanguageChange === 'function') window.onLanguageChange();
}

function setLanguage(lang) {
  window.LANG = lang;
  localStorage.setItem('bb_lang', lang);
  document.body.style.opacity = '0';
  setTimeout(() => { applyLanguage(); document.body.style.transition = 'opacity .35s'; document.body.style.opacity = '1'; }, 120);
}

/* --- auth chip --- */
function updateAuthChip() {
  const chip = document.getElementById('auth-chip');
  if (!chip) return;
  const u = window.Store && window.Store.currentUser;
  /* admins are never shown in the customer header — only real customers are */
  if (u && !u.isAdmin) {
    chip.textContent = u.name.split(' ')[0];
    chip.href = 'account.html';
    chip.removeAttribute('data-i18n');
  } else {
    chip.textContent = t('nav.signin');
    chip.setAttribute('data-i18n', 'nav.signin');
    chip.href = 'signin.html';
  }
}

/* --- boot --- */
document.addEventListener('DOMContentLoaded', () => {
  const isAdminPage = document.body.dataset.page === 'admin';
  const header = document.querySelector('.site-header');
  if (header) header.innerHTML = isAdminPage ? chromeHeaderAdmin() : chromeHeader();
  const footer = document.querySelector('.footer');
  if (footer) footer.innerHTML = chromeFooter();

  /* active nav */
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.nav === page) a.setAttribute('data-active', 'true');
  });

  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    setLanguage(window.LANG === 'en' ? 'ar' : 'en');
  });

  applyLanguage();

  Store.init();
  let booted = false;
  Store.onAuth(() => {
    updateAuthChip();
    if (!booted) {
      booted = true;
      if (typeof window.PageInit === 'function') window.PageInit();
    }
  });
});
