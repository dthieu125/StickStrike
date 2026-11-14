/* =========================================================
 * SHOP — cửa hàng giữa các đợt wave (vẽ bằng canvas, bấm bằng chuột)
 * Mở tự động trong giờ nghỉ. Mua: SÚNG (mở khoá), ĐẠN (nạp đầy),
 * HỒI MÁU. Đóng bằng nút "Ra đánh tiếp" hoặc hết giờ.
 * ========================================================= */
window.Shop = {
  open: false,
  rows: [], // vùng bấm [{x,y,w,h,action}]

  setOpen(v) {
    this.open = v;
  },

  toggle() { this.open = !this.open; },

  // trả về danh sách món hàng kèm giá/trạng thái
  items() {
    const p = Player.obj;
    const list = [];
    for (const w of Weapons.list) {
      if (w.price > 0) {
        list.push({
          kind: 'weapon', w,
          name: w.name, price: w.price,
          owned: p.owned.has(w.id),
          afford: p.money >= w.price,
        });
      }
    }
    list.push({
      kind: 'refill', name: 'Nạp đầy đạn mọi khẩu (kể cả dự trữ)', price: 50,
      afford: p.money >= 50, owned: false,
    });
    list.push({
      kind: 'medkit', name: 'Hồi máu +' + 50 + ' HP', price: 75,
      afford: p.money >= 75, owned: false,
    });
    return list;
  },

  buy(item) {
    const p = Player.obj;
    if (!item.afford) { AudioFX.empty(); return; }
    if (item.kind === 'weapon') {
      if (item.owned) return;
      p.money -= item.price;
      p.owned.add(item.w.id);
      p.spare[Weapons.list.indexOf(item.w)] = Infinity; // súng MUA = đạn vô hạn (khác súng LỤM)
      showToast('Đã mua ' + item.w.name + '! (phím ' + ((Weapons.list.indexOf(item.w) + 1) % 10) + ')');
    } else if (item.kind === 'refill') {
      p.money -= item.price;
      Weapons.list.forEach((w, i) => {
        if (!p.owned.has(w.id)) return;
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

  /* gọi mỗi frame khi mở — vẽ panel + xử lý click */
  updateAndDraw(ctx, mouse) {
    const p = Player.obj;
    const W = 720, H = 420;
    const x0 = (Config.CANVAS_W - W) / 2;
    const y0 = (Config.CANVAS_H - H) / 2 - 10;
    this.rows = [];

    // nền mờ toàn màn + panel
    ctx.fillStyle = 'rgba(3,6,12,0.72)';
    ctx.fillRect(0, 0, Config.CANVAS_W, Config.CANVAS_H);
    ctx.fillStyle = 'rgba(12,20,34,0.96)';
    ctx.strokeStyle = 'rgba(34,211,238,0.55)';
    ctx.lineWidth = 2;
    ctx.fillRect(x0, y0, W, H);
    ctx.strokeRect(x0, y0, W, H);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#7df3ff';
    ctx.fillText('🛒 CỬA HÀNG TÀU — Wave ' + Wave.num + ' đã dọn sạch!', x0 + 24, y0 + 16);
    ctx.font = '600 17px Consolas, monospace';
    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'right';
    ctx.fillText(p.money + ' 💰', x0 + W - 24, y0 + 20);
    ctx.textAlign = 'left';

    // danh sách hàng — 2 cột
    const items = this.items();
    const colW = (W - 48) / 2;
    let rowH = 44;
    items.forEach((item, i) => {
      const cx = x0 + 24 + (i % 2) * (colW + 12);
      const cy = y0 + 60 + Math.floor(i / 2) * rowH;
      const rect = { x: cx, y: cy, w: colW, h: rowH - 8 };
      this.rows.push({ ...rect, action: item });

      const hover = mouse.x >= rect.x && mouse.x <= rect.x + rect.w && mouse.y >= rect.y && mouse.y <= rect.y + rect.h;
      ctx.fillStyle = hover && item.afford && !item.owned ? 'rgba(34,211,238,0.22)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = item.owned ? 'rgba(74,222,128,0.6)' : item.afford ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      ctx.fillStyle = item.owned ? '#4ade80' : item.afford ? '#e8fdff' : 'rgba(200,215,235,0.4)';
      ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
      const label = item.kind === 'weapon' ? (item.owned ? '[ĐÃ CÓ] ' : '') + item.name : item.name;
      ctx.fillText(label, rect.x + 10, rect.y + 6);

      ctx.font = '600 13px Consolas, monospace';
      if (item.kind === 'weapon' && item.owned) {
        ctx.fillStyle = '#4ade80';
        ctx.fillText('SẴN SÀNG', rect.x + rect.w - 70, rect.y + 8);
      } else {
        ctx.fillStyle = item.afford ? '#ffe066' : 'rgba(255,224,102,0.35)';
        ctx.fillText(item.price + ' 💰', rect.x + rect.w - 64, rect.y + 8);
      }
    });

    // nút ra trận + đồng hồ (🏪 tiệm nghỉ: đồng hồ ĐÓNG BĂNG → đổi chữ báo "chọn đường")
    const btn = { x: x0 + W / 2 - 110, y: y0 + H - 52, w: 220, h: 36 };
    this.rows.push({ ...btn, action: 'close' });
    const hoverB = mouse.x >= btn.x && mouse.x <= btn.x + btn.w && mouse.y >= btn.y && mouse.y <= btn.y + btn.h;
    ctx.fillStyle = hoverB ? 'rgba(34,211,238,0.4)' : 'rgba(34,211,238,0.2)';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = '#22d3ee';
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.textAlign = 'center';
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#e8fdff';
    const restingShop = window.Wave && Wave.resting;
    ctx.fillText(restingShop ? 'XONG? ĐÓNG TIỆM → CHỌN ĐƯỜNG' : 'RA ĐÁNH TIẾP (' + Math.ceil(Wave.timer) + 's)',
      Config.CANVAS_W / 2, btn.y + 8);
    ctx.textAlign = 'left';
    if (restingShop) {
      ctx.textAlign = 'center';
      ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,209,102,0.85)';
      const bkey = (window.Input && Input.boundKey) ? Input.boundKey('buy') : 'B';
      ctx.fillText('hoặc bấm ' + bkey + ' — tiệm nghỉ KHÔNG có đồng hồ, cứ thoải mái mà xem đồ',
        Config.CANVAS_W / 2, btn.y + btn.h + 8);
      ctx.textAlign = 'left';
    }
  },

  // trả về true nếu click vừa được "tiêu" bởi cửa hàng
  handleClick(mx, my) {
    if (!this.open) return false;
    for (const r of this.rows) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        if (r.action === 'close') this.setOpen(false);
        else this.buy(r.action);
        return true;
      }
    }
    return true; // đang mở: nuốt mọi click (không bắn được khi đi mua đồ)
  },
};
