// ==========================================================
//  HELLO BROTHERS SMART STORE - BILLS REGISTER
// ==========================================================

const SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.APP_CONFIG.SUPABASE_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = 'bills';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// Bill ke 3 type (cards isi list se bante hain)
const BILL_TYPES = [
  { value: 'Purchase Bill', title: 'Purchase (Kharid)', cls: 'tc-purchase', totalLabel: 'Abhi tak ki Purchasing' },
  { value: 'Sale Bill',     title: 'Sale (Bikri)',      cls: 'tc-sale',     totalLabel: 'Abhi tak ki Sale' },
  { value: 'Unlocking Job', title: 'Unlocking',         cls: 'tc-unlock',   totalLabel: 'Abhi tak ki Unlocking' }
];

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
  const p = String(s).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
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
  if (code === '42501' || m.includes('row-level security') || m.includes('permission') || m.includes('not allowed') || m.includes('unauthorized')) {
    return "You don't have permission to perform this action.";
  }
  return 'Something went wrong. Please try again.';
}

// ---------- State ----------
let profile = null;
let currentUser = null;
let loginRole = 'staff';
let filterMode = 'all';
let allBills = [];       // chune hue time period ke saare bills (teeno type)
let bills = [];          // selectedType ke hisaab se filter hue bills
let selectedType = '';   // '' = Sab, warna 'Purchase Bill' / 'Sale Bill' / 'Unlocking Job'
let periodBase = '';
let isAdmin = false;

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

  currentUser = data.user;
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
  currentUser = null;
  bills = [];
  allBills = [];
  selectedType = '';
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
    badge.textContent = 'STAFF MODE - Upload Only';
    badge.className = 'badge staff';
  }

  $('todayText').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
  });

  $('bDate').value = todayStr();
  $('singleDate').value = todayStr();
  $('startDate').value = todayStr();
  $('endDate').value = todayStr();

  if (profile.full_name && profile.full_name !== 'Admin' && profile.full_name.indexOf('@') === -1 && !$('bStaff').value) {
    $('bStaff').value = profile.full_name;
  }

  updateTypeFields();

  // Bills sirf Admin dekh sakta hai
  $('adminSection').classList.toggle('hidden', !isAdmin);
  $('noViewMsg').classList.toggle('hidden', isAdmin);

  if (isAdmin) loadBills();
}

// Bill type ke hisaab se form ke fields badlo
$('bType').addEventListener('change', updateTypeFields);

function updateTypeFields() {
  const t = $('bType').value;
  const unlock = t === 'Unlocking Job';
  $('unlockFields').classList.toggle('hidden', !unlock);
  $('idFileBox').classList.toggle('hidden', !unlock);
  if (unlock) {
    $('bPartyLabel').textContent = 'Customer Name *';
  } else if (t === 'Sale Bill') {
    $('bPartyLabel').textContent = 'Customer Name *';
  } else {
    $('bPartyLabel').textContent = 'Supplier / Party Name *';
  }
}

