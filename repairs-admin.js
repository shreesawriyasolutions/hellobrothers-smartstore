// ==========================================================
//  HELLO BROTHERS SMART STORE - REPAIR MANAGER (Admin + Staff)
// ==========================================================

const SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.APP_CONFIG.SUPABASE_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUSES = ['Received', 'Diagnosing', 'Repair in Progress', 'Waiting for Part', 'Ready for Pickup', 'Delivered', 'Returned'];
const TRACK_LINK = 'https://shreesawriyasolutions.github.io/hellobrothers-smartstore/track.html';

// ---------- Chhote helper functions ----------
function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtDate(s) {
  if (!s) return '-';
  const p = String(s).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
}

function fmtDateTime(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function money(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

let toastTimer = null;
function toast(msg, type) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type === 'err' ? 'err' : 'ok');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 4000);
}

function errorMessage(error) {
  const m = ((error && error.message) || '').toLowerCase();
  const code = error && error.code;
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to')) {
    return 'Unable to save data. Please check your internet connection.';
  }
  if (code === '42501' || m.includes('row-level security') || m.includes('permission') || m.includes('sirf status')) {
    return "You don't have permission to perform this action.";
  }
  return 'Something went wrong. Please try again.';
}

function statusClass(s) {
  switch (s) {
    case 'Received': return 'st-received';
    case 'Diagnosing': return 'st-diagnosing';
    case 'Repair in Progress': return 'st-progress';
    case 'Waiting for Part': return 'st-waiting';
    case 'Ready for Pickup': return 'st-ready';
    case 'Returned': return 'st-returned';
    default: return 'st-delivered';
  }
}

// ---------- State ----------
let profile = null;
let loginRole = 'staff';
let isAdmin = false;
let repairs = [];

// Dropdowns bharo
(function fillSelects() {
  $('rStatus').innerHTML = STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('');
  $('statusFilter').innerHTML =
    '<option value="active">Sab chalu (Delivered/Returned chhodke)</option>' +
    '<option value="all">Sab repairs</option>' +
    STATUSES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
})();

// ==========================================================
//  LOGIN / LOGOUT
// ==========================================================
$('tabStaff').addEventListener('click', function () { setLoginTab('staff'); });
$('tabAdmin').addEventListener('click', function () { setLoginTab('admin'); });

function setLoginTab(role) {
  loginRole = role;
  $('tabStaff').classList.toggle('active', role === 'staff');
  $('tabAdmin').classList.toggle('active', role === 'admin');
}

$('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  if (!email || !password) { toast('Please enter required information.', 'err'); return; }

  $('loginBtn').disabled = true;
  const { data, error } = await db.auth.signInWithPassword({ email: email, password: password });
  $('loginBtn').disabled = false;

  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('fetch') || m.includes('network')) {
      toast('Unable to save data. Please check your internet connection.', 'err');
    } else {
      toast('Login failed.', 'err');
    }
    return;
  }

  const ok = await loadProfile(data.user.id);
  if (!ok) {
    await db.auth.signOut();
    toast("You don't have permission to perform this action.", 'err');
    return;
  }
  if (loginRole === 'admin' && profile.role !== 'admin') {
    await db.auth.signOut();
    profile = null;
    toast("You don't have permission to perform this action.", 'err');
    return;
  }

  $('loginPassword').value = '';
  showApp();
});

$('logoutBtn').addEventListener('click', async function () {
  await db.auth.signOut();
  profile = null;
  repairs = [];
  $('appView').classList.add('hidden');
  $('loginView').classList.remove('hidden');
});

async function loadProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('role, can_view, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return false;
  profile = data;
  return true;
}

// ==========================================================
//  APP SHOW
// ==========================================================
function showApp() {
  isAdmin = profile.role === 'admin';

  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');

  const badge = $('modeBadge');
  if (isAdmin) {
    badge.textContent = 'ADMIN MODE';
    badge.className = 'badge admin';
  } else {
    badge.textContent = 'STAFF MODE';
    badge.className = 'badge staff';
  }

  $('todayText').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
  });

  $('rDate').value = todayStr();
  $('exportBtn').classList.toggle('hidden', !isAdmin);
  $('visitorsLink').classList.toggle('hidden', !isAdmin);

  loadRepairs();
}

