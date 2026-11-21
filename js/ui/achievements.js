/* =========================================================
 * ACHIEVEMENTS — 🏆 HỆ THỐNG THÀNH TỰU
 * • Lưu vĩnh viễn ở localStorage (ss_achievements)
 * • Mở khóa → toast + tiếng chime + ghi vào danh sách "mới mở"
 * • Panel menu hiển thị tiến độ từng mốc + tổng thống kê dài hạn
 * ========================================================= */
window.Achievements = {
  KEY: 'ss_achievements',

  list: [
    {
      id: 'headshot50', icon: '🎯', title: 'Xạ thủ bậc thầy',
      desc: 'Đạt 50 headshot trong MỘT trận đấu',
      target: 50, unit: 'headshot', current: 0, unlocked: false,
    },
    {
      id: 'destroy20', icon: '💣', title: 'Kẻ hủy diệt',
      desc: 'Phá hủy 20 thùng nổ / thùng gỗ / ống ga / cây cối',
      target: 20, unit: 'vật thể', current: 0, unlocked: false,
    },
    {
      id: 'flawless10', icon: '🛡️', title: 'Bất bại',
      desc: 'Hoàn thành Wave 10 mà không mất mạng nào',
      target: 10, unit: 'wave', current: 0, unlocked: false,
    },
    {
      id: 'gold20k', icon: '💰', title: 'Triệu phú vũ trụ',
      desc: 'Tích lũy tổng cộng 20,000 vàng kiếm được',
      target: 20000, unit: 'vàng', current: 0, unlocked: false,
    },
    {
      id: 'boss3', icon: '👑', title: 'Săn trùm vũ trụ',
      desc: 'Hạ gục 3 boss (boss lớn hoặc boss nhỏ)',
      target: 3, unit: 'boss', current: 0, unlocked: false,
    },
    {
      id: 'revive1', icon: '🤝', title: 'Đồng đội tin cậy',
      desc: 'Cứu sống đồng đội trong chế độ co-op 2 người',
      target: 1, unit: 'lần', current: 0, unlocked: false,
    },
  ],

  pending: [], // thành tựu vừa mở trong trận — hiện ở bảng kết quả

  /* ─────────── LƯU / NẠP ─────────── */
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (saved && typeof saved === 'object') {
        for (const a of this.list) {
          const s = saved[a.id];
          if (s) {
            a.current = Math.max(0, Math.min(a.target, +s.current || 0));
            a.unlocked = !!s.unlocked || a.current >= a.target;
          }
        }
      }
    } catch (e) { /* file lưu hỏng → bắt đầu lại */ }
    this.syncGold();
  },

  save() {
    try {
      const data = {};
      for (const a of this.list) data[a.id] = { current: a.current, unlocked: a.unlocked };
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) { /* bỏ qua */ }
  },

  get(id) { return this.list.find((a) => a.id === id) || null; },

  /* ─────────── MỞ KHÓA ─────────── */
  _unlock(a) {
    if (!a || a.unlocked) return;
    a.unlocked = true;
    a.current = a.target;
    this.pending.push({ id: a.id, title: a.title, icon: a.icon });
    if (window.AudioFX) AudioFX.heal();
    if (window.showToast) window.showToast('🏆 MỞ KHÓA THÀNH TỰU: ' + a.icon + ' ' + a.title + '!');
    this.save();
  },

  /* cộng dồn tiến độ (mỗi hành động +1) */
  progress(id, delta = 1) {
    const a = this.get(id);
    if (!a || a.unlocked) return;
    a.current = Math.min(a.target, a.current + delta);
    if (a.current >= a.target) this._unlock(a);
    else this.save();
  },

  /* đặt tiến độ TUYỆT ĐỐI nhưng chỉ TĂNG (kỷ lục / số liệu tích lũy) */
  set(id, val) {
    const a = this.get(id);
    if (!a || a.unlocked) return;
    const v = Math.max(0, Math.min(a.target, +val || 0));
    if (v <= a.current) return;
    a.current = v;
    if (a.current >= a.target) this._unlock(a);
    else this.save();
  },

  /* đặt KỶ LỤC: chỉ tăng, không bao giờ tụt (headshot 1 trận, wave cao nhất...) */
  best(id, val) { this.set(id, val); },

  /* xóa tiến độ của thành tựu CHƯA mở (vd gục → mất chuỗi "Bất bại") */
  reset(id) {
    const a = this.get(id);
    if (!a || a.unlocked || a.current === 0) return;
    a.current = 0;
    this.save();
  },

  /* 💰 mốc vàng đọc thẳng từ tổng vàng tích lũy vĩnh viễn */
  syncGold() {
    const a = this.get('gold20k');
    if (!a || a.unlocked) return;
    const earned = (window.Gold && Gold.earned) || 0;
    this.set('gold20k', earned);
  },

  /* ─────────── HIỂN THỊ ─────────── */
  _fmt(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /* khối "thành tựu mới" cho bảng kết quả — đọc xong thì xóa */
  takePendingHtml() {
    if (!this.pending.length) return '';
    const items = this.pending.map((a) => '🏆 ' + a.icon + ' ' + a.title);
    this.pending = [];
    return '<div class="ach-new"><b>THÀNH TỰU MỚI MỞ KHÓA</b><br>' + items.join('<br>') + '</div>';
  },

  summaryHtml() {
    const L = (window.Stats && Stats.lifetime) || {};
    const acc = L.shots ? Math.min(100, Math.round((Math.min(L.hits, L.shots) / L.shots) * 100)) : 0;
    const bw = +(localStorage.getItem('ss_bestWave') || 0);
    const gold = (window.Gold && Gold.earned) || 0;
    const cell = (v, l) => '<div><b>' + v + '</b><span>' + l + '</span></div>';
    return '<div class="ach-sum">' +
      cell(this._fmt(L.matches || 0), 'trận đã chơi') +
      cell(acc + '%', 'chính xác TB') +
      cell(this._fmt(L.damage || 0), 'tổng sát thương') +
      cell(this._fmt(L.headshots || 0), 'headshot') +
      cell(this._fmt(L.kills || 0), 'hạ gục') +
      cell('Wave ' + bw, 'kỷ lục') +
      cell(this._fmt(gold), 'vàng tích lũy') +
      '</div>';
  },

  render() {
    this.syncGold();
    const sum = document.getElementById('achSummary');
    if (sum) sum.innerHTML = this.summaryHtml();

    const box = document.getElementById('achList');
    if (!box) return;
    box.innerHTML = this.list.map((a) => {
      const pct = Math.max(0, Math.min(100, Math.round((a.current / a.target) * 100)));
      const num = a.unit === 'vàng'
        ? this._fmt(a.current) + ' / ' + this._fmt(a.target)
        : a.current + ' / ' + a.target;
      const badge = a.unlocked
        ? '<span class="ach-badge">✅ ĐÃ MỞ KHÓA</span>'
        : '<span class="ach-pct">' + pct + '%</span>';
      return '<div class="ach-row' + (a.unlocked ? ' unlocked' : '') + '">' +
        '<span class="ach-icon">' + a.icon + '</span>' +
        '<div class="ach-main">' +
          '<div class="ach-name"><span>' + a.title + '</span>' + badge + '</div>' +
          '<div class="ach-desc">' + a.desc + '</div>' +
          '<div class="ach-track"><i style="width:' + pct + '%"></i></div>' +
        '</div>' +
        '<span class="ach-num">' + (a.unlocked ? '🏆' : num) + '</span>' +
      '</div>';
    }).join('');
  },

  unlockedCount() { return this.list.filter((a) => a.unlocked).length; },
};
