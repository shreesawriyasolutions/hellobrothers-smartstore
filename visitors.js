// Website Visitors - sirf Admin ke liye
const SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.APP_CONFIG.SUPABASE_KEY;
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
let toastTimer = null;
function toast(msg, type) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type === 'err' ? 'err' : 'ok');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 4000);
}
function fmtDT(s) {
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

$('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  $('loginBtn').disabled = true;
  const { data, error } = await db.auth.signInWithPassword({
    email: $('loginEmail').value.trim(), password: $('loginPassword').value
  });
  $('loginBtn').disabled = false;
  if (error) { toast('Login failed.', 'err'); return; }
  const ok = await checkAdmin(data.user.id);
  if (!ok) { await db.auth.signOut(); toast("Sirf Admin ye page dekh sakta hai.", 'err'); return; }
  $('loginPassword').value = '';
  showApp();
});

$('logoutBtn').addEventListener('click', async function () {
  await db.auth.signOut();
  $('appView').classList.add('hidden');
  $('loginView').classList.remove('hidden');
});
$('refreshBtn').addEventListener('click', load);

async function checkAdmin(uid) {
  const { data, error } = await db.from('profiles').select('role').eq('id', uid).maybeSingle();
  return !error && data && data.role === 'admin';
}

function showApp() {
  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  load();
}

function lines(arr, key, label) {
  if (!arr || !arr.length) return '<div class="muted">Abhi koi data nahi.</div>';
  return arr.map(function (x) {
    return '<div class="rowline"><span>' + esc(label(x)) + '</span><b>' + esc(x.views) + '</b></div>';
  }).join('');
}

async function load() {
  const { data, error } = await db.rpc('get_visit_stats');
  if (error || !data) { toast('Data load nahi hua.', 'err'); return; }

  function st(n, t) { return '<div class="stat"><div class="n">' + esc(n) + '</div><div class="t">' + esc(t) + '</div></div>'; }
  $('stats').innerHTML =
    st(data.today_visitors, 'Aaj ke visitors') +
    st(data.today_views, 'Aaj ke page views') +
    st(data.yday_views, 'Kal ke page views') +
    st(data.week_visitors, '7 din ke visitors') +
    st(data.week_views, '7 din ke page views') +
    st(data.month_visitors, '30 din ke visitors') +
    st(data.month_views, '30 din ke page views') +
    st(data.total_views, 'Kul page views');
  $('lastVisit').textContent = data.last_visit ? 'Aakhri visit: ' + fmtDT(data.last_visit) : 'Abhi tak koi visit nahi.';

  // Server din ko "2026-10-12 00:00:00+00" jaisa bhejta hai; sirf date (YYYY-MM-DD) rakho
  const daily = (data.daily || []).map(function (d) {
    return { day: String(d.day || '').slice(0, 10), views: d.views || 0, visitors: d.visitors || 0 };
  });
  const max = Math.max.apply(null, daily.map(function (d) { return d.views; }).concat([1]));
  $('bars').innerHTML = daily.map(function (d) {
    const h = Math.round((d.views / max) * 100);
    return '<div class="bar' + (d.views ? '' : ' zero') + '" style="height:' + Math.max(h, 2) + '%" title="' +
      esc(d.day) + ': ' + d.views + ' views, ' + d.visitors + ' visitors"></div>';
  }).join('');
  $('barLabels').innerHTML = daily.map(function (d) { return '<span>' + esc(d.views) + '<br>' + esc(d.day.slice(8)) + '</span>'; }).join('');

  $('pages').innerHTML = lines(data.pages, 'path', function (x) { return x.path; });
  $('refs').innerHTML = lines(data.referrers, 'ref', function (x) { return x.ref; });
  $('devs').innerHTML = lines(data.devices, 'device', function (x) {
    return x.device === 'mobile' ? 'Mobile' : x.device === 'desktop' ? 'Computer' : x.device === 'tablet' ? 'Tablet' : x.device;
  });
  $('recent').innerHTML = (data.recent && data.recent.length) ? data.recent.map(function (x) {
    return '<div class="rowline"><span>' + esc(x.path) + ' <span class="muted">(' + esc(x.device || '-') + ', ' + esc(x.ref) + ')</span></span><b>' + esc(fmtDT(x.at)) + '</b></div>';
  }).join('') : '<div class="muted">Abhi koi data nahi.</div>';
}

(async function init() {
  try {
    const { data } = await db.auth.getSession();
    if (data && data.session && await checkAdmin(data.session.user.id)) { showApp(); return; }
    if (data && data.session) await db.auth.signOut();
  } catch (e) {}
  $('loginView').classList.remove('hidden');
})();
