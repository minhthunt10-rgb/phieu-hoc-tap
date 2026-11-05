/* ================= ĐỒNG BỘ NHIỀU MÁY – Google Sheet "Quản lý học sinh" =================
   Mỗi trang vẫn lưu trong máy (localStorage) như cũ để mất mạng vẫn dùng được;
   sync.js đưa thay đổi lên Sheet chung và lấy thay đổi của máy khác về.
   - Mỗi bản ghi có id + updated (mốc giờ sửa). Bản sửa sau cùng thắng.
   - Xoá = gửi "bia mộ" {id, deleted:1} để máy khác cũng xoá.
   - HS trùng tên giữa các máy được gộp vào 1 id (id trên Sheet).
   SYNC_URL trống = chế độ thử: "máy chủ" giả nằm trong localStorage của trình duyệt. */
var SYNC_URL = 'https://script.google.com/macros/s/AKfycbyTeTQOBHySLBjd1FTP5st8gnoOdeK92T2gXVAsjWSyVsH4mxZkIDnXtlwO6p6MRQya/exec';

(function () {
  const CODE_KEY = 'gwe-sync-code', DEMO_KEY = 'gwe-sync-demo-server';
  const nameKey = n => String(n || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  const getCode = () => { try { return localStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; } };
  const setCode = c => { try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY); } catch (e) {} };

  /* ---------- "máy chủ" giả cho chế độ thử (cùng luật với Apps Script) ---------- */
  function demoCall(d) {
    let srv = {}; try { srv = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}'); } catch (e) {}
    if (d.action === 'pull') {
      const data = {}; Object.keys(srv).forEach(k => data[k] = Object.values(srv[k]));
      return Promise.resolve({ ok: true, data });
    }
    let saved = 0;
    Object.keys(d.items || {}).forEach(k => {
      srv[k] = srv[k] || {};
      d.items[k].forEach(r => { const o = srv[k][r.id]; if (o && o.updated > r.updated) return;
        srv[k][r.id] = r.deleted ? { id: r.id, deleted: 1, updated: r.updated } : r; saved++; });
    });
    localStorage.setItem(DEMO_KEY, JSON.stringify(srv));
    return new Promise(res => setTimeout(() => res({ ok: true, saved }), 250));
  }
  function call(d) {
    if (!SYNC_URL) return demoCall(d);
    return fetch(SYNC_URL, { method: 'POST', body: JSON.stringify({ ...d, code: getCode() }) }).then(r => r.json());
  }

  /* opts: app, cols[], get(col)→mảng, set(col,mảng), save(), onChange(), remap(cũ,mới) */
  window.createSync = function (opts) {
    const DEL_KEY = 'gwe-sync-del-' + opts.app, KNOWN_KEY = 'gwe-sync-known-' + opts.app;
    let dels = {}, known = {};
    try { dels = JSON.parse(localStorage.getItem(DEL_KEY) || '{}'); } catch (e) {}
    try { known = JSON.parse(localStorage.getItem(KNOWN_KEY) || '{}'); } catch (e) {}
    const keep = () => { try { localStorage.setItem(DEL_KEY, JSON.stringify(dels)); localStorage.setItem(KNOWN_KEY, JSON.stringify(known)); } catch (e) {} };
    let running = false, again = false, timer = null, state = 'idle', lastOk = 0, pulled = false;

    /* ---------- nút trạng thái trên đầu trang ---------- */
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sync-btn';
    (document.querySelector('header.app') || document.body).appendChild(btn);
    btn.onclick = () => {
      if (SYNC_URL && !getCode()) { askCode(); return; }
      if (state === 'badcode') { askCode(); return; }
      run(true);
    };
    function show(s, txt) { state = s; btn.dataset.s = s; btn.textContent = txt; }
    function askCode() {
      const c = (prompt('Nhập MÃ NHÓM cô Minh Thư đưa (chỉ cần nhập 1 lần trên máy này):', getCode()) || '').trim();
      if (!c) return; setCode(c); run(true);
    }
    const hhmm = t => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    function pendingList() {
      const items = {}; let n = 0;
      opts.cols.forEach(col => {
        const kn = known[col] || {}, list = [];
        opts.get(col).forEach(r => {
          if (!r.updated) r.updated = Number(r.created) || 1;
          if (!(r.id in kn) || r.updated > kn[r.id]) list.push(r);
        });
        Object.keys(dels[col] || {}).forEach(id => list.push({ id, deleted: 1, updated: dels[col][id] }));
        if (list.length) { items[col] = list; n += list.length; }
      });
      return { items, n };
    }

    function merge(data) {
      let changed = false;
      opts.cols.forEach(col => {
        const remote = data[col] || [], kn = known[col] = {};
        let arr = opts.get(col).slice();
        remote.forEach(r => {
          kn[r.id] = r.updated || 0;
          if ((dels[col] || {})[r.id]) return; // máy này đã xoá, chờ gửi
          const i = arr.findIndex(x => x.id === r.id), l = arr[i];
          if (r.deleted) { if (l && (l.updated || 0) <= r.updated) { arr.splice(i, 1); changed = true; } return; }
          if (!l) {
            // HS trùng tên mà máy này chưa từng gửi lên → gộp vào id trên Sheet
            if (col === 'students') {
              const j = arr.findIndex(x => nameKey(x.name) === nameKey(r.name) && !remote.some(y => y.id === x.id));
              if (j >= 0) { const old = arr[j].id; arr[j] = { ...arr[j], ...r }; remapAll(old, r.id); changed = true; return; }
            }
            arr.push(r); changed = true; return;
          }
          if (r.updated > (l.updated || 0)) { arr[i] = r; changed = true; }
        });
        opts.set(col, arr);
      });
      return changed;
    }
    function remapAll(oldId, newId) {
      opts.cols.forEach(col => { if (col !== 'students') opts.get(col).forEach(x => { if (x.studentId === oldId) { x.studentId = newId; x.updated = Date.now(); } }); });
      opts.remap && opts.remap(oldId, newId);
    }

    async function run(manual) {
      if (SYNC_URL && !getCode()) { show('nocode', '🔑 Nhập mã nhóm'); if (manual) askCode(); return; }
      if (running) { again = true; return; }
      running = true; show('busy', '⏳ Đang đồng bộ…');
      try {
        const p = await call({ action: 'pull' });
        if (!p.ok) throw p;
        const changed = merge(p.data || {}); pulled = true;
        const { items, n } = pendingList();
        if (n) {
          const r = await call({ action: 'push', items });
          if (!r.ok) throw r;
          Object.keys(items).forEach(col => {
            known[col] = known[col] || {};
            items[col].forEach(x => { known[col][x.id] = x.updated; if (x.deleted && dels[col]) delete dels[col][x.id]; });
          });
        }
        keep(); opts.save();
        if (changed) opts.onChange && opts.onChange();
        lastOk = Date.now();
        show('ok', (SYNC_URL ? '☁️ Đã đồng bộ ' : '🧪 Chế độ thử · ') + hhmm(lastOk));
        if (manual) toast(n ? `Đã gửi ${n} thay đổi lên Sheet` : 'Dữ liệu đã khớp với Sheet chung');
      } catch (e) {
        if (e && e.code === 'badcode') { setCode(''); show('badcode', '🔑 Sai mã nhóm'); if (manual) toast('Sai mã nhóm – bấm nút 🔑 để nhập lại'); }
        else { const n = pendingList().n; show('err', n ? `⚠️ ${n} thay đổi chờ gửi` : '⚠️ Chưa nối được Sheet');
          if (manual) toast('Chưa gửi được (mất mạng?) – phiếu vẫn lưu trong máy, có mạng web tự gửi lại'); console.warn(e); }
      } finally {
        running = false;
        if (again) { again = false; run(); }
      }
    }
    const soon = () => { clearTimeout(timer); timer = setTimeout(run, 1200); };

    setTimeout(run, 300);
    setInterval(() => { if (document.visibilityState === 'visible') run(); }, 60000);
    addEventListener('online', () => run());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastOk > 20000) run(); });
    show('busy', '⏳ Đang đồng bộ…');

    return {
      /* gọi sau khi thêm/sửa 1 bản ghi */
      touch(col, rec) { rec.updated = Date.now(); soon(); },
      /* gọi sau khi xoá 1 bản ghi khỏi mảng của trang */
      remove(col, id) { (dels[col] = dels[col] || {})[id] = Date.now(); keep(); soon(); },
      now: () => run(true),
      get ready() { return pulled; }
    };
  };
})();
