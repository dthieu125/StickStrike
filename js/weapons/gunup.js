/* =========================================================
 * GUNUP — 🔧 NÂNG CẤP SÚNG bằng vàng (lưu vĩnh viễn ss_gunLv)
 * Mỗi khẩu 5 cấp (Config.UPGRADE): mỗi cấp +10% dame · +10% băng · nạp nhanh 5%.
 * Cấp 3 mở ALT-FIRE (bắn phụ) · cấp 5 mở PERK riêng từng khẩu.
 * Mua ở 🏪 MARKET (menu chính) bằng VÀNG TÍCH LUỸ — cấp độ giữ qua các trận.
 * Player.fire / startReload / băng đạn... đọc qua GunUp.stats() nên cấp độ
 * áp dụng ngay cho mọi chế độ (wave + deathmatch). Bot KHÔNG được nâng cấp.
 * ========================================================= */
window.GunUp = {
  lv: {}, // id khẩu súng → cấp 0..5

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('ss_gunLv') || 'null');
      if (saved) {
        for (const w of Weapons.list) {
          if (typeof saved[w.id] === 'number') {
            this.lv[w.id] = Math.max(0, Math.min(Config.UPGRADE.MAX_LV, Math.floor(saved[w.id])));
          }
        }
      }
    } catch (e) { /* file lưu hỏng → bỏ qua */ }
  },
  save() {
    try { localStorage.setItem('ss_gunLv', JSON.stringify(this.lv)); } catch (e) { /* Ignore */ }
  },

  lvl(id) { return this.lv[id] || 0; },

  /* Giá lên CẤP KẾ tiếp — càng lên càng đắt (lv0→1 rẻ nhất, lv4→5 đắt nhất) */
  cost(w) {
    const base = Math.max(w.price, Config.UPGRADE.COST_BASE_MIN);
    return Math.round(base * Config.UPGRADE.COST_MUL * (this.lvl(w.id) + 1));
  },

  /* Mua 1 cấp: trừ vàng tích luỹ, +1 cấp, lưu. Trả true nếu thành công. */
  buy(id) {
    const w = Weapons.list.find((x) => x.id === id);
    if (!w) return false;
    if (this.lvl(id) >= Config.UPGRADE.MAX_LV) return false;
    if (!Gold.spend(this.cost(w))) return false;
    this.lv[id] = this.lvl(id) + 1;
    this.save();
    return true;
  },

  /* Thẻ súng SAU NÂNG CẤP — mọi chỗ tính dame/băng/nạp đều đọc qua đây.
   * (lv 0 → đúng số gốc; lv cao → nhân hệ số + perk lv5) */
  stats(w) {
    const lv = this.lvl(w.id);
    const s = {
      ...w,
      damage: w.damage * (1 + lv * Config.UPGRADE.DMG_PER_LV),
      mag: Math.round(w.mag * (1 + lv * Config.UPGRADE.MAG_PER_LV)),
      reload: w.reload * (1 - lv * Config.UPGRADE.RELOAD_PER_LV),
      spread: w.spread,
      pellets: w.pellets,
      explodeRadius: w.explodeRadius,
      headMult: w.headMult,
    };
    if (lv >= Config.UPGRADE.PERK_LV) {
      switch (w.id) {
        case 'pistol':  s.reload *= 0.85; break;              // nòng ngắn
        case 'revolver': s.damage *= 1.15; break;             // đạn nóng
        case 'smg':     s.spread *= 0.75; break;              // bớt phụt
        case 'shotgun': s.pellets += 1; break;                // +1 viên bi
        case 'rifle':   s.pierceBase = 1; break;              // đạn AP xuyên 1 bia
        case 'minigun': s.mag = Math.round(s.mag * 1.25); break; // băng đôi
        case 'sniper':  s.headMult = 2.5; break;              // headshot ×2.5
        case 'rail':    s.reload *= 0.8; break;               // cuộn siêu dẫn
        case 'rocket':  s.explodeRadius = Math.round(s.explodeRadius * 1.2); break;
        case 'plasma':  s.explodeRadius = Math.round(s.explodeRadius * 1.15); break;
      }
    }
    s.reload = Math.max(0.2, s.reload); // nạp không thể nhanh hơn 0.2s
    return s;
  },

  /* Băng đạn hiện tại của khẩu (đã cộng nâng cấp) */
  mag(w) { return this.stats(w).mag; },

  /* ALT-FIRE đã mở chưa (cấp 3) — minigun là "giữ" nên vẫn tính mở */
  altOpen(w) { return this.lvl(w.id) >= Config.UPGRADE.ALT_LV; },
};