// ==========================================================
//  MOBILE NUMBER PAR PURANA CUSTOMER DHUNDHNA
// ==========================================================
let hintToken = 0;
$('rMobile').addEventListener('input', async function () {
  const m = $('rMobile').value.replace(/\D/g, '');
  $('rMobile').value = m;
  const token = ++hintToken;

  $('rName').readOnly = false;
  $('rHint').textContent = '';
  $('rHint').className = 'hint';
  if (m.length !== 10) return;

  const { data: c, error } = await db.from('customers').select('id, name').eq('mobile', m).maybeSingle();
  if (token !== hintToken) return;
  if (error || !c) {
    $('rHint').textContent = 'Naya customer';
    return;
  }
  const { count } = await db.from('repairs').select('id', { count: 'exact', head: true }).eq('customer_id', c.id);
  if (token !== hintToken) return;
  $('rName').value = c.name;
  $('rName').readOnly = true;
  $('rHint').textContent = 'Purana customer: ' + c.name + ' (' + (count || 0) + ' repair pehle se). Ye naya phone unke saath judega.';
  $('rHint').className = 'hint ok';
});

// ==========================================================
//  NAAM LIKHTE HI PURANE CUSTOMER KI SUGGESTION
// ==========================================================
let nameToken = 0;
let nameTimer = null;
const CUST_RE = /\((\d{10})\)\s*$/;

function suggestCustomers(term) {
  clearTimeout(nameTimer);
  const clean = term.replace(/[%_\\,()]/g, ' ').trim();
  if (clean.length < 2 || CUST_RE.test(term) || /^\d+$/.test(clean) || /^hbs-?\d*$/i.test(clean)) {
    if (clean.length < 2) $('custList').innerHTML = '';
    return;
  }
  const token = ++nameToken;
  nameTimer = setTimeout(async function () {
    const { data, error } = await db.from('customers')
      .select('name, mobile')
      .ilike('name', '%' + clean + '%')
      .order('name', { ascending: true })
      .limit(8);
    if (token !== nameToken || error) return;
    $('custList').innerHTML = (data || []).map(function (c) {
      return '<option value="' + esc(c.name + ' (' + c.mobile + ')') + '"></option>';
    }).join('');
  }, 250);
}

// Add form: naam par suggestion, chunte hi mobile + naam bhar jaye
$('rName').addEventListener('input', function () {
  if ($('rName').readOnly) return;
  const v = $('rName').value;
  const m = v.match(CUST_RE);
  if (m) {
    $('rMobile').value = m[1];
    $('rMobile').dispatchEvent(new Event('input'));
    return;
  }
  suggestCustomers(v);
});

// Search box: naam par suggestion, chunte hi us customer ki history khul jaye
$('searchBox').addEventListener('input', function () {
  const v = $('searchBox').value;
  const m = v.match(CUST_RE);
  if (m) {
    $('searchBox').value = m[1];
    loadRepairs();
    return;
  }
  suggestCustomers(v);
});

