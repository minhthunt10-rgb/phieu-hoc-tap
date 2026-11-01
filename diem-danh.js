// ĐIỂM DANH TRỢ GIẢNG – dán link Web app Apps Script (apps-script/diem-danh.gs) vào đây.
// Để trống = chế độ thử: dữ liệu lưu trong máy, mật khẩu của cô là 1234.
var DD_URL = 'https://script.google.com/macros/s/AKfycbx-C1ww--MTKMQXTNWNrcto5rVAdu5Kb5F8pJKBSSLcG632AvIM47N3sZYUeVSqDtV6lg/exec';

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var LS_TA = 'gwe-dd-ta', LS_CO = 'gwe-dd-co', LS_DEMO = 'gwe-dd-demo-v1';
  var me = null, co = null, coData = null, buoi = 'Tối';   // chỉ dạy buổi tối
  var GIO_TOI = ['18:00', '21:00'];

  if (window.LOGO) $('appLogo').src = window.LOGO;
  if (!DD_URL) $('demoNote').hidden = false;

  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 2600); }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function viDate(s) { var p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function show(v) { ['v-login', 'v-ta', 'v-co'].forEach(function (x) { $(x).classList.toggle('on', x === v); }); }

  // ---------- Gọi máy chủ (Apps Script) hoặc bản thử trong máy ----------
  function api(action, data) {
    data.action = action;
    if (!DD_URL) return demo(data);
    return fetch(DD_URL, { method: 'POST', body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (!r.ok) throw new Error(r.error || 'Có lỗi'); return r; });
  }

  function sha(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.from(new Uint8Array(b)).map(function (x) { return pad16(x); }).join('');
    });
    function pad16(x) { return ('0' + x.toString(16)).slice(-2); }
  }

  // Bản thử: cùng quy tắc với diem-danh.gs
  function demo(d) {
    var db = load(LS_DEMO) || { tas: [], recs: [] };
    var fail = function (m) { return Promise.reject(new Error(m)); };
    var done = function (o) { save(LS_DEMO, db); o.ok = true; return Promise.resolve(o); };
    var find = function (n) { return db.tas.filter(function (t) { return norm(t.name) === norm(n); })[0]; };
    var isCo = function () { return String(d.pw) === '1234'; };
    return sha(norm(d.name) + '|' + d.pw).then(function (h) {
      var ta = find(d.name);
      var taOk = ta && ta.hash === h && ta.status !== 'Nghỉ';
      switch (d.action) {
        case 'login': return taOk ? done({ name: ta.name }) : fail(ta && ta.status === 'Nghỉ' ? 'Tài khoản này đã tạm khoá.' : 'Sai tên hoặc mật khẩu.');
        case 'checkin':
          if (!taOk) return fail('Sai tên hoặc mật khẩu.');
          if (db.recs.some(function (x) { return norm(x.name) === norm(ta.name) && x.date === d.date && x.buoi === d.buoi && x.status !== 'Từ chối'; }))
            return fail('Đã điểm danh buổi ' + d.buoi + ' ngày ' + viDate(d.date) + ' rồi.');
          var id = Math.random().toString(16).slice(2, 10);
          db.recs.push({ id: id, sent: new Date().toLocaleString('vi-VN'), name: ta.name, date: d.date, buoi: d.buoi, tin: d.tin, tout: d.tout,
            hours: d.hours, lop: d.lop, note: d.note, status: 'Chờ duyệt', reviewed: '', reason: '' });
          return done({ id: id });
        case 'mine': return taOk ? done({ records: db.recs.filter(function (x) { return norm(x.name) === norm(ta.name); }) }) : fail('Sai tên hoặc mật khẩu.');
        case 'admin': return isCo() ? done({ tas: db.tas.map(function (t) { return { name: t.name, status: t.status, created: t.created }; }), records: db.recs }) : fail('Sai mật khẩu của cô.');
        case 'review':
          if (!isCo()) return fail('Sai mật khẩu của cô.');
          var r = db.recs.filter(function (x) { return x.id === d.id; })[0];
          if (!r) return fail('Không tìm thấy dòng điểm danh.');
          r.status = d.status; r.reviewed = new Date().toLocaleString('vi-VN'); r.reason = d.reason || '';
          return done({});
        case 'ta_save':
          if (!isCo()) return fail('Sai mật khẩu của cô.');
          var t = find(d.name);
          return sha(norm(d.name) + '|' + d.tapw).then(function (h2) {
            if (t) t.hash = h2; else db.tas.push({ name: String(d.name).trim(), hash: h2, status: 'Đang làm', created: new Date().toLocaleString('vi-VN') });
            return done({});
          });
        case 'ta_status':
          if (!isCo()) return fail('Sai mật khẩu của cô.');
          if (!find(d.name)) return fail('Không tìm thấy trợ giảng.');
          find(d.name).status = d.status; return done({});
      }
      return fail('Lệnh không hợp lệ.');
    });
  }

  function busy(btn, on) { btn.disabled = on; btn.style.opacity = on ? .6 : 1; }

  // ---------- Đăng nhập ----------
  var mode = 'ta';
  function setMode(m) {
    mode = m;
    $('lgTitle').textContent = m === 'co' ? 'Cô Minh Thư đăng nhập' : 'Trợ giảng đăng nhập';
    $('lgTA').hidden = m === 'co'; $('lgHint').hidden = m === 'co';
    $('toCo').hidden = m === 'co'; $('toTA').hidden = m !== 'co';
    $('lgPw').value = '';
  }
  $('toCo').onclick = function (e) { e.preventDefault(); setMode('co'); };
  $('toTA').onclick = function (e) { e.preventDefault(); setMode('ta'); };
  $('lgPw').onkeydown = function (e) { if (e.key === 'Enter') $('lgGo').click(); };

  $('lgGo').onclick = function () {
    var pw = $('lgPw').value, btn = this;
    if (!pw) return toast('Nhập mật khẩu');
    busy(btn, true);
    if (mode === 'co') {
      api('admin', { pw: pw }).then(function (r) {
        co = { pw: pw }; if ($('lgRemember').checked) save(LS_CO, co);
        openCo(r);
      }).catch(function (e) { toast(e.message); }).then(function () { busy(btn, false); });
    } else {
      var name = $('lgName').value.trim();
      if (!name) { busy(btn, false); return toast('Nhập tên trợ giảng'); }
      api('login', { name: name, pw: pw }).then(function (r) {
        me = { name: r.name, pw: pw }; if ($('lgRemember').checked) save(LS_TA, me);
        openTA();
      }).catch(function (e) { toast(e.message); }).then(function () { busy(btn, false); });
    }
  };

  // ---------- Trang trợ giảng ----------
  function hours() {
    var a = $('cIn').value.split(':'), b = $('cOut').value.split(':');
    if (a.length < 2 || b.length < 2) return 0;
    var m = (+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]);
    return m > 0 ? Math.round(m / 60 * 100) / 100 : 0;
  }
  function calc() { $('cHours').textContent = hours(); }
  $('cIn').oninput = $('cOut').oninput = calc;

  function resetForm() {
    $('cDate').value = today();
    $('cIn').value = GIO_TOI[0]; $('cOut').value = GIO_TOI[1]; calc();
    $('cNote').value = '';
  }

  var myRecs = [];
  function openTA() {
    show('v-ta'); $('taName').textContent = me.name;
    if (!$('mMonth').value) $('mMonth').value = today().slice(0, 7);
    resetForm(); loadMine();
  }
  function loadMine() {
    api('mine', { name: me.name, pw: me.pw }).then(function (r) { myRecs = r.records; renderMine(); })
      .catch(function (e) { toast(e.message); });
  }
  function byDate(a, b) { return (a.date + a.tin) < (b.date + b.tin) ? 1 : -1; }
  function card(x, extra) {
    var cls = x.status === 'Đã duyệt' ? 'ok' : x.status === 'Từ chối' ? 'no' : 'cho';
    return '<div class="item"><div class="t"><div><b>' + esc(viDate(x.date)) + '</b>' +
      (extra && extra.name ? ' – <b style="color:var(--green)">' + esc(x.name) + '</b>' : '') + '</div><span class="st ' + cls + '">' + esc(x.status) + '</span></div>' +
      '<div class="gio"><span>Giờ vào <b>' + esc(x.tin) + '</b></span><span>Giờ ra <b>' + esc(x.tout) + '</b></span><span>' + x.hours + ' giờ</span></div>' +
      (x.lop ? '<div class="m">' + esc(x.lop) + '</div>' : '') +
      (x.note ? '<div class="m">📝 ' + esc(x.note) + '</div>' : '') +
      (x.reason ? '<div class="m" style="color:#b42318">Lý do: ' + esc(x.reason) + '</div>' : '') +
      (extra && extra.btns ? '<div class="btns"><button class="btn" data-ok="' + esc(x.id) + '">✓ Duyệt</button><button class="btn r" data-no="' + esc(x.id) + '">✗ Từ chối</button></div>' : '') +
      '</div>';
  }
  function renderMine() {
    var m = $('mMonth').value;
    var ok = myRecs.filter(function (x) { return x.status === 'Đã duyệt' && x.date.slice(0, 7) === m; }).sort(byDate);
    var wait = myRecs.filter(function (x) { return x.status !== 'Đã duyệt'; }).sort(byDate);
    $('sBuoi').textContent = ok.length;
    $('sGio').textContent = Math.round(ok.reduce(function (s, x) { return s + (+x.hours || 0); }, 0) * 100) / 100;
    $('sCho').textContent = wait.filter(function (x) { return x.status === 'Chờ duyệt'; }).length;
    $('taOk').innerHTML = ok.length ? ok.map(function (x) { return card(x); }).join('') : '<div class="empty">Tháng này chưa có buổi nào được duyệt.</div>';
    $('taWait').innerHTML = wait.length ? wait.map(function (x) { return card(x); }).join('') : '<div class="empty">Không có buổi nào đang chờ.</div>';
  }
  $('mMonth').onchange = renderMine;

  $('cSend').onclick = function () {
    var btn = this, h = hours();
    if (!$('cDate').value) return toast('Chọn ngày');
    if (!h) return toast('Giờ ra phải sau giờ vào');
    busy(btn, true);
    api('checkin', { name: me.name, pw: me.pw, date: $('cDate').value, buoi: buoi, tin: $('cIn').value, tout: $('cOut').value,
      hours: h, lop: $('cLop').value.trim(), note: $('cNote').value.trim() })
      .then(function () { toast('Đã gửi – chờ cô duyệt'); resetForm(); loadMine(); })
      .catch(function (e) { toast(e.message); }).then(function () { busy(btn, false); });
  };
  $('taOut').onclick = function () { me = null; save(LS_TA, null); setMode('ta'); show('v-login'); };

  // ---------- Trang của cô ----------
  function openCo(r) {
    coData = r; show('v-co');
    if (!$('coMonth').value) $('coMonth').value = today().slice(0, 7);
    renderCo();
  }
  function reloadCo() { return api('admin', { pw: co.pw }).then(function (r) { coData = r; renderCo(); }).catch(function (e) { toast(e.message); }); }
  $('coReload').onclick = function () { reloadCo().then(function () { toast('Đã tải lại'); }); };

  function renderCo() {
    var recs = coData.records;
    var wait = recs.filter(function (x) { return x.status === 'Chờ duyệt'; }).sort(function (a, b) { return -byDate(a, b); });
    $('nWait').textContent = wait.length;
    $('coWait').innerHTML = wait.length ? wait.map(function (x) { return card(x, { name: 1, btns: 1 }); }).join('') : '<div class="empty">Không có buổi nào chờ duyệt. 🎉</div>';

    var sel = $('coTA'), cur = sel.value;
    sel.innerHTML = '<option value="">Tất cả trợ giảng</option>' + coData.tas.map(function (t) { return '<option>' + esc(t.name) + '</option>'; }).join('');
    sel.value = cur;
    var m = $('coMonth').value, who = sel.value;
    var ok = recs.filter(function (x) { return x.status === 'Đã duyệt' && x.date.slice(0, 7) === m && (!who || norm(x.name) === norm(who)); }).sort(function (a, b) { return -byDate(a, b); });
    var tot = {};
    ok.forEach(function (x) {
      var t = tot[x.name] || (tot[x.name] = { n: 0, h: 0 });
      t.n++; t.h += +x.hours || 0;
    });
    var names = Object.keys(tot);
    $('coTotal').innerHTML = '<tr><th>Trợ giảng</th><th>Số buổi tối</th><th>Tổng giờ</th></tr>' +
      (names.length ? names.map(function (n) { var t = tot[n]; return '<tr><td><b>' + esc(n) + '</b></td><td><b>' + t.n + '</b></td><td><b>' + Math.round(t.h * 100) / 100 + '</b></td></tr>'; }).join('')
        : '<tr><td colspan="3" class="empty">Chưa có buổi nào được duyệt trong tháng.</td></tr>');
    $('coDetail').innerHTML = '<tr><th>Ngày</th><th>Trợ giảng</th><th>Giờ vào</th><th>Giờ ra</th><th>Số giờ</th><th>Lớp / công việc</th><th></th></tr>' +
      ok.map(function (x) { return '<tr><td>' + esc(viDate(x.date)) + '</td><td>' + esc(x.name) + '</td><td><b style="color:var(--orange)">' + esc(x.tin) + '</b></td><td>' + esc(x.tout) + '</td><td>' + x.hours + '</td><td>' + esc(x.lop) + '</td><td><button class="btn r" style="padding:4px 8px;font-size:12px" data-undo="' + esc(x.id) + '">Bỏ duyệt</button></td></tr>'; }).join('');

    $('taList').innerHTML = '<tr><th>Trợ giảng</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr>' +
      (coData.tas.length ? coData.tas.map(function (t) {
        var off = t.status === 'Nghỉ';
        return '<tr><td><b>' + esc(t.name) + '</b></td><td><span class="st ' + (off ? 'no' : 'ok') + '">' + esc(t.status || 'Đang làm') + '</span></td><td>' + esc(t.created) + '</td>' +
          '<td><button class="btn g" style="padding:4px 10px;font-size:12px" data-tg="' + esc(t.name) + '" data-s="' + (off ? 'Đang làm' : 'Nghỉ') + '">' + (off ? 'Mở lại' : 'Khoá') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="empty">Chưa có trợ giảng. Thêm ở trên.</td></tr>');
  }
  $('coMonth').onchange = $('coTA').onchange = renderCo;

  document.querySelector('#v-co nav').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
    [].forEach.call(document.querySelectorAll('.cot'), function (c) { c.hidden = c.id !== b.dataset.t; });
  };

  function review(id, status, reason) {
    return api('review', { pw: co.pw, id: id, status: status, reason: reason || '' }).then(function () {
      coData.records.forEach(function (x) { if (x.id === id) { x.status = status; x.reason = reason || ''; } });
      renderCo(); toast(status === 'Đã duyệt' ? 'Đã duyệt' : status === 'Từ chối' ? 'Đã từ chối' : 'Đã chuyển về chờ duyệt');
    }).catch(function (e) { toast(e.message); });
  }
  $('v-co').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.ok) { busy(t, true); review(t.dataset.ok, 'Đã duyệt'); }
    else if (t.dataset.no) { var why = prompt('Lý do từ chối (trợ giảng sẽ thấy):', ''); if (why !== null) review(t.dataset.no, 'Từ chối', why); }
    else if (t.dataset.undo) { if (confirm('Chuyển buổi này về "Chờ duyệt"?')) review(t.dataset.undo, 'Chờ duyệt'); }
    else if (t.dataset.tg) {
      api('ta_status', { pw: co.pw, name: t.dataset.tg, status: t.dataset.s }).then(reloadCo).catch(function (er) { toast(er.message); });
    }
  });
  $('nSave').onclick = function () {
    var n = $('nName').value.trim(), p = $('nPw').value.trim(), btn = this;
    if (!n || p.length < 4) return toast('Cần tên và mật khẩu ít nhất 4 ký tự');
    busy(btn, true);
    api('ta_save', { pw: co.pw, name: n, tapw: p }).then(function () {
      toast('Đã lưu tài khoản ' + n); $('nName').value = ''; $('nPw').value = ''; return reloadCo();
    }).catch(function (e) { toast(e.message); }).then(function () { busy(btn, false); });
  };
  $('coOut').onclick = function () { co = null; save(LS_CO, null); setMode('ta'); show('v-login'); };

  // ---------- Mở trang: tự đăng nhập nếu đã ghi nhớ ----------
  var savedCo = load(LS_CO), savedTA = load(LS_TA);
  if (location.hash === '#co') setMode('co');
  if (savedCo && location.hash === '#co') { co = savedCo; api('admin', { pw: co.pw }).then(openCo).catch(function () { save(LS_CO, null); }); }
  else if (savedTA) { me = savedTA; api('login', { name: me.name, pw: me.pw }).then(openTA).catch(function () { save(LS_TA, null); }); }
})();
