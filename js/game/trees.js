/* =========================================================
 * TREES — CÂY CỐI PHÁ ĐƯỢC (map 🌲 RỪNG, deathmatch)
 * • Cây KHÔNG chặn người đi lại (len lỏi giữa cây như rừng thật)
 *   nhưng CHẶN ĐẠN + che tầm nhìn → chỗ ẩn nấp tự nhiên
 * • Bắn trúng cây: cây mất máu theo SÁT THƯƠNG viên đạn → cụt dần
 *   TỪ NGỌN XUỐNG (tán lá rụng bớt, thân ngắn dần, rung lắc) —
 *   hết máu còn lại GỐC cây, không mất hẳn (như bị cưa đổ)
 * • Đạn nổ (tên lửa 🔥, plasma): cây trong bán kính nổ BAY MÀU
 *   cả cây kể cả gốc, chỉ còn vết cháy
 * ========================================================= */
window.Trees = {
  list: [],

  clear() { this.list.length = 0; },

  /* Dựng cây theo bản đồ: mapDef.trees = [{ c: cột ô, h: số ô cao }, ...]
   * Cây mọc trên mặt đất thấp nhất của cột đó (tự dò xuống tìm sàn). */
  spawnForMap(mapDef) {
    this.clear();
    for (const t of (mapDef.trees || [])) {
      const h = t.h * Level.T;
      this.list.push({
        x: t.c * Level.T + Level.T / 2,  // tâm thân
        baseY: this._baseYAt(t.c),       // mặt đất chỗ cây đứng
        h,
        hp: 70 + t.h * 4, maxHp: 70 + t.h * 4, // cây to trâu hơn chút
        gone: false,                     // nổ tan xác → không vẽ gì nữa
        shake: 0,                        // rung khi vừa trúng đạn
      });
    }
    return this.list.length;
  },

  /* Mặt đất thấp nhất của cột ô c (tồn_col có khối đặc ở đâu thì cây mọc trên đó) */
  _baseYAt(c) {
    for (let r = Level.rows - 2; r >= 0; r--) {
      if (Level.isSolid(Level.tileAt(c, r))) return r * Level.T;
    }
    return Level.pxH;
  },

  /* Chiều cao CÒN LẠI của cây theo máu — cụt dần từ ngọn xuống,
   * hết máu còn ~16% (gốc cây) */
  _visH(t) {
    return t.h * (0.16 + 0.84 * Math.max(0, t.hp) / t.maxHp);
  },

  /* Cây chứa điểm (x, y) nào không? (thân + tán lá khi còn nhiều lá) */
  _treeAt(x, y) {
    for (const t of this.list) {
      if (t.gone) continue;
      const vh = this._visH(t);
      // thân cây
      if (x >= t.x - 12 && x <= t.x + 12 && y >= t.baseY - vh && y <= t.baseY) return t;
      // tán lá — chỉ còn khi cây còn >45% máu (bắn nhiều lá rụng hết)
      if (t.hp > t.maxHp * 0.45) {
        const frac = (t.hp / t.maxHp - 0.45) / 0.55; // 0..1 theo máu
        const cw = t.h * 0.55 * (0.6 + 0.4 * frac), ch = t.h * 0.42 * (0.6 + 0.4 * frac);
        const cy = t.baseY - vh - ch * 0.3;
        if (x >= t.x - cw / 2 && x <= t.x + cw / 2 && y >= cy - ch / 2 && y <= cy + ch / 2) return t;
      }
    }
    return null;
  },

  /* Ô (x, y) có bị cây chặn đạn/tầm nhìn không? (Level.blocksShotAt gọi qua) */
  blocksShotAt(x, y) { return !!this._treeAt(x, y); },

  /* Viên đạn (không nổ) cắm vào cây → cây mất máu theo sát thương,
   * gỗ vụn văng. Hết máu → đổ về gốc, chỉ còn GỐC. */
  hitAt(x, y, dmg) {
    const t = this._treeAt(x, y);
    if (!t || t.gone) return false;
    const wasStanding = t.hp > 0;
    t.hp = Math.max(0, t.hp - dmg);
    t.shake = 0.22;
    Particles.sparks(x, y, -Math.PI / 2 + (Math.random() - 0.5) * 1.2, 5, '#8a5a2b'); // gỗ vụn
    Particles.smoke(x, y, 1);
    if (wasStanding && t.hp <= 0) {
      // cây bị CẮT đổ — tán lá rụng tung tóe
      Particles.sparks(t.x, t.baseY - t.h * 0.7, -Math.PI / 2, 10, '#4ade80');
      Particles.sparks(t.x, t.baseY - t.h * 0.5, -Math.PI / 2, 8, '#8a5a2b');
      Particles.smoke(t.x, t.baseY - 20, 4);
    }
    return true;
  },

  /* Vụ nổ (tên lửa/plasma) quét qua: cây trong bán kính BAY MÀU cả cây
   * kể cả gốc — "không còn cả cái cây" */
  explodeAt(x, y, radius) {
    if (!(radius > 0)) return; // đạn không nổ → thôi
    for (const t of this.list) {
      if (t.gone) continue;
      const d = Math.hypot(t.x - x, t.baseY - t.h * 0.4 - y); // ~tâm khối cây
      if (d > radius + 30) continue;
      t.gone = true;
      Particles.sparks(t.x, t.baseY - t.h * 0.5, -Math.PI / 2, 14, '#8a5a2b');
      Particles.sparks(t.x, t.baseY - t.h * 0.6, -Math.PI / 2, 12, '#4ade80');
      Particles.smoke(t.x, t.baseY - t.h * 0.3, 5);
    }
  },

  update(dt) {
    for (const t of this.list) t.shake = Math.max(0, t.shake - dt);
  },

  draw(ctx) {
    for (const t of this.list) {
      if (t.gone) continue;
      const vh = this._visH(t);
      const frac = Math.max(0, t.hp) / t.maxHp;
      // rung lắc khi vừa trúng đạn
      const sx = t.shake > 0 ? Math.sin(t.shake * 55) * 4 * (t.shake / 0.22) : 0;

      /* thân — hình thang, rộng gốc hẹp ngọn */
      ctx.fillStyle = '#6b4a2b';
      ctx.beginPath();
      ctx.moveTo(t.x - 15 + sx, t.baseY);
      ctx.lineTo(t.x - 9 + sx, t.baseY - vh);
      ctx.lineTo(t.x + 9 + sx, t.baseY - vh);
      ctx.lineTo(t.x + 15 + sx, t.baseY);
      ctx.closePath();
      ctx.fill();
      // vân bóng bên thân
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(t.x + 3 + sx, t.baseY - vh + 4, 5, Math.max(0, vh - 6));

      if (t.hp > 0 && frac > 0.45) {
        /* tán lá 3 lớp — càng bắn càng thưa (co lại theo máu) */
        const s = (frac - 0.45) / 0.55;
        const cw = t.h * 0.55 * (0.6 + 0.4 * s), ch = t.h * 0.42 * (0.6 + 0.4 * s);
        const cy = t.baseY - vh - ch * 0.3;
        ctx.fillStyle = '#1e5c2e';
        ctx.beginPath(); ctx.ellipse(t.x + sx, cy, cw * 0.5, ch * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2f7a3d';
        ctx.beginPath(); ctx.ellipse(t.x + sx - cw * 0.12, cy - ch * 0.16, cw * 0.38, ch * 0.37, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3f9c4d';
        ctx.beginPath(); ctx.ellipse(t.x + sx + cw * 0.08, cy - ch * 0.3, cw * 0.26, ch * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      } else if (t.hp > 0) {
        /* trơ cành gãy — cây bị bắn nát tán */
        ctx.strokeStyle = '#6b4a2b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(t.x + sx, t.baseY - vh);
        ctx.lineTo(t.x - 14 + sx, t.baseY - vh - 12);
        ctx.moveTo(t.x + sx, t.baseY - vh + 8);
        ctx.lineTo(t.x + 13 + sx, t.baseY - vh - 6);
        ctx.stroke();
      } else {
        /* GỐC CÂY — mặt cắt xéo màu gỗ sáng */
        ctx.fillStyle = '#a0784a';
        ctx.beginPath();
        ctx.ellipse(t.x + sx, t.baseY - vh, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(107, 74, 43, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(t.x + sx, t.baseY - vh, 6, 2.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  },
};
