/* =========================================================
 * GOLD + GEAR + MARKET — chợ trang bị bằng vàng tích luỹ
 * • Vàng kiếm được ở SINH TỔN (giết quái + thưởng dọn wave) được lưu
 *   LẠI VĨNH VIỄN (localStorage) — xài ở chợ ngay cả ngoài trận đấu.
 * • Trang bị vĩnh viễn: giáp / nón / giày / bao tay (mua 1 lần dùng mãi).
 * • Khiên ánh sáng: TIÊU HAO — tự hình thành khi mang, hư hại theo từng
 *   đòn bị chặn, về 0 độ bền thì vỡ mất (mua lại).
 * Định giá cân theo dame súng: lục 16 · AK 23 · shotgun 72/phát ·
 * sniper 95 · rocket 85 — đòn quái: cắn 12 · brute 25 · kamikaze 45.
 * ========================================================= */
window.Gold = {
  balance: 0, // vàng đang có (xài được)
  earned: 0,  // tổng vàng ĐÃ KIẾM được từ Sinh tồn (thống kê — không giảm khi tiêu)

  load() {
    this.balance = +localStorage.getItem('ss_gold') || 0;
    this.earned = +localStorage.getItem('ss_goldTotal') || 0;
  },
  save() {
    localStorage.setItem('ss_gold', this.balance);
    localStorage.setItem('ss_goldTotal', this.earned);
  },
  add(n) {
    if (!n || n <= 0) return;
    n = Math.round(n);
    this.balance += n;
    this.earned += n;
    this.save();
  },
  spend(n) {
    n = Math.round(n);
    if (this.balance < n) return false;
    this.balance -= n;
    this.save();
    return true;
  },
};

/* 🔫 MarketGuns — SÚNG ĐỘC QUYỀN chỉ bán ở chợ (Gatling...)
 * Mua bằng vàng tích luỹ, SỞ HỮU VĨNH VIỄN (lưu ss_guns). Vào trận mỗi máy
 * được mang khẩu của MÌNH với số đạn dự trữ giới hạn (Config.MARKET_GUNS.startAmmo)
 * — khác mọi súng mua trong trận (∞) để giữ đúng kinh tế hộp đạn vàng + 88💰/100 viên. */
window.MarketGuns = {
  ids: [], // các khẩu đã sở hữu (mảng id)

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('ss_guns') || 'null');
      if (Array.isArray(saved)) {
        this.ids = saved.filter((id) => window.Weapons && Weapons.list.some((w) => w.id === id));
      }
    } catch (e) { /* file lưu hỏng → bỏ qua */ }
  },
  save() {
    try { localStorage.setItem('ss_guns', JSON.stringify(this.ids)); } catch (e) { /* Ignore */ }
  },
  has(id) { return this.ids.indexOf(id) !== -1; },
  count() { return this.ids.length; },
  owned() { return this.ids.slice(); },

  /* Mua: trừ vàng tích luỹ + ghi lưu. Trả true nếu thành công. */
  buy(id) {
    const G = Config.MARKET_GUNS[id];
    if (!G || this.has(id)) return false;
    if (!Weapons.list.some((w) => w.id === id)) return false;
    if (!Gold.spend(G.price)) return false;
    this.ids.push(id);
    this.save();
    return true;
  },
};

window.Gear = {
  // trạng thái trang bị đã lưu: perm = mua rồi dùng mãi; shield = độ bền còn lại
  state: { armor: false, helmet: false, boots: false, gloves: false, shield: 0 },

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('ss_gear') || 'null');
      if (saved) {
        for (const k in this.state) {
          if (saved[k] !== undefined) this.state[k] = saved[k];
        }
      }
    } catch (e) { /* hỏng file save → bỏ qua, giữ mặc định */ }
  },
  save() { localStorage.setItem('ss_gear', JSON.stringify(this.state)); },

  owned(id) { return id === 'shield' ? this.state.shield > 0 : !!this.state[id]; },

  /* Mua: trừ vàng, ghi lưu. Trả về true nếu mua thành công. */
  buy(id) {
    const def = Config.MARKET[id];
    if (!def) return false;
    if (def.kind === 'perm' && this.state[id]) return false; // đã có rồi
    if (!Gold.spend(def.price)) return false; // thiếu vàng
    if (def.kind === 'use') this.state.shield = 100; // khiên mới: đầy 100 bền
    else this.state[id] = true;
    this.save();
    return true;
  },

  /* snapshot cho người chơi mang vào trận (đọc trực tiếp Gear.state cũng được) */
  active() { return this.state.shield > 0 || this.state.armor || this.state.helmet || this.state.boots || this.state.gloves; },
};

