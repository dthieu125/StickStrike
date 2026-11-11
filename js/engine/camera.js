/* =========================================================
 * CAMERA — bám theo người chơi, giới hạn trong map,
 * có sẵn rung màn hình (dùng ở giai đoạn 2 khi bắn).
 * ========================================================= */
window.Camera = {
  x: 0,      // góc trên-trái của khung nhìn (theo toạ độ map)
  y: 0,
  shake: 0,  // cường độ rung hiện tại

  // Đặt camera ngay lập tức vào vị trí theo mục tiêu (dùng lúc mới vào game)
  snapTo(target, viewW, viewH, level) {
    this.x = this._clampX(target.x + target.w / 2 - viewW / 2, viewW, level);
    this.y = this._clampY(target.y + target.h / 2 - viewH / 2, viewH, level);
  },

  // Bám mượt theo mục tiêu, gọi mỗi frame
  follow(target, viewW, viewH, level, dt) {
    const tx = target.x + target.w / 2 - viewW / 2;
    const ty = target.y + target.h / 2 - viewH / 2;

    // lerp: tiến dần về vị trí mục tiêu (0.001^dt ≈ mượt ~8 lần/giây)
    const k = 1 - Math.pow(0.0005, dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;

    this.x = this._clampX(this.x, viewW, level);
    this.y = this._clampY(this.y, viewH, level);
  },

  // Gọi để thêm rung (giai đoạn 2: súng lớn, nổ...)
  addShake(v) {
    this.shake = Math.min(20, this.shake + v);
  },

  // Dịch canvas về toạ độ camera (+ độ rung ngẫu nhiên)
  apply(ctx) {
    let ox = 0, oy = 0;
    if (this.shake > 0.1) {
      ox = (Math.random() * 2 - 1) * this.shake;
      oy = (Math.random() * 2 - 1) * this.shake;
    }
    this.shake *= 0.88; // tắt dần
    ctx.translate(-Math.round(this.x + ox), -Math.round(this.y + oy));
  },

  _clampX(x, viewW, level) {
    if (level.pxW <= viewW) return (level.pxW - viewW) / 2; // map nhỏ hơn màn hình → giữa
    return Math.max(0, Math.min(level.pxW - viewW, x));
  },
  _clampY(y, viewH, level) {
    if (level.pxH <= viewH) return (level.pxH - viewH) / 2;
    return Math.max(0, Math.min(level.pxH - viewH, y));
  },
};
