/* ===== Link khảo từ cho HS làm trên máy của con =====
   Bài khảo (nghĩa + đáp án) được nén vào sau dấu # của link, có xáo mã để HS không đọc được đáp án.
   Không cần máy chủ: HS nộp bài → web tự chấm → HS gửi lại "link kết quả" cho cô qua Zalo
   → cô bấm link đó, trang Khảo từ tự lưu điểm (máy nào cũng được). */
(function () {
  const K = 'gwe-ms-minh-thu-khao-tu';
  const xor = b => b.map((x, i) => x ^ K.charCodeAt(i % K.length));
  window.klEncode = o => {
    const b = xor([...new TextEncoder().encode(JSON.stringify(o))]);
    let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.slice(i, i + 8192));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  window.klDecode = s => {
    try {
      s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(s), b = xor([...bin].map(c => c.charCodeAt(0)));
      return JSON.parse(new TextDecoder().decode(new Uint8Array(b)));
    } catch (e) { return null; }
  };
  /* bản NÉN (link ngắn gần một nửa) – dùng khoá #z= (bài) và #kz= (kết quả); khoá cũ #de= / #kq= vẫn mở được */
  const b64 = b => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.slice(i, i + 8192));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const pipe = (u8, t) => new Response(new Blob([u8]).stream().pipeThrough(t)).arrayBuffer().then(x => new Uint8Array(x));
  window.klZip = typeof CompressionStream === 'function';
  window.klEncodeZ = async o => b64(xor([...await pipe(new TextEncoder().encode(JSON.stringify(o)), new CompressionStream('deflate-raw'))]));
  window.klDecodeZ = async s => {
    try {
      const bin = atob(String(s || '').replace(/-/g, '+').replace(/_/g, '/'));
      const u8 = new Uint8Array(xor([...bin].map(c => c.charCodeAt(0))));
      return JSON.parse(new TextDecoder().decode(await pipe(u8, new DecompressionStream('deflate-raw'))));
    } catch (e) { return null; }
  };
  /* tạo link: nén nếu trình duyệt hỗ trợ, không thì dùng kiểu cũ */
  window.klMake = async (page, key, zkey, o) => klZip ? klUrl(page, zkey + '=' + await klEncodeZ(o)) : klUrl(page, key + '=' + klEncode(o));
  /* đọc link: tự nhận kiểu nén hay kiểu cũ */
  window.klRead = async (key, zkey) => {
    const h = location.hash, mz = h.match(new RegExp('[#&]' + zkey + '=([^&]+)')), m = h.match(new RegExp('[#&]' + key + '=([^&]+)'));
    if (mz) return { found: true, data: await klDecodeZ(mz[1]) };
    if (m) return { found: true, data: klDecode(m[1]) };
    return { found: false, data: null };
  };
  /* chấm: không phân biệt hoa thường, bỏ "to ", chấp nhận đáp án a/b (giống trang Khảo từ) */
  window.klNorm = s => String(s || '').normalize('NFC').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/^to /, '');
  window.klCheck = (ans, en) => {
    const a = klNorm(ans); if (!a) return false;
    return String(en).split(/\s*[\/;,]\s*/).concat([en]).map(klNorm).filter(Boolean).includes(a);
  };
  /* đường dẫn trang cùng thư mục với trang đang mở */
  window.klUrl = (page, hash) => new URL(page, location.href).href.split('#')[0] + '#' + hash;
})();
