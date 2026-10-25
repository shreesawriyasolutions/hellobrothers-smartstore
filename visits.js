// ==========================================================
//  HELLO BROTHERS SMART STORE - ANONYMOUS VISIT COUNTER
//  Privacy-friendly: koi cookie nahi, IP/naam/number save nahi hota,
//  koi personal data nahi. Sirf: kaun sa page, kahan se aaya,
//  mobile/desktop, aur ek random tab-id (tab band hote hi khatam).
// ==========================================================
(function () {
  try {
    var SUPABASE_URL = (window.APP_CONFIG || {}).SUPABASE_URL;
    var SUPABASE_KEY = (window.APP_CONFIG || {}).SUPABASE_KEY;

    // "Do Not Track" ka samman, aur local testing / bots ko ginti se bahar rakho
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return;
    if (/bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(navigator.userAgent)) return;

    // Agar isi browser me owner/staff login hai to unki apni visit na ginein
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (k.indexOf('sb-') === 0 && k.slice(-11) === '-auth-token') return;
      }
    } catch (e) {}

    // Random tab-id (sirf is tab ke liye, tab band = khatam)
    var sid = null;
    try {
      sid = sessionStorage.getItem('v_sid');
      if (!sid) {
        sid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        sessionStorage.setItem('v_sid', sid);
      }
    } catch (e) { sid = Math.random().toString(36).slice(2, 12); }

    var ref = '';
    try {
      if (document.referrer) {
        var h = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (h && h !== location.hostname.replace(/^www\./, '')) ref = h;
      }
    } catch (e) {}

    var w = window.innerWidth || screen.width || 1024;
    var device = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile'
      : (/iPad|Tablet/i.test(navigator.userAgent) || (w >= 600 && w < 1000 && 'ontouchstart' in window) ? 'tablet' : 'desktop');

    var path = (location.pathname || '/').slice(0, 120);

    fetch(SUPABASE_URL + '/rest/v1/site_visits', {
      method: 'POST',
      keepalive: true,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        path: path,
        referrer: ref ? ref.slice(0, 120) : null,
        device: device,
        lang: (navigator.language || '').slice(0, 12) || null,
        sid: sid
      })
    }).catch(function () {});
  } catch (e) { /* ginti fail ho to website par koi asar nahi */ }
})();
