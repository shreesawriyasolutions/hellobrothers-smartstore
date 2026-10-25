// ==========================================================
//  HELLO BROTHERS SMART STORE - CUSTOMER REPAIR TRACKING
//  3 Languages: English / Hindi / Punjabi
//  Is page par koi secret key nahi hai, sirf public key hai.
// ==========================================================

const SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.APP_CONFIG.SUPABASE_KEY;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const STATUSES = ['Received', 'Diagnosing', 'Repair in Progress', 'Waiting for Part', 'Ready for Pickup', 'Delivered'];
const LOCALE = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };

// ---------- Teeno languages ke shabd ----------
const T = {
  en: {
    back: '← Home',
    tag: 'REPAIR STATUS',
    h1: 'Check Your Phone Status',
    sub: 'Enter your registered mobile number. All your phones will show together.',
    label: 'Mobile Number',
    ph: '10-digit mobile number',
    btn: 'Check Status',
    note: 'Only the mobile number given at the shop will work.',
    title: 'Track Your Repair | Hello Brothers Smart Store',
    errInvalid: 'Please enter a valid 10-digit mobile number.',
    wait: 'Please wait a moment and try again.',
    searching: 'Searching...',
    busy: 'Too many people are searching right now. Please try again later.',
    techErr: 'Technical problem. Please check your internet and try again.',
    none: 'No repair record found for this number. Please contact the shop.',
    hello: 'Hello {name}, we found {n} repair record(s).',
    received: 'Received',
    updated: 'Last updated',
    tapOpen: 'Tap to see full details',
    tapClose: 'Tap to hide',
    ready: 'Your phone is ready. Please collect it from the shop.',
    returnedMsg: 'This phone has been returned. Please contact the shop if you have any questions.',
    problem: 'Problem',
    receivedDate: 'Received Date',
    lastUpdated: 'Last Updated',
    estDelivery: 'Estimated Delivery',
    noteRow: 'Note',
    progress: 'REPAIR PROGRESS',
    st: {
      'Received': 'Received',
      'Diagnosing': 'Diagnosing',
      'Repair in Progress': 'Repair in Progress',
      'Waiting for Part': 'Waiting for Part',
      'Ready for Pickup': 'Ready for Pickup',
      'Delivered': 'Delivered',
      'Returned': 'Returned'
    },
    desc: {
      'Received': 'We have received your phone',
      'Diagnosing': 'Your phone is being checked',
      'Repair in Progress': 'Repair work is going on',
      'Waiting for Part': 'Waiting for a part to arrive',
      'Ready for Pickup': 'Phone is ready, please collect it from the shop',
      'Delivered': 'Phone has been handed over',
      'Returned': 'Phone has been returned'
    }
  },
  hi: {
    back: '← होम',
    tag: 'रिपेयर स्टेटस',
    h1: 'अपने फोन का स्टेटस देखें',
    sub: 'अपना रजिस्टर्ड मोबाइल नंबर डालें। आपके सभी फोन का स्टेटस एक साथ दिखेगा।',
    label: 'मोबाइल नंबर',
    ph: '10 अंकों का मोबाइल नंबर',
    btn: 'स्टेटस देखें',
    note: 'सिर्फ वही मोबाइल नंबर चलेगा जो दुकान पर लिखवाया था।',
    title: 'रिपेयर स्टेटस | हैलो ब्रदर्स स्मार्ट स्टोर',
    errInvalid: 'कृपया 10 अंकों का सही मोबाइल नंबर डालें।',
    wait: 'थोड़ा रुककर दोबारा कोशिश करें।',
    searching: 'खोज रहे हैं...',
    busy: 'अभी बहुत लोग सर्च कर रहे हैं। कृपया थोड़ी देर बाद कोशिश करें।',
    techErr: 'तकनीकी समस्या। कृपया इंटरनेट चेक करके दोबारा कोशिश करें।',
    none: 'इस नंबर पर कोई रिपेयर रिकॉर्ड नहीं मिला। कृपया दुकान पर संपर्क करें।',
    hello: 'नमस्ते {name}, आपके {n} रिपेयर रिकॉर्ड मिले।',
    received: 'जमा हुआ',
    updated: 'आखिरी अपडेट',
    tapOpen: 'पूरी जानकारी देखने के लिए टैप करें',
    tapClose: 'छिपाने के लिए टैप करें',
    ready: 'आपका फोन तैयार है। कृपया दुकान से ले जाएं।',
    returnedMsg: 'यह फोन वापस कर दिया गया है। कोई सवाल हो तो कृपया दुकान पर संपर्क करें।',
    problem: 'समस्या',
    receivedDate: 'जमा करने की तारीख',
    lastUpdated: 'आखिरी अपडेट',
    estDelivery: 'अनुमानित डिलीवरी',
    noteRow: 'नोट',
    progress: 'रिपेयर की प्रगति',
    st: {
      'Received': 'फोन प्राप्त हुआ',
      'Diagnosing': 'जांच हो रही है',
      'Repair in Progress': 'रिपेयर चल रही है',
      'Waiting for Part': 'पार्ट का इंतज़ार',
      'Ready for Pickup': 'लेने के लिए तैयार',
      'Delivered': 'डिलीवर हो गया',
      'Returned': 'वापस किया गया'
    },
    desc: {
      'Received': 'आपका फोन हमें मिल गया है',
      'Diagnosing': 'आपके फोन की जांच हो रही है',
      'Repair in Progress': 'रिपेयर का काम चल रहा है',
      'Waiting for Part': 'पार्ट आने का इंतज़ार है',
      'Ready for Pickup': 'फोन तैयार है, कृपया दुकान से ले जाएं',
      'Delivered': 'फोन सौंप दिया गया है',
      'Returned': 'फोन वापस कर दिया गया है'
    }
  },
  pa: {
    back: '← ਹੋਮ',
    tag: 'ਰਿਪੇਅਰ ਸਟੇਟਸ',
    h1: 'ਆਪਣੇ ਫ਼ੋਨ ਦਾ ਸਟੇਟਸ ਦੇਖੋ',
    sub: 'ਆਪਣਾ ਰਜਿਸਟਰਡ ਮੋਬਾਈਲ ਨੰਬਰ ਪਾਓ। ਤੁਹਾਡੇ ਸਾਰੇ ਫ਼ੋਨਾਂ ਦਾ ਸਟੇਟਸ ਇਕੱਠਾ ਦਿਖੇਗਾ।',
    label: 'ਮੋਬਾਈਲ ਨੰਬਰ',
    ph: '10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ',
    btn: 'ਸਟੇਟਸ ਦੇਖੋ',
    note: 'ਸਿਰਫ਼ ਉਹੀ ਮੋਬਾਈਲ ਨੰਬਰ ਚੱਲੇਗਾ ਜੋ ਦੁਕਾਨ ਤੇ ਲਿਖਵਾਇਆ ਸੀ।',
    title: 'ਰਿਪੇਅਰ ਸਟੇਟਸ | ਹੈਲੋ ਬ੍ਰਦਰਜ਼ ਸਮਾਰਟ ਸਟੋਰ',
    errInvalid: 'ਕਿਰਪਾ ਕਰਕੇ 10 ਅੰਕਾਂ ਦਾ ਸਹੀ ਮੋਬਾਈਲ ਨੰਬਰ ਪਾਓ।',
    wait: 'ਥੋੜ੍ਹਾ ਰੁਕ ਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    searching: 'ਖੋਜ ਰਹੇ ਹਾਂ...',
    busy: 'ਇਸ ਵੇਲੇ ਬਹੁਤ ਲੋਕ ਖੋਜ ਰਹੇ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    techErr: 'ਤਕਨੀਕੀ ਸਮੱਸਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਇੰਟਰਨੈੱਟ ਚੈੱਕ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    none: 'ਇਸ ਨੰਬਰ ਤੇ ਕੋਈ ਰਿਪੇਅਰ ਰਿਕਾਰਡ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਕਾਨ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
    hello: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ {name}, ਤੁਹਾਡੇ {n} ਰਿਪੇਅਰ ਰਿਕਾਰਡ ਮਿਲੇ।',
    received: 'ਜਮ੍ਹਾਂ ਹੋਇਆ',
    updated: 'ਆਖ਼ਰੀ ਅਪਡੇਟ',
    tapOpen: 'ਪੂਰੀ ਜਾਣਕਾਰੀ ਦੇਖਣ ਲਈ ਟੈਪ ਕਰੋ',
    tapClose: 'ਲੁਕਾਉਣ ਲਈ ਟੈਪ ਕਰੋ',
    ready: 'ਤੁਹਾਡਾ ਫ਼ੋਨ ਤਿਆਰ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਕਾਨ ਤੋਂ ਲੈ ਜਾਓ।',
    returnedMsg: 'ਇਹ ਫ਼ੋਨ ਵਾਪਸ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਕੋਈ ਸਵਾਲ ਹੋਵੇ ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਦੁਕਾਨ ਤੇ ਸੰਪਰਕ ਕਰੋ।',
    problem: 'ਸਮੱਸਿਆ',
    receivedDate: 'ਜਮ੍ਹਾਂ ਕਰਨ ਦੀ ਤਾਰੀਖ਼',
    lastUpdated: 'ਆਖ਼ਰੀ ਅਪਡੇਟ',
    estDelivery: 'ਅਨੁਮਾਨਿਤ ਡਿਲੀਵਰੀ',
    noteRow: 'ਨੋਟ',
    progress: 'ਰਿਪੇਅਰ ਦੀ ਪ੍ਰਗਤੀ',
    st: {
      'Received': 'ਫ਼ੋਨ ਪ੍ਰਾਪਤ ਹੋਇਆ',
      'Diagnosing': 'ਜਾਂਚ ਹੋ ਰਹੀ ਹੈ',
      'Repair in Progress': 'ਰਿਪੇਅਰ ਚੱਲ ਰਹੀ ਹੈ',
      'Waiting for Part': 'ਪਾਰਟ ਦੀ ਉਡੀਕ',
      'Ready for Pickup': 'ਲੈਣ ਲਈ ਤਿਆਰ',
      'Delivered': 'ਡਿਲੀਵਰ ਹੋ ਗਿਆ',
      'Returned': 'ਵਾਪਸ ਕੀਤਾ ਗਿਆ'
    },
    desc: {
      'Received': 'ਤੁਹਾਡਾ ਫ਼ੋਨ ਸਾਨੂੰ ਮਿਲ ਗਿਆ ਹੈ',
      'Diagnosing': 'ਤੁਹਾਡੇ ਫ਼ੋਨ ਦੀ ਜਾਂਚ ਹੋ ਰਹੀ ਹੈ',
      'Repair in Progress': 'ਰਿਪੇਅਰ ਦਾ ਕੰਮ ਚੱਲ ਰਿਹਾ ਹੈ',
      'Waiting for Part': 'ਪਾਰਟ ਆਉਣ ਦੀ ਉਡੀਕ ਹੈ',
      'Ready for Pickup': 'ਫ਼ੋਨ ਤਿਆਰ ਹੈ, ਕਿਰਪਾ ਕਰਕੇ ਦੁਕਾਨ ਤੋਂ ਲੈ ਜਾਓ',
      'Delivered': 'ਫ਼ੋਨ ਸੌਂਪ ਦਿੱਤਾ ਗਿਆ ਹੈ',
      'Returned': 'ਫ਼ੋਨ ਵਾਪਸ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ'
    }
  }
};