// ==========================================================
//  NAYA REPAIR ADD
// ==========================================================
$('repairForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const mobile = $('rMobile').value.replace(/\D/g, '');
  const name = $('rName').value.trim();
  const model = $('rModel').value.trim();
  const date = $('rDate').value;
  const status = $('rStatus').value;
  const charge = $('rCharge').value;

  if (!mobile || !name || !model || !date) {
    toast('Please enter required information.', 'err');
    return;
  }
  if (!/^\d{10}$/.test(mobile)) {
    toast('Mobile number 10 digit ka hona chahiye.', 'err');
    return;
  }
  if (charge !== '' && Number(charge) < 0) {
    toast('Please enter required information.', 'err');
    return;
  }

  $('addBtn').disabled = true;
  try {
    const { data: cdata, error: cerr } = await db.rpc('add_customer_or_get', { p_mobile: mobile, p_name: name });
    if (cerr) throw cerr;
    const cust = Array.isArray(cdata) ? cdata[0] : cdata;
    if (!cust || !cust.out_customer_id) throw { message: 'customer error' };

    const { data: rep, error: rerr } = await db.from('repairs').insert({
      customer_id: cust.out_customer_id,
      device_model: model,
      problem: $('rProblem').value.trim() || null,
      status: status,
      received_date: date,
      estimated_charge: charge === '' ? null : Number(charge),
      estimated_delivery: $('rDelivery').value || null,
      public_note: $('rPublic').value.trim() || null,
      internal_note: $('rInternal').value.trim() || null
    }).select('repair_code').single();
    if (rerr) throw rerr;

    toast('Repair added. Repair ID: ' + rep.repair_code, 'ok');
    showAdded(rep.repair_code, cust.out_name || name, mobile, model);

    ['rMobile', 'rName', 'rModel', 'rProblem', 'rCharge', 'rDelivery', 'rPublic', 'rInternal'].forEach(function (id) { $(id).value = ''; });
    $('rName').readOnly = false;
    $('rHint').textContent = '';
    $('rStatus').value = 'Received';
    $('rDate').value = todayStr();

    loadRepairs();
  } catch (err) {
    toast(errorMessage(err), 'err');
  }
  $('addBtn').disabled = false;
});

function showAdded(code, name, mobile, model) {
  const msg = 'Namaste ' + name + ', aapka ' + model + ' Hello Brothers Smart Store me receive ho gaya hai.\n' +
    'Repair ID: ' + code + '\n' +
    'Status dekhne ke liye apna mobile number yahan daalein: ' + TRACK_LINK;
  const wa = 'https://wa.me/91' + mobile + '?text=' + encodeURIComponent(msg);
  const box = $('addedBox');
  box.innerHTML =
    '<div class="small">Repair add ho gaya. Repair ID:</div>' +
    '<div class="big">' + esc(code) + '</div>' +
    '<div class="small">' + esc(name) + ' &bull; ' + esc(mobile) + ' &bull; ' + esc(model) + '</div>' +
    '<a class="btn btn-green" target="_blank" rel="noopener" href="' + esc(wa) + '">Customer ko WhatsApp par bhejo</a>';
  box.classList.remove('hidden');
}

// ==========================================================
//  SEARCH + LIST
// ==========================================================
$('searchBtn').addEventListener('click', loadRepairs);
$('statusFilter').addEventListener('change', loadRepairs);
$('searchBox').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); loadRepairs(); }
});

async function loadRepairs() {
  const term = $('searchBox').value.trim();
  const sf = $('statusFilter').value;
  const digits = term.replace(/\s/g, '');
  const codeMatch = term.match(/^hbs-?(\d{1,6})$/i);

  let q = db.from('repairs')
    .select('*, customers(name, mobile)')
    .order('created_at', { ascending: false })
    .limit(300);

  let textSearch = false;
  let note = '';

  if (/^\d{10}$/.test(digits)) {
    const { data: c, error } = await db.from('customers').select('id').eq('mobile', digits).maybeSingle();
    if (error) { toast(errorMessage(error), 'err'); return; }
    if (!c) {
      repairs = [];
      $('summary').textContent = 'Is mobile number ka koi customer nahi mila.';
      renderList();
      return;
    }
    q = q.eq('customer_id', c.id);
    note = 'Is customer ki poori repair history';
  } else if (codeMatch) {
    q = q.eq('repair_code', 'HBS-' + codeMatch[1].padStart(4, '0'));
    note = 'Repair ID search';
  } else {
    if (sf === 'active') q = q.not('status', 'in', '(Delivered,Returned)');
    else if (sf !== 'all') q = q.eq('status', sf);
    textSearch = term !== '';
  }

  const { data, error } = await q;
  if (error) { toast(errorMessage(error), 'err'); return; }

  let list = data || [];
  if (textSearch) {
    const t = term.toLowerCase();
    list = list.filter(function (r) {
      const c = r.customers || {};
      return [c.name, c.mobile, r.device_model, r.problem, r.repair_code].join(' ').toLowerCase().indexOf(t) !== -1;
    });
  }
  repairs = list;
  $('summary').textContent = (note ? note + ': ' : '') + repairs.length + ' repair dikh rahe hain.';
  renderList();
}

