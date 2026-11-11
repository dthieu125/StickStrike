/* =========================================================
 * LEVEL — nạp & vẽ bản đồ tilemap
 * Nạp từ Maps (dạng chữ hoặc sinh bằng code), kèm:
 *   • Lớp VẾT MÁU vẽ đè lên tường (bám theo map, tự xoá khi đổi map)
 *   • Điểm phát sáng trang trí (lò phản ứng...)
 *   • An toàn: dòng nào lệch độ dài tự động đắp cho đủ
 * ========================================================= */
window.Level = {
  T: window.Config.TILE,
  tiles: [],
  rows: 0, cols: 0, pxW: 0, pxH: 0,
  spawn: { x: 100, y: 100 },
  glows: [],
  stains: null,        // canvas vết máu/bám dính
  camX: 0, camY: 0,    // main.js gán mỗi frame (cho thị sai nền)

  load(def) {
    let rows = def.rows || def.build();

    // An toàn: đắp dòng ngắn cho đủ độ dài lớn nhất
    const maxLen = Math.max(...rows.map((r) => r.length));
    rows = rows.map((r) => r + '.'.repeat(maxLen - r.length));

    this.tiles = rows;
    this.rows = rows.length;
    this.cols = maxLen;
    this.pxW = this.cols * this.T;
    this.pxH = this.rows * this.T;
    this.glows = def.glows || [];

    // điểm xuất phát người chơi (ưu tiên ký tự 'P' trong map chữ)
    this.spawn = { x: 100, y: 100 };
    for (let r = 0; r < this.rows; r++) {
      const c = rows[r].indexOf('P');
      if (c !== -1) { this.spawn = { x: c * this.T, y: r * this.T }; break; }
    }
    if (def.playerSpawn) this.spawn = { x: def.playerSpawn.x, y: def.playerSpawn.y };

    // canvas vết máu — kích thước bằng map
    this.stains = document.createElement('canvas');
    this.stains.width = this.pxW;
    this.stains.height = this.pxH;
  },

  // vẽ vệt máu/bám dính lên lớp stains (gọi khi đạn trúng thịt)
  splatter(x, y, dirAngle, big) {
    if (!this.stains) return;
    const c = this.stains.getContext('2d');
    const n = big ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const a = dirAngle + (Math.random() - 0.5) * 1.4;
      const dist = 6 + Math.random() * (big ? 46 : 22);
      const sx = x + Math.cos(a) * dist;
      const sy = y + Math.sin(a) * dist;
      const r = 1.5 + Math.random() * (big ? 5 : 3);
      c.fillStyle = `rgba(${120 + Math.random() * 40 | 0}, 8, 18, ${0.35 + Math.random() * 0.3})`;
      c.beginPath();
      c.ellipse(sx, sy, r, r * (0.5 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
  },

  tileAt(col, row) {
    if (row < 0) return '#';
    if (row >= this.rows) return '.';
    // MAP VÒNG TRÒN ngang: cột ngoài biên → vòng vòng qua mép kia
    // (đi hết biên phải là ra biên trái — trái phải thông nhau)
    col = ((col % this.cols) + this.cols) % this.cols;
    return this.tiles[row][col];
  },

  /* Chênh lệch x NGẮN NHẤT theo map vòng tròn (dương = nên đi sang phải).
   * VD map rộng 1920: wrapDx(100 - 1890) = 130 — thay vì lội ngược 1790px
   * thì chỉ cần đi tiếp 130px là tới nơi (qua mép map). */
  wrapDx(dx) {
    const W = this.pxW;
    if (!(W > 0)) return dx;
    if (dx > W / 2) return dx - W;
    if (dx < -W / 2) return dx + W;
    return dx;
  },

  isSolid(c) { return c === '#'; },
  isOneWay(c) { return c === '-'; },

  /* Ô chặn ĐẠN/TẦM NHÌN: tường đậm lẫn bậc thềm 1 chiều đều không bắn xuyên
   * (người chơi vẫn nhảy xuyên qua bậc thềm bình thường — chỉ đạn là bị chặn).
   * Cây cối ở map rừng cũng chặn đạn + che mắt (nhưng đi len được). */
  blocksShotAt(x, y) {
    const ch = this.tileAt(Math.floor(x / this.T), Math.floor(y / this.T));
    if (ch === '#' || ch === '-') return true;
    return window.Trees ? Trees.blocksShotAt(x, y) : false;
  },

  rectOverlapsSolid(x, y, w, h) {
    const T = this.T;
    const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.01) / T);
    const r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.01) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.isSolid(this.tileAt(c, r))) {
          return { left: c * T, right: c * T + T, top: r * T, bottom: r * T + T };
        }
      }
    }
    return null;
  },

  oneWayUnder(x, y, w, h, prevBottom) {
    const T = this.T;
    const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.01) / T);
    const r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.01) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.isOneWay(this.tileAt(c, r))) {
          const top = r * T;
          if (prevBottom <= top + 1) return top;
        }
      }
    }
    return null;
  },

  /* ---------- PHẦN VẼ ---------- */

  drawBackground(ctx, viewW, viewH, time) {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, viewW, viewH);

    const rng = mulberry32(1337);
    for (let i = 0; i < Config.STAR_COUNT; i++) {
      const sx = rng() * 2200, sy = rng() * 1300;
      const size = rng() < 0.85 ? 1 : 2;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * (0.5 + rng()) + i));
      const px = ((sx - this.camX * 0.25) % (viewW + 40) + viewW + 40) % (viewW + 40) - 20;
      const py = ((sy - this.camY * 0.15) % (viewH + 40) + viewH + 40) % (viewH + 40) - 20;
      ctx.fillStyle = `rgba(200, 220, 255, ${tw.toFixed(2)})`;
      ctx.fillRect(px, py, size, size);
    }

    const planetX = 1150 - this.camX * 0.1;
    const planetY = 140 - this.camY * 0.06;
    const grad = ctx.createRadialGradient(planetX - 40, planetY - 40, 10, planetX, planetY, 150);
    grad.addColorStop(0, '#4a7fb5');
    grad.addColorStop(1, '#101f38');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(planetX, planetY, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(planetX, planetY, 190, 42, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  },

  draw(ctx, camX, camY, viewW, viewH, time) {
    const T = this.T;
    const c0 = Math.max(0, Math.floor(camX / T));
    const c1 = Math.min(this.cols - 1, Math.floor((camX + viewW) / T));
    const r0 = Math.max(0, Math.floor(camY / T));
    const r1 = Math.min(this.rows - 1, Math.floor((camY + viewH) / T));

    // hào quang trang trí (lò phản ứng...)
    for (const g of this.glows) {
      const pulse = 0.75 + 0.25 * Math.sin(time * 2.2);
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      grad.addColorStop(0, `rgba(${g.color}, ${0.30 * pulse})`);
      grad.addColorStop(1, `rgba(${g.color}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    }

    // lớp vết máu in trên tường
    if (this.stains) ctx.drawImage(this.stains, 0, 0);

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = this.tiles[r][c];
        const x = c * T, y = r * T;
        if (ch === '#') this._drawMetalTile(ctx, x, y, r > 0 && this.tiles[r - 1][c] === '#');
        else if (ch === '-') this._drawGrate(ctx, x, y);
      }
    }
  },

  _drawMetalTile(ctx, x, y, hasAbove) {
    ctx.fillStyle = '#262e3f';
    ctx.fillRect(x, y, this.T, this.T);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x + this.T - 2, y, 2, this.T);
    if (!hasAbove) {
      ctx.fillStyle = '#4c5a75';
      ctx.fillRect(x, y, this.T, 5);
      ctx.fillStyle = '#7889a8';
      ctx.fillRect(x, y, this.T, 2);
      ctx.fillStyle = '#8b9ab5';
      ctx.fillRect(x + 5, y + 9, 2, 2);
      ctx.fillRect(x + this.T - 7, y + 9, 2, 2);
    }
  },

  _drawGrate(ctx, x, y) {
    ctx.fillStyle = '#7c88a3';
    ctx.fillRect(x, y + 2, this.T, 6);
    ctx.fillStyle = '#aab4ca';
    ctx.fillRect(x, y + 2, this.T, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 2, y + 8, 2, 4);
    ctx.fillRect(x + this.T - 4, y + 8, 2, 4);
  },
};

// rng gieo hạt — dãy số "ngẫu nhiên" nhưng giống nhau mỗi lần chạy
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
