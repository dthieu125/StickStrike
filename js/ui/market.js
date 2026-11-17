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

/* ═══ 🏪 CỬA HÀNG (trước đây gọi là MARKET) — vẽ CANVAS như cửa hàng giữa wave ═══
 * GĐ 23b: cùng 1 giao diện tiệm — GRID ô vuông + khung phóng lớn món QUAY quanh
 * tâm + ông già chủ tiệm — để đồng nhất, khách khỏi phải học lại giao diện mới.
 * 3 tab: 🔫 SÚNG (độc quyền) · 🔧 NÂNG CẤP (mỗi khẩu 10 cấp) · 🪖 TRANG BỊ.
 * Mở từ MENU CHÍNH (nút 🏪 CỬA HÀNG); ESC hoặc nút ‹ VỀ MENU để thoát.
 * Vàng kiếm từ SINH TỔN tích luỹ vĩnh viễn (localStorage) — xài thoải mái. */
window.Market = {
  open: false,
  tab: 'guns',     // tab đang mở: 'guns' | 'up' | 'gear'
  sel: null,       // món đang chọn xem ở khung phóng lớn
  rows: [],        // vùng bấm [{x,y,w,h,action}]
  keeper: null,    // ông già chủ tiệm (dùng chung bộ máy Keeper của Shop)
  _bought: false,
  _afterMood: null,

  init() {
    Gold.load();
    Gear.load();
    if (window.GunUp) GunUp.load(); // cấp súng đã nâng cấp (ss_gunLv)
    if (window.MarketGuns) MarketGuns.load(); // 🔫 súng độc quyền đã mua (ss_guns)
  },

  /* mở tiệm từ menu chính — ẩn hết DOM để canvas tiệm hiện rõ */
  show() {
    this.open = true;
    this._bought = false;
    const after = this._afterMood;
    this._afterMood = null;
    this.keeper = Keeper.new(after || 'idle'); // lần trước ra về không mua → ông già buồn
    this._refreshSel();
    window.Menu && Menu.hideAll();
  },

  /* đóng tiệm (KHÔNG tự mở lại menu — menu.js tự gọi Menu.show('menu') sau lệnh này,
   * tránh vòng lặp vì Menu.show() cũng gọi Market.hide()) */
  hide() {
    if (this.open && !this._bought) {
      this._afterMood = Math.random() < 0.5 ? 'sad' : 'encourage';
    }
    this.open = false;
  },

  /* chọn lại món ĐANG XEM theo tab (sau khi mua xong để giá/trạng thái cập nhật) */
  _refreshSel() {
    const idOf = (x) => x.kind + ':' + (x.w ? x.w.id : x.gid);
    const list = this._items(this.tab);
    const cur = this.sel;
    this.sel = list.length ? list[0] : null;
    if (cur) {
      const again = list.find((x) => idOf(x) === idOf(cur));
      if (again) this.sel = again;
    }
  },

  /* ── danh sách món theo tab (giống items() của Shop — mỗi món có giá/trạng thái) ── */
  _items(tab) {
    const list = [];
    if (tab === 'guns') {
      // 🔫 SÚNG ĐỘC QUYỀN — chỉ bán ở đây, mua 1 lần sở hữu vĩnh viễn
      for (const id in Config.MARKET_GUNS) {
        const G = Config.MARKET_GUNS[id];
        const w = Weapons.list.find((x) => x.id === id);
        if (!w) continue;
        list.push({
          kind: 'mgun', w, gid: id, name: '🔥 ' + w.name, price: G.price,
          owned: MarketGuns.has(id), afford: Gold.balance >= G.price,
        });
      }
    } else if (tab === 'up') {
      // 🔧 NÂNG CẤP — mọi khẩu, mỗi cấp +5% dame/băng · nạp nhanh 2.5%
      for (const w of Weapons.list) {
        const lv = GunUp.lvl(w.id);
        const maxed = lv >= Config.UPGRADE.MAX_LV;
        list.push({
          kind: 'up', w, name: w.name,
          price: maxed ? 0 : GunUp.cost(w),
          owned: maxed, afford: Gold.balance >= GunUp.cost(w),
          lv, maxed,
        });
      }
    } else {
      // 🪖 TRANG BỊ — giáp/nón/giày/bao tay vĩnh viễn + khiên tiêu hao
      for (const id in Config.MARKET) {
        const def = Config.MARKET[id];
        list.push({
          kind: 'gear', gid: id, name: def.name, price: def.price,
          owned: def.kind === 'perm' && Gear.state[id],
          afford: Gold.balance >= def.price,
          use: def.kind === 'use',
        });
      }
    }
    return list;
  },

  /* mô tả chi tiết món (mảng dòng ngắn — wrap ở khung phóng lớn) */
  _descOf(it) {
    const out = [];
    if (it.kind === 'mgun') {
      const w = it.w, G = Config.MARKET_GUNS[it.gid];
      out.push('💥 Sát thương ' + Math.round(w.damage) + ' · ⚡ ' + Math.round(1 / w.fireDelay) + ' phát/s (nhanh nhất game)');
      out.push('🔫 Băng ' + w.mag + ' viên · giữ bắn phụ (chuột phải/E) = QUAY NÒNG giảm tản đạn');
      out.push('⚠️ Đạn GIỚI HẠN: vào trận có ' + G.startAmmo + ' viên dự trữ — săn hộp đạn VÀNG (10%) hoặc mua 100 viên 88💰 ở cửa hàng giữa wave');
      out.push('🔧 Nâng cấp băng tới ' + G.maxMag + ' viên ở MAX (giá bội số của 8, đắt gấp 2)');
    } else if (it.kind === 'up') {
      const w = it.w, st = GunUp.stats(w);
      out.push(it.maxed ? '🔧 Đã đạt MAX ' + Config.UPGRADE.MAX_LV + '/' + Config.UPGRADE.MAX_LV
        : '🔧 Cấp hiện tại: ' + it.lv + ' → lên cấp ' + (it.lv + 1));
      out.push('💥 Dame ' + Math.round(st.damage) + ' · băng ' + st.mag + ' · nạp ' + st.reload.toFixed(1) + 's (đã tính cấp)');
      if (it.lv >= Config.UPGRADE.ALT_LV && w.alt) out.push('⓶ ĐÃ MỞ bắn phụ: ' + w.alt.name);
      else if (it.lv === Config.UPGRADE.ALT_LV - 1) out.push('⓶ Lên tiếp cấp 3 mở ALT-FIRE: ' + (w.alt ? w.alt.name : ''));
      if (it.lv >= Config.UPGRADE.PERK_LV && w.perk) out.push('⭐ ĐÃ MỞ PERK: ' + w.perk.desc);
      else if (it.lv === Config.UPGRADE.PERK_LV - 1 && w.perk) out.push('⭐ Lên tiếp mở PERK: ' + w.perk.desc);
      out.push('💾 Cấp độ lưu VĨNH VIỄN — dùng cho mọi trận (bot không được nâng cấp)');
    } else {
      const def = Config.MARKET[it.gid];
      out.push('🛡️ ' + def.desc);
      if (def.kind === 'perm') out.push('💾 Mua 1 lần dùng MÃI — lưu localStorage');
      else out.push('🧪 TIÊU HAO — độ bền còn ' + Gear.state.shield + '/100, vỡ phải mua lại');
    }
    return out;
  },

  /* trạng thái món (dòng trước nút MUA) */
  _statusOf(it) {
    if (it.kind === 'mgun') return it.owned ? '✅ ĐÃ SỞ HỮU VĨNH VIỄN' : '❌ CHƯA SỞ HỮU';
    if (it.kind === 'up') return it.maxed ? '⭐ CẤP TỐI ĐA ' + Config.UPGRADE.MAX_LV + '/' + Config.UPGRADE.MAX_LV
      : '🔧 CẤP ' + it.lv + '/' + Config.UPGRADE.MAX_LV;
    const def = Config.MARKET[it.gid];
    if (def.kind === 'use') return '🧪 TIÊU HAO — bền ' + Gear.state.shield + '/100';
    return it.owned ? '✅ ĐÃ TRANG BỊ (VĨNH VIỄN)' : '❌ CHƯA CÓ';
  },

  /* có mua được không (theo trạng thái MỚI NHẤT — giá/vàng đổi sau mỗi lần mua) */
  _canBuy(it) {
    if (it.kind === 'mgun') return !it.owned && Gold.balance >= Config.MARKET_GUNS[it.gid].price;
    if (it.kind === 'up') return !it.maxed && Gold.balance >= GunUp.cost(it.w);
    const def = Config.MARKET[it.gid];
    if (def.kind === 'perm' && Gear.state[it.gid]) return false;
    return Gold.balance >= def.price;
  },

  /* MUA món đang chọn — gọi từ nút MUA trong khung phóng lớn */
  _tryBuy() {
    const it = this.sel;
    if (!it) { AudioFX.empty(); return; }
    if (!this._canBuy(it)) {
      AudioFX.empty();
      this.keeper = Keeper.new('angry'); // "Nghèo mà bày đặt vào tiệm mua đồ!"
      window.showToast && showToast('💸 Không đủ vàng! (cần ' + this._priceOf(it) + ')');
      return;
    }
    let ok = false;
    if (it.kind === 'mgun') ok = MarketGuns.buy(it.gid);
    else if (it.kind === 'up') ok = GunUp.buy(it.w.id);
    else ok = Gear.buy(it.gid);
    if (!ok) { AudioFX.empty(); this.keeper = Keeper.new('angry'); return; }
    AudioFX.reloadEnd(); // tiếng "cash" vui tai
    this._bought = true;
    this.keeper = Keeper.new('happy'); // 😄 "Quý khách thật có con mắt tinh tường!"
    if (it.kind === 'mgun') {
      const G = Config.MARKET_GUNS[it.gid];
      window.showToast && showToast('🔥 Đã MUA ' + it.w.name + ' — sở hữu VĨNH VIỄN! (nhận +' + G.startAmmo + ' đạn mỗi trận)');
    } else if (it.kind === 'up') {
      const lv = GunUp.lvl(it.w.id);
      window.showToast && showToast('🔧 ' + it.w.name + ' lên cấp ' + lv + '!');
      if (lv === Config.UPGRADE.ALT_LV && it.w.alt) showToast('⓶ Mở ALT-FIRE: ' + it.w.alt.name + ' (chuột phải / E)');
      if (lv === Config.UPGRADE.PERK_LV && it.w.perk) showToast('⭐ PERK: ' + it.w.perk.desc);
    } else {
      window.showToast && showToast('🛍️ Đã mua ' + Config.MARKET[it.gid].name + '!');
    }
    this._refreshSel(); // giá/trạng thái món này đổi rồi — nạp lại vào khung xem
  },

  _priceOf(it) {
    if (it.kind === 'mgun') return Config.MARKET_GUNS[it.gid].price;
    if (it.kind === 'up') return GunUp.cost(it.w);
    return Config.MARKET[it.gid].price;
  },

  /* ═════════ VẼ TIỆM (mỗi frame khi mở) ═════════ */
  updateAndDraw(ctx, mouse) {
    const W = 960, H = 600;
    const x0 = (Config.CANVAS_W - W) / 2;
    const y0 = (Config.CANVAS_H - H) / 2 - 10;
    this.rows = [];
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : 0;

    // nền mờ toàn màn + panel
    ctx.fillStyle = 'rgba(3,6,12,0.72)';
    ctx.fillRect(0, 0, Config.CANVAS_W, Config.CANVAS_H);
    const bg = ctx.createLinearGradient(x0, y0, x0, y0 + H);
    bg.addColorStop(0, 'rgba(20,26,20,0.98)');
    bg.addColorStop(1, 'rgba(12,16,12,0.98)');
    ctx.fillStyle = bg;
    ctx.fillRect(x0, y0, W, H);
    ctx.strokeStyle = 'rgba(255,209,64,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, W, H);

    /* header: tên tiệm + ví vàng */
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.fillText('🏪 CỬA HÀNG — vàng tích luỹ từ SINH TỔN', x0 + 24, y0 + 14);
    ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,240,200,0.55)';
    ctx.fillText('tổng đã kiếm: ' + Gold.earned + ' 💰 (thoát game không mất)', x0 + 24, y0 + 40);
    ctx.font = '700 19px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe066';
    ctx.fillText(Gold.balance + ' 💰', x0 + W - 24, y0 + 18);
    ctx.textAlign = 'left';

    /* ── 3 TAB: 🔫 SÚNG · 🔧 NÂNG CẤP · 🪖 TRANG BỊ ── */
    const TABS = [['guns', '🔫 SÚNG ĐỘC QUYỀN'], ['up', '🔧 NÂNG CẤP SÚNG'], ['gear', '🪖 TRANG BỊ']];
    let tx = x0 + 24;
    for (const [id, label] of TABS) {
      ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 28;
      const tb = { x: tx, y: y0 + 60, w: tw, h: 32 };
      this.rows.push({ ...tb, action: 'tab:' + id });
      const act = this.tab === id;
      const hover = mouse.x >= tb.x && mouse.x <= tb.x + tb.w && mouse.y >= tb.y && mouse.y <= tb.y + tb.h;
      ctx.fillStyle = act ? 'rgba(255,209,64,0.28)' : hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
      ctx.strokeStyle = act ? 'rgba(255,209,64,0.8)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = act ? 2 : 1;
      ctx.strokeRect(tb.x, tb.y, tb.w, tb.h);
      ctx.fillStyle = act ? '#ffe066' : 'rgba(255,240,200,0.55)';
      ctx.fillText(label, tb.x + 14, tb.y + 8);
      tx += tw + 10;
    }

    /* ── GRID ô vuông bên trái ── */
    const items = this._items(this.tab);
    const GX = x0 + 20, GY = y0 + 104;
    const TW = 146, TH = 104, GAP = 8, COLS = 4;
    const selId = this.sel ? this.sel.kind + ':' + (this.sel.w ? this.sel.w.id : this.sel.gid) : null;
    items.forEach((item, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      if (row > 2) return; // mỗi tab tối đa 3 hàng — đủ cho 11 khẩu nâng cấp
      const rect = { x: GX + col * (TW + GAP), y: GY + row * (TH + GAP), w: TW, h: TH };
      const id = item.kind + ':' + (item.w ? item.w.id : item.gid);
      const isSel = id === selId;
      this.rows.push({ ...rect, action: item });

      const hover = mouse.x >= rect.x && mouse.x <= rect.x + rect.w && mouse.y >= rect.y && mouse.y <= rect.y + rect.h;
      ctx.fillStyle = isSel ? 'rgba(255,209,64,0.18)'
        : hover && item.afford && !item.owned ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = isSel ? '#ffd943'
        : item.owned ? 'rgba(74,222,128,0.55)'
        : item.afford ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.10)';
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      // icon nghiêng nhẹ — thiết bị VẼ THEO TÂM (textBaseline middle) để quay không lệch trục
      if (item.kind === 'gear') {
        ctx.save();
        ctx.translate(rect.x + rect.w / 2, rect.y + 36);
        ctx.rotate(-0.14);
        ctx.font = '34px "Segoe UI Emoji", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // 🎯 trọng tâm = điểm quay
        ctx.fillText(item.name.split(' ')[0], 0, 0);
        ctx.restore(); // restore trả lại cả textBaseline
      } else {
        Shop._drawItem(ctx, { kind: 'weapon', w: item.w }, rect.x + rect.w / 2, rect.y + 36, -0.18, 0.85);
      }

      // tên (2 dòng nếu dài)
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = item.owned ? '#4ade80' : item.afford ? '#dfeaff' : 'rgba(200,215,235,0.45)';
      ctx.textAlign = 'center';
      const nm = item.name.replace(/^[^ ]+ /, ''); // bỏ emoji đầu (đã là icon)
      ctx.fillText(nm.length > 24 ? nm.slice(0, 23) + '…' : nm, rect.x + rect.w / 2, rect.y + 58);

      // giá / trạng thái ngắn
      ctx.font = '700 12px Consolas, monospace';
      if (item.owned) {
        ctx.fillStyle = '#4ade80';
        ctx.fillText(item.maxed ? '⭐ MAX' : '✔️ ĐÃ CÓ', rect.x + rect.w / 2, rect.y + rect.h - 20);
      } else {
        ctx.fillStyle = item.afford ? '#ffe066' : 'rgba(255,224,102,0.4)';
        ctx.fillText(item.price + ' 💰', rect.x + rect.w / 2, rect.y + rect.h - 20);
      }
      ctx.textAlign = 'left';
    });

    /* ── KHUNG PHÓNG LỚN bên phải: món QUAY quanh TÂM ── */
    const DX = GX + COLS * (TW + GAP) + GAP + 12;
    const DW = x0 + W - 24 - DX;
    const DY = GY, DH = 3 * (TH + GAP) - GAP;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(DX, DY, DW, DH);
    ctx.strokeStyle = 'rgba(255,209,64,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(DX, DY, DW, DH);

    const it = this.sel;
    if (it) {
      // ☀️ sân khấu: bóng đổ + món quay chầm chậm quanh TÂM nó
      const pcx = DX + DW / 2, pcy = DY + 84;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(pcx, pcy + 42, 44, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      if (it.kind === 'gear') {
        ctx.save();
        ctx.translate(pcx, pcy);
        ctx.rotate(now * 1.15);
        ctx.font = '58px "Segoe UI Emoji", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // 🎯 quay quanh TRỌNG TÂM của item (baseline giữa)
        ctx.fillText(it.name.split(' ')[0], 0, 0);
        ctx.restore();
      } else {
        Shop._drawItem(ctx, { kind: 'weapon', w: it.w }, pcx, pcy, now * 1.15, 1.6);
      }

      // tên + giá
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#fff6dd';
      const nameLines = Shop._wrap(ctx, it.name, DW - 24);
      nameLines.forEach((ln, k) => ctx.fillText(ln, DX + 12, DY + 142 + k * 17));

      // chi tiết tác dụng
      ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
      let dy = DY + 142 + nameLines.length * 17 + 4;
      for (const d of this._descOf(it)) {
        for (const ln of Shop._wrap(ctx, d, DW - 24)) {
          ctx.fillStyle = 'rgba(230,235,245,0.8)';
          ctx.fillText(ln, DX + 12, dy);
          dy += 14;
        }
      }

      // trạng thái
      ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = it.owned ? '#4ade80' : '#f0abfc';
      ctx.fillText(this._statusOf(it), DX + 12, DY + DH - 60);

      // nút MUA / NÂNG
      const btn = { x: DX + 12, y: DY + DH - 42, w: DW - 24, h: 32 };
      const canBuy = this._canBuy(it);
      this.rows.push({ ...btn, action: 'buy' });
      const hoverB = mouse.x >= btn.x && mouse.x <= btn.x + btn.w && mouse.y >= btn.y && mouse.y <= btn.y + btn.h;
      ctx.fillStyle = canBuy ? (hoverB ? 'rgba(255,209,64,0.45)' : 'rgba(255,209,64,0.22)')
        : 'rgba(255,255,255,0.08)';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = canBuy ? '#ffd943' : 'rgba(255,255,255,0.15)';
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
      ctx.textAlign = 'center';
      ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = canBuy ? '#fff6dd' : 'rgba(200,215,235,0.45)';
      const verb = it.kind === 'up' ? '⬆ NÂNG' : '🛒 MUA';
      const buyLabel = it.owned ? (it.maxed ? '⭐ MAX' : '✔️ ĐÃ CÓ RỒI')
        : canBuy ? verb + ' — ' + this._priceOf(it) + ' 💰' : '💸 THIẾU VÀNG';
      ctx.fillText(buyLabel, btn.x + btn.w / 2, btn.y + 7);
      ctx.textAlign = 'left';
    }

    /* ── ÔNG GIÀ CHỦ TIỆM (dùng chung bộ máy Keeper + hình vẽ của Shop) ── */
    if (!this.keeper) this.keeper = Keeper.new('idle');
    Keeper.step(this, now);
    Shop._drawKeeper(ctx, x0 + 74, y0 + H - 14, now, this.keeper.mood);
    Shop._drawBubble(ctx, x0 + 132, y0 + H - 118, this.keeper.quote, this.keeper.mood);

    /* ── nút VỀ MENU ── */
    const btn = { x: x0 + W - 264, y: y0 + H - 52, w: 240, h: 36 };
    this.rows.push({ ...btn, action: 'close' });
    const hoverC = mouse.x >= btn.x && mouse.x <= btn.x + btn.w && mouse.y >= btn.y && mouse.y <= btn.y + btn.h;
    ctx.fillStyle = hoverC ? 'rgba(255,209,64,0.4)' : 'rgba(255,209,64,0.2)';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = '#ffd943';
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.textAlign = 'center';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fff6dd';
    ctx.fillText('‹ VỀ MENU (ESC)', btn.x + btn.w / 2, btn.y + 9);
    ctx.textAlign = 'left';

    // 🖱️ con trỏ chuột (dùng chung với Shop) — canvas ẩn cursor CSS nên phải vẽ tay
    Shop._drawCursor(ctx, mouse.x, mouse.y);
  },

  /* bấm chuột/tap khi tiệm đang mở — trả true nếu "tiêu" được cú click */
  handleClick(mx, my) {
    if (!this.open) return false;
    for (const r of this.rows) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        if (r.action === 'close') this.hide();
        else if (r.action === 'buy') this._tryBuy();
        else if (String(r.action).startsWith('tab:')) {
          this.tab = r.action.slice(4);
          this._refreshSel();
          AudioFX.click();
        } else {
          this.sel = r.action; // bấm ô grid = CHỌN XEM
          AudioFX.click();
        }
        return true;
      }
    }
    return true; // đang mở: nuốt mọi click
  },
};