// ==========================================================
//  FILE UPLOAD HELPERS
// ==========================================================
function compressImage(file) {
  return new Promise(function (resolve) {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function () {
      const max = 1600;
      let w = img.width, h = img.height;
      if (w > max || h > max) {
        const r = Math.min(max / w, max / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', 0.8);
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function randomId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now() + '-' + Math.random().toString(16).slice(2);
}

function extFromType(t) {
  if (t === 'application/pdf') return 'pdf';
  if (t === 'image/png') return 'png';
  if (t === 'image/webp') return 'webp';
  return 'jpg';
}

// File ko storage me daalta hai, path wapas deta hai
async function uploadOne(file, kind) {
  if (ALLOWED_TYPES.indexOf(file.type) === -1) {
    throw { custom: 'Sirf JPG, PNG, WEBP ya PDF file allowed hai.' };
  }
  const blob = await compressImage(file);
  const contentType = blob.type || file.type;
  if (ALLOWED_TYPES.indexOf(contentType) === -1) {
    throw { custom: 'Sirf JPG, PNG, WEBP ya PDF file allowed hai.' };
  }
  if (blob.size > MAX_FILE_BYTES) {
    throw { custom: 'File 10 MB se badi hai. Chhoti file chuno.' };
  }
  const path = currentUser.id + '/' + kind + '-' + randomId() + '.' + extFromType(contentType);
  const { error } = await db.storage.from(BUCKET).upload(path, blob, {
    contentType: contentType,
    upsert: false
  });
  if (error) throw error;
  return path;
}

// ==========================================================
//  UPLOAD BILL
// ==========================================================
$('billForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const type = $('bType').value;
  const date = $('bDate').value;
  const party = $('bParty').value.trim();
  const staff = $('bStaff').value.trim();
  const mobile = $('bMobile').value.replace(/\s/g, '');
  const amount = $('bAmount').value;
  const billFiles = Array.from($('bFile').files);
  const idFiles = Array.from($('bIdFile').files);
  const unlock = type === 'Unlocking Job';

  if (!date || !party || !staff || billFiles.length === 0) {
    toast('Please enter required information.', 'err');
    return;
  }
  if (billFiles.length > 10) {
    toast('Ek baar me maximum 10 bill files chun sakte ho.', 'err');
    return;
  }
  if (unlock && idFiles.length > 4) {
    toast('Maximum 4 ID files chun sakte ho.', 'err');
    return;
  }
  if (mobile && !/^\d{10}$/.test(mobile)) {
    toast('Mobile number 10 digit ka hona chahiye.', 'err');
    return;
  }

  let model = null, imei = null, work = null;
  if (unlock) {
    model = $('bModel').value.trim();
    imei = $('bImei').value.replace(/\s/g, '');
    work = $('bWork').value;
    if (!model || !imei) {
      toast('Please enter required information.', 'err');
      return;
    }
    if (!/^\d{15}$/.test(imei)) {
      toast('IMEI 15 digit ka hona chahiye.', 'err');
      return;
    }
  }

  $('uploadBtn').disabled = true;
  $('uploadBtn').textContent = 'Uploading... please wait';

  try {
    const toUpload = [];
    billFiles.forEach(function (f) { toUpload.push({ file: f, kind: 'bill' }); });
    if (unlock) { idFiles.forEach(function (f) { toUpload.push({ file: f, kind: 'id' }); }); }

    const billPaths = [];
    const idPaths = [];
    for (let i = 0; i < toUpload.length; i++) {
      $('uploadBtn').textContent = 'Uploading ' + (i + 1) + ' / ' + toUpload.length + ' ...';
      const p = await uploadOne(toUpload[i].file, toUpload[i].kind);
      if (toUpload[i].kind === 'id') { idPaths.push(p); } else { billPaths.push(p); }
    }
    const billPath = billPaths[0];
    const idPath = idPaths.length ? idPaths[0] : null;
    const extraPaths = billPaths.slice(1).concat(idPaths.slice(1));

    const { error } = await db.from('bills').insert({
      bill_date: date,
      bill_type: type,
      party_name: party,
      mobile_number: mobile || null,
      phone_model: model,
      imei: imei,
      work_type: work,
      amount: amount === '' ? null : Number(amount),
      notes: $('bNotes').value.trim() || null,
      bill_file_path: billPath,
      id_file_path: idPath,
      extra_file_paths: extraPaths,
      uploaded_by_name: staff
    });
    if (error) throw error;

    toast('Bill uploaded successfully.', 'ok');
    $('bParty').value = '';
    $('bMobile').value = '';
    $('bAmount').value = '';
    $('bNotes').value = '';
    $('bModel').value = '';
    $('bImei').value = '';
    $('bFile').value = '';
    $('bIdFile').value = '';
    if (isAdmin) loadBills();
  } catch (err) {
    toast(err && err.custom ? err.custom : errorMessage(err), 'err');
  }

  $('uploadBtn').disabled = false;
  $('uploadBtn').textContent = 'Upload Bill';
});

// ==========================================================
//  FILTERS (Admin)
// ==========================================================
document.querySelectorAll('.filter-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    filterMode = btn.getAttribute('data-mode');
    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.classList.toggle('active', b === btn);
    });
    $('singleBox').classList.toggle('hidden', filterMode !== 'single');
    $('rangeBox').classList.toggle('hidden', filterMode !== 'range');
    loadBills();
  });
});

$('singleDate').addEventListener('change', loadBills);
$('applyRange').addEventListener('click', loadBills);
$('searchBox').addEventListener('input', renderList);

// Type card par click: sirf usi type ke bills dikhao (dobara click = Sab)
$('typeCards').addEventListener('click', function (e) {
  const card = e.target.closest('[data-type]');
  if (!card) return;
  const t = card.getAttribute('data-type');
  selectedType = (t === selectedType) ? '' : t;
  applyType();
});

