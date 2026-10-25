/* ==========================================================
   DIWALI 2026 — TEMPORARY FESTIVE THEME
   Diwali (Lakshmi Puja): Sunday, 8 November 2026
   Active from now until the end of 10 November 2026 (IST).
   After that it switches itself OFF automatically — nothing is
   loaded, nothing is shown (the date check below decides).

   To remove it completely later: delete diwali.js + diwali.css and
   the <script src="diwali.js"> line from the public pages.
   ========================================================== */
(function () {
  // 11 Nov 2026, 00:00 IST  ==  10 Nov 2026, 18:30 UTC
  var END = Date.UTC(2026, 10, 10, 18, 30, 0);
  if (Date.now() >= END) return;

  var doc = document, root = doc.documentElement;

  // Styles are loaded only while the theme is active
  var css = doc.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'diwali.css';
  doc.head.appendChild(css);

  function start() {
    var body = doc.body;
    if (!body) return;
    root.classList.add('diwali');

    var diya = '<svg class="dw-diya" viewBox="0 0 32 30" width="28" height="26" aria-hidden="true">' +
      '<path d="M2 15c0 7.5 6 13 14 13s14-5.500 14-13z" fill="#C2410C"/>' +
      '<path d="M2 15h28c-2 2.300-6.500 3.500-14 3.500S4 17.300 2 15z" fill="#F59E0B"/>' +
      '<path class="dw-flame" d="M16 1.500c3.600 3.300 4.800 6.800 0 11.500-4.800-4.700-3.600-8.200 0-11.500z" fill="#FFD54A"/>' +
      '<path class="dw-flame" d="M16 6c1.600 1.600 2.100 3.200 0 5.300-2.100-2.100-1.600-3.700 0-5.300z" fill="#FF7A1A"/></svg>';

    var MSG = {
      en: 'Happy Diwali from Hello Brothers Smart Store',
      hi: 'हैलो ब्रदर्स स्मार्ट स्टोर की ओर से दीपावली की हार्दिक शुभकामनाएँ',
      pa: 'ਹੈਲੋ ਬ੍ਰਦਰਜ਼ ਸਮਾਰਟ ਸਟੋਰ ਵੱਲੋਂ ਦੀਵਾਲੀ ਦੀਆਂ ਲੱਖ-ਲੱਖ ਵਧਾਈਆਂ'
    };
    function lang() {
      try { var l = localStorage.getItem('preferredLang'); return MSG[l] ? l : 'en'; } catch (e) { return 'en'; }
    }

    var dismissed = false;
    try { dismissed = sessionStorage.getItem('dw_closed') === '1'; } catch (e) {}

    var strip = null;
    if (!dismissed) {
      strip = doc.createElement('div');
      strip.className = 'dw-strip';
      strip.setAttribute('role', 'note');
      strip.innerHTML = diya + '<span class="dw-msg"></span>' + diya +
        '<button type="button" class="dw-x" aria-label="Close">&times;</button>' +
        '<i class="dw-lights"></i><i class="dw-lights b"></i>';
      body.insertBefore(strip, body.firstChild);

      var msg = strip.querySelector('.dw-msg');
      var fit = function () {
        root.style.setProperty('--dw-h', strip.offsetHeight + 'px');
      };
      var paint = function () { msg.textContent = MSG[lang()]; fit(); };
      paint();
      window.addEventListener('resize', fit);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
      // language buttons on the page change the greeting too
      doc.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.lang-btn,.lb')) setTimeout(paint, 80);
      });
      strip.querySelector('.dw-x').addEventListener('click', function () {
        try { sessionStorage.setItem('dw_closed', '1'); } catch (e) {}
        strip.remove();
        root.style.setProperty('--dw-h', '0px');
      });
    }

    // floating golden sparkles (decoration only, sits behind the page content)
    var fx = doc.createElement('div');
    fx.className = 'dw-fx';
    fx.setAttribute('aria-hidden', 'true');
    var n = window.innerWidth < 700 ? 12 : 22, html = '';
    for (var i = 0; i < n; i++) {
      var s = 3 + Math.random() * 6;
      html += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) +
        'px;--sx:' + ((Math.random() * 60 - 30) | 0) + 'px;animation-duration:' + (11 + Math.random() * 14).toFixed(1) +
        's;animation-delay:-' + (Math.random() * 25).toFixed(1) + 's"></i>';
    }
    fx.innerHTML = html;
    body.appendChild(fx);

    startFireworks(body);
  }

  // ---------- background crackers: rockets, anar (fountains) and "bum" bombs ----------
  function startFireworks(body) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cv = doc.createElement('canvas');
    cv.className = 'dw-fw';
    cv.setAttribute('aria-hidden', 'true');
    body.appendChild(cv);
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var W = 0, H = 0, dpr = 1;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    var small = window.innerWidth < 700;
    var COLORS = ['#FFB300', '#FF7A1A', '#FF4D3D', '#E6399B', '#8E44E0', '#19B58A', '#2D8CF0', '#F5D000'];
    var MAXP = small ? 260 : 480;
    var parts = [], rockets = [], flashes = [], rings = [];
    var R = function (a, b) { return a + Math.random() * (b - a); };
    var pick = function () { return COLORS[(Math.random() * COLORS.length) | 0]; };

    function spark(x, y, vx, vy, color, life, g, drag, w) {
      if (parts.length >= MAXP) return;
      parts.push({ x: x, y: y, vx: vx, vy: vy, c: color, life: life, max: life, g: g, d: drag, w: w || 1.6 });
    }

    function explode(x, y) {
      var kind = Math.random(), c1 = pick(), c2 = pick(), i, a, s;
      var k = Math.min(1.25, Math.max(0.7, H / 800));
      var n = small ? 34 : 54;
      flashes.push({ x: x, y: y, r: 70 * k, life: 0.3, max: 0.3, c: '255,200,90' });
      if (kind < 0.4) {                       // round burst
        for (i = 0; i < n; i++) { a = R(0, 6.283); s = R(40, 190) * k; spark(x, y, Math.cos(a) * s, Math.sin(a) * s, i % 3 ? c1 : c2, R(1.0, 1.7), 95, 0.982); }
      } else if (kind < 0.7) {                // ring
        for (i = 0; i < n; i++) { a = i / n * 6.283; s = 170 * k; spark(x, y, Math.cos(a) * s, Math.sin(a) * s, c1, 1.4, 60, 0.975); }
      } else {                                // golden willow
        for (i = 0; i < n; i++) { a = R(0, 6.283); s = R(50, 150) * k; spark(x, y, Math.cos(a) * s, Math.sin(a) * s, '#F0A500', R(2.0, 3.0), 120, 0.985, 1.4); }
      }
    }

    function bomb() {                         // ground "bum": flash + shock ring + short fast sparks
      var x = R(0.08, 0.92) * W, y = H - R(8, 50), i, a, s;
      flashes.push({ x: x, y: y, r: 130, life: 0.38, max: 0.38, c: '255,170,60' });
      rings.push({ x: x, y: y, r: 6, max: 110, life: 0.45, t: 0.45 });
      for (i = 0; i < 18; i++) { a = R(-3.0, -0.14); s = R(180, 340); spark(x, y, Math.cos(a) * s, Math.sin(a) * s, i % 2 ? '#FFD54A' : '#FF6A2A', R(0.4, 0.8), 520, 0.97, 1.8); }
    }

    var fountains = [{ x: 0.05, left: 0 }, { x: 0.95, left: 0 }], nextAnar = 1.5;
    var tRocket = 0.4, tBomb = 2.5, clock = 0, last = 0;

    function launch() {
      var x = R(0.1, 0.9) * W, ty = R(0.14, 0.5) * H, a = 240;
      rockets.push({ x: x, y: H + 4, vx: R(-14, 14), vy: -Math.sqrt(2 * a * (H - ty)), a: a, c: pick() });
    }

    // Safety for weak phones: if the page runs below ~12 fps, switch the crackers off
    var warm = 2.5, fT = 0, fN = 0, stopped = false;
    function stop() { stopped = true; window.removeEventListener('resize', size); cv.remove(); }

    function frame(now) {
      if (stopped) return;
      requestAnimationFrame(frame);
      var raw = (now - last) / 1000 || 0.016;
      var dt = Math.min(0.05, raw); last = now;
      if (doc.hidden) return;
      if (raw < 1) {
        if (warm > 0) warm -= raw;
        else {
          fT += raw; fN++;
          if (fT >= 3) { if (fN / fT < 12) { stop(); return; } fT = 0; fN = 0; }
        }
      }
      clock += dt;

      tRocket -= dt; if (tRocket <= 0) { launch(); tRocket = small ? R(1.6, 3.2) : R(1.0, 2.3); }
      tBomb -= dt;   if (tBomb <= 0)   { bomb();   tBomb = R(3.5, 7); }
      nextAnar -= dt;
      if (nextAnar <= 0) { fountains[(Math.random() * 2) | 0].left = 3.2; nextAnar = R(7, 12); }

      var i, p, r, f;
      for (i = 0; i < fountains.length; i++) {
        f = fountains[i];
        if (f.left > 0) {
          f.left -= dt;
          for (var j = 0, m = (small ? 70 : 120) * dt; j < m + Math.random(); j++) {
            var a = -1.5708 + R(-0.24, 0.24), s = R(260, 420);
            spark(f.x * W, H, Math.cos(a) * s, Math.sin(a) * s, Math.random() < 0.6 ? '#FFC21A' : '#FF8A2A', R(0.8, 1.3), 520, 0.985, 1.5);
          }
        }
      }

      for (i = rockets.length - 1; i >= 0; i--) {
        r = rockets[i];
        r.vy += r.a * dt; r.x += r.vx * dt; r.y += r.vy * dt;
        spark(r.x, r.y + 6, R(-12, 12), R(10, 40), '#FFB300', R(0.3, 0.6), 60, 0.96, 1.2);
        if (r.vy > -35) { explode(r.x, r.y); rockets.splice(i, 1); }
      }

      ctx.clearRect(0, 0, W, H);

      for (i = flashes.length - 1; i >= 0; i--) {
        f = flashes[i]; f.life -= dt;
        if (f.life <= 0) { flashes.splice(i, 1); continue; }
        var q = f.life / f.max, rad = f.r * (1.4 - q * 0.6);
        var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
        g.addColorStop(0, 'rgba(' + f.c + ',' + (0.55 * q).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + f.c + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, rad, 0, 6.283); ctx.fill();
      }
      for (i = rings.length - 1; i >= 0; i--) {
        r = rings[i]; r.life -= dt;
        if (r.life <= 0) { rings.splice(i, 1); continue; }
        var u = 1 - r.life / r.t;
        ctx.strokeStyle = 'rgba(255,150,40,' + (0.7 * (1 - u)).toFixed(3) + ')';
        ctx.lineWidth = 3 * (1 - u) + 0.5;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.max * u + 6, 0, 6.283); ctx.stroke();
      }

      ctx.lineCap = 'round';
      for (i = parts.length - 1; i >= 0; i--) {
        p = parts[i]; p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        var dr = Math.pow(p.d, dt * 60);
        p.vx *= dr; p.vy = p.vy * dr + p.g * dt;
        var px = p.x, py = p.y;
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.min(1, p.life / p.max * 1.4);
        ctx.strokeStyle = p.c; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.moveTo(px - p.vx * 0.012, py - p.vy * 0.012); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (i = 0; i < rockets.length; i++) {
        r = rockets[i];
        ctx.fillStyle = '#FFF3C4'; ctx.beginPath(); ctx.arc(r.x, r.y, 2.2, 0, 6.283); ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }

  if (doc.body) start();
  else doc.addEventListener('DOMContentLoaded', start);
})();
