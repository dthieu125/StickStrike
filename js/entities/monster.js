/* =========================================================
 * MONSTERS — quái vật chế độ Sinh tồn
 * ┌──────────┬────────────────────────────────────────────────┐
 * │ Crawler  │ nhỏ, nhanh, lao vào cắn (12 dmg)               │
 * │ Spitter  │ giữ khoảng cách, phun axit theo VÒNG CUNG      │
 * │ Brute    │ to, chậm, máu trâu, đập 25 dmg + bật lùi       │
 * │ Tank     │ GIÁP PHÍA TRƯỚC: đạn trúng ngực chỉ 20% dmg    │
 * │          │ → phải bắn LƯNG hoặc headshot; đập 20 dmg      │
 * │ Kamikaze │ lao rất nhanh, đến gần là TỰ NỔ (45 dmg vùng); │
 * │          │ bị bắn chết cũng nổ — bắn từ xa kẻo vạ!        │
 * │ Sniper   │ đứng RẤT xa, có TIA ĐỎ cảnh báo 0.7s rồi bắn   │
 * └──────────┴────────────────────────────────────────────────┘
 * Quái cũng là "người que" — phân biệt bằng màu + dáng + mắt đỏ.
 * ========================================================= */
window.Monsters = {
  list: [],

  /* súng bắn tỉa của quái sniper (dùng chung hệ hitscan của Bullets) */
  SNIPER_GUN: {
    id: 'msniper', damage: 25, range: 900,
    tracerColor: '#ff8080', tracerWidth: 2.2, tracerLife: 0.14, headMult: 1.5,
  },

  TYPES: {
    crawler: { w: 26, h: 26, hp: 30, speed: 140, dmg: 12, money: 10, score: 10, blood: '#7ef27a' },   // 140 = 200 giảm 30%
    spitter: { w: 24, h: 40, hp: 45, speed: 77, dmg: 14, money: 15, score: 15, blood: '#c77dff' },    // 77 = 110 giảm 30%
    brute:   { w: 44, h: 64, hp: 220, speed: 60, dmg: 25, money: 30, score: 30, blood: '#ff8a5c' },   // 60 = 85 giảm 30%
    tank:    { w: 40, h: 58, hp: 160, speed: 55, dmg: 20, money: 25, score: 25, blood: '#9db4d4' },
    kamikaze:{ w: 24, h: 28, hp: 20, speed: 250, dmg: 0, money: 15, score: 15, blood: '#ffd166' },
    sniper:  { w: 24, h: 44, hp: 40, speed: 90, dmg: 25, money: 20, score: 20, blood: '#f783ac' },
  },

  clear() { for (const m of this.list) Combatants.unregister(m); this.list.length = 0; },

  spawn(typeId, x, y, wave) {
    const T = this.TYPES[typeId];
    const hpScale = 1 + wave * Config.WAVE.HP_SCALE;
    const m = {
      type: typeId,
      x: x - T.w / 2, y: y - T.h,
      w: T.w, h: T.h,
      vx: 0, vy: 0, onGround: false,
      hp: Math.round(T.hp * hpScale), maxHp: Math.round(T.hp * hpScale),
      speed: T.speed * (1 + wave * Config.WAVE.SPEED_SCALE),
      dmg: T.dmg, money: T.money, score: T.score,
      bloodColor: T.blood, team: 'M', dead: false, headRatio: 0.3,
      facing: 1, runPhase: 0, flash: 0,
      biteCd: 0, spitCd: 1 + Math.random(), spawnFade: 1, // vừa trồi lên
      jumpCd: 0,
      aimT: 0, aimX: 0, aimY: 0,   // sniper: đồng hồ ngắm + điểm đã chốt
      boomed: false,               // kamikaze: nổ 1 lần thôi
      hit(dmg, isHead, hx, hy, shooterTeam) {
        if (this.dead) return 0;
        let d = dmg;
        /* GIÁP TANK: trúng PHÍA TRƯỚC chỉ còn 20% — headshot và bắn lưng thì đủ đòn */
        if (typeId === 'tank' && !isHead) {
          const cx = this.x + this.w / 2;
          const front = (hx >= cx && this.facing === 1) || (hx < cx && this.facing === -1);
          if (front) {
            d = Math.max(1, Math.round(d * 0.2));
            Particles.sparks(hx, hy, 0, 5, '#cfd8e3'); // tia lửa văng trên thép
          }
        }
        this.hp -= d;
        this.flash = 0.12;
        if (this.hp <= 0) { this.dead = true; Wave.onMonsterKilled(this); }
        return d;
      },
    };
    this.list.push(m);
    Combatants.register(m);
    return m;
  },

  update(dt) {
    const p = Player.obj;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];

      if (m.dead) { // xác nát mờ dần rồi biến mất
        // kamikaze bị BẮN CHẾT cũng nổ — ai đứng gần cũng dính (bắn từ xa kẻo vạ!)
        if (m.type === 'kamikaze' && !m.boomed) {
          m.boomed = true;
          const K = Config.WAVE.KAMIKAZE;
          Bullets.explode(m.x + m.w / 2, m.y + m.h / 2,
            { id: 'kamikaze', explodeRadius: K.BOOM_R, damage: K.BOOM_DMG, shakeOnBoom: 7 }, 'M');
        }
        m.deadT = (m.deadT || 0) + dt;
        if (m.deadT > 0.8) { Combatants.unregister(m); this.list.splice(i, 1); }
        continue;
      }

      // rơi khỏi map (hố Boong tàu) → tan biến, không để kẹt wave
      if (m.y > Level.pxH + 80) {
        Combatants.unregister(m);
        this.list.splice(i, 1);
        continue;
      }

      m.flash = Math.max(0, m.flash - dt);
      m.spawnFade = Math.min(1, m.spawnFade + dt * 2);
      m.biteCd -= dt; m.spitCd -= dt; m.jumpCd -= dt;

      const dx = Level.wrapDx(p.x + p.w / 2 - (m.x + m.w / 2)); // map vòng tròn: đuổi theo qua mép map
      const dist = Math.abs(dx);
      m.facing = dx >= 0 ? 1 : -1;

      /* ── AI từng loại ── */
      if (m.type === 'crawler') {
        // lao thẳng, gặp tường thì nhảy
        m.vx = _approach(m.vx, m.facing * m.speed, 1600 * dt);
        const ahead = Level.isSolid(Level.tileAt(Math.floor((m.x + m.w / 2 + m.facing * 20) / Level.T), Math.floor((m.y + m.h - 8) / Level.T)));
        if (ahead && m.onGround && m.jumpCd <= 0) { m.vy = -560; m.jumpCd = 0.8; }
        // cắn khi chạm người chơi
        if (m.biteCd <= 0 && _overlap(m, p)) {
          p.takeDamage(m.dmg, m.x + m.w / 2);
          m.biteCd = 0.9;
          m.vx += m.facing * 120; // hích thêm một cú
        }
      } else if (m.type === 'spitter') {
        // giữ khoảng cách ~280px
        if (dist > 330) m.vx = _approach(m.vx, m.facing * m.speed, 900 * dt);
        else if (dist < 190) m.vx = _approach(m.vx, -m.facing * m.speed, 900 * dt);
        else m.vx = _approach(m.vx, 0, 900 * dt);
        if (m.spitCd <= 0 && Combatants.canSee(m.x + m.w / 2, m.y + 6, p, 620)) {
          this._spit(m, p);
          m.spitCd = 1.6 + Math.random() * 0.5;
        }
      } else if (m.type === 'tank') {
        // như brute nhưng chậm hơn — đột lên trước làm khiên cho đồng bọn
        m.vx = _approach(m.vx, m.facing * m.speed, 400 * dt);
        const ahead = Level.isSolid(Level.tileAt(Math.floor((m.x + m.w / 2 + m.facing * 22) / Level.T), Math.floor((m.y + m.h - 8) / Level.T)));
        if (ahead && m.onGround && m.jumpCd <= 0) { m.vy = -560; m.jumpCd = 1; }
        if (m.biteCd <= 0 && _overlap(m, p)) {
          p.takeDamage(m.dmg, m.x + m.w / 2);
          m.biteCd = 1.2;
        }
      } else if (m.type === 'kamikaze') {
        // lao CỰC nhanh, tới gần người chơi là TỰ NỔ
        m.vx = _approach(m.vx, m.facing * m.speed, 2200 * dt);
        const ahead = Level.isSolid(Level.tileAt(Math.floor((m.x + m.w / 2 + m.facing * 20) / Level.T), Math.floor((m.y + m.h - 8) / Level.T)));
        if (ahead && m.onGround && m.jumpCd <= 0) { m.vy = -560; m.jumpCd = 0.6; }
        const pd = Math.hypot(Level.wrapDx(p.x + p.w / 2 - (m.x + m.w / 2)), p.y + p.h / 2 - (m.y + m.h / 2));
        if (pd < 55 && !m.dead) this._selfBoom(m);
      } else if (m.type === 'sniper') {
        // giữ RẤT xa (400-640) + bắn tỉa CÓ TIA ĐỎ cảnh báo 0.7s trước
        if (dist > 640) m.vx = _approach(m.vx, m.facing * m.speed, 700 * dt);
        else if (dist < 400) m.vx = _approach(m.vx, -m.facing * m.speed, 700 * dt);
        else m.vx = _approach(m.vx, 0, 700 * dt);
        if (m.aimT > 0) {
          m.aimT -= dt;
          if (m.aimT <= 0) {
            // bắn về điểm ĐÃ CHỐT lúc bắt đầu ngắm (người né được nếu kịp nhảy)
            const ex = m.x + m.w / 2, ey = m.y + 6;
            const ang = Math.atan2(m.aimY - ey, Level.wrapDx(m.aimX - ex));
            Bullets.fireHitscan(ex, ey, ang + (Math.random() - 0.5) * 0.06, this.SNIPER_GUN, 'M');
            m.spitCd = 2.4 + Math.random() * 0.8;
          }
        } else if (m.spitCd <= 0 && Combatants.canSee(m.x + m.w / 2, m.y + 6, p, 820)) {
          m.aimT = 0.7; // bắt đầu ngắm — tia đỏ hiện ra
          m.aimX = p.x + p.w / 2;
          m.aimY = p.y + p.h * 0.45;
        }
      } else { // brute
        m.vx = _approach(m.vx, m.facing * m.speed, 500 * dt);
        if (m.biteCd <= 0 && _overlap(m, p)) {
          p.takeDamage(m.dmg, m.x + m.w / 2);
          m.biteCd = 1.1;
          Particles.sparks(p.x + p.w / 2, p.y + p.h / 2, 0, 6, '#ffb347');
        }
      }

      m.vy = Math.min(m.vy + Config.GRAVITY * dt, Config.MAX_FALL);
      Physics.moveAndCollide(m, Level, dt);

      if (m.onGround && Math.abs(m.vx) > 15) m.runPhase += Math.abs(m.vx) * dt * 0.07;
      else m.runPhase = 0;
    }
  },

  /* Kamikaze chạm người chơi → TỰ NỔ: chết + vẫn thưởng (bẫy được nó là tài),
   * vụ nổ trúng người chơi qua hệ explode của Bullets (có chặn tường như tên lửa) */
  _selfBoom(m) {
    if (m.boomed) return;
    m.boomed = true;
    m.dead = true;
    Wave.onMonsterKilled(m);
    const K = Config.WAVE.KAMIKAZE;
    Bullets.explode(m.x + m.w / 2, m.y + m.h / 2,
      { id: 'kamikaze', explodeRadius: K.BOOM_R, damage: K.BOOM_DMG, shakeOnBoom: 7 }, 'M');
  },

  /* phun giọt axit theo VÒNG CUNG trúng luôn vị trí người chơi đang đứng */
  _spit(m, p) {
    const sx = m.x + m.w / 2, sy = m.y + 6;
    const tx = p.x + p.w / 2, ty = p.y + p.h / 2;
    // map vòng tròn: phun QUA MÉP map nếu người chơi đứng bên kia seam
    const dx = Level.wrapDx(tx - sx), dy = ty - sy;
    const g = 900;
    const t = Math.max(0.35, Math.abs(dx) / 238); // thời gian bay theo khoảng cách (238 = 340 giảm 30%)
    const vx = dx / t;
    const vy = (dy - 0.5 * g * t * t) / t; // công thức ném trúng đích
    const acid = {
      projSpeed: Math.hypot(vx, vy), acid: true,
      damage: m.dmg, explodeRadius: 26, shakeOnBoom: 1,
    };
    Bullets.fireProjectile(sx, sy, Math.atan2(vy, vx), acid, 'M');
    // sửa vận tốc đúng theo tính toán ballistic
    const pr = Bullets.projectiles[Bullets.projectiles.length - 1];
    pr.vx = vx; pr.vy = vy;
    AudioFX._tone(500, 180, 0.15, 'square', 0.08); // tiếng "phựt"
  },

  draw(ctx, time) {
    for (const m of this.list) {
      const col = m.flash > 0 ? '#ffffff'
        : m.type === 'crawler' ? '#5ecf6e'
        : m.type === 'spitter' ? '#a86ee0'
        : m.type === 'tank' ? '#93a7c4'
        : m.type === 'kamikaze' ? '#ffa94d'
        : m.type === 'sniper' ? '#f783ac'
        : '#e2574c';
      // hào quang khi vừa trồi lên
      if (m.spawnFade < 1) {
        ctx.strokeStyle = `rgba(142,242,122,${(1 - m.spawnFade).toFixed(2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x + m.w / 2, m.y + m.h / 2, 30 * (1 - m.spawnFade) + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = m.dead ? Math.max(0, 1 - (m.deadT || 0) / 0.8) : m.spawnFade;
      drawStickman(ctx, {
        cx: m.x + m.w / 2, feetY: m.y + m.h, h: m.h,
        facing: m.facing, runPhase: m.runPhase,
        moving: Math.abs(m.vx) > 15, onGround: m.onGround, crouch: false,
        color: col, hat: 'none', aimAngle: null,
        thick: m.type === 'brute' ? 1.6 : 1,
      });
      // mắt đỏ quái vật
      if (!m.dead) {
        const headR = Math.max(6, m.h * 0.155);
        ctx.fillStyle = '#ff2b2b';
        ctx.beginPath();
        ctx.arc(m.x + m.w / 2 + m.facing * headR * 0.42, m.y + headR - headR * 0.1, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ── đồ riêng từng loại ── */
      if (!m.dead) {
        if (m.type === 'tank') {
          // TẤM GIÁP phía trước — đạn trúng đây chỉ làm xước 20%
          const cx = m.x + m.w / 2, px = cx + m.facing * m.w * 0.5;
          ctx.strokeStyle = '#8fa3bf';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(px, m.y + 4); ctx.lineTo(px, m.y + m.h - 6); ctx.stroke();
          ctx.strokeStyle = '#5c6b80';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(px, m.y + 4); ctx.lineTo(px, m.y + m.h - 6); ctx.stroke();
        }
        if (m.type === 'kamikaze') {
          // tới gần người chơi → nhấp nháy CHỚP CHỚP báo sắp nổ
          const p = Player.obj;
          const pd = p ? Math.hypot(Level.wrapDx(p.x + p.w / 2 - (m.x + m.w / 2)), p.y + p.h / 2 - (m.y + m.h / 2)) : 999;
          if (pd < 160) {
            const a = Math.max(0, 0.3 + 0.4 * Math.sin(time * 18));
            ctx.strokeStyle = `rgba(255,80,40,${a.toFixed(2)})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(m.x + m.w / 2, m.y + m.h / 2, m.w * 0.95, 0, Math.PI * 2); ctx.stroke();
          }
        }
        if (m.type === 'sniper' && m.aimT > 0) {
          // TIA ĐỎ cảnh báo — còn 0.7s là bắn, né ngay!
          const a = 0.25 + 0.55 * Math.min(1, (0.7 - m.aimT) / 0.7);
          ctx.strokeStyle = `rgba(255,80,80,${a.toFixed(2)})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(m.x + m.w / 2, m.y + 6);
          ctx.lineTo(m.x + m.w / 2 + Level.wrapDx(m.aimX - (m.x + m.w / 2)), m.aimY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.globalAlpha = 1;

      // thanh máu
      if (!m.dead && m.hp < m.maxHp) {
        const bw = m.w + 14, pct = Math.max(0, m.hp / m.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(m.x + m.w / 2 - bw / 2, m.y - 10, bw, 4);
        ctx.fillStyle = '#ff5a5a';
        ctx.fillRect(m.x + m.w / 2 - bw / 2 + 0.5, m.y - 9.5, (bw - 1) * pct, 3);
      }
    }
  },
};

function _overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function _approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
}
