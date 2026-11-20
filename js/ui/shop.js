/* =========================================================
 * SHOP — cửa hàng giữa các đợt wave (vẽ bằng canvas, bấm bằng chuột/touch)
 * 🎨 GĐ 23 — LAYOUT MỚI:
 *   • GRID Ô VUÔNG bên trái (mỗi món 1 ô: icon + tên + giá) — không còn
 *     danh sách 1 dòng/món choáng không gian nữa.
 *   • Bấm 1 ô → KHUNG PHÓNG LỚN bên phải: món quay quanh điểm cố định
 *     (nhìn mọi góc) + giá + tên + chi tiết tác dụng + trạng thái
 *     (ĐÃ TRANG BỊ / CHƯA CÓ / TIÊU HAO) + nút MUA.
 *   • Ông GIÀ chủ tiệm ngồi góc dưới: hỏi han, khen khi khách mua,
 *     cau có khi khách nghèo, buồn khi ế hàng (bộquote "zui zui").
 * Mở tự động trong giờ nghỉ. Đóng bằng nút "Ra đánh tiếp" hoặc phím B.
 * 🤝 co-op: rows[] giữ nguyên cơ chế — guest bấm ô = XEM, bấm MUA = gửi
 * tin nhắn {t:'buy'} sang host (host mua hộ vào túi người 2).
 * ========================================================= */
/* ═══ 👴 KEEPER — bộ máy ông già chủ tiệm DÙNG CHUNG cho cả 2 cửa hàng ═══
 * (CỬA HÀNG giữa wave = Shop · CỬA HÀNG ngoài menu = Market — cùng 1 ông già!)
 * GĐ 23b fix: trước đây nhánh idle đổi quote mà KHÔNG reset timer → ông già
 * nhể câu mới MỖI FRAME → chữ hiện ra liên tục không kịp đọc. Giờ mọi nhánh
 * đều có giờ nghỉ riêng: vui/câu có 4s · idle 8-12s đổi câu chậm rãi. */
window.Keeper = {
  new(mood) {
    return {
      mood,
      quote: this.pick(mood),
      timer: mood === 'idle' ? 8 + Math.random() * 4 : 4, // giây giữ câu này
      _last: 0,
    };
  },

  pick(mood) {
    const L = Shop.QUOTES[mood] || Shop.QUOTES.idle;
    return L[Math.floor(Math.random() * L.length)];
  },

  /* gọi mỗi frame khi cửa hàng đang mở — trôi thời gian + đổi tâm trạng/câu */
  step(host, now) {
    const k = host.keeper;
    if (!k) return;
    if (!k._last) k._last = now;
    const dt = Math.min(0.1, now - k._last);
    k._last = now;
    k.timer -= dt;
    if (k.timer > 0) return;
    if (k.mood !== 'idle') host.keeper = this.new('idle'); // vui/cau có 4s → về bình thường
    else { k.quote = this.pick('idle'); k.timer = 8 + Math.random() * 4; } // idle: đổi câu + NGHỈ ĐỦ LÂU
  },
};