function renderList() {
  if (repairs.length === 0) {
    $('repairList').innerHTML = '<div class="card empty">Koi repair nahi mila.</div>';
    return;
  }

  $('repairList').innerHTML = repairs.map(function (r) {
    const c = r.customers || {};
    let h = '<div class="entry">';
    h += '<div class="entry-head">';
    h += '<div class="entry-title"><span class="code">' + esc(r.repair_code) + '</span> &bull; ' + esc(r.device_model) + '</div>';
    h += '<span class="st ' + statusClass(r.status) + '">' + esc(r.status) + '</span>';
    h += '</div>';

    h += '<div class="rep-info">';
    h += '<div><span>Customer:</span> <b>' + esc(c.name) + '</b> &bull; <a href="tel:' + esc(c.mobile) + '">' + esc(c.mobile) + '</a></div>';
    if (r.problem) h += '<div><span>Problem:</span> ' + esc(r.problem) + '</div>';
    h += '<div><span>Received:</span> ' + esc(fmtDate(r.received_date)) + ' &bull; <span>Updated:</span> ' + esc(fmtDateTime(r.updated_at)) + '</div>';
    if (r.estimated_charge != null) h += '<div><span>Estimate:</span> <b>' + money(r.estimated_charge) + '</b></div>';
    if (r.estimated_delivery) h += '<div><span>Delivery:</span> ' + esc(fmtDate(r.estimated_delivery)) + '</div>';
    if (r.public_note) h += '<div><span>Customer note:</span> ' + esc(r.public_note) + '</div>';
    if (r.internal_note) h += '<div><span>Internal note:</span> ' + esc(r.internal_note) + '</div>';
    h += '</div>';

    // Status badalna (Staff aur Admin dono)
    h += '<div class="status-row">';
    h += '<select id="st-' + esc(r.id) + '">';
    STATUSES.forEach(function (s) {
      h += '<option' + (s === r.status ? ' selected' : '') + '>' + s + '</option>';
    });
    h += '</select>';
    h += '<button type="button" class="btn btn-green" data-act="status" data-id="' + esc(r.id) + '">Update Status</button>';
    h += '</div>';

    h += '<div class="rep-actions">';
    h += '<button type="button" class="btn btn-ghost" data-act="history" data-id="' + esc(r.id) + '">Timeline</button>';
    h += '<button type="button" class="btn btn-ghost" data-act="cust" data-mobile="' + esc(c.mobile) + '">Customer History</button>';
    h += '<button type="button" class="btn btn-ghost" data-act="print" data-id="' + esc(r.id) + '">Print Jobsheet</button>';
    h += '<button type="button" class="btn btn-ghost" data-act="wa" data-id="' + esc(r.id) + '">WhatsApp Jobsheet</button>';
    h += '<button type="button" class="btn btn-ghost" data-act="sms" data-id="' + esc(r.id) + '">SMS Jobsheet</button>';
    if (isAdmin) {
      h += '<button type="button" class="btn btn-edit" data-act="edit" data-id="' + esc(r.id) + '">EDIT</button>';
      h += '<button type="button" class="btn btn-del" data-act="delete" data-id="' + esc(r.id) + '">DELETE</button>';
    }
    h += '</div>';
    h += '<div id="hist-' + esc(r.id) + '" class="timeline hidden"></div>';
    h += '</div>';
    return h;
  }).join('');
}

