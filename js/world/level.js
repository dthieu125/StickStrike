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
  /* ── 🪟 NỚI MAP THEO KHUNG NHÌN ──
   * Bản gốc (baseTiles) giữ nguyên. Khi khung nhìn rộng hơn map, hai bên
   * được đắp thêm cột bằng cách LẶP LẠI ô ở mép (cột 0 / cột cuối) —
   * sàn tiếp tục, kệ/khoang kéo dài nên không lộ khoảng trống.
   * Map vẫn vòng tròn: mọi toạ độ (spawn, glows, hazard, cây...) đều dời
   * +offsetX / +colOffset nên vẫn khớp tuyệt đối. */
  baseDef: null,       // mapDef gốc — refit() dùng lại
  baseTiles: null, baseRows: 0, baseCols: 0, basePxW: 0, basePxH: 0,
  baseGlows: [],
  baseSpawn: { x: 100, y: 100 },
  padL: 0, padR: 0, offsetX: 0, colOffset: 0,
  viewW: 0,            // bề rộng khung nhìn px đã áp (main.js ghi)

  load(def, viewW) {
    let rows = def.rows || def.build();

    // An toàn: đắp dòng ngắn cho đủ độ dài lớn nhất
    const maxLen = Math.max(...rows.map((r) => r.length));
    rows = rows.map((r) => r + '.'.repeat(maxLen - r.length));

    this.baseDef = def;
    this.baseTiles = rows.slice();
    this.baseRows = rows.length;
    this.baseCols = maxLen;
    this.basePxW = maxLen * this.T;
    this.basePxH = rows.length * this.T;
    this.baseGlows = (def.glows || []).slice();

    // điểm xuất phát GỐC (trước khi nới map) — ưu tiên 'P' trong map chữ
    let sp = { x: 100, y: 100 };
    for (let r = 0; r < rows.length; r++) {
      const c = rows[r].indexOf('P');
      if (c !== -1) { sp = { x: c * this.T, y: r * this.T }; break; }
    }
    if (def.playerSpawn) sp = { x: def.playerSpawn.x, y: def.playerSpawn.y };
    // map DM không có 'P'/playerSpawn (chơi SINH TỔN trên map DM) → dùng điểm spawn đội A
    else if (def.spawns && def.spawns.A && def.spawns.A[0]) {
      sp = { x: def.spawns.A[0][0], y: def.spawns.A[0][1] };
    }
    this.baseSpawn = sp;

    this.stains = null;
    this._rebuild(viewW || 0, 0);
  },

  /* 🪟 Đổi khung nhìn (kéo cửa sổ) → tính lại phần đắp 2 bên.
   * Trả về độ dời px (dx) để main.js dời người/quái/đạn/hazard theo. */
  refit(viewW) {
    if (!this.baseTiles) return 0;
    const oldPadL = this.padL;
    this._rebuild(viewW || 0, oldPadL);
    return this.padL - oldPadL;
  },

  /* Dựng lại tiles từ bản gốc + đắp 2 bên theo bề rộng khung nhìn.
   * oldPadL: phần đắp trái CŨ (px) — dùng để dời lớp vết máu cho khớp. */
  _rebuild(viewW, oldPadL) {
    const T = this.T;
    const VIEW = Config.VIEW || {};
    const room = VIEW.SIDE_ROOM || 0;

    // map phải rộng hơn khung nhìn ít nhất SIDE_ROOM (2 bên cộng lại)
    const want = viewW > 0 ? viewW + room : 0;
    const extraCols = Math.max(0, Math.ceil((want - this.basePxW) / T));
    const padLCols = Math.floor(extraCols / 2);
    const padRCols = extraCols - padLCols;

    this.tiles = this.baseTiles.map((r) => {
      const first = r.charAt(0) || '.';
      const last = r.charAt(r.length - 1) || '.';
      return first.repeat(padLCols) + r + last.repeat(padRCols);
    });
    this.rows = this.baseRows;
    this.cols = this.baseCols + padLCols + padRCols;
    this.pxW = this.cols * T;
    this.pxH = this.basePxH;
    this.colOffset = padLCols;
    this.padL = padLCols * T;
    this.padR = padRCols * T;
    this.offsetX = this.padL;
    this.viewW = viewW || 0;

    // hào quang + spawn dời theo phần đắp bên trái
    this.glows = this.baseGlows.map((g) => ({ ...g, x: g.x + this.offsetX }));
    this.spawn = { x: this.baseSpawn.x + this.offsetX, y: this.baseSpawn.y };

    // canvas vết máu — giữ vết cũ, dời ngang theo map
    const cv = document.createElement('canvas');
    cv.width = this.pxW;
    cv.height = this.pxH;
    const c2 = cv.getContext('2d');
    const dx = this.padL - (oldPadL || 0);
    if (this.stains && c2 && typeof c2.drawImage === 'function') c2.drawImage(this.stains, dx, 0);
    this.stains = cv;
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
    if (window.Trees && Trees.blocksShotAt(x, y)) return true;
    return window.Props ? Props.blocksShotAt(x, y) : false;
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

    // 🌌 THỊ SAI SAU (parallax): 2 lớp sao XA trôi chậm hơn + tinh vân màu mờ
    // — hệ số càng nhỏ = càng xa = trôi càng chậm, tạo chiều sâu không gian
    const layers = [
      { n: 90, fx: 0.45, fy: 0.25, col: '210, 200, 255' }, // sao xa tím nhạt
      { n: 70, fx: 0.70, fy: 0.35, col: '255, 235, 210' }, // sao gần hơn ánh ấm
    ];
    for (const L of layers) {
      const r2 = mulberry32(Math.round(L.fx * 1000));
      for (let i = 0; i < L.n; i++) {
        const sx = r2() * 2200, sy = r2() * 1300;
        const size = r2() < 0.8 ? 1 : 1.6;
        const tw = 0.25 + 0.55 * Math.abs(Math.sin(time * (0.3 + r2() * 0.4) + i * 1.7));
        const px = ((sx - this.camX * L.fx) % (viewW + 40) + viewW + 40) % (viewW + 40) - 20;
        const py = ((sy - this.camY * L.fy) % (viewH + 40) + viewH + 40) % (viewH + 40) - 20;
        ctx.fillStyle = `rgba(${L.col}, ${tw.toFixed(2)})`;
        ctx.fillRect(px, py, size, size);
      }
    }
    // ☁️ TINH VÂN: vệt sáng màu lớn trôi CỰC chậm — nền vũ trụ không còn trống trải
    const nebulae = [
      { x: 420, y: 220, r: 230, col: '90, 60, 160', fx: 0.3 },   // tím
      { x: 1500, y: 420, r: 190, col: '30, 110, 130', fx: 0.4 }, // teal
      { x: 2100, y: 160, r: 170, col: '150, 60, 90', fx: 0.35 }, // hồng sẫm
    ];
    for (const n of nebulae) {
      const px = ((n.x - this.camX * n.fx) % (viewW + 600) + viewW + 600) % (viewW + 600) - 300;
      const py = n.y - this.camY * 0.12;
      const g2 = ctx.createRadialGradient(px, py, 0, px, py, n.r);
      g2.addColorStop(0, `rgba(${n.col}, 0.10)`);
      g2.addColorStop(1, `rgba(${n.col}, 0)`);
      ctx.fillStyle = g2;
      ctx.fillRect(px - n.r, py - n.r, n.r * 2, n.r * 2);
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
