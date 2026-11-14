/* =========================================================
 * PROPS — 🛢️ VẬT THỂ PHÁ ĐƯỢC rải ngẫu nhiên trên map
 * • 3 loại: 🛢️ thùng nổ TO (vỡ là nổ lớn, dãn nổ dây chuyền),
 *           📦 thùng gỗ (vỡ rơi vàng 20-35💰), 🔧 ống ga (vỡ nổ nhỏ hơi ga)
 * • GIỐNG CÂY: KHÔNG chặn người đi lại (đi xuyên qua được) nhưng
 *   CHẶN ĐẠN + che tầm nhìn → cover động, đập được là mất chỗ nấp!
 * • Nổ của thùng là TRUNG LẬP (đội 'X') — trúng cả người lẫn quái,
 *   nổ lan dãn dây chuyền: bắn 1 thùng giữa bầy thùng = pháo hoa.
 * • Đạn thường + rocket/plasma/lựu đạn đều phá được. Vỡ xong mất hẳn.
 * ========================================================= */
window.Props = {
  list: [],

  clear() { this.list.length = 0; },

  /* Rải ngẫu nhiên PER_MAP vật trên mặt đất, tránh chỗ spawn + tránh chồng nhau.
   * Loại random theo Config.PROPS.TYPES.chance. Trả về số vật đã rải. */
  spawnForMap(mapDef) {
    this.clear();
    const P = Config.PROPS;
    // dò các cột có sàn để đứng (mặt đất thấp nhất)
    const spots = [];
    for (let c = 0; c < Level.cols; c++) {
      const baseY = this._baseYAt(c);
      if (baseY < Level.pxH) spots.push({ x: c * Level.T + Level.T / 2, baseY });
    }
    if (!spots.length) return 0;
    // tránh chỗ xuất phát của 2 đội (cả wave lẫn DM)
    const avoid = [];
    const sp = mapDef.spawns || {};
    for (const arr of [sp.A, sp.B, sp.wave, ...(Array.isArray(sp) ? [sp] : [])]) {
      if (Array.isArray(arr)) for (const s of arr) avoid.push(s);
    }
    let tries = 0;
    // 3 vật đầu ép đủ 3 LOẠI (đảm bảo map nào cũng có đủ thùng nổ/gỗ/ống ga), còn lại random
    const forced = ['barrel', 'crate', 'pipe'];
    while (this.list.length < P.PER_MAP && tries < 300) {
      tries++;
      const s = spots[Math.floor(Math.random() * spots.length)];
      // không đặt gần spawn
      if (avoid.some((a) => Math.hypot((a[0] || a.x) - s.x, (a[1] || a.y) - s.baseY) < P.SPAWN_CLEAR)) continue;
      // không chồng vật cũ
      if (this.list.some((pr) => Math.abs(pr.x - s.x) < P.MIN_GAP && Math.abs(pr.baseY - s.baseY) < 80)) continue;
      const type = forced.length ? forced.shift() : this._rollType();
      this.list.push(this._make(type, s.x, s.baseY));
    }
    return this.list.length;
  },

  _rollType() {
    const roll = Math.random();
    const T = Config.PROPS.TYPES;
    let acc = 0;
    for (const id in T) {
      acc += T[id].chance;
      if (roll <= acc) return id;
    }
    return 'crate';
  },

  _make(type, x, baseY) {
    const T = Config.PROPS.TYPES[type];
    return {
      type, x, baseY,
      w: T.w, h: T.h,
      hp: T.hp, maxHp: T.hp,
      gone: false, shake: 0,
    };
  },

  /* Mặt đất thấp nhất của cột ô c (giống Trees) */
  _baseYAt(c) {
    for (let r = Level.rows - 2; r >= 0; r--) {
      if (Level.isSolid(Level.tileAt(c, r))) return r * Level.T;
    }
    return Level.pxH;
  },

  _propAt(x, y) {
    for (const p of this.list) {
      if (p.gone) continue;
      if (x >= p.x - p.w / 2 - 2 && x <= p.x + p.w / 2 + 2
        && y >= p.baseY - p.h - 2 && y <= p.baseY) return p;
    }
    return null;
  },

  /* Ô (x,y) có bị vật thể chặn đạn/tầm nhìn không? (Level.blocksShotAt gọi qua) */
  blocksShotAt(x, y) { return !!this._propAt(x, y); },

  /* Đạn thường cắm vào vật → mất máu theo đạn. Hết máu → theo loại:
   * barrel/pipe NỔ (trung lập, dãn dây chuyền) · crate RƠI VÀNG. */
  hitAt(x, y, dmg) {
    const p = this._propAt(x, y);
    if (!p || p.gone) return false;
    p.hp = Math.max(0, p.hp - dmg);
    p.shake = 0.22;
    const debris = p.type === 'crate' ? '#8a5a2b' : (p.type === 'barrel' ? '#b33a2b' : '#9db4c4');
    Particles.sparks(x, y, -Math.PI / 2 + (Math.random() - 0.5) * 1.2, 5, debris);
    if (p.hp <= 0) this._break(p);
    return true;
  },

  /* Vụ nổ (rocket/plasma/lựu đạn/thùng khác) quét qua: vật trong bán kính vỡ luôn */
  explodeAt(x, y, radius) {
    if (!(radius > 0)) return;
    // chụp danh sách trước để dây chuyền không sửa mảng đang duyệt
    const hit = this.list.filter((p) => !p.gone
      && Math.hypot(p.x - x, p.baseY - p.h * 0.5 - y) <= radius + 26);
    for (const p of hit) {
      p.hp = 0;
      this._break(p);
    }
    return hit.length; // số vật vỡ vì vụ nổ này (test dùng)
  },

  _break(p) {
    if (p.gone) return;
    p.gone = true;
    const BOOM = Config.PROPS.BOOM;
    if (p.type === 'crate') {
      // 📦 vỡ: gỗ vụn + rơi vàng 20-35💰 → về túi NGƯỜI GẦN NHẤT còn sống (co-op)
      const [lo, hi] = Config.PROPS.LOOT.crate;
      const gold = lo + Math.floor(Math.random() * (hi - lo + 1));
      const who = Player.nearest(p.x, p.baseY - p.h * 0.5) || Player.obj;
      if (who) {
        if (window.Net && Net.mode === 'host' && who.idx !== 0) Net.fx({ k: 'gold', v: gold });
        else if (window.Gold) Gold.add(gold);
        who.money += gold;
      }
      Particles.text(p.x, p.baseY - p.h - 8, '+' + gold + '💰', '#ffe066', 13);
      Particles.sparks(p.x, p.baseY - p.h * 0.5, -Math.PI / 2, 12, '#8a5a2b');
      Particles.smoke(p.x, p.baseY - 10, 4);
      AudioFX.click();
      return;
    }
    // 🛢️/🔧 NỔ — trung lập (đội 'X' trúng cả người lẫn quái), có thể dãn dây chuyền
    const B = BOOM[p.type] || BOOM.pipe;
    Particles.sparks(p.x, p.baseY - p.h * 0.5, -Math.PI / 2, 10, '#ffb347');
    Bullets.explode(p.x, p.baseY - p.h * 0.5,
      { damage: B.damage, explodeRadius: B.radius, shakeOnBoom: 5 }, 'X');
  },

  update(dt) {
    for (const p of this.list) p.shake = Math.max(0, p.shake - dt);
  },

  draw(ctx) {
    for (const p of this.list) {
      if (p.gone) continue;
      const sx = p.shake > 0 ? Math.sin(p.shake * 55) * 3 * (p.shake / 0.22) : 0;
      const bx = p.x + sx, top = p.baseY - p.h;
      const frac = Math.max(0, p.hp) / p.maxHp;

      if (p.type === 'barrel') {
        /* thùng dầu đỏ sậm + vạch vàng cảnh báo — càng vỡ càng nứt */
        ctx.fillStyle = '#8f2f22';
        ctx.fillRect(bx - 13, top + 4, 26, p.h - 4);
        ctx.fillStyle = '#b33a2b';
        ctx.fillRect(bx - 13, top + 4, 26, 5);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(bx - 13, p.baseY - p.h * 0.42, 26, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(bx + 5, top + 9, 5, p.h - 13);
        if (frac < 0.6) { // nứt
          ctx.strokeStyle = 'rgba(20,10,8,0.85)'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx - 8, top + 10); ctx.lineTo(bx - 2, top + 18); ctx.lineTo(bx - 9, top + 24);
          ctx.stroke();
        }
      } else if (p.type === 'crate') {
        /* thùng gỗ nâu + nan chéo — mờ dần theo máu */
        ctx.globalAlpha = 0.45 + 0.55 * frac;
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(bx - 15, top, 30, p.h);
        ctx.fillStyle = '#93643a';
        ctx.fillRect(bx - 15, top, 30, 4);
        ctx.strokeStyle = '#5d3d20'; ctx.lineWidth = 2;
        ctx.strokeRect(bx - 15, top, 30, p.h);
        ctx.beginPath();
        ctx.moveTo(bx - 15, top); ctx.lineTo(bx + 15, p.baseY);
        ctx.moveTo(bx + 15, top); ctx.lineTo(bx - 15, p.baseY);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        /* ống ga xám dựng đứng + van tròn — xì hơi khi yếu */
        ctx.fillStyle = '#7d8fa0';
        ctx.fillRect(bx - 6, top + 8, 12, p.h - 8);
        ctx.fillStyle = '#a9bccb';
        ctx.fillRect(bx - 6, top + 8, 4, p.h - 8);
        ctx.fillStyle = '#5f707e';
        ctx.fillRect(bx - 8, p.baseY - 5, 16, 5);
        ctx.beginPath(); ctx.arc(bx, top + 6, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c9d6e0';
        ctx.beginPath(); ctx.arc(bx - 2, top + 4, 2.2, 0, Math.PI * 2); ctx.fill();
        if (frac < 0.5) { // rò ga — chấm khói nhỏ báo hiệu nguy hiểm
          Particles.add({ type: 'smoke', x: bx + (Math.random() - 0.5) * 6, y: top + 8,
            vx: (Math.random() - 0.5) * 16, vy: -28, life: 0.5, size: 2 + Math.random() * 2, gravity: -30 });
        }
      }
    }
  },
};