window.Shop = {
  open: false,
  rows: [],        // vùng bấm [{x,y,w,h,action}] — action: món hàng / 'buy' / 'close'
  sel: null,       // món đang được chọn xem ở khung phóng lớn
  keeper: null,    // ông già chủ tiệm {mood, quote, timer, _last}
  _bought: false,  // lần mở tiệm này có mua gì chưa (để ông già buồn/cau có khi ra về)
  _afterMood: null, // tâm trạng chờ thể hiện ở lần mở KẾ TIẾP (không mua → buồn)

  /* ── BỘ QUOTE ÔNG GIÀ (giữ nguyên lời bạn đưa ra) ── */
  QUOTES: {
    idle: [
      'Khách quan ơi, cần mua gì?',
      'Bổn tiệm có rất nhiều đồ quý giá, sịn xò con bò!',
      'Đồ bổn tiệm chính hãng 100%, bắn phát nghe liền!',
      'Coi kỹ trước khi mua, mua rồi khỏi đổi đổi hả!',
      'Hàng mới về nè khách, sịn xò lông ngỗng!',
      'Giữa trống chưa ai ghé... khách vào coi đồ đi!',
    ],
    happy: [
      'Quý khách thật có con mắt tinh tường!',
      'Cảm ơn khách! Nhìn là biết người chơi có talent!',
      'Chuẩn đồ đó! Xài bắn ai cũng sợ!',
      'Hehe, tiệm tui hôm nay vui ghê, có khách sành điệu!',
    ],
    angry: [
      'Nghèo mà bày đặt vào tiệm mua đồ!',
      'Không đủ tiền mà đòi mua? Về cày đi rồi hả!',
      'Tay súng thì đẹp, túi thì rỗng không... hức!',
      'Bổn tiệm KHÔNG bán chịu! Bố già cũng phải ăn!',
    ],
    sad: [
      'Sáng giờ chưa ai mở hàng! Chán ghê!',
      'Tiệm ế chỏng như lô gà... ông già tui buồn ghê lắm',
      'Rồi tiệm này còn mở nổi không nữa đây...',
    ],
    encourage: [
      'Ráng cày đi rùi quay lại ủng hộ bổn tiệm nhé!',
      'Giết quái là ra tiền! Đồ tốt đang chờ khách nè!',
      'Đi đi khách, kiếm tiền về bổn tiệm giảm giá cho!',
    ],
  },

  pick(mood) {
    const L = this.QUOTES[mood] || this.QUOTES.idle;
    return L[Math.floor(Math.random() * L.length)];
  },

  /* đổi tâm trạng ông già + 1 câu nói tương ứng (Keeper dùng chung với Market) */
  pick(mood) { return Keeper.pick(mood); },

  _mood(mood) {
    this.keeper = Keeper.new(mood);
  },

  setOpen(v) {
    const was = this.open;
    this.open = v;
    if (v && !was) {
      // vừa MỞ tiệm: chọn lại món đầu + ông già chào khách
      // (nếu lần trước ra về KHÔNG mua gì → ông già xị mặt/buồn trước rồi mới vui lại)
      this._bought = false;
      const after = this._afterMood;
      this._afterMood = null;
      this._mood(after || 'idle');
      this.sel = null;
      const it = this.items();
      this.sel = it.length ? it[0] : null;
    }
  },

  toggle() {
    this.setOpen(!this.open); // qua setOpen để nhánh reset (chọn món đầu + ông già chào) chạy đúng
  },

  // trả về danh sách món hàng kèm giá/trạng thái
  // 🤝 co-op: p = người MUA (mặc định người máy mình) — mỗi người ví riêng
  items(p) {
    p = p || Player.obj;
    const list = [];
    // 🔫 súng ĐỘC QUYỀN chợ (Gatling...) KHÔNG bán ở đây — chỉ ở 🏪 CỬA HÀNG (menu chính)
    for (const w of Weapons.list) {
      if (w.price > 0 && !w.marketOnly) {
        list.push({
          kind: 'weapon', w,
          name: w.name, price: w.price,
          owned: p.owned.has(w.id),
          afford: p.money >= w.price,
        });
      }
    }
    // 🔫 ĐẠN GATLING: khẩu độc quyền là đạn GIỚI HẠN — mua lẻ 100 viên/88💰
    const gat = Weapons.list.find((w) => w.marketOnly);
    if (gat && p.owned.has(gat.id)) {
      list.push({
        kind: 'gatAmmo', w: gat,
        name: '🔥 Đạn ' + gat.short + ' +' + Config.AMMO.GAT_AMOUNT + ' viên (đạn giới hạn)',
        price: Config.SHOP.GAT_AMMO_PRICE,
        afford: p.money >= Config.SHOP.GAT_AMMO_PRICE,
        owned: false,
      });
    }
    list.push({
      kind: 'refill', name: 'Nạp đầy đạn MỌI KHẨU THƯỜNG (kể cả dự trữ)', price: 50,
      afford: p.money >= 50, owned: false,
    });
    list.push({
      kind: 'medkit', name: 'Hồi máu +' + 50 + ' HP', price: 75,
      afford: p.money >= 75, owned: false,
    });
    return list;
  },

  buy(item, p) {
    p = p || Player.obj; // 🤝 co-op: mua vào túi NGƯỜI ĐÓ (host xử lý hộ bạn 2)
    if (!item.afford) { AudioFX.empty(); return; }
    if (item.kind === 'weapon') {
      if (item.owned) return;
      p.money -= item.price;
      p.owned.add(item.w.id);
      p.spare[Weapons.list.indexOf(item.w)] = Infinity; // súng MUA = đạn vô hạn (khác súng LỤM)
      showToast('Đã mua ' + item.w.name + '! (phím ' + ((Weapons.list.indexOf(item.w) + 1) % 10) + ')');
    } else if (item.kind === 'gatAmmo') {
      // 🔫 nạp 100 viên vào DỰ TRỮ của Gatling (đạn giới hạn — trần dự trữ như súng lụm)
      const i = Weapons.list.indexOf(item.w);
      const magSize = (window.GunUp ? GunUp.mag(item.w) : item.w.mag);
      const cap = magSize * Config.AMMO.SPARE_CAP;
      if (p.spare[i] !== Infinity) {
        p.spare[i] = Math.min(cap, p.spare[i] + Config.AMMO.GAT_AMOUNT);
      }
      p.money -= item.price;
      showToast('🔥 +' + Config.AMMO.GAT_AMOUNT + ' đạn ' + item.w.short + ' (dự trữ ' + p.spare[i] + '/' + cap + ')');
    } else if (item.kind === 'refill') {
      p.money -= item.price;
      Weapons.list.forEach((w, i) => {
        if (!p.owned.has(w.id) || w.marketOnly) return; // 🔫 gatling đạn giới hạn — mua riêng 88💰
        const magSize = (window.GunUp ? GunUp.mag(w) : w.mag); // 🔧 băng đã nâng cấp
        p.mags[i] = magSize;
        // súng LỤM (dự trữ hữu hạn) được bồi đủ trần dự trữ luôn
        if (p.spare[i] !== Infinity) p.spare[i] = magSize * Config.AMMO.SPARE_CAP;
      });
      showToast('Đạn sung túc!');
    } else if (item.kind === 'medkit') {
      p.money -= item.price;
      p.hp = Math.min(p.maxHp, p.hp + 50);
      showToast('Đã vá người que!');
    }
    AudioFX.reloadEnd();
  },

  /* ═════════ VẼ + XỬ LÝ CHUỘT ═════════ */

  /* gói chữ thành nhiều dòng vừa khung (dùng measureText) */
  _wrap(ctx, str, maxW) {
    const words = String(str).split(' ');
    const lines = [];
    let cur = '';
    for (const wd of words) {
      const t = cur ? cur + ' ' + wd : wd;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  },

  /* vẽ icon món hàng quay quanh điểm (cx,cy) — dùng cho ô grid (góc nghiêng tĩnh)
   * và khung phóng lớn (quay tròn theo thời gian).
   * 🎯 GĐ 23b fix: súng vẽ 1 lần vào canvas ẨN (sprite) rồi xoay TẤM ẢNH quanh
   * tâm nó — quay đúng TÂM ITEM như bạn yêu cầu, không còn lệch quanh điểm xa. */
  _gunCache: {},
  _gunSprite(w) {
    if (this._gunCache[w.id]) return this._gunCache[w.id];
    let spr = null;
    try {
      if (typeof _drawGun === 'function' && document.createElement) {
        const len = (w.bodyLen || 12) + (w.barrelLen || 14);
        const H = Config.PLAYER.H || 52;
        const pad = 12, hgt = 48;
        const c = document.createElement('canvas');
        c.width = Math.ceil(len + pad * 2 + H * 0.08);
        c.height = hgt;
        const g = c.getContext('2d');
        _drawGun(g, w, pad, hgt / 2, 0, 0, H); // vẽ ngang 1 lần — tâm thật = giữa canvas
        spr = { c, w: c.width, h: c.height };
      }
    } catch (e) { spr = null; } // harness không có canvas → fallback bên dưới
    this._gunCache[w.id] = spr;
    return spr;
  },

  /* vẽ icon món hàng quay quanh điểm (cx,cy) — dùng cho ô grid (góc nghiêng tĩnh)
   * và khung phóng lớn (quay tròn theo thời gian) */
  _drawItem(ctx, item, cx, cy, angle, scale) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    if (item.kind === 'weapon') {
      const spr = this._gunSprite(item.w);
      if (spr) {
        ctx.rotate(angle);
        ctx.drawImage(spr.c, -spr.w / 2, -spr.h / 2); // xoay quanh TÂM tấm ảnh = tâm khẩu súng
      } else if (typeof _drawGun === 'function') {
        // fallback: xoay quanh nửa chiều dài khẩu (chưa có canvas ẩn)
        const w = item.w;
        const len = (w.bodyLen || 12) + (w.barrelLen || 14);
        _drawGun(ctx, w, -(len / 2 + (Config.PLAYER.H || 52) * 0.08), -2, angle, 0, Config.PLAYER.H || 52);
      } else {
        // phòng hộ: harness không có gì cả → hình chữ nhật đại diện
        ctx.fillStyle = '#aab4c5';
        ctx.fillRect(-16, -3, 32, 6);
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(-10, 3, 5, 9);
      }
    } else if (item.kind === 'gatAmmo') {
      // 🔫 thùng đạn VÀNG của Gatling (như hộp vàng trên map)
      ctx.fillStyle = '#d4af37'; ctx.fillRect(-16, -11, 32, 22);
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2.5; ctx.strokeRect(-16, -11, 32, 22);
      ctx.fillStyle = '#fff3b0';
      for (let i = -1; i <= 1; i++) ctx.fillRect(i * 8 - 2, -6, 4, 12);
    } else if (item.kind === 'refill') {
      // 📦 thùng đạn xanh — nạp đầy mọi khẩu
      ctx.fillStyle = '#2b6cb0'; ctx.fillRect(-16, -11, 32, 22);
      ctx.strokeStyle = '#7ec8ff'; ctx.lineWidth = 2.5; ctx.strokeRect(-16, -11, 32, 22);
      ctx.fillStyle = '#bfe4ff';
      for (let i = -1; i <= 1; i++) ctx.fillRect(i * 8 - 2, -6, 4, 12);
    } else { // medkit
      ctx.fillStyle = '#f4f6fb'; ctx.fillRect(-15, -11, 30, 22);
      ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 2.5; ctx.strokeRect(-15, -11, 30, 22);
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(-3, -7, 6, 14);
      ctx.fillRect(-7, -3, 14, 6);
    }
    ctx.restore();
  },

  /* chi tiết tác dụng — mỗi món vài dòng ngắn */
  _descOf(item) {
    const out = [];
    if (item.kind === 'weapon') {
      const w = item.w;
      const rps = Math.round(1 / w.fireDelay);
      out.push('💥 Sát thương ' + Math.round(w.damage) + (w.headMult ? ' (đầu ×' + w.headMult + ')' : ''));
      out.push('⚡ ' + rps + ' phát/s · băng ' + w.mag + ' viên · nạp ' + w.reload.toFixed(1) + 's');
      out.push(w.auto ? '🔫 Bắn liên thanh — GIỮ chuột là bắn liền' : '👆 Bấm từng phát — bắn chậm mà chuẩn');
      if (w.pellets > 1) out.push('🧨 1 phát tung ' + w.pellets + ' viên bi');
      if (w.kind === 'proj') out.push('🚀 Đạn bay thật — nổ chạm mục tiêu');
      if (w.alt) out.push('✨ Bắn phụ: ' + w.alt.name.toLowerCase());
    } else if (item.kind === 'gatAmmo') {
      const magSize = (window.GunUp ? GunUp.mag(item.w) : item.w.mag);
      out.push('🔥 +' + Config.AMMO.GAT_AMOUNT + ' viên vào DỰ TRỮ Gatling (trần ' + (magSize * Config.AMMO.SPARE_CAP) + ')');
      out.push('⚠️ Gatling là đạn GIỚI HẠN — hộp đạn VÀNG trên map (10%) cũng nhặt được +100 viên');
      out.push('💰 Gói "Nạp đầy mọi khẩu" 50💰 KHÔNG gồm Gatling — phải mua riêng món này');
    } else if (item.kind === 'refill') {
      out.push('📦 Nạp ĐẦY băng + dự trữ của mọi khẩu thường đang sở hữu');
      out.push('⚠️ Gatling đạn giới hạn — không nằm trong gói này (mua 🔥 riêng 88💰)');
      out.push('🛡️ Súng LỤM trên map được bồi đủ trần dự trữ luôn');
    } else { // medkit
      out.push('❤️ Băng bó +50 HP NGAY LẬP TỨC');
      out.push('🧪 Món TIÊU HAO — mua dùng luôn, không cầm về');
      out.push('💡 Máu càng đầy càng giữ mạng cho wave sau');
    }
    return out;
  },

  /* trạng thái món: ĐÃ TRANG BỊ / CHƯA CÓ / TIÊU HAO (+ thông tin phụ) */
  _statusOf(item, p) {
    if (item.kind === 'weapon') return item.owned ? '✅ ĐÃ TRANG BỊ — SẴN SÀNG' : '❌ CHƯA TRANG BỊ';
    if (item.kind === 'gatAmmo') {
      const i = Weapons.list.indexOf(item.w);
      const sp = p.spare ? p.spare[i] : 0;
      return '🧪 TIÊU HAO — đang dự trữ: ' + sp + ' viên';
    }
    return '🧪 TIÊU HAO — dùng ngay khi mua';
  },

  /* gọi mỗi frame khi mở — vẽ panel + xử lý hover */
  updateAndDraw(ctx, mouse) {
    const p = Player.obj;
    if (!p) return;
    const W = 960, H = 600;
    const CW = (ctx.canvas && ctx.canvas.width) || Config.CANVAS_W;   // 🪟 khung nhìn co giãn
    const CH = (ctx.canvas && ctx.canvas.height) || Config.CANVAS_H;
    const x0 = (CW - W) / 2;
    const y0 = (CH - H) / 2 - 10;
    this.rows = [];
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : 0;

    // nền mờ toàn màn + panel
    ctx.fillStyle = 'rgba(3,6,12,0.72)';
    ctx.fillRect(0, 0, CW, CH);
    const bg = ctx.createLinearGradient(x0, y0, x0, y0 + H);
    bg.addColorStop(0, 'rgba(16,26,44,0.98)');
    bg.addColorStop(1, 'rgba(10,16,28,0.98)');
    ctx.fillStyle = bg;
    ctx.fillRect(x0, y0, W, H);
    ctx.strokeStyle = 'rgba(34,211,238,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, W, H);

    /* ── header ── */
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#7df3ff';
    ctx.fillText('🛒 CỬA HÀNG TÀU — Wave ' + Wave.num + ' đã dọn sạch!', x0 + 24, y0 + 14);
    ctx.font = '700 19px Consolas, monospace';
    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'right';
    ctx.fillText(p.money + ' 💰', x0 + W - 24, y0 + 16);
    ctx.textAlign = 'left';

    /* ── GRID ô vuông bên trái ── */
    const items = this.items();
    const GX = x0 + 20, GY = y0 + 58;
    const TW = 146, TH = 112, GAP = 8, COLS = 4;
    const selId = this.sel ? (this.sel.kind === 'weapon' ? 'w:' + this.sel.w.id : this.sel.kind) : null;
    items.forEach((item, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const rect = { x: GX + col * (TW + GAP), y: GY + row * (TH + GAP), w: TW, h: TH };
      const id = item.kind === 'weapon' ? 'w:' + item.w.id : item.kind;
      const isSel = id === selId;
      this.rows.push({ ...rect, action: item });

      const hover = mouse.x >= rect.x && mouse.x <= rect.x + rect.w && mouse.y >= rect.y && mouse.y <= rect.y + rect.h;
      ctx.fillStyle = isSel ? 'rgba(34,211,238,0.18)'
        : hover && item.afford && !item.owned ? 'rgba(255,255,255,0.10)'
        : 'rgba(255,255,255,0.05)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = isSel ? '#22d3ee'
        : item.owned ? 'rgba(74,222,128,0.55)'
        : item.afford ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.10)';
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      // icon nghiêng nhẹ (ô grid không quay — quay ở khung phóng lớn)
      this._drawItem(ctx, item, rect.x + rect.w / 2, rect.y + 38, -0.18, item.kind === 'weapon' ? 0.95 : 0.85);

      // tên món (dòng dưới icon)
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = item.owned ? '#4ade80' : item.afford ? '#dfeaff' : 'rgba(200,215,235,0.45)';
      ctx.textAlign = 'center';
      const nm = item.name.length > 22 ? item.name.slice(0, 21) + '…' : item.name;
      ctx.fillText(nm, rect.x + rect.w / 2, rect.y + 62);

      // giá / ĐÃ CÓ
      ctx.font = '700 12px Consolas, monospace';
      if (item.kind === 'weapon' && item.owned) {
        ctx.fillStyle = '#4ade80';
        ctx.fillText('✔️ ĐÃ CÓ', rect.x + rect.w / 2, rect.y + rect.h - 20);
      } else {
        ctx.fillStyle = item.afford ? '#ffe066' : 'rgba(255,224,102,0.4)';
        ctx.fillText(item.price + ' 💰', rect.x + rect.w / 2, rect.y + rect.h - 20);
      }
      ctx.textAlign = 'left';
    });

    /* ── KHUNG PHÓNG LỚN bên phải: món QUAY quanh điểm cố định ── */
    const DX = GX + COLS * (TW + GAP) + GAP + 12; // mép trái khung chi tiết
    const DW = x0 + W - 24 - DX;
    const DY = GY, DH = Math.max(TH * 3 + GAP * 2, items.length ? Math.ceil(items.length / COLS) * (TH + GAP) - GAP : TH * 3);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(DX, DY, DW, DH);
    ctx.strokeStyle = 'rgba(34,211,238,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(DX, DY, DW, DH);

    const it = this.sel;
    if (it) {
      // ☀️ sân khấu: bóng đổ + món quay chầm chậm quanh điểm cố định
      const pcx = DX + DW / 2, pcy = DY + 92;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(pcx, pcy + 46, 44, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      this._drawItem(ctx, it, pcx, pcy, now * 1.15, it.kind === 'weapon' ? 1.9 : 1.6);

      // tên + giá
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#e8fdff';
      const nameLines = this._wrap(ctx, it.name, DW - 24);
      nameLines.forEach((ln, k) => ctx.fillText(ln, DX + 12, DY + 152 + k * 17));

      // chi tiết tác dụng (wrap từng dòng)
      ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
      let dy = DY + 152 + nameLines.length * 17 + 4;
      for (const d of this._descOf(it)) {
        for (const ln of this._wrap(ctx, d, DW - 24)) {
          ctx.fillStyle = 'rgba(200,225,255,0.8)';
          ctx.fillText(ln, DX + 12, dy);
          dy += 14;
        }
      }

      // trạng thái ĐÃ TRANG BỊ / CHƯA CÓ / TIÊU HAO
      const st = this._statusOf(it, p);
      ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = (it.kind === 'weapon' && it.owned) ? '#4ade80' : '#f0abfc';
      ctx.fillText(st, DX + 12, DY + DH - 62);

      // nút MUA
      const btn = { x: DX + 12, y: DY + DH - 42, w: DW - 24, h: 32 };
      const canBuy = !(it.kind === 'weapon' && it.owned) && it.afford;
      this.rows.push({ ...btn, action: 'buy' });
      const hoverB = mouse.x >= btn.x && mouse.x <= btn.x + btn.w && mouse.y >= btn.y && mouse.y <= btn.y + btn.h;
      ctx.fillStyle = canBuy ? (hoverB ? 'rgba(34,211,238,0.45)' : 'rgba(34,211,238,0.25)')
        : 'rgba(255,255,255,0.08)';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = canBuy ? '#22d3ee' : 'rgba(255,255,255,0.15)';
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
      ctx.textAlign = 'center';
      ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = canBuy ? '#e8fdff' : 'rgba(200,215,235,0.45)';
      const buyLabel = (it.kind === 'weapon' && it.owned) ? '✔️ ĐÃ CÓ RỒI'
        : it.afford ? '🛒 MUA — ' + it.price + ' 💰' : '💸 THIẾU TIỀN';
      ctx.fillText(buyLabel, btn.x + btn.w / 2, btn.y + 7);
      ctx.textAlign = 'left';
    }

    /* ── ÔNG GIÀ CHỦ TIỆM + bong bóng lời thoại ── */
    if (!this.keeper) this._mood('idle');
    Keeper.step(this, now); // trôi giờ + đổi câu CÓ NGHỈ (không nhể chữ mỗi frame nữa)
    this._drawKeeper(ctx, x0 + 74, y0 + H - 14, now, this.keeper.mood);
    this._drawBubble(ctx, x0 + 132, y0 + H - 118, this.keeper.quote, this.keeper.mood);

    /* ── nút ra trận + đồng hồ (🏪 tiệm nghỉ: đồng hồ ĐÓNG BĂNG) ── */
    const btn = { x: x0 + W - 264, y: y0 + H - 52, w: 240, h: 36 };
    this.rows.push({ ...btn, action: 'close' });
    const hoverC = mouse.x >= btn.x && mouse.x <= btn.x + btn.w && mouse.y >= btn.y && mouse.y <= btn.y + btn.h;
    ctx.fillStyle = hoverC ? 'rgba(34,211,238,0.4)' : 'rgba(34,211,238,0.2)';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = '#22d3ee';
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.textAlign = 'center';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#e8fdff';
    const restingShop = window.Wave && Wave.resting;
    ctx.fillText(restingShop ? 'XONG? ĐÓNG TIỆM → CHỌN ĐƯỜNG' : 'RA ĐÁNH TIẾP (' + Math.ceil(Wave.timer) + 's)',
      btn.x + btn.w / 2, btn.y + 9);
    ctx.textAlign = 'left';
    if (restingShop) {
      ctx.textAlign = 'center';
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,209,102,0.85)';
      const bkey = (window.Input && Input.boundKey) ? Input.boundKey('buy') : 'B';
      ctx.fillText('hoặc bấm ' + bkey + ' — tiệm nghỉ KHÔNG có đồng hồ, cứ thoải mái mà xem đồ',
        btn.x + btn.w / 2, btn.y + btn.h + 6);
      ctx.textAlign = 'left';
    }

    /* 🖱️ vẽ con trỏ chuột — canvas đang ẩn cursor CSS (cursor:none) mà tiệm
     * không vẽ tâm ngắm → không biết chuột ở đâu. Con trỏ mũi tên vẽ CUỐI cùng
     * để nằm trên mọi thứ trong panel. Dùng chung cho cả CỬA HÀNG menu. */
    this._drawCursor(ctx, mouse.x, mouse.y);
  },

  /* con trỏ chuột vẽ tay: mũi tên trắng viền đen (giống cursor hệ thống) */
  _drawCursor(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 14.5);
    ctx.lineTo(3.6, 11.2);
    ctx.lineTo(6.2, 17.2);
    ctx.lineTo(9.2, 15.8);
    ctx.lineTo(6.6, 10);
    ctx.lineTo(11.2, 9.2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = 'rgba(10,12,16,0.9)';
    ctx.lineWidth = 1.3;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  /* ── vẽ ông già chủ tiệm (người que cụ già: nón lá + chạc + râu trắng) ── */
  _drawKeeper(ctx, fx, fy, t, mood) {
    const bob = Math.sin(t * 2.2) * 2; // lắc lư già cả
    ctx.save();
    ctx.translate(fx, fy + bob * 0.4);

    // 🔦 hào quang ấm dưới chân (đèn tiệm)
    const g = ctx.createRadialGradient(0, -40, 0, 0, -40, 56);
    g.addColorStop(0, 'rgba(255,200,110,0.16)');
    g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-56, -96, 112, 112);

    // gậy gỗ (tay phải chống)
    ctx.strokeStyle = '#8a6d3b';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(16, -34); ctx.lineTo(19, 0); ctx.stroke();
    ctx.fillStyle = '#6d5427';
    ctx.beginPath(); ctx.arc(16, -36, 3.4, 0, Math.PI * 2); ctx.fill(); // chạc đầu gậy

    // thân áo choàng (cong lưng già)
    ctx.fillStyle = '#4a4258';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-16, -30, -6, -48);
    ctx.lineTo(10, -48);
    ctx.quadraticCurveTo(20, -28, 14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // tay trái đưa ra mời khách
    ctx.strokeStyle = '#4a4258';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(6, -40); ctx.lineTo(22, -34); ctx.stroke();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(23, -33, 2.6, 0, Math.PI * 2); ctx.fill();

    // đầu (nghiêng về khách)
    const hy = -56 + bob * 0.5;
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(2, hy, 8, 0, Math.PI * 2); ctx.fill();

    // 🌾 NÓN LÁ — "ông già" kiểu quê
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath();
    ctx.moveTo(-10, hy - 3);
    ctx.lineTo(14, hy - 3);
    ctx.lineTo(2, hy - 15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#9a7b42';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath(); // vành nón
    ctx.moveTo(-12, hy - 2.4); ctx.lineTo(16, hy - 2.4); ctx.stroke();

    // 🧔 RÂU TRẮNG dài xuống ngực
    ctx.fillStyle = '#e9edf2';
    ctx.beginPath();
    ctx.moveTo(-5, hy + 4);
    ctx.quadraticCurveTo(2, hy + 16, 9, hy + 4);
    ctx.quadraticCurveTo(8, hy + 30, 2, hy + 34);
    ctx.quadraticCurveTo(-4, hy + 30, -5, hy + 4);
    ctx.closePath();
    ctx.fill();

    // lông mày trắng — CAU CÓ thì chếch xuống, vui thì cong lên
    ctx.strokeStyle = '#e9edf2';
    ctx.lineWidth = 2.4;
    const ex = 2; // giữa mặt
    ctx.beginPath();
    if (mood === 'angry') { ctx.moveTo(ex - 5, hy - 4); ctx.lineTo(ex - 1, hy - 2); ctx.moveTo(ex + 1, hy - 2); ctx.lineTo(ex + 5, hy - 4); }
    else if (mood === 'happy' || mood === 'encourage') { ctx.moveTo(ex - 5, hy - 3); ctx.quadraticCurveTo(ex - 3, hy - 5, ex - 1, hy - 3); ctx.moveTo(ex + 1, hy - 3); ctx.quadraticCurveTo(ex + 3, hy - 5, ex + 5, hy - 3); }
    else { ctx.moveTo(ex - 5, hy - 3); ctx.lineTo(ex - 1, hy - 3); ctx.moveTo(ex + 1, hy - 3); ctx.lineTo(ex + 5, hy - 3); }
    ctx.stroke();

    // mắt (vui: cười chữ ^ — khác: chấm tròn)
    ctx.fillStyle = '#2b2530';
    if (mood === 'happy' || mood === 'encourage') {
      ctx.lineWidth = 1.6; ctx.strokeStyle = '#2b2530';
      ctx.beginPath(); ctx.arc(ex - 3, hy + 1, 2, Math.PI, 0, true); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex + 3, hy + 1, 2, Math.PI, 0, true); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(ex - 3, hy + 1, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 3, hy + 1, 1.4, 0, Math.PI * 2); ctx.fill();
    }

    // miệng — ẩn sau râu: vui nhô cười lên, cau có nhó râu xệ
    ctx.strokeStyle = mood === 'happy' || mood === 'encourage' ? '#e8b98a' : '#c9a08a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (mood === 'happy' || mood === 'encourage') { ctx.arc(ex, hy + 6, 3, 0.15 * Math.PI, 0.85 * Math.PI); }
    else if (mood === 'angry' || mood === 'sad') { ctx.arc(ex, hy + 9, 3, 1.15 * Math.PI, 1.85 * Math.PI); }
    else { ctx.moveTo(ex - 2, hy + 7); ctx.lineTo(ex + 2, hy + 7); }
    ctx.stroke();

    // hiệu ứng tâm trạng: 😡 hắt hơi nóng · 😢 giọt nước mắt · 😊 lấp lánh
    if (mood === 'angry') {
      ctx.fillStyle = '#ff5a5a';
      ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('💢', 12, hy - 16);
    } else if (mood === 'sad') {
      ctx.fillStyle = 'rgba(125,211,252,0.9)';
      ctx.beginPath();
      ctx.ellipse(ex - 3, hy + 5 + Math.sin(t * 3) * 2, 1.6, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mood === 'happy') {
      ctx.fillStyle = '#ffe066';
      ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('✨', 13, hy - 14);
    }
    ctx.restore();
  },

  /* ── bong bóng thoại ông già ── */
  _drawBubble(ctx, bx, by, quote, mood) {
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    const lines = this._wrap(ctx, quote || '', 330).slice(0, 3);
    if (!lines.length) return;
    const bw = 356, bh = 18 + lines.length * 17;
    // đuôi bong bóng chỉ về ông già
    ctx.fillStyle = mood === 'angry' ? 'rgba(255,235,235,0.96)' : 'rgba(255,250,235,0.96)';
    ctx.beginPath();
    ctx.moveTo(bx + 26, by + bh - 4);
    ctx.lineTo(bx + 8, by + bh + 16);
    ctx.lineTo(bx + 44, by + bh - 2);
    ctx.closePath();
    ctx.fill();
    // thân bong bóng (bo góc)
    ctx.beginPath();
    const r = 10;
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by); ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
    ctx.lineTo(bx + bw, by + bh - r); ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
    ctx.lineTo(bx + 44, by + bh); ctx.lineTo(bx + 26, by + bh - 4);
    ctx.lineTo(bx + r, by + bh); ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
    ctx.lineTo(bx, by + r); ctx.arcTo(bx, by, bx + r, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mood === 'happy' ? 'rgba(255,209,64,0.7)'
      : mood === 'angry' ? 'rgba(255,90,90,0.7)' : 'rgba(150,160,180,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // chữ
    ctx.fillStyle = '#2b2530';
    ctx.textAlign = 'left';
    lines.forEach((ln, i) => ctx.fillText(ln, bx + 14, by + 10 + i * 17));
  },

  /* ── xử lý bấm (host/chơi đơn); guest đi qua main.js gửi tin nhắn ── */
  _tryBuy() {
    const it = this.sel;
    if (!it) { AudioFX.empty(); return; }
    // 🤝 guest: MUA = gửi yêu cầu — host quyết, mình chỉ chờ toast
    if (window.Net && Net.mode === 'guest') {
      Net.send({ t: 'buy', kind: it.kind, w: it.kind === 'weapon' ? it.w.id : null });
      return;
    }
    const p = Player.obj;
    // lấy lại món MỚI NHẤT (giá/afford/owned có thể đã đổi sau khi mua món khác)
    const fresh = this.items(p).find((x) => x.kind === it.kind
      && (x.kind !== 'weapon' || (x.w && x.w.id === it.w.id)));
    if (!fresh) { this._mood('sad'); AudioFX.empty(); return; }
    if (fresh.kind === 'weapon' && fresh.owned) { this._mood('angry'); AudioFX.empty(); return; }
    if (!fresh.afford) { this._mood('angry'); AudioFX.empty(); return; }
    this.buy(fresh, p);
    this._bought = true;
    this._mood('happy'); // 😄 "quý khách thật có con mắt tinh tường!"
  },

  // trả về true nếu click vừa được "tiêu" bởi cửa hàng
  handleClick(mx, my) {
    if (!this.open) return false;
    for (const r of this.rows) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        if (r.action === 'close') {
          // ra về KHÔNG mua gì → ông già nhớ mặt, lần sau mở tiệm là buồn/cau có
          if (!this._bought) this._afterMood = Math.random() < 0.5 ? 'sad' : 'encourage';
          this.setOpen(false);
        } else if (r.action === 'buy') {
          this._tryBuy();
        } else {
          // bấm ô grid = CHỌN XEM (không mua luôn — mua bấm nút MUA)
          this.sel = r.action;
          AudioFX.click();
        }
        return true;
      }
    }
    return true; // đang mở: nuốt mọi click (không bắn được khi đi mua đồ)
  },
};