// ---------- Chhote helper functions ----------
function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

let lang = 'en';
try {
  const saved = localStorage.getItem('preferredLang');
  if (saved && T[saved]) lang = saved;
} catch (e) {}

function t(key) {
  return (T[lang] && T[lang][key] != null) ? T[lang][key] : T.en[key];
}

function stLabel(s) {
  return (T[lang].st && T[lang].st[s]) || s;
}

function fmtDate(s) {
  if (!s) return '-';
  const p = String(s).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
}

function fmtDateTime(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString(LOCALE[lang] || 'en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return new Date(s).toLocaleString();
  }
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

// ---------- Screen par kya dikh raha hai (language badalne par dobara banane ke liye) ----------
let lastState = null;       // {kind:'msg', type, key}  ya  {kind:'data', data}
let openSet = new Set();    // kaun se repair card khule hain

function showKey(type, key) {
  lastState = { kind: 'msg', type: type, key: key };
  draw();
}

function draw() {
  if (!lastState) { $('result').innerHTML = ''; return; }
  if (lastState.kind === 'msg') {
    $('result').innerHTML = '<div class="msg ' + lastState.type + '">' + esc(t(lastState.key)) + '</div>';
  } else {
    renderData(lastState.data);
  }
}

// ---------- Language badalna ----------
function applyLang(l) {
  if (!T[l]) l = 'en';
  lang = l;
  try { localStorage.setItem('preferredLang', l); } catch (e) {}
  document.documentElement.lang = l;
  document.title = t('title');

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  document.querySelectorAll('.lb').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-lang') === l);
  });
  draw();
}

