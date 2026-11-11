/* =========================================================
 * GAME LOOP — tim của game, chạy 60 lần/giây (60 FPS)
 * Mỗi frame: update(dt) cập nhật logic → render() vẽ hình.
 * dt = thời gian frame thực tế → game giống nhau trên mọi máy.
 *
 * AN TOÀN: requestAnimationFrame được đăng ký TRƯỚC khi update/render
 * + có try/catch → nếu một bug nào đó xảy ra, game KHÔNG chết im lặng
 * mà tiếp tục chạy và hiện lỗi lên màn hình (dễ báo lỗi và sửa).
 * ========================================================= */
window.GameLoop = {
  error: null, // lỗi gần nhất (main.js đọc để hiện toast)

  start(update, render) {
    let last = performance.now();

    const tick = (now) => {
      let dt = (now - last) / 1000; // giây
      last = now;

      // Chặn dt quá lớn (mở tab khác quay lại) → tránh "xuyên tường"
      if (dt > 1 / 20) dt = 1 / 20;

      // Đăng ký frame kế tiếp TRƯỚC — bug cũng không làm đứng vòng lặp
      requestAnimationFrame(tick);

      try {
        update(dt);
        render();
        window.Input.endFrame();
      } catch (err) {
        // chỉ "đập" lỗi 1 lần/giây thay vì 60 lần/giây cho đỡspam console
        if (!this.error || now - this.errorTime > 1000) {
          this.error = err;
          this.errorTime = now;
          console.error('Lỗi game:', err);
          this._paintError(err); // vẽ lỗi NGAY LÊN MÀN HÌNH — không cần bấm F12
        }
      }
    };

    requestAnimationFrame(tick);
  },

  /* Vẽ dải báo lỗi đỏ lên canvas — người chơi thấy ngay khi có bug */
  _paintError(err) {
    try {
      if (!this._ctx) {
        const cv = document.getElementById('game');
        this._ctx = cv ? cv.getContext('2d') : null;
      }
      const c = this._ctx;
      if (!c) return;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0); // bỏ qua camera
      c.fillStyle = 'rgba(70,0,10,0.9)';
      c.fillRect(0, 0, 1280, 96);
      c.strokeStyle = '#ff5a5a';
      c.strokeRect(2, 2, 1276, 92);
      c.fillStyle = '#ffd0d0';
      c.font = '700 20px Consolas, monospace';
      c.textAlign = 'left';
      c.fillText('🐞 Lỗi game (gửi dòng này cho dev): ' + err.message, 16, 34);
      c.font = '400 14px Consolas, monospace';
      c.fillText(String(err.stack || '').split('\n')[1] || '', 16, 62);
      c.restore();
    } catch (_) { /* trượt luôn thì thôi — tránh lỗi trong lỗi */ }
  },
};
