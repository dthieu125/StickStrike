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
    boss:    { w: 56, h: 92, hp: 700, speed: 55, dmg: 30, money: 150, score: 200, blood: '#ff4d4d' },
  },

  clear() { for (const m of this.list) Combatants.unregister(m); this.list.length = 0; },

  spawn(typeId, x, y, wave, speedMul, hpMul) {
    const T = this.TYPES[typeId];
    // BOSS: máu gốc lấy từ Config (dễ chỉnh) — wave càng cao càng trâu
    const hpBase = typeId === 'boss' ? Config.WAVE.BOSS.HP : T.hp;
    const hpScale = 1 + wave * Config.WAVE.HP_SCALE;
    const m = {
      type: typeId,
      x: x - T.w / 2, y: y - T.h,
      w: T.w, h: T.h,
      vx: 0, vy: 0, onGround: false,
      hp: Math.round(hpBase * hpScale * (hpMul || 1)), maxHp: Math.round(hpBase * hpScale * (hpMul || 1)),
      speed: T.speed * (1 + wave * Config.WAVE.SPEED_SCALE) * (speedMul || 1), // 🎲 event cuồng tốc
      dmg: T.dmg, money: T.money, score: T.score,
      bloodColor: T.blood, team: 'M', dead: false, headRatio: 0.3,
      facing: 1, runPhase: 0, flash: 0,
      biteCd: 0, spitCd: 1 + Math.random(), spawnFade: 1, // vừa trồi lên
      jumpCd: 0,
      flankT: 0, flankDir: 1,      // bị tường cao chặn → đi VÒNG tìm lối (không đứng nhảy tại chỗ)
      aimT: 0, aimX: 0, aimY: 0,   // sniper: đồng hồ ngắm + điểm đã chốt
      boomed: false,               // kamikaze: nổ 1 lần thôi
      /* ── riêng BOSS 3 phase ── */
      phase: 1,                    // 1 pháo thủ · 2 gọi quân · 3 cuồng nộ
      stunT: 0,                    // choáng khi vừa ĐỔI PHASE (cơ hội dồn đạn)
      volleyCd: 1.5, summonCd: 2,  // đồng hồ ném loạt (P1) + gọi quân (P2)
      bossMinion: false,           // crawler do boss trồi lên (đếm để giới hạn)
      hit(dmg, isHead, hx, hy, shooterTeam) {
        if (this.dead) return 0;
        let d = dmg;
        /* ĐIỂM YẾU BOSS: chấm vàng nhấp nháy ĐỔI CHỖ theo phase
         * (P1 = đầu · P2 = ngực · P3 = chân) — bắn trúng ×2 sát thương */
        if (typeId === 'boss' && !this.dead) {
          const s = Monsters._weakSpot(this);
          if (Math.hypot(hx - s.x, hy - s.y) < s.r + 6) {
            d = Math.round(d * Config.WAVE.BOSS.WEAK_MULT);
            Particles.sparks(hx, hy, 0, 8, '#ffe066'); // văng sáng vàng báo trúng điểm yếu
          }
        }
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
        // 👑 BOSS GỤC: loé sáng + báo thưởng modifier hiếm
        if (m.type === 'boss' && !m.boomed) {
          m.boomed = true;
          Particles.sparks(m.x + m.w / 2, m.y + m.h / 2, 0, 24, '#ffe066');
          Particles.text(m.x + m.w / 2, m.y - 30, 'BOSS GỤC!', '#ffe066', 22);
          AudioFX._tone(500, 120, 0.6, 'sawtooth', 0.16);
          window.showToast && showToast('👑 BOSS GỤC! Vàng lớn + 2/3 lựa chọn HIẾM đang chờ!');
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

      /* ── 👑 BOSS: kiểm tra ĐỔI PHASE theo máu còn lại ── */
      if (m.type === 'boss') {
        const B = Config.WAVE.BOSS;
        const frac = m.hp / m.maxHp;
        const want = frac <= B.PHASE3_AT ? 3 : frac <= B.PHASE2_AT ? 2 : 1;
        if (want > m.phase) {
          m.phase = want;
          m.stunT = B.STUN;                 // choáng đứng im — phần thưởng cho người bắn khỏe
          m.volleyCd = B.TELEGRAPH; m.summonCd = 1.5;
          m.flash = 0.5;                    // nháy trắng báo đổi phase
          Particles.text(m.x + m.w / 2, m.y - 26, '⚠️ PHASE ' + want + '!', '#ff5a5a', 18);
          Particles.sparks(m.x + m.w / 2, m.y + m.h / 2, 0, 14, '#ff5a5a');
          AudioFX._tone(180, 90, 0.4, 'sawtooth', 0.14);
          window.showToast && showToast(want === 2 ? '👑 BOSS GỌI QUÂN! Điểm yếu dời xuống NGỰC'
            : '👑 BOSS CUỒNG NỘ! Điểm yếu dời xuống CHÂN — chạy kẻo đè!');
        }
      }

      /* ── AI từng loại ── */
      if (m.type === 'boss') {
        const B = Config.WAVE.BOSS;
        const pd = dist;
        if (m.stunT > 0) {
          // CHOÁNG khi vừa đổi phase: đứng khựng — người chơi dồn đạn điểm yếu ngay
          m.stunT -= dt;
          m.vx = _approach(m.vx, 0, 900 * dt);
        } else if (m.phase === 1) {
          // PHASE 1 — PHÁO THỦ: giữ khoảng cách 300-460, ném loạt 3 viên có vòng đỏ báo trước
          if (pd > 460) m.vx = _approach(m.vx, m.facing * m.speed, 500 * dt);
          else if (pd < 300) m.vx = _approach(m.vx, -m.facing * m.speed, 500 * dt);
          else m.vx = _approach(m.vx, 0, 500 * dt);
          if (m.aimT > 0) {
            m.aimT -= dt;
            if (m.aimT <= 0 && Combatants.canSee(m.x + m.w / 2, m.y + 8, p, 900)) this._bossVolley(m, p);
          } else {
            m.volleyCd -= dt;
            if (m.volleyCd <= 0 && Combatants.canSee(m.x + m.w / 2, m.y + 8, p, 900)) {
              m.aimT = B.TELEGRAPH; // bắt đầu MƯỚI — vòng đỏ chớp quanh boss
              m.volleyCd = B.VOLLEY_CD;
              AudioFX._tone(320, 200, 0.2, 'square', 0.09);
            }
          }
        } else if (m.phase === 2) {
          // PHASE 2 — GỌI QUÂN: đứng vững trồi crawler + vẫn phun lẻ gây áp lực
          m.summonCd -= dt;
          m.vx = _approach(m.vx, 0, 400 * dt); // trụ chân gọi quân — là "trụ" để người chơi phá
          if (m.summonCd <= 0) {
            m.summonCd = B.MINION_CD;
            const alive = this.list.filter((m2) => m2.bossMinion && !m2.dead).length;
            if (alive < B.MINION_CAP) {
              for (let i = 0; i < B.MINIONS_PER_CALL; i++) {
                const mx = m.x + m.w / 2 + (i - (B.MINIONS_PER_CALL - 1) / 2) * 46;
                const c = this.spawn('crawler', Math.max(40, Math.min(Level.pxW - 40, mx)), m.y + m.h, Wave.num);
                c.bossMinion = true;
                c.spawnFade = 0; // trồi CHẬM hơn thường (0.5s) = telegraph cho người chơi
              }
              AudioFX._tone(140, 260, 0.3, 'sawtooth', 0.12);
            }
          }
          if (m.spitCd <= 0 && Combatants.canSee(m.x + m.w / 2, m.y + 6, p, 700)) {
            this._spit(m, p);
            m.spitCd = 2.2 + Math.random();
          }
        } else {
          // PHASE 3 — CUỒNG NỘ: lao nhanh ×1.7, nhảy ĐÈ người chơi, đập 30 dmg
          const bs = m.speed * 1.7;
          const mv = this._wallMove(m, m.facing, 1400, dt);
          if (mv === m.facing) m.vx = _approach(m.vx, m.facing * bs, 1400 * dt);
          // xa quá → BỒ lên đè (telegraph: khựng 0.35s trước khi nhảy — nhìn thấy là né!)
          if (pd > 200 && m.onGround && m.jumpCd <= 0) {
            m.vx = Math.sign(dx) * Math.min(360, Math.abs(dx) * 2.2);
            m.vy = -800;
            m.jumpCd = 2.2;
            AudioFX._tone(200, 340, 0.18, 'square', 0.1);
          }
          if (m.biteCd <= 0 && _overlap(m, p)) {
            p.takeDamage(m.dmg, m.x + m.w / 2);
            m.biteCd = 1.0;
            Particles.sparks(p.x + p.w / 2, p.y + p.h / 2, 0, 10, '#ff5a5a');
          }
        }
      } else if (m.type === 'crawler') {
        // lao thẳng; tường thấp thì NHẢY QUA, tường cao thì ĐI VÒNG tìm lối
        const mv = this._wallMove(m, m.facing, 1600, dt);
        if (mv === m.facing) m.vx = _approach(m.vx, m.facing * m.speed, 1600 * dt);
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
        const mv = this._wallMove(m, m.facing, 400, dt);
        if (mv === m.facing) m.vx = _approach(m.vx, m.facing * m.speed, 400 * dt);
        if (m.biteCd <= 0 && _overlap(m, p)) {
          p.takeDamage(m.dmg, m.x + m.w / 2);
          m.biteCd = 1.2;
        }
      } else if (m.type === 'kamikaze') {
        // lao CỰC nhanh, tới gần người chơi là TỰ NỔ
        const mv = this._wallMove(m, m.facing, 2200, dt);
        if (mv === m.facing) m.vx = _approach(m.vx, m.facing * m.speed, 2200 * dt);
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
        const mv = this._wallMove(m, m.facing, 500, dt);
        if (mv === m.facing) m.vx = _approach(m.vx, m.facing * m.speed, 500 * dt);
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

  /* 👑 BOSS — ném LOẠT 3 viên cầu nổ theo VÒNG CUNG quanh người chơi
   * (đã có TELEGRAPH 0.8s: vòng đỏ chớp quanh boss trước khi ném) */
  _bossVolley(m, p) {
    const B = Config.WAVE.BOSS;
    for (let i = 0; i < B.VOLLEY_SHOTS; i++) {
      const sx = m.x + m.w / 2 + (i - 1) * 12, sy = m.y + 8;
      // ném rải quanh người chơi (±35px) — đứng im ăn trọn loạt, chạy là né
      const tx = p.x + p.w / 2 + (Math.random() - 0.5) * 70;
      const ty = p.y + p.h * 0.4;
      const dx = Level.wrapDx(tx - sx), dy = ty - sy;
      const g = 900;
      const t = Math.max(0.5, Math.abs(dx) / 260);
      const vx = dx / t, vy = (dy - 0.5 * g * t * t) / t;
      const shot = { projSpeed: Math.hypot(vx, vy), explodeRadius: 30, damage: 16, shakeOnBoom: 2 };
      Bullets.fireProjectile(sx, sy, Math.atan2(vy, vx), shot, 'M');
      const pr = Bullets.projectiles[Bullets.projectiles.length - 1];
      pr.vx = vx; pr.vy = vy;
    }
    AudioFX._tone(180, 90, 0.3, 'sawtooth', 0.12);
  },

  /* 👑 BOSS — vị trí ĐIỂM YẾU hiện tại (đổi theo phase):
   * P1 = ĐẦU (đứng bắn tỉa đầu) · P2 = NGỰC (nằm/nấp sẽ khó trúng) · P3 = CHÂN */
  _weakSpot(m) {
    const cx = m.x + m.w / 2;
    if (m.phase === 1) return { x: cx, y: m.y + m.h * 0.10, r: Config.WAVE.BOSS.WEAK_R };
    if (m.phase === 2) return { x: cx, y: m.y + m.h * 0.45, r: Config.WAVE.BOSS.WEAK_R };
    return { x: cx, y: m.y + m.h * 0.88, r: Config.WAVE.BOSS.WEAK_R };
  },

  /* Tường chắn ngang hướng chạy: {blocked, h} — h = số ô ĐẶM tính từ chân trở lên.
   * Tường ≤ 2 ô: một cú nhảy (-560 ≈ 71px ≈ 2 ô) là qua được. */
  _wallAhead(m, dir) {
    const col = Math.floor((m.x + m.w / 2 + dir * 20) / Level.T);
    const feetRow = Math.floor((m.y + m.h - 8) / Level.T);
    let h = 0;
    while (h < 8 && Level.isSolid(Level.tileAt(col, feetRow - h))) h++;
    return { blocked: h > 0, h };
  },

  /* Xử lý tường chắn CHO QUÁI CẬN CHIẾN (góp ý người chơi: đừng đứng nhảy tại chỗ!):
   * • tường thấp ≤ 2 ô → nhảy qua như cũ;
   * • tường CAO → ĐI VÒNG: chọn phía có lối trống, lóc ra ~1-2s rồi mới
   *   xác định lại vị trí người chơi và xông tới. Trả về hướng nên chạy. */
  _wallMove(m, dir, accel, dt) {
    const wall = this._wallAhead(m, m.flankT > 0 ? m.flankDir : dir);
    if (m.flankT > 0) {
      m.flankT -= dt;
      if (!wall.blocked) { m.flankT = 0; return dir; } // vòng ra chỗ trống rồi → đuổi tiếp
      m.vx = _approach(m.vx, m.flankDir * m.speed * 0.9, accel * dt);
      return m.flankDir;
    }
    if (!wall.blocked) return dir;
    if (wall.h <= 2) {
      if (m.onGround && m.jumpCd <= 0) { m.vy = -560; m.jumpCd = 0.8; }
      return dir;
    }
    // tường cao không nhảy nổi → chọn phía CÓ LỐI rồi vòng qua
    if (m.onGround) {
      m.flankT = 1.1 + Math.random() * 0.8;
      const leftBlocked = this._wallAhead(m, -1).blocked;
      const rightBlocked = this._wallAhead(m, 1).blocked;
      m.flankDir = (leftBlocked && rightBlocked) ? (Math.random() < 0.5 ? -1 : 1)
        : leftBlocked ? 1 : -1;
      m.vx = _approach(m.vx, m.flankDir * m.speed * 0.9, accel * dt);
    }
    return dir;
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
        : m.type === 'boss' ? (m.phase === 2 ? '#ff8a3c' : m.phase === 3 ? '#ff2b5e' : '#b478ff')
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
        if (m.type === 'boss') {
          const cx = m.x + m.w / 2;
          // TELEGRAPH ném loạt (P1): vòng đỏ chớp quanh boss — sắp mưa cầu nổ!
          if (m.phase === 1 && m.aimT > 0) {
            const a = 0.3 + 0.4 * Math.sin(time * 22);
            ctx.strokeStyle = `rgba(255,90,90,${a.toFixed(2)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, m.y + m.h * 0.35, m.w * 0.8, 0, Math.PI * 2);
            ctx.stroke();
          }
          // CHOÁNG đổi phase: vòng sáng vàng to dần — "dồn đạn ngay đi!"
          if (m.stunT > 0) {
            const t = 1 - m.stunT / Config.WAVE.BOSS.STUN;
            ctx.strokeStyle = `rgba(255,224,102,${(0.9 - t * 0.6).toFixed(2)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, m.y + m.h / 2, 20 + t * 46, 0, Math.PI * 2);
            ctx.stroke();
          }
          // ĐIỂM YẾU: chấm vàng nhấp nháy — ĐỔI CHỖ theo phase (đầu/ngực/chân)
          const s = Monsters._weakSpot(m);
          const wa = 0.45 + 0.35 * Math.sin(time * 6);
          ctx.fillStyle = `rgba(255,224,102,${wa.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.stroke();
          // chấm giữa điểm yếu
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
          ctx.fill();
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
      // 👑 thanh máu BOSS riêng: RỘNG + nhãn PHASE (đỡ nhìn nhầm với quái thường)
      if (!m.dead && m.type === 'boss') {
        const bw = m.w + 60, pct = Math.max(0, m.hp / m.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(m.x + m.w / 2 - bw / 2, m.y - 22, bw, 9);
        ctx.fillStyle = m.phase === 3 ? '#ff2b5e' : m.phase === 2 ? '#ff8a3c' : '#b478ff';
        ctx.fillRect(m.x + m.w / 2 - bw / 2 + 1, m.y - 21, (bw - 2) * pct, 7);
        ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffe066';
        ctx.fillText('👑 BOSS · PHASE ' + m.phase + '/3', m.x + m.w / 2, m.y - 26);
        ctx.textAlign = 'left';
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
