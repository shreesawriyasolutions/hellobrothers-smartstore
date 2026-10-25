// ==========================================================
//  HELLO BROTHERS SMART STORE - DAILY SALE REGISTER
// ==========================================================

const SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.APP_CONFIG.SUPABASE_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3500);
}

function errorMessage(error) {
  const m = ((error && error.message) || '').toLowerCase();
  const code = error && error.code;
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to')) {
    return 'Unable to save data. Please check your internet connection.';
  }
  if (code === '42501' || m.includes('row-level security') || m.includes('permission')) {
    return "You don't have permission to perform this action.";
  }
  return 'Something went wrong. Please try again.';
}

// ---------- State (yaad rakhne wali cheezein) ----------
let profile = null;        // {role, can_view, full_name}
let loginRole = 'staff';   // login tab: 'staff' ya 'admin'
let filterMode = 'today';  // today | single | range | all
let entries = [];          // screen par loaded entries
let isAdmin = false;
let canView = false;

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

  // Tab aur asli role match hona chahiye
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
  entries = [];
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
  canView = isAdmin || profile.can_view === true;

  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');

  const badge = $('modeBadge');
  if (isAdmin) {
    badge.textContent = 'ADMIN MODE';
    badge.className = 'badge admin';
  } else {
    badge.textContent = 'STAFF MODE - Add Only';
    badge.className = 'badge staff';
  }

  $('todayText').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
  });

  $('fDate').value = todayStr();
  $('singleDate').value = todayStr();
  $('startDate').value = todayStr();
  $('endDate').value = todayStr();

  // Staff ka naam khud bhar do (change kar sakta hai)
  if (profile.full_name && profile.full_name !== 'Admin' && profile.full_name.indexOf('@') === -1 && !$('fStaff').value) {
    $('fStaff').value = profile.full_name;
  }

  // Jis staff ko view permission nahi, usko filter/list/totals nahi dikhte
  $('filterSection').classList.toggle('hidden', !canView);
  $('listSection').classList.toggle('hidden', !canView);
  $('noViewMsg').classList.toggle('hidden', canView);
  $('exportBtn').classList.toggle('hidden', !isAdmin);

  if (canView) loadEntries();
}

// ==========================================================
//  FILTERS
// ==========================================================
document.querySelectorAll('.filter-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    filterMode = btn.getAttribute('data-mode');
    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.classList.toggle('active', b === btn);
    });
    $('singleBox').classList.toggle('hidden', filterMode !== 'single');
    $('rangeBox').classList.toggle('hidden', filterMode !== 'range');
    loadEntries();
  });
});

$('singleDate').addEventListener('change', loadEntries);
$('applyRange').addEventListener('click', loadEntries);
$('searchBox').addEventListener('input', renderList);