async function loadBills() {
  if (!isAdmin) return;

  let q = db.from('bills')
    .select('*')
    .order('bill_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2000);

  let label = '';
  if (filterMode === 'today') {
    q = q.eq('bill_date', todayStr());
    label = 'Aaj ke bills: ' + fmtDate(todayStr());
  } else if (filterMode === 'single') {
    const d = $('singleDate').value;
    if (!d) { toast('Please enter required information.', 'err'); return; }
    q = q.eq('bill_date', d);
    label = 'Date: ' + fmtDate(d);
  } else if (filterMode === 'range') {
    const s = $('startDate').value;
    const en = $('endDate').value;
    if (!s || !en) { toast('Please enter required information.', 'err'); return; }
    if (s > en) { toast('Start Date, End Date se pehle honi chahiye.', 'err'); return; }
    q = q.gte('bill_date', s).lte('bill_date', en);
    label = 'Date Range: ' + fmtDate(s) + ' se ' + fmtDate(en);
  } else {
    label = 'All Time (saare bills)';
  }

  periodBase = label;

  // Teeno type ek saath aate hain, taaki har card ka total alag dikha sake
  const { data, error } = await q;
  if (error) { toast(errorMessage(error), 'err'); return; }
  allBills = data || [];
  applyType();
}

// selectedType ke hisaab se list, cards aur totals update karo
function applyType() {
  bills = selectedType
    ? allBills.filter(function (b) { return b.bill_type === selectedType; })
    : allBills.slice();

  $('periodLabel').textContent = periodBase + (selectedType ? ' | ' + selectedType : '');
  renderTypeCards();
  renderTotals();
  renderList();
}

function renderTypeCards() {
  let allTotal = 0;
  allBills.forEach(function (b) { allTotal += Number(b.amount) || 0; });

  let h = '';
  BILL_TYPES.forEach(function (t) {
    let count = 0, total = 0;
    allBills.forEach(function (b) {
      if (b.bill_type === t.value) { count++; total += Number(b.amount) || 0; }
    });
    h += '<button type="button" class="type-card ' + t.cls + (selectedType === t.value ? ' active' : '') + '" data-type="' + esc(t.value) + '">';
    h += '<div class="tc-name">' + esc(t.title) + '</div>';
    h += '<div class="tc-amount">' + money(total) + '</div>';
    h += '<div class="tc-count">' + count + ' bill' + (count === 1 ? '' : 's') + '</div>';
    h += '</button>';
  });

  h += '<button type="button" class="type-card tc-all' + (selectedType === '' ? ' active' : '') + '" data-type="">';
  h += '<div class="tc-name">Sab Bills</div>';
  h += '<div class="tc-amount">' + money(allTotal) + '</div>';
  h += '<div class="tc-count">' + allBills.length + ' bill' + (allBills.length === 1 ? '' : 's') + '</div>';
  h += '</button>';

  $('typeCards').innerHTML = h;
}

function renderTotals() {
  let total = 0;
  bills.forEach(function (b) { total += Number(b.amount) || 0; });
  $('totCount').textContent = bills.length;
  $('totAmount').textContent = money(total);

  const t = BILL_TYPES.find(function (x) { return x.value === selectedType; });
  const isAllTime = filterMode === 'all';
  if (t) {
    $('totCountLabel').textContent = t.title + ' - Bills';
    $('totAmountLabel').textContent = isAllTime ? t.totalLabel : t.title + ' - Total Amount';
  } else {
    $('totCountLabel').textContent = 'Total Bills';
    $('totAmountLabel').textContent = 'Total Amount';
  }
}

function getFilteredList() {
  const term = $('searchBox').value.trim().toLowerCase();
  return bills.filter(function (b) {
    if (!term) return true;
    const hay = [b.party_name, b.mobile_number, b.imei, b.phone_model, b.work_type, b.notes, b.uploaded_by_name].join(' ').toLowerCase();
    return hay.indexOf(term) !== -1;
  });
}

// Ek bill ki saari files (bill + ID + extra) ki list
function allFiles(b) {
  const out = [];
  let billN = 0, idN = 0;
  const paths = [b.bill_file_path, b.id_file_path].concat(b.extra_file_paths || []).filter(Boolean);
  paths.forEach(function (p) {
    const name = p.split('/').pop();
    if (name.indexOf('id-') === 0) {
      idN++;
      out.push({ path: p, label: 'View ID' + (idN > 1 ? ' ' + idN : ''), cls: 'btn-ghost' });
    } else {
      billN++;
      out.push({ path: p, label: 'View Bill' + (billN > 1 ? ' ' + billN : ''), cls: 'btn-blue' });
    }
  });
  return out;
}

function typeClass(t) {
  if (t === 'Purchase Bill') return 'purchase';
  if (t === 'Sale Bill') return 'sale';
  return 'unlock';
}

function renderList() {
  const list = getFilteredList();
  if (list.length === 0) {
    $('billsList').innerHTML = '<div class="card empty">Koi bill nahi mila.</div>';
    return;
  }

  $('billsList').innerHTML = list.map(function (b) {
    let h = '<div class="entry">';
    h += '<div class="entry-head">';
    h += '<div class="entry-title">' + esc(b.party_name) + '</div>';
    h += '<div class="entry-date">' + esc(fmtDate(b.bill_date)) + '</div>';
    h += '</div>';
    h += '<div class="entry-meta"><span class="type-badge ' + typeClass(b.bill_type) + '">' + esc(b.bill_type) + '</span>';
    h += ' &bull; Uploaded by: ' + esc(b.uploaded_by_name) + '</div>';

    h += '<div class="bill-info">';
    if (b.mobile_number) h += '<div><span>Mobile:</span> ' + esc(b.mobile_number) + '</div>';
    if (b.phone_model) h += '<div><span>Model:</span> ' + esc(b.phone_model) + '</div>';
    if (b.imei) h += '<div><span>IMEI:</span> ' + esc(b.imei) + '</div>';
    if (b.work_type) h += '<div><span>Kaam:</span> ' + esc(b.work_type) + '</div>';
    if (b.amount != null) h += '<div><span>Amount:</span> <b>' + money(b.amount) + '</b></div>';
    if (b.notes) h += '<div><span>Notes:</span> ' + esc(b.notes) + '</div>';
    h += '</div>';

    h += '<div class="bill-actions">';
    allFiles(b).forEach(function (f) {
      h += '<button type="button" class="btn ' + f.cls + '" data-path="' + esc(f.path) + '">' + esc(f.label) + '</button>';
    });
    h += '<button type="button" class="btn btn-del" data-del="' + esc(b.id) + '">DELETE</button>';
    h += '</div>';
    h += '</div>';
    return h;
  }).join('');
}

$('billsList').addEventListener('click', function (e) {
  const viewPath = e.target.getAttribute('data-path');
  const delId = e.target.getAttribute('data-del');
  if (viewPath) viewFile(viewPath);
  if (delId) deleteBill(delId);
});

// ==========================================================
//  VIEW FILE (private link, 60 second me expire)
// ==========================================================
async function viewFile(path) {
  if (!isAdmin) {
    toast("You don't have permission to perform this action.", 'err');
    return;
  }
  if (!path) return;

  const w = window.open('', '_blank'); // popup block se bachne ke liye pehle khol do
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) {
    if (w) w.close();
    toast(errorMessage(error), 'err');
    return;
  }
  if (w) { w.location.href = data.signedUrl; }
  else { window.location.href = data.signedUrl; }
}

