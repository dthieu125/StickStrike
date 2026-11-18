/* =========================================================
 * MAPEDIT — 🗺️ BẢN ĐỒ CỦA TÔI
 * Người chơi tự thiết kế map bằng file JSON:
 *   1. Tải MAP MẪU (hoặc xuất map đang chọn) → sửa lưới ô trong Notepad/VS Code
 *   2. NHẬP lại file .json vào game
 *   3. Map được kiểm tra hợp lệ, LƯU VĨNH VIỄN vào localStorage ('ss_maps')
 *      và xuất hiện trong ô chọn map ở menu chính.
 *
 * Lưới ô: '#' = tường đặc · '-' = bậc thềm 1 chiều · '.' = trống
 * Kích thước: 20-160 cột × 12-40 hàng (ô 32px) — chặn map khổng lồ làm lag.
 * ========================================================= */
window.MapEdit = {
  KEY: 'ss_maps',
  list: [],
  MAX_BYTES: 300 * 1024, // file JSON tối đa 300KB
  MIN_ROWS: 12, MAX_ROWS: 40,
  MIN_COLS: 20, MAX_COLS: 160,

  /* ── nạp các map đã lưu từ localStorage + đăng ký vào Maps ── */
  loadAll() {
    this.list = [];
    try {
      const arr = JSON.parse(localStorage.getItem(this.KEY) || '[]');
      if (Array.isArray(arr)) {
        for (const raw of arr) {
          const r = this._norm(raw, raw && raw.id);
          if (r.ok) { this.list.push(r.def); Maps[r.def.id] = r.def; }
        }
      }
    } catch (e) { this.list = []; }
    return this.list;
  },

  ids() { return this.list.map((m) => m.id); },
  has(id) { return this.list.some((m) => m.id === id); },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.list)); } catch (e) { /* bỏ qua */ }
  },

  /* ── map MẪU TRỐNG: sàn liền + vài khối/chướng ngại + spawn 2 đội ── */
  template() {
    const cols = 60, rows = 24;
    const g = Array.from({ length: rows }, () => Array(cols).fill('.'));
    const solid = (x, y, w, h) => {
      for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) {
        if (g[r] && c >= 0 && c < cols) g[r][c] = '#';
      }
    };
    const grate = (x, y, w) => {
      for (let c = x; c < x + w; c++) if (g[y] && c >= 0 && c < cols) g[y][c] = '-';
    };
    solid(0, 22, cols, 2);        // sàn chính (2 hàng đặc)
    solid(8, 20, 4, 2);           // bậc lên
    solid(15, 17, 4, 5);          // container cao 5 ô (leo được từ bậc 3 ô)
    solid(24, 20, 3, 2);          // thùng giữa
    solid(33, 19, 4, 3);          // khối 3 ô
    solid(40, 17, 5, 5);          // container cao phải
    solid(47, 20, 4, 2);          // thùng phải
    grate(12, 13, 10);            // giàn giáo 1 chiều (nhảy xuyên từ dưới lên)
    grate(26, 12, 8);
    grate(38, 13, 10);
    return {
      format: 'stickstrike-map',
      version: 1,
      help: 'Ký hiệu: # tường đặc · - bậc thềm 1 chiều · . trống · P chỗ người chơi xuất phát (tuỳ chọn). ' +
        'Sửa rows (mỗi phần tử = 1 hàng), spawns.A (bạn) và spawns.B (địch). ' +
        'Sàn nên ở hàng 22-23, khối chạm sàn cao tối đa 5 ô.',
      name: '🗺️ Map mẫu trống',
      mode: 'dm',
      rows: g.map((r) => r.join('')),
      spawns: { A: [[96, 652], [220, 652]], B: [[1808, 652], [1700, 652]] },
      hazards: [],
      trees: [],
    };
  },

  /* ── xuất MAP ĐANG CHỌN ra file mẫu để người chơi sửa tiếp ── */
  exportCurrent(mapId) {
    const def = Maps[mapId];
    if (!def) return null;
    let rows = def.rows;
    if (!rows) { try { rows = def.build(); } catch (e) { rows = null; } }
    if (!rows) return null;
    const tpl = this.template();
    return {
      format: 'stickstrike-map',
      version: 1,
      help: tpl.help,
      name: def.name,
      mode: 'dm',
      rows: rows.slice(),
      spawns: {
        A: (def.spawns && def.spawns.A ? def.spawns.A : tpl.spawns.A).map((s) => [s[0], s[1]]),
        B: (def.spawns && def.spawns.B ? def.spawns.B : tpl.spawns.B).map((s) => [s[0], s[1]]),
      },
      hazards: (def.hazards || []).map((h) => Object.assign({}, h)),
      trees: (def.trees || []).map((t) => Object.assign({}, t)),
    };
  },

  /* ── kiểm tra + chuẩn hoá 1 map JSON ──
   * Trả { ok:true, def } hoặc { ok:false, error } (error là câu tiếng Việt cho người chơi) */
  _norm(raw, forcedId) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'File không chứa đối tượng map JSON.' };
    }
    const src = raw.rows || raw.tiles;
    if (!Array.isArray(src) || !src.length) {
      return { ok: false, error: 'Thiếu mảng "rows" (mỗi phần tử là 1 hàng bản đồ).' };
    }
    if (src.length < this.MIN_ROWS || src.length > this.MAX_ROWS) {
      return { ok: false, error: 'Số hàng phải từ ' + this.MIN_ROWS + ' đến ' + this.MAX_ROWS + ' (đang ' + src.length + ').' };
    }
    if (!src.every((r) => typeof r === 'string')) {
      return { ok: false, error: 'Mỗi hàng trong "rows" phải là chuỗi ký tự.' };
    }
    const maxLen = Math.max(...src.map((r) => r.length));
    if (maxLen < this.MIN_COLS || maxLen > this.MAX_COLS) {
      return { ok: false, error: 'Bề ngang phải từ ' + this.MIN_COLS + ' đến ' + this.MAX_COLS + ' ký tự (đang ' + maxLen + ').' };
    }
    // chuẩn hoá: khoảng trắng → trống; chỉ cho phép # - . (P = điểm spawn người chơi)
    const clean = src.map((r) => r.replace(/ /g, '.'));
    let pSpawn = null;
    for (let i = 0; i < clean.length; i++) {
      if (!/^[.#\-P]*$/.test(clean[i])) {
        return { ok: false, error: 'Hàng ' + (i + 1) + ' có ký tự lạ — chỉ dùng # (tường), - (bậc), . (trống), P (spawn).' };
      }
      if (!pSpawn) {
        const pc = clean[i].indexOf('P');
        if (pc !== -1) {
          const T0 = Config.TILE;
          pSpawn = { x: pc * T0, y: i * T0 };
        }
      }
    }
    const grid = clean.map((r) => r.replace(/P/g, '.') + '.'.repeat(maxLen - r.length));
    const T = Config.TILE;
    const W = maxLen * T, H = grid.length * T;

    // spawn: lọc điểm hợp lệ; không có → điểm mặc định 2 mép
    const sp = raw.spawns || {};
    const fixSpawn = (arr, defX) => {
      const out = [];
      if (Array.isArray(arr)) {
        for (const s of arr) {
          if (!Array.isArray(s) || s.length < 2) continue;
          const x = Math.round(+s[0]), y = Math.round(+s[1]);
          if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= W && y >= 0 && y <= H + 60) out.push([x, y]);
        }
      }
      if (!out.length) out.push([defX, (grid.length - 2) * T - 52]);
      return out;
    };

    // hazard: chỉ nhận loại hợp lệ, cột trong map
    const hazards = [];
    if (Array.isArray(raw.hazards)) {
      for (const h of raw.hazards) {
        if (!h) continue;
        const c = Math.round(+h.c);
        if (!Number.isFinite(c) || c <= 0 || c >= maxLen - 1) continue;
        if (h.kind === 'gas') hazards.push({ kind: 'gas', c });
        else if (h.kind === 'zap') {
          const c2 = Math.round(+h.c2);
          if (Number.isFinite(c2) && c2 > c && c2 < maxLen) hazards.push({ kind: 'zap', c, c2 });
        }
      }
    }
    // cây: cột + số ô cao hợp lệ
    const trees = [];
    if (Array.isArray(raw.trees)) {
      for (const t of raw.trees) {
        if (!t) continue;
        const c = Math.round(+t.c), hh = Math.round(+t.h);
        if (Number.isFinite(c) && Number.isFinite(hh) && c > 0 && c < maxLen - 1 && hh > 0 && hh < 12) {
          trees.push({ c, h: hh });
        }
      }
    }

    const id = forcedId || ('my_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36));
    let name = String(raw.name || '🗺️ Map của tôi').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) name = '🗺️ Map của tôi';

    return {
      ok: true,
      def: {
        id, name, mode: 'dm', rows: grid,
        playerSpawn: pSpawn || undefined,
        spawns: { A: fixSpawn(sp.A, 96), B: fixSpawn(sp.B, maxLen * T - 96) },
        hazards, trees,
      },
    };
  },

  /* ── nhập map từ text JSON (người chơi chọn file) ── */
  importText(text) {
    if (typeof text !== 'string') return { ok: false, error: 'Không đọc được nội dung file.' };
    if (text.length > this.MAX_BYTES) {
      return { ok: false, error: 'File quá lớn (tối đa ' + Math.round(this.MAX_BYTES / 1024) + 'KB).' };
    }
    let raw;
    try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: 'File không phải JSON hợp lệ.' }; }
    const r = this._norm(raw);
    if (!r.ok) return r;

    this.list.push(r.def);
    Maps[r.def.id] = r.def;
    this.save();

    // thêm vào ô chọn map + chọn luôn map vừa nhập
    if (window.Menu && Array.isArray(Menu.maps)) {
      if (!Menu.maps.includes(r.def.id)) Menu.maps.push(r.def.id);
      Menu.mapIndex = Menu.maps.length - 1;
      if (typeof Menu._updateMapName === 'function') Menu._updateMapName();
    }
    return { ok: true, def: r.def };
  },

  /* ── xoá map tự tạo ── */
  remove(id) {
    this.list = this.list.filter((m) => m.id !== id);
    delete Maps[id];
    this.save();
    if (window.Menu && Array.isArray(Menu.maps)) {
      const i = Menu.maps.indexOf(id);
      if (i >= 0) Menu.maps.splice(i, 1);
      if (Menu.mapIndex >= Menu.maps.length) Menu.mapIndex = Math.max(0, Menu.maps.length - 1);
      if (typeof Menu._updateMapName === 'function') Menu._updateMapName();
    }
  },

  /* ── tải file .json về máy (trình duyệt) ── */
  download(obj, filename) {
    try {
      const txt = JSON.stringify(obj, null, 2);
      const blob = new Blob([txt], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'stickstrike-map.json';
      if (document.body) document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { URL.revokeObjectURL(url); if (a.remove) a.remove(); else if (a.parentNode) a.parentNode.removeChild(a); } catch (e) { /* bỏ qua */ }
      }, 800);
      return true;
    } catch (e) {
      return false;
    }
  },
};