// ==========================================================
//  ENTRIES LOAD
// ==========================================================
async function loadEntries() {
  if (!canView) return;

  let q = db.from('sales_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2000);

  let label = '';
  if (filterMode === 'today') {
    q = q.eq('entry_date', todayStr());
    label = 'Aaj ki entries: ' + fmtDate(todayStr());
  } else if (filterMode === 'single') {
    const d = $('singleDate').value;
    if (!d) { toast('Please enter required information.', 'err'); return; }
    q = q.eq('entry_date', d);
    label = 'Date: ' + fmtDate(d);
  } else if (filterMode === 'range') {
    const s = $('startDate').value;
    const en = $('endDate').value;
    if (!s || !en) { toast('Please enter required information.', 'err'); return; }
    if (s > en) { toast('Start Date, End Date se pehle honi chahiye.', 'err'); return; }
    q = q.gte('entry_date', s).lte('entry_date', en);
    label = 'Date Range: ' + fmtDate(s) + ' se ' + fmtDate(en);
  } else {
    label = 'All Time (saari entries)';
  }
  $('periodLabel').textContent = label;

  const { data, error } = await q;
  if (error) {
    toast(errorMessage(error), 'err');
    return;
  }
  entries = data || [];
  renderTotals();
  renderList();
}

function renderTotals() {
  let sale = 0, exp = 0;
  entries.forEach(function (r) {
    sale += Number(r.amount_received) || 0;
    exp += Number(r.expense) || 0;
  });
  $('totSale').textContent = money(sale);
  $('totExpense').textContent = money(exp);
  $('totProfit').textContent = money(sale - exp);
  $('totCount').textContent = entries.length;
}

function getFilteredList() {
  const term = $('searchBox').value.trim().toLowerCase();
  return entries.filter(function (r) {
    if (!term) return true;
    const hay = [r.customer_name, r.sale_description, r.staff_name, r.notes].join(' ').toLowerCase();
    return hay.indexOf(term) !== -1;
  });
}

// ---------- CSV Download (sirf Admin) ----------
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // Excel formula se bachav
  return '"' + s.replace(/"/g, '""') + '"';
}

$('exportBtn').addEventListener('click', function () {
  if (!isAdmin) {
    toast("You don't have permission to perform this action.", 'err');
    return;
  }
  const list = getFilteredList();
  if (list.length === 0) {
    toast('Download karne ke liye koi entry nahi hai.', 'err');
    return;
  }

  const head = ['Date', 'Kaam / Sale', 'Customer', 'Paise Liye', 'Kharcha', 'Profit', 'Payment Mode', 'Staff', 'Notes'];
  const rows = list.map(function (r) {
    return [
      fmtDate(r.entry_date), r.sale_description, r.customer_name,
      r.amount_received, r.expense, r.profit,
      r.payment_mode, r.staff_name, r.notes
    ].map(csvCell).join(',');
  });

  const csv = '\uFEFF' + [head.map(csvCell).join(',')].concat(rows).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sales-register-' + filterMode + '-' + todayStr() + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('CSV download ho gayi.', 'ok');
});

function renderList() {
  const list = getFilteredList();

  if (list.length === 0) {
    $('entriesList').innerHTML = '<div class="card empty">Koi entry nahi mili.</div>';
    return;
  }

  $('entriesList').innerHTML = list.map(function (r) {
    const profit = Number(r.profit);
    let html = '';
    html += '<div class="entry">';
    html += '<div class="entry-head">';
    html += '<div class="entry-title">' + esc(r.sale_description) + '</div>';
    html += '<div class="entry-date">' + esc(fmtDate(r.entry_date)) + '</div>';
    html += '</div>';
    html += '<div class="entry-meta">';
    if (r.customer_name) html += 'Customer: ' + esc(r.customer_name) + ' &bull; ';
    html += 'Staff: ' + esc(r.staff_name);
    html += '<span class="pay-badge">' + esc(r.payment_mode) + '</span>';
    html += '</div>';
    html += '<div class="entry-money">';
    html += '<div><span>Paise Liye</span><b>' + money(r.amount_received) + '</b></div>';
    html += '<div><span>Kharcha</span><b class="x">' + money(r.expense) + '</b></div>';
    html += '<div><span>Profit</span><b class="p">' + money(profit) + '</b></div>';
    html += '</div>';
    if (r.notes) html += '<div class="entry-note">Notes: ' + esc(r.notes) + '</div>';
    if (isAdmin) {
      html += '<div class="entry-actions">';
      html += '<button type="button" class="btn btn-edit" data-edit="' + esc(r.id) + '">EDIT</button>';
      html += '<button type="button" class="btn btn-del" data-del="' + esc(r.id) + '">DELETE</button>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }).join('');
}

// Edit / Delete button clicks (sirf Admin ko buttons dikhte hain)
$('entriesList').addEventListener('click', function (e) {
  const editId = e.target.getAttribute('data-edit');
  const delId = e.target.getAttribute('data-del');
  if (editId) openEdit(editId);
  if (delId) deleteEntry(delId);
});

// ==========================================================
//  ADD ENTRY
// ==========================================================
function updateProfitPreview() {
  const a = parseFloat($('fAmount').value) || 0;
  const x = parseFloat($('fExpense').value) || 0;
  $('fProfit').textContent = money(a - x);
}
$('fAmount').addEventListener('input', updateProfitPreview);
$('fExpense').addEventListener('input', updateProfitPreview);

$('entryForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const date = $('fDate').value;
  const work = $('fWork').value.trim();
  const amount = $('fAmount').value;
  const expense = $('fExpense').value === '' ? '0' : $('fExpense').value;
  const staff = $('fStaff').value.trim();

  if (!date || !work || amount === '' || !staff) {
    toast('Please enter required information.', 'err');
    return;
  }
  if (Number(amount) < 0 || Number(expense) < 0) {
    toast('Please enter required information.', 'err');
    return;
  }

  $('addBtn').disabled = true;
  const { error } = await db.from('sales_entries').insert({
    entry_date: date,
    sale_description: work,
    customer_name: $('fCustomer').value.trim() || null,
    amount_received: Number(amount),
    expense: Number(expense),
    payment_mode: $('fPayment').value,
    staff_name: staff,
    notes: $('fNotes').value.trim() || null
  });
  $('addBtn').disabled = false;

  if (error) {
    toast(errorMessage(error), 'err');
    return;
  }

  toast('Entry added successfully.', 'ok');
  $('fWork').value = '';
  $('fCustomer').value = '';
  $('fAmount').value = '';
  $('fExpense').value = '';
  $('fNotes').value = '';
  $('fPayment').value = 'Cash';
  updateProfitPreview();

  if (canView) loadEntries();
});

// ==========================================================
//  EDIT ENTRY (sirf Admin)
// ==========================================================
function openEdit(id) {
  const r = entries.find(function (x) { return x.id === id; });
  if (!r) return;
  $('eId').value = r.id;
  $('eDate').value = r.entry_date;
  $('eCustomer').value = r.customer_name || '';
  $('eWork').value = r.sale_description;
  $('eAmount').value = r.amount_received;
  $('eExpense').value = r.expense;
  $('ePayment').value = r.payment_mode;
  $('eStaff').value = r.staff_name;
  $('eNotes').value = r.notes || '';
  $('editModal').classList.remove('hidden');
}

$('editCancel').addEventListener('click', function () {
  $('editModal').classList.add('hidden');
});

$('editForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const id = $('eId').value;
  const date = $('eDate').value;
  const work = $('eWork').value.trim();
  const amount = $('eAmount').value;
  const expense = $('eExpense').value === '' ? '0' : $('eExpense').value;
  const staff = $('eStaff').value.trim();

  if (!date || !work || amount === '' || !staff) {
    toast('Please enter required information.', 'err');
    return;
  }

  const { data, error } = await db.from('sales_entries').update({
    entry_date: date,
    sale_description: work,
    customer_name: $('eCustomer').value.trim() || null,
    amount_received: Number(amount),
    expense: Number(expense),
    payment_mode: $('ePayment').value,
    staff_name: staff,
    notes: $('eNotes').value.trim() || null
  }).eq('id', id).select();

  if (error) { toast(errorMessage(error), 'err'); return; }
  if (!data || data.length === 0) {
    toast("You don't have permission to perform this action.", 'err');
    return;
  }

  $('editModal').classList.add('hidden');
  toast('Entry updated successfully.', 'ok');
  loadEntries();
});

// ==========================================================
//  DELETE ENTRY (sirf Admin)
// ==========================================================
async function deleteEntry(id) {
  if (!confirm('Are you sure you want to delete this entry?')) return;

  const { data, error } = await db.from('sales_entries').delete().eq('id', id).select();

  if (error) { toast(errorMessage(error), 'err'); return; }
  if (!data || data.length === 0) {
    toast("You don't have permission to perform this action.", 'err');
    return;
  }

  toast('Entry deleted successfully.', 'ok');
  loadEntries();
}

// ==========================================================
//  PAGE KHULTE HI: pehle se login hai to seedha app dikhao
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