window.Market = {
  open: false,
  el: null, list: null, wallet: null, upList: null, gunList: null,

  init() {
    Gold.load();
    Gear.load();
    if (window.GunUp) GunUp.load(); // cấp súng đã nâng cấp (ss_gunLv)
    if (window.MarketGuns) MarketGuns.load(); // 🔫 súng độc quyền đã mua (ss_guns)
    this.el = document.getElementById('market');
    this.list = document.getElementById('marketList');
    this.gunList = document.getElementById('gunList');
    this.wallet = document.getElementById('marketWallet');
    this.upList = document.getElementById('upList');
  },

  refresh() {
    if (!this.list) return;
    this.wallet.textContent = '💰 Vàng của bạn: ' + Gold.balance +
      '   ·   tổng đã kiếm từ Sinh tồn: ' + Gold.earned;
    this.refreshGuns();

    this.list.innerHTML = '';
    for (const id in Config.MARKET) {
      const def = Config.MARKET[id];
      const owned = Gear.owned(id);
      const afford = Gold.balance >= def.price;
      const row = document.createElement('div');
      row.className = 'mrow' + (owned ? ' owned' : '');
      row.innerHTML =
        '<div class="mtxt"><b>' + def.name + '</b><small>' + def.desc + '</small></div>' +
        '<div class="mright"><span class="mprice">' + (owned ? 'ĐÃ CÓ' : def.price + ' 💰') + '</span>' +
        '<button class="btn small">' + (def.kind === 'use' ? '🛒 Mua cái mới' : (owned ? '✔️' : '🛒 Mua')) + '</button></div>';
      const btn = row.querySelector('button');
      if (owned && def.kind === 'perm') btn.disabled = true;
      else btn.disabled = !afford;
      btn.onclick = () => {
        if (Gear.buy(id)) {
          AudioFX.reloadEnd(); // tiếng "cash" tạm dùng tiếng nạp đạn vui tai
          window.showToast && showToast('🛍️ Đã mua ' + def.name + '!');
        } else {
          AudioFX.empty();
          window.showToast && showToast('💸 Không đủ vàng! (cần ' + def.price + ')');
        }
        this.refresh();
      };
      this.list.appendChild(row);
    }
    this.refreshUpgrades();
  },

  /* 🔫 SÚNG ĐỘC QUYỀN — chỉ bán ở chợ, mua 1 lần sở hữu vĩnh viễn (ss_guns).
   * ĐẠN GIỚI HẠN: vào trận chỉ có số đạn dự trữ ban đầu, phải săn hộp đạn vàng
   * (10%) hoặc mua 100 viên 88💰 ở cửa hàng giữa wave — đừng bắn như vòi rồng vô tội vạ! */
  refreshGuns() {
    if (!this.gunList || !window.MarketGuns) return;
    this.gunList.innerHTML = '';
    for (const id in Config.MARKET_GUNS) {
      const G = Config.MARKET_GUNS[id];
      const w = Weapons.list.find((x) => x.id === id);
      if (!w) continue;
      const owned = MarketGuns.has(id);
      const afford = Gold.balance >= G.price;
      const row = document.createElement('div');
      row.className = 'mrow' + (owned ? ' owned' : '');
      row.innerHTML =
        '<div class="mtxt"><b>🔥 ' + w.name + '</b><small>Bắn nhanh nhất game (' +
        Math.round(1 / w.fireDelay) + ' phát/s) · ' + w.mag + ' viên/băng · giữ bắn phụ quay nòng. ' +
        'Đạn GIỚI HẠN: hộp đạn VÀNG hiếm (10%) hoặc mua 100 viên 88💰 ở cửa hàng giữa wave.</small></div>' +
        '<div class="mright"><span class="mprice">' + (owned ? 'ĐÃ CÓ' : G.price + ' 💰') + '</span>' +
        '<button class="btn small">' + (owned ? '✔️' : '🛒 Mua') + '</button></div>';
      const btn = row.querySelector('button');
      btn.disabled = owned || !afford;
      btn.onclick = () => {
        if (MarketGuns.buy(id)) {
          AudioFX.reloadEnd();
          window.showToast && showToast('🔥 Đã MUA ' + w.name + ' — sở hữu VĨNH VIỄN! (nhận +' +
            G.startAmmo + ' đạn mỗi trận)');
        } else {
          AudioFX.empty();
          window.showToast && showToast('💸 Không đủ vàng! (cần ' + G.price + ')');
        }
        this.refresh();
      };
      this.gunList.appendChild(row);
    }
  },

  /* 🔧 NÂNG CẤP SÚNG — mỗi khẩu 5 cấp: +10% dame/băng · nạp nhanh 5% mỗi cấp
   * cấp 3 mở ALT-FIRE (bắn phụ) · cấp 5 mở PERK. Mua bằng vàng tích luỹ. */
  refreshUpgrades() {
    if (!this.upList || !window.GunUp) return;
    this.upList.innerHTML = '';
    for (const w of Weapons.list) {
      const lv = GunUp.lvl(w.id);
      const maxed = lv >= Config.UPGRADE.MAX_LV;
      const cost = GunUp.cost(w);
      const afford = Gold.balance >= cost;
      const st = GunUp.stats(w);
      const pips = '●'.repeat(lv) + '○'.repeat(Config.UPGRADE.MAX_LV - lv);
      // mô tả trạng thái hiện tại + cái sắp mở
      let desc = 'Dame ' + Math.round(st.damage) + ' · băng ' + st.mag + ' · nạp ' + st.reload.toFixed(1) + 's';
      if (lv >= Config.UPGRADE.ALT_LV && w.alt) desc += ' · ALT: ' + w.alt.name;
      else if (lv === Config.UPGRADE.ALT_LV - 1) desc += ' · lên tiếp mở ALT-FIRE: ' + (w.alt ? w.alt.name : '');
      if (lv >= Config.UPGRADE.PERK_LV && w.perk) desc += ' · PERK: ' + w.perk.desc;
      else if (lv === Config.UPGRADE.PERK_LV - 1 && w.perk) desc += ' · lên MAX mở PERK: ' + w.perk.desc;

      const row = document.createElement('div');
      row.className = 'mrow' + (maxed ? ' owned' : '');
      row.innerHTML =
        '<div class="mtxt"><b>' + w.name + ' <span class="lv-pips">' + pips + '</span></b>' +
        '<small>' + desc + '</small></div>' +
        '<div class="mright"><span class="mprice">' + (maxed ? 'MAX' : cost + ' 💰') + '</span>' +
        '<button class="btn small">' + (maxed ? '✔️' : '⬆ Nâng') + '</button></div>';
      const btn = row.querySelector('button');
      btn.disabled = maxed || !afford;
      btn.onclick = () => {
        if (GunUp.buy(w.id)) {
          AudioFX.reloadEnd();
          window.showToast && showToast('🔧 ' + w.name + ' lên cấp ' + GunUp.lvl(w.id) + '!');
          if (GunUp.lvl(w.id) === Config.UPGRADE.ALT_LV) window.showToast && showToast('⓶ Mở ALT-FIRE: ' + w.alt.name + ' (chuột phải / E)');
          if (GunUp.lvl(w.id) === Config.UPGRADE.PERK_LV) window.showToast && showToast('⭐ PERK: ' + w.perk.desc);
        } else {
          AudioFX.empty();
          window.showToast && showToast('💸 Không đủ vàng! (cần ' + cost + ')');
        }
        this.refresh();
      };
      this.upList.appendChild(row);
    }
  },

  show() { this.open = true; this.refresh(); if (this.el) this.el.classList.remove('hidden'); },
  hide() { this.open = false; if (this.el) this.el.classList.add('hidden'); },
};
