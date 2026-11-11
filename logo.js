// logo là file ảnh riêng (trình duyệt lưu đệm được, tải nhanh hơn chuỗi base64)
window.LOGO='logo.png';

/* Cuộn chuột khi đang ở ô số thì KHÔNG đổi số (cô yêu cầu 2026-11-11): bỏ chọn ô để trang cuộn bình thường */
document.addEventListener('wheel', function (e) {
  var el = document.activeElement;
  if (el && el.type === 'number' && e.target === el) el.blur();
}, { passive: true });