document.querySelectorAll('.lb').forEach(function (b) {
  b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
});

// ---------- Search ----------
let lastSearch = 0;

$('mobile').addEventListener('input', function () {
  $('mobile').value = $('mobile').value.replace(/\D/g, '');
});

$('trackForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const m = $('mobile').value.replace(/\D/g, '');

  if (!/^\d{10}$/.test(m)) {
    showKey('err', 'errInvalid');
    return;
  }

  // Bar bar tezi se search rokne ke liye
  const now = Date.now();
  if (now - lastSearch < 2500) {
    showKey('info', 'wait');
    return;
  }
  lastSearch = now;

  $('goBtn').disabled = true;
  showKey('load', 'searching');

  try {
    const { data, error } = await db.rpc('track_repairs', { p_mobile: m });
    if (error) throw error;

    if (!data || data.ok !== true) {
      if (data && data.error === 'busy') showKey('err', 'busy');
      else showKey('err', 'errInvalid');
    } else if (!data.repairs || data.repairs.length === 0) {
      showKey('info', 'none');
    } else {
      openSet = new Set([data.repairs[0].repair_code]);
      lastState = { kind: 'data', data: data };
      draw();
    }
  } catch (err) {
    showKey('err', 'techErr');
  }

  $('goBtn').disabled = false;
});