// ==========================================================
//  DELETE BILL (sirf Admin)
// ==========================================================
async function deleteBill(id) {
  if (!confirm('Are you sure you want to delete this bill? File bhi hamesha ke liye delete ho jayegi.')) return;

  const b = allBills.find(function (x) { return x.id === id; });
  const { data, error } = await db.from('bills').delete().eq('id', id).select();

  if (error) { toast(errorMessage(error), 'err'); return; }
  if (!data || data.length === 0) {
    toast("You don't have permission to perform this action.", 'err');
    return;
  }

  if (b) {
    const paths = allFiles(b).map(function (f) { return f.path; });
    if (paths.length) { await db.storage.from(BUCKET).remove(paths); }
  }

  toast('Bill deleted successfully.', 'ok');
  loadBills();
}

// ==========================================================
//  CSV DOWNLOAD (sirf Admin, files nahi, sirf details)
// ==========================================================
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

$('exportBtn').addEventListener('click', function () {
  if (!isAdmin) {
    toast("You don't have permission to perform this action.", 'err');
    return;
  }
  const list = getFilteredList();
  if (list.length === 0) {
    toast('Download karne ke liye koi bill nahi hai.', 'err');
    return;
  }
  const head = ['Date', 'Type', 'Party / Customer', 'Mobile', 'Phone Model', 'IMEI', 'Kaam', 'Amount', 'Notes', 'Uploaded By'];
  const rows = list.map(function (b) {
    return [fmtDate(b.bill_date), b.bill_type, b.party_name, b.mobile_number, b.phone_model, b.imei, b.work_type, b.amount, b.notes, b.uploaded_by_name]
      .map(csvCell).join(',');
  });
  const csv = '\uFEFF' + [head.map(csvCell).join(',')].concat(rows).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bills-register-' + todayStr() + '.csv';
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
      currentUser = data.session.user;
      const ok = await loadProfile(currentUser.id);
      if (ok) { showApp(); return; }
      await db.auth.signOut();
    }
  } catch (err) {
    toast('Unable to save data. Please check your internet connection.', 'err');
  }
  $('loginView').classList.remove('hidden');
})();
