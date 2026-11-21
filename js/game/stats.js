/* =========================================================
 * STATS — 📊 THỐNG KÊ TRẬN ĐẤU (và tổng hợp vĩnh viễn)
 * • Mỗi trận: số phát bắn, phát trúng, sát thương, headshot, hạ gục,
 *   vật thể phá, số lần gục, vàng kiếm, súng dùng nhiều nhất.
 * • Tổng hợp nhiều trận lưu ở localStorage (ss_stats) để panel
 *   🏆 THÀNH TỰU hiển thị số liệu dài hạn.
 * • Chỉ tính cho NGƯỜI CHƠI MÁY NÀY (máy guest không mô phỏng
 *   nên không bật thống kê — tránh số liệu ảo).
 * ========================================================= */
window.Stats = {
  KEY: 'ss_stats',

  /* ── số liệu TRẬN HIỆN TẠI ── */
  active: false,
  mode: '',            // 'wave' | 'dm'
  shots: 0,            // số phát đã bắn (mỗi viên bi / mỗi tia)
  hits: 0,             // số phát TRÚNG ít nhất 1 mục tiêu
  damage: 0,           // tổng sát thương thực tế gây ra
  headshots: 0,
  kills: 0,
  destroyed: 0,        // thùng nổ / thùng gỗ / ống ga / cây
  deaths: 0,
  gold: 0,             // vàng kiếm trong trận
  weaponShots: {},     // id súng → số phát (chọn "súng dùng nhiều nhất")
  weaponHits: {},      // id súng → số phát trúng

  /* ── tổng hợp VĨNH VIỄN nhiều trận ── */
  lifetime: {
    matches: 0, shots: 0, hits: 0, damage: 0,
    headshots: 0, kills: 0, destroyed: 0, gold: 0,
  },

  last: null, // bản chụp trận VỪA XONG (để vẽ bảng kết quả)

  /* ─────────── LƯU / NẠP ─────────── */
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (s && typeof s === 'object') {
        for (const k in this.lifetime) {
          if (typeof s[k] === 'number' && isFinite(s[k])) this.lifetime[k] = s[k];
        }
      }
    } catch (e) { /* hỏng file lưu → dùng số 0 */ }
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.lifetime)); } catch (e) { /* bỏ qua */ }
  },

  /* ─────────── VÒNG ĐỜI 1 TRẬN ─────────── */
  start(mode) {
    // 🌐 máy guest chỉ áp snapshot — không tự mô phỏng nên không có số liệu thật
    this.active = !(window.Net && Net.mode === 'guest');
    this.mode = mode || '';
    this.shots = 0; this.hits = 0; this.damage = 0;
    this.headshots = 0; this.kills = 0; this.destroyed = 0; this.deaths = 0;
    this.gold = 0;
    this.weaponShots = {}; this.weaponHits = {};
    this.last = null;
  },

  /* dừng theo dõi (thoát giữa trận — KHÔNG cộng vào tổng vĩnh viễn) */
  stop() { this.active = false; },

  /* kết thúc trận: cộng vào tổng vĩnh viễn + cập nhật thành tựu.
   * Trả về bản chụp số liệu (hoặc null nếu trận này không theo dõi). */
  finish() {
    if (!this.active) return null;
    this.active = false;

    const L = this.lifetime;
    L.matches++;
    L.shots += this.shots;
    L.hits += this.hits;
    L.damage += this.damage;
    L.headshots += this.headshots;
    L.kills += this.kills;
    L.destroyed += this.destroyed;
    L.gold += this.gold;
    this.save();

    if (window.Achievements) {
      Achievements.best('headshot50', this.headshots); // kỷ lục headshot 1 trận
      Achievements.syncGold();
    }

    this.last = {
      mode: this.mode,
      shots: this.shots, hits: this.hits, damage: this.damage,
      headshots: this.headshots, kills: this.kills,
      destroyed: this.destroyed, deaths: this.deaths, gold: this.gold,
      acc: this.accuracy(), top: this.topWeapon(),
      weapons: this.weaponBars(),
    };
    return this.last;
  },

  /* ─────────── GHI NHẬN SỰ KIỆN ─────────── */
  _mine(owner) {
    const list = (window.Player && Player.list) || [];
    if (!owner || !list.length) return false;
    // người chơi MÁY NÀY = người 1 (Player.obj ở chế độ đơn / host co-op)
    return owner === list[0] || owner === Player.obj;
  },

  onShot(owner, w) {
    if (!this.active || !w || !this._mine(owner)) return;
    const id = w.id || '?';
    this.shots++;
    this.weaponShots[id] = (this.weaponShots[id] || 0) + 1;
  },

  /* 1 phát TRÚNG (tính 1 lần dù tia xuyên nhiều bia / vụ nổ trúng nhiều con) */
  onHit(owner, w, dmg, isHead) {
    if (!this.active || !(dmg > 0) || !this._mine(owner)) return;
    const id = (w && w.id) || '?';
    this.hits++;
    this.damage += Math.round(dmg);
    this.weaponHits[id] = (this.weaponHits[id] || 0) + 1;
    if (isHead) {
      this.headshots++;
      // 🏆 mốc "50 headshot trong MỘT trận" — cập nhật ngay khi vượt
      if (window.Achievements) Achievements.best('headshot50', this.headshots);
    }
  },

  onKill(m) {
    if (!this.active || !m) return;
    if (this._mine(m.lastHitBy)) this.kills++;
    // 👑 hạ boss lớn / boss nhỏ → tiến độ thành tựu Săn trùm
    if (window.Achievements && (m.type === 'boss' || m.type === 'elite_mini')) {
      Achievements.progress('boss3');
    }
  },

  /* ⚔️ ĐẤU ĐỘI: hạ gục NGƯỜI/BOT địch — owner = ai bắn phát cuối */
  onPlayerKill(owner) {
    if (!this.active || !this._mine(owner)) return;
    this.kills++;
  },

  onDestroy() {
    if (!this.active) return;
    this.destroyed++;
    if (window.Achievements) Achievements.progress('destroy20');
  },

  onDeath(p) {
    if (!this.active) return;
    const list = (window.Player && Player.list) || [];
    if (!list.length || p !== list[0]) return;
    this.deaths++;
    // 💀 gục giữa chừng → thành tựu "Bất bại" mất tiến độ (chưa mở khóa)
    if (this.mode === 'wave' && window.Achievements) Achievements.reset('flawless10');
  },

  onGold(n) {
    if (!this.active || !(n > 0)) return;
    this.gold += Math.round(n);
  },

  /* ─────────── TÍNH TOÁN / HIỂN THỊ ─────────── */
  accuracy() {
    if (!this.shots) return 0;
    // tia xuyên / vụ nổ có thể trúng nhiều mục tiêu 1 phát → kẹp trần 100%
    return Math.min(100, Math.round((Math.min(this.hits, this.shots) / this.shots) * 100));
  },

  topWeapon() {
    let best = null, n = 0;
    for (const id in this.weaponShots) {
      if (id === 'grenade') continue; // lựu đạn không phải "khẩu súng"
      if (this.weaponShots[id] > n) { n = this.weaponShots[id]; best = id; }
    }
    if (!best) return null;
    return { id: best, name: this._wName(best), shots: n };
  },

  _wName(id) {
    const w = (window.Weapons && Weapons.list)
      ? Weapons.list.find((x) => x.id === id) : null;
    return w ? w.name : id;
  },

  /* biểu đồ cột: 3 khẩu bắn nhiều nhất (độ dài = tỉ lệ so với khẩu đầu) */
  weaponBars(limit = 3) {
    const arr = [];
    for (const id in this.weaponShots) {
      if (id === 'grenade' || !this.weaponShots[id]) continue;
      arr.push({ id, name: this._wName(id), shots: this.weaponShots[id] });
    }
    arr.sort((a, b) => b.shots - a.shots);
    const max = arr.length ? arr[0].shots : 0;
    return arr.slice(0, limit).map((o) => ({
      name: o.name, shots: o.shots,
      pct: max ? Math.max(4, Math.round((o.shots / max) * 100)) : 0,
    }));
  },

  _fmt(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /* bảng HTML cuối trận (chèn vào màn GAME OVER / KẾT THÚC TRẬN) */
  html(snap) {
    const s = snap || this.last;
    if (!s) return '';
    const rows = [
      ['🎯 Độ chính xác', s.acc + '% <small>(' + this._fmt(Math.min(s.hits, s.shots)) + '/' + this._fmt(s.shots) + ' phát)</small>'],
      ['💥 Sát thương gây ra', this._fmt(s.damage)],
      ['🎯 Headshot', this._fmt(s.headshots)],
      ['☠️ Hạ gục', this._fmt(s.kills)],
      ['💣 Vật thể phá hủy', this._fmt(s.destroyed)],
      ['💰 Vàng kiếm được', '+' + this._fmt(s.gold) + ' 💰'],
      ['🔫 Súng dùng nhiều nhất', s.top ? s.top.name + ' <small>(' + this._fmt(s.top.shots) + ' phát)</small>' : '—'],
    ];
    if (s.deaths > 0) rows.splice(4, 0, ['💀 Số lần gục', this._fmt(s.deaths)]);
    const bars = (s.weapons && s.weapons.length)
      ? '<div class="wbars">' + s.weapons.map((o) =>
          '<div class="wbar"><span class="wbar-n">' + o.name + '</span>' +
          '<span class="wbar-t"><i style="width:' + o.pct + '%"></i></span>' +
          '<span class="wbar-v">' + this._fmt(o.shots) + '</span></div>').join('') + '</div>'
      : '';
    return '<div class="endstats">' +
      '<h3>📊 THỐNG KÊ TRẬN ĐẤU</h3>' +
      '<div class="accbar"><i style="width:' + s.acc + '%"></i></div>' +
      rows.map((r) => '<div class="row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') +
      bars +
      '</div>';
  },
};