// ---------- Result dikhana ----------
function renderData(data) {
  const reps = data.repairs || [];
  let html = '<div class="hello">' +
    esc(t('hello').replace('{name}', data.first_name || '').replace('{n}', reps.length)) +
    '</div>';

  reps.forEach(function (r) {
    html += card(r, openSet.has(r.repair_code));
  });

  $('result').innerHTML = html;
}

function card(r, open) {
  const idx = STATUSES.indexOf(r.status);
  const when = {};
  (r.history || []).forEach(function (h) { when[h.status] = h.changed_at; });

  let h = '<div class="rep" data-code="' + esc(r.repair_code) + '">';
  h += '<button type="button" class="rep-head" aria-expanded="' + (open ? 'true' : 'false') + '">';
  h += '<div class="rep-top"><div>';
  h += '<div class="rep-code">' + esc(r.repair_code) + '</div>';
  h += '<div class="rep-model">' + esc(r.device_model) + '</div>';
  h += '</div><span class="st ' + statusClass(r.status) + '">' + esc(stLabel(r.status)) + '</span></div>';
  h += '<div class="rep-sub">' + esc(t('received')) + ': ' + esc(fmtDate(r.received_date)) +
       ' &bull; ' + esc(t('updated')) + ': ' + esc(fmtDateTime(r.updated_at)) + '</div>';
  h += '<div class="tap">' + esc(open ? t('tapClose') : t('tapOpen')) + '</div>';
  h += '</button>';

  h += '<div class="rep-body' + (open ? '' : ' hidden') + '">';

  if (r.status === 'Ready for Pickup') {
    h += '<div class="ready-banner">' + esc(t('ready')) + '</div>';
  }

  h += '<div style="margin-top:8px;">';
  if (r.problem) h += row(t('problem'), r.problem);
  h += row(t('receivedDate'), fmtDate(r.received_date));
  h += row(t('lastUpdated'), fmtDateTime(r.updated_at));
  if (r.estimated_delivery) h += row(t('estDelivery'), fmtDate(r.estimated_delivery));
  if (r.public_note) h += row(t('noteRow'), r.public_note);
  h += '</div>';

  if (r.status === 'Returned') {
    h += '<div class="returned-banner">' + esc(t('returnedMsg')) + '</div>';
    h += '</div></div>';
    return h;
  }

  h += '<div class="sec-title">' + esc(t('progress')) + '</div>';
  h += '<div class="tl">';
  STATUSES.forEach(function (s, i) {
    let cls = 'pending';
    if (i < idx) cls = 'done';
    else if (i === idx) cls = 'current';
    const isFinal = (s === 'Ready for Pickup' || s === 'Delivered') ? ' final' : '';
    h += '<div class="step ' + cls + isFinal + '">';
    h += '<div class="dot">' + (cls === 'done' ? '&#10003;' : '') + '</div>';
    h += '<div><div class="s-name">' + esc(stLabel(s)) + '</div>';
    h += '<div class="s-desc">' + esc((T[lang].desc && T[lang].desc[s]) || '') + '</div>';
    if (when[s] && cls !== 'pending') h += '<div class="s-time">' + esc(fmtDateTime(when[s])) + '</div>';
    h += '</div></div>';
  });
  h += '</div>';

  h += '</div></div>';
  return h;
}

function row(label, value) {
  return '<div class="info-row"><span class="l">' + esc(label) + '</span><span class="v">' + esc(value) + '</span></div>';
}

// Card kholna / band karna
$('result').addEventListener('click', function (e) {
  const head = e.target.closest('.rep-head');
  if (!head) return;
  const wrap = head.parentNode;
  const body = wrap.querySelector('.rep-body');
  const code = wrap.getAttribute('data-code');
  const isOpen = !body.classList.contains('hidden');
  body.classList.toggle('hidden', isOpen);
  head.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  head.querySelector('.tap').textContent = isOpen ? t('tapOpen') : t('tapClose');
  if (isOpen) openSet.delete(code); else openSet.add(code);
});

// Page khulte hi language lagao
applyLang(lang);

// Home page se number lekar aaye to apne aap search karo (?m=9876543210)
(function autoSearch() {
  const m = new URLSearchParams(window.location.search).get('m');
  if (!m || !/^\d{10}$/.test(m)) return;
  $('mobile').value = m;
  try { window.history.replaceState({}, '', window.location.pathname); } catch (e) {}
  $('trackForm').dispatchEvent(new Event('submit', { cancelable: true }));
})();
