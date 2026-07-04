/* ============================================================
   ALL MEN SALON — single source for the script chain.

   Every page loads just <script src="js/boot.js" defer></script> instead
   of repeating the whole Firebase-SDK + module list in its <head>. Add or
   remove a shared dependency HERE, once — not in all 8 HTML files.

   Scripts are injected with async=false so they still execute in this exact
   order (SDK → config → data → i18n → store → app), same as parser-inserted
   deferred tags. app.js is resilient to running after DOMContentLoaded.
   ============================================================ */
(function () {
  var FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
  var srcs = [
    FB + 'firebase-app-compat.js',
    FB + 'firebase-auth-compat.js',
    FB + 'firebase-firestore-compat.js',
    FB + 'firebase-app-check-compat.js',
    'js/firebase-config.js',
    'js/data.js',
    'js/i18n.js',
    'js/store.js',
    'js/app.js',
  ];
  srcs.forEach(function (src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;   // preserve execution order for dynamically inserted scripts
    document.head.appendChild(s);
  });
})();