$('repairList').addEventListener('click', function (e) {
  const act = e.target.getAttribute('data-act');
  if (!act) return;
  const id = e.target.getAttribute('data-id');
  if (act === 'status') updateStatus(id);
  if (act === 'history') toggleHistory(id);
  if (act === 'cust') {
    $('searchBox').value = e.target.getAttribute('data-mobile');
    loadRepairs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (act === 'print') printJobsheet(id);
  if (act === 'wa') sendJobsheet(id, 'wa');
  if (act === 'sms') sendJobsheet(id, 'sms');
  if (act === 'edit') openEdit(id);
  if (act === 'delete') deleteRepair(id);
});

// ==========================================================
//  JOBSHEET PRINT + SHARE
// ==========================================================
const SHOP = {
  name: 'HELLO BROTHERS SMART STORE',
  addr: 'M.G. Road, Opp. Shri Ram Studio, Safidon, Jind, Haryana',
  phone: '+91 94684 51460'
};

function jobsheetText(r, plain) {
  const c = r.customers || {};
  let t = '*' + SHOP.name + '*\n*JOBSHEET*\n\n' +
    'Repair ID: ' + r.repair_code + '\n' +
    'Date: ' + fmtDate(r.received_date) + '\n' +
    'Customer: ' + (c.name || '') + ' (' + (c.mobile || '') + ')\n' +
    'Phone: ' + r.device_model + '\n';
  if (r.problem) t += 'Problem: ' + r.problem + '\n';
  t += 'Status: ' + r.status + '\n';
  if (r.estimated_charge != null) t += 'Estimate: ' + money(r.estimated_charge) + '\n';
  if (r.estimated_delivery) t += 'Est. Delivery: ' + fmtDate(r.estimated_delivery) + '\n';
  t += '\nStatus dekhne ke liye: ' + TRACK_LINK + '\n' + SHOP.name + ' | ' + SHOP.phone;
  return plain ? t.replace(/\*/g, '') : t;
}

function jobsheetHtml(r) {
  const c = r.customers || {};
  function row(l, v) { return v ? '<tr><td class="l">' + esc(l) + '</td><td>' + esc(v) + '</td></tr>' : ''; }
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Jobsheet ' + esc(r.repair_code) + '</title><style>' +
    '@import url(https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@500;600&display=swap);' +
    '@page{size:A5;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:13px;margin:0}' +
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.hd{background:#0b0b0b;color:#fff;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;border-bottom:3px solid #d4af37}' +
    '.lgw{width:84px;height:84px;overflow:hidden;flex:none;position:relative}.lgw img{position:absolute;width:160px;height:auto;left:-38px;top:-12px}' +
    '.hx{flex:1;text-align:center}' +
    '.hx h1{margin:0;font-family:"Cinzel Decorative",Georgia,serif;font-size:21px;line-height:1.15;color:#e6c25a;letter-spacing:1px;font-weight:700}' +
    '.hx .tg{font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:2.5px;color:#cfcfcf;margin-top:3px;text-transform:uppercase}' +
    '.hx .ad{font-size:10.5px;color:#eee;margin-top:6px;line-height:1.4}' +
    '.tt{text-align:center;font-family:Cinzel,Georgia,serif;font-weight:600;font-size:15px;margin:12px 0 10px;letter-spacing:4px}' +
    '.code{display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-bottom:8px}' +
    'table{width:100%;border-collapse:collapse}td{border:1px solid #444;padding:6px 8px;vertical-align:top}td.l{width:36%;font-weight:bold;background:#f2f2f2}' +
    '.terms{margin-top:10px;font-size:11px}.terms div{margin-top:2px}' +
    '.sig{display:flex;justify-content:space-between;margin-top:36px;font-size:12px}.sig div{border-top:1px solid #000;padding-top:4px;width:42%;text-align:center}' +
    '.trk{margin-top:12px;text-align:center;font-size:11px}' +
    '</style></head><body>' +
    '<div class="hd"><div class="lgw"><img class="lg" src="' + esc(location.origin + '/logo.png') + '" alt=""></div>' +
    '<div class="hx"><h1>Hello Brothers Smart Store</h1><div class="tg">Mobile Repair &bull; Chip-Level &bull; Accessories</div>' +
    '<div class="ad">' + esc(SHOP.addr) + '<br>Phone / WhatsApp: ' + esc(SHOP.phone) + '</div></div></div>' +
    '<div class="tt">JOBSHEET</div>' +
    '<div class="code"><span>Repair ID: ' + esc(r.repair_code) + '</span><span>Date: ' + esc(fmtDate(r.received_date)) + '</span></div>' +
    '<table>' +
    row('Customer', c.name) + row('Mobile', c.mobile) + row('Phone Model', r.device_model) +
    row('Problem', r.problem) + row('Status', r.status) +
    (r.estimated_charge != null ? row('Estimated Charges', money(r.estimated_charge)) : '') +
    (r.estimated_delivery ? row('Est. Delivery', fmtDate(r.estimated_delivery)) : '') +
    row('Note', r.public_note) +
    '</table>' +
    '<div class="terms"><b>Dhyan dein:</b>' +
    '<div>1. Phone lene ke liye ye Jobsheet saath layein.</div>' +
    '<div>2. Repair ke baad final charges badal sakte hain, pehle bataya jayega.</div>' +
    '<div>3. Phone ka data/backup customer ki zimmedari hai.</div></div>' +
    '<div class="sig"><div>Customer Signature</div><div>Authorised Signature</div></div>' +
    '<div class="trk">Repair status dekhein: ' + esc(TRACK_LINK) + '</div>' +
    '</body></html>';
}

function printJobsheet(id) {
  const r = repairs.find(function (x) { return x.id === id; });
  if (!r) return;
  const old = document.getElementById('printFrame');
  if (old) old.remove();
  const f = document.createElement('iframe');
  f.id = 'printFrame';
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open(); d.write(jobsheetHtml(r)); d.close();
  function go() {
    try { f.contentWindow.focus(); f.contentWindow.print(); }
    catch (e) { toast('Print nahi ho paya. Dobara try karein.', 'err'); }
  }
  // Logo load hone ke baad hi print karein
  const img = d.querySelector('img.lg');
  let done = false;
  function once() { if (!done) { done = true; setTimeout(go, 150); } }
  const logoReady = new Promise(function (res) {
    if (!img || img.complete) res(); else { img.onload = res; img.onerror = res; }
  });
  const fontsReady = (d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve();
  Promise.all([logoReady, fontsReady]).then(once);
  setTimeout(once, 2500);
}

function sendJobsheet(id, how) {
  const r = repairs.find(function (x) { return x.id === id; });
  if (!r) return;
  const c = r.customers || {};
  const mobile = encodeURIComponent(c.mobile || '');
  // Dono option seedha customer ke number par khulte hain
  if (how === 'sms') {
    window.location.href = 'sms:+91' + mobile + '?body=' + encodeURIComponent(jobsheetText(r, true));
  } else {
    window.open('https://wa.me/91' + mobile + '?text=' + encodeURIComponent(jobsheetText(r)), '_blank', 'noopener');
  }
}

// ==========================================================
//  STATUS BADALNA (Staff + Admin)
// ==========================================================
async function updateStatus(id) {
  const sel = $('st-' + id);
  if (!sel) return;
  const newStatus = sel.value;

  const { data, error } = await db.from('repairs').update({ status: newStatus }).eq('id', id).select('id');
  if (error) { toast(errorMessage(error), 'err'); return; }
  if (!data || data.length === 0) {
    toast("You don't have permission to perform this action.", 'err');
    return;
  }
  toast('Status updated successfully.', 'ok');
  loadRepairs();
}

// ==========================================================
//  TIMELINE
// ==========================================================
async function toggleHistory(id) {
  const box = $('hist-' + id);
  if (!box) return;
  if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }

  box.innerHTML = 'Loading...';
  box.classList.remove('hidden');
  const { data, error } = await db.from('repair_status_history')
    .select('status, changed_at')
    .eq('repair_id', id)
    .order('changed_at', { ascending: true });
  if (error) { box.innerHTML = 'Timeline load nahi hui.'; return; }
  if (!data || data.length === 0) { box.innerHTML = 'Abhi koi history nahi.'; return; }
  box.innerHTML = data.map(function (h) {
    return '<div><b>' + esc(h.status) + '</b> <span>&bull; ' + esc(fmtDateTime(h.changed_at)) + '</span></div>';
  }).join('');
}

// ==========================================================
//  EDIT (sirf Admin)
// ==========================================================
function openEdit(id) {
  const r = repairs.find(function (x) { return x.id === id; });
  if (!r) return;
  const c = r.customers || {};
  $('eId').value = r.id;
  $('eCustId').value = r.customer_id;
  $('eName').value = c.name || '';
  $('eModel').value = r.device_model || '';
  $('eDate').value = r.received_date || '';
  $('eCharge').value = r.estimated_charge == null ? '' : r.estimated_charge;
  $('eDelivery').value = r.estimated_delivery || '';
  $('eProblem').value = r.problem || '';
  $('ePublic').value = r.public_note || '';
  $('eInternal').value = r.internal_note || '';
  $('editModal').classList.remove('hidden');
}

$('editCancel').addEventListener('click', function () {
  $('editModal').classList.add('hidden');
});

$('editForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!isAdmin) { toast("You don't have permission to perform this action.", 'err'); return; }

  const id = $('eId').value;
  const custId = $('eCustId').value;
  const name = $('eName').value.trim();
  const model = $('eModel').value.trim();
  const date = $('eDate').value;
  const charge = $('eCharge').value;

  if (!name || !model || !date) {
    toast('Please enter required information.', 'err');
    return;
  }

  const r1 = await db.from('repairs').update({
    device_model: model,
    problem: $('eProblem').value.trim() || null,
    received_date: date,
    estimated_charge: charge === '' ? null : Number(charge),
    estimated_delivery: $('eDelivery').value || null,
    public_note: $('ePublic').value.trim() || null,
    internal_note: $('eInternal').value.trim() || null
  }).eq('id', id).select('id');
  if (r1.error) { toast(errorMessage(r1.error), 'err'); return; }
  if (!r1.data || r1.data.length === 0) { toast("You don't have permission to perform this action.", 'err'); return; }

  const r2 = await db.from('customers').update({ name: name }).eq('id', custId).select('id');
  if (r2.error) { toast(errorMessage(r2.error), 'err'); return; }

  $('editModal').classList.add('hidden');
  toast('Repair updated successfully.', 'ok');
  loadRepairs();
});

// ==========================================================
//  DELETE (sirf Admin)
// ==========================================================
async function deleteRepair(id) {
  if (!isAdmin) { toast("You don't have permission to perform this action.", 'err'); return; }
  if (!confirm('Are you sure you want to delete this repair? Iski history bhi hamesha ke liye delete ho jayegi.')) return;

  const { data, error } = await db.from('repairs').delete().eq('id', id).select('id');
  if (error) { toast(errorMessage(error), 'err'); return; }
  if (!data || data.length === 0) {
    toast("You don't have permission to perform this action.", 'err');
    return;
  }
  toast('Repair deleted successfully.', 'ok');
  loadRepairs();
}

// ==========================================================
//  CSV DOWNLOAD (sirf Admin)
// ==========================================================
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

$('exportBtn').addEventListener('click', function () {
  if (!isAdmin) { toast("You don't have permission to perform this action.", 'err'); return; }
  if (repairs.length === 0) { toast('Download karne ke liye koi repair nahi hai.', 'err'); return; }

  const head = ['Repair ID', 'Mobile', 'Customer', 'Phone Model', 'Problem', 'Status', 'Received', 'Est. Charge', 'Est. Delivery', 'Customer Note', 'Internal Note', 'Last Updated'];
  const rows = repairs.map(function (r) {
    const c = r.customers || {};
    return [r.repair_code, c.mobile, c.name, r.device_model, r.problem, r.status, fmtDate(r.received_date),
      r.estimated_charge, r.estimated_delivery ? fmtDate(r.estimated_delivery) : '', r.public_note, r.internal_note, fmtDateTime(r.updated_at)]
      .map(csvCell).join(',');
  });
  const csv = '\uFEFF' + [head.map(csvCell).join(',')].concat(rows).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'repairs-' + todayStr() + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('CSV download ho gayi.', 'ok');
});

// ==========================================================
//  PAGE KHULTE HI
// ==========================================================
(async function init() {
  try {
    const { data } = await db.auth.getSession();
    if (data && data.session) {
      const ok = await loadProfile(data.session.user.id);
      if (ok) { showApp(); return; }
      await db.auth.signOut();
    }
  } catch (err) {
    toast('Unable to save data. Please check your internet connection.', 'err');
  }
  $('loginView').classList.remove('hidden');
})();
