/* =========================================================
 * PLAYER — người que của bạn
 * Di chuyển (G0): coyote, jump buffer, double jump, ngồi
 * Chiến đấu (G1): ngắm chuột, 10 khẩu, nạp đạn, đổi súng
 * Sinh tồn (G3): HP, tiền💰, MUA súng ở cửa hàng, bị quái cắn
 * Deathmatch (G4): team A, chết hồi sinh
 * ========================================================= */
window.Player = {
  obj: null, // tham chiếu toàn cục (quái/bot tìm bạn qua đây)

  create(spawn, team, allWeapons) {
    const C = Config.PLAYER;
    const p = {
      x: spawn.x, y: spawn.y,
      w: C.W, h: C.H,
      vx: 0, vy: 0,
      onGround: false,
      facing: 1,
      runPhase: 0,
      airJumps: 0,
      coyote: 0,
      jumpBuf: 0,
      crouch: false,

      /* chiến đấu */
      team,                       // 'P' (wave) hoặc 'A' (deathmatch)
      headRatio: 0.28,
      bloodColor: '#e23b3b',
      dead: false,
      hp: C.MAX_HP, maxHp: C.MAX_HP,
      color: C.COLOR,             // màu áo (đổi ở menu, lưu localStorage)
      hat: C.HAT,                 // kiểu mũ (đổi ở menu)
      money: 0,                   // 💰 chế độ wave
      // kho súng ban đầu: true = đủ 10 khẩu; mảng id = đúng các khẩu đó;
      // mặc định (wave) = súng lục + lục lọi
      owned: new Set(allWeapons === true
        ? Weapons.list.map((w) => w.id)
        : (allWeapons || ['pistol', 'revolver'])),
      wi: 0,
      mags: Weapons.list.map((w) => w.mag),
      // đạn DỰ TRỮ từng khẩu: nạp đạn phải tiêu từ đây.
      // Quy tắc: súng TẶNG lúc đầu / MUA ở cửa hàng = ∞ (bắn thoải mái);
      // súng LỤM trên map = GIỚI HẠN — chỉ có băng đang cầm, đạn thêm phải kiếm.
      spare: Weapons.list.map(() => 0),
      cooldown: 0,
      reloading: 0,
      gunKick: 0,
      muzzleTimer: 0,
      muzzle: { x: 0, y: 0 },
      aimAngle: 0,
      hurtFlash: 0,               // viền đỏ khi bị đánh

      /* đăng ký làm mục tiêu cho đạn */
      hit(dmg, isHead, hx, hy, shooterTeam) {
        if (this.dead || this.hp <= 0) return 0;
        this.takeDamage(dmg, hx);
        return dmg;
      },
      takeDamage(dmg, srcX) {
        // modifier GIÁP NẸP: sát thương nhận −30% (chỉ chế độ wave)
        if (window.Wave && Wave.mods && Wave.mods.armor && Wave.state !== 'idle') {
          dmg = Math.max(1, Math.round(dmg * 0.7));
        }
        this.hp -= dmg;
        this.hurtFlash = 0.5;
        Camera.addShake(2.5);
        AudioFX.hurt();
        // bật lùi ra xa nguồn sát thương
        const dir = this.x + this.w / 2 >= srcX ? 1 : -1;
        this.vx += dir * 130;
        this.vy = Math.min(this.vy, -160);
        if (this.hp <= 0) {
          this.hp = 0;
          this.dead = true; // wave/match sẽ xử lý tiếp
        }
      },
    };
    this.obj = p;
    // súng được TẶNG lúc vào game → đạn vô hạn (súng LỤM trên map mới bị giới hạn)
    Weapons.list.forEach((w, i) => { if (p.owned.has(w.id)) p.spare[i] = Infinity; });
    Combatants.register(p);
    return p;
  },

  weapon(p) { return Weapons.list[p.wi]; },

  /* Tìm ô súng kế tiếp ĐANG CÓ theo hướng lăn (dir: 1 tới, -1 lùi) —
   * bỏ qua hết các ô khóa, kể cả mấy ô khóa dính nhau */
  nextOwned(p, dir) {
    const n = Weapons.list.length;
    let i = p.wi;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (p.owned.has(Weapons.list[i].id)) return i;
    }
    return p.wi; // chỉ có 1 khẩu duy nhất → giữ nguyên
  },

  respawnAt(p, x, y) {
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.airJumps = 0;
    p.hp = p.maxHp;
    p.dead = false;
    p.crouch = false;
    p.h = Config.PLAYER.H;
    Weapons.list.forEach((w, i) => { if (p.owned.has(w.id)) p.mags[i] = w.mag; });
  },

  selectWeapon(p, i) {
    if (i === p.wi || i < 0 || i >= Weapons.list.length) return;
    if (!p.owned.has(Weapons.list[i].id)) { AudioFX.empty(); return; } // chưa mua!
    p.wi = i;
    p.reloading = 0;
    p.cooldown = Math.max(p.cooldown, 0.18);
    AudioFX.click();
  },

  startReload(p, w) {
    if (p.reloading > 0 || p.mags[p.wi] >= w.mag) return;
    // hết đạn dự trữ → không nạp được (súng lục ∞ nên không bao giờ khô)
    if (p.spare[p.wi] !== Infinity && p.spare[p.wi] <= 0) { AudioFX.empty(); return; }
    p.reloading = w.reload;
    AudioFX.reloadStart();
  },

  update(p, level, dt, mouseWorld) {
    const C = Config.PLAYER;
    const inp = window.Input;

    p.hurtFlash = Math.max(0, p.hurtFlash - dt);

    /* ── 0. Đang gục (deathmatch) → đợi hồi sinh, không điều khiển ── */
    if (p.hp <= 0) return;

    /* ── 1. Chạy ── */
    let dir = 0;
    if (inp.isDown('left')) dir -= 1;
    if (inp.isDown('right')) dir += 1;

    const speedMax = C.SPEED * (p.crouch ? C.CROUCH_SPEED : 1);
    const accel = p.onGround ? C.ACCEL : C.AIR_ACCEL;
    const fric = p.onGround ? C.FRICTION : C.AIR_FRICTION;

    if (dir !== 0) p.vx = _approach(p.vx, dir * speedMax, accel * dt);
    else p.vx = _approach(p.vx, 0, fric * dt);

    /* ── 2. Ngắm bằng chuột ── */
    const shoulderY = p.y + p.h * 0.38;
    const cx = p.x + p.w / 2;
    p.aimAngle = Math.atan2(mouseWorld.y - shoulderY, mouseWorld.x - cx);
    p.facing = Math.cos(p.aimAngle) >= 0 ? 1 : -1;

    /* ── 3. Ngồi ── */
    const wantCrouch = inp.isDown('crouch') && p.onGround;
    if (wantCrouch && !p.crouch) {
      p.y += p.h - C.CROUCH_H;
      p.h = C.CROUCH_H;
      p.crouch = true;
    } else if (!wantCrouch && p.crouch) {
      const standH = C.H;
      const newY = p.y + p.h - standH;
      if (!level.rectOverlapsSolid(p.x, newY, p.w, standH)) {
        p.y = newY; p.h = standH; p.crouch = false;
      }
    }

    /* ── 4. Nhảy ── */
    p.coyote = p.onGround ? C.COYOTE : p.coyote - dt;
    p.jumpBuf = inp.wasPressed('jump') ? C.JUMP_BUF : p.jumpBuf - dt;
    if (p.onGround) p.airJumps = C.MAX_JUMPS - 1;

    if (p.jumpBuf > 0) {
      if (p.coyote > 0) {
        p.vy = C.JUMP_VEL;
        p.coyote = 0; p.jumpBuf = 0;
        p.onGround = false;
      } else if (p.airJumps > 0) {
        p.vy = C.JUMP_VEL * 0.92;
        p.airJumps--;
        p.jumpBuf = 0;
      }
    }
    if (!inp.isDown('jump') && p.vy < 0) p.vy += Config.GRAVITY * 0.9 * dt;

    /* ── 5. Đổi súng ── */
    // đang có bảng chọn modifier (1/2/3) → các phím số dành cho CHỌN, đừng đổi súng
    const offersActive = window.Wave && Wave.state === 'intermission' && Wave.offers;
    if (!offersActive) {
      for (let i = 0; i < 10; i++) {
        if (inp.wasPressed('slot' + i)) this.selectWeapon(p, i);
      }
      if (inp.mouse.wheel !== 0) {
        // lăn qua LUÔN các khẩu chưa mở khoá (kể cả dính nhau mấy ô) — không kẹt
        this.selectWeapon(p, this.nextOwned(p, inp.mouse.wheel > 0 ? 1 : -1));
      }
    }

    /* ── 6. Nạp đạn ── */
    const w = Weapons.list[p.wi];
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) this.finishReload(p, w);
    } else {
      if (inp.wasPressed('reload') && p.mags[p.wi] < w.mag) this.startReload(p, w);
    }

    /* ── 7. BẮN (cửa hàng mở thì chỉ được đi mua đồ) ── */
    p.cooldown -= dt;
    const shopBlocks = window.Shop && Shop.open;
    const wantFire = !shopBlocks && (w.auto ? inp.mouse.down : inp.mouse.pressed);
    if (wantFire && p.reloading <= 0 && p.cooldown <= 0) {
      if (p.mags[p.wi] > 0) {
        this.fire(p, w);
      } else {
        this.startReload(p, w);
        if (inp.mouse.pressed) AudioFX.empty();
      }
    }

    /* ── 8. Vật lý + animate ── */
    p.vy = Math.min(p.vy + Config.GRAVITY * dt, Config.MAX_FALL);
    Physics.moveAndCollide(p, level, dt);

    if (p.onGround && Math.abs(p.vx) > 15) p.runPhase += Math.abs(p.vx) * dt * 0.055;
    else p.runPhase = 0;

    p.gunKick = Math.max(0, p.gunKick - dt * 7);
    p.muzzleTimer -= dt;
  },

  /* XONG NẠP ĐẠN: băng được lấp từ kho dự trữ (∞ = không giới hạn).
   * Tách hàm riêng để test logic được. */
  finishReload(p, w) {
    const need = w.mag - p.mags[p.wi];
    const take = p.spare[p.wi] === Infinity ? need : Math.min(need, p.spare[p.wi]);
    if (p.spare[p.wi] !== Infinity) p.spare[p.wi] -= take;
    p.mags[p.wi] += take;
    AudioFX.reloadEnd();
  },

  muzzlePos(p, w) {
    const sh = { x: p.x + p.w / 2, y: p.y + p.h * 0.38 };
    const dist = p.h * 0.08 + w.bodyLen + w.barrelLen;
    return {
      x: sh.x + Math.cos(p.aimAngle) * dist,
      y: sh.y + Math.sin(p.aimAngle) * dist,
    };
  },

  fire(p, w) {
    // modifier wave: HOẢ LỰC +25% sát thương, BẮN NHANH −20% delay (chỉ chế độ wave)
    const mods = (window.Wave && Wave.mods && Wave.state !== 'idle') ? Wave.mods : null;
    const w2 = (mods && mods.dmg) ? { ...w, damage: w.damage * 1.25 } : w;
    const rate = (mods && mods.rate) ? 0.8 : 1;

    p.mags[p.wi]--;
    p.cooldown = w.fireDelay * rate;
    p.gunKick = Math.min(1, w.recoil);
    p.muzzleTimer = 0.05;

    const m = this.muzzlePos(p, w);
    const a = p.aimAngle;
    p.muzzle.x = m.x; p.muzzle.y = m.y;

    AudioFX.shot(w.sound);
    Camera.addShake(w.shake);

    if (w2.kind === 'proj') {
      Bullets.fireProjectile(m.x, m.y, a, w2, p.team);
      // bắn rocket/plasma bị đẩy nhẹ ngược — đã tay
      p.vx -= Math.cos(a) * 40;
    } else {
      let totalDmg = 0, anyHead = false, tx = m.x, ty = m.y;
      for (let i = 0; i < (w2.pellets || 1); i++) {
        const spread = (Math.random() - 0.5) * 2 * w2.spread;
        const res = Bullets.fireHitscan(m.x, m.y, a + spread, w2, p.team);
        totalDmg += res.dmg;
        if (res.head) anyHead = true;
        tx = res.x; ty = res.y;
      }
      if (totalDmg > 0) {
        Particles.text(tx, ty - 10, String(totalDmg), anyHead ? '#ffe066' : '#ffffff', anyHead ? 16 : 12);
        if (anyHead) Particles.text(tx, ty - 28, 'HEADSHOT!', '#ffe066', 12);
      }
    }

    // đẩy ngược nhẹ khi bắn súng lớn (shotgun, sniper)
    if (w.recoil >= 1) p.vx -= Math.cos(a) * 60;

    Particles.shell(m.x - Math.cos(a) * 10, m.y - Math.sin(a) * 10, a);
    Particles.smoke(m.x, m.y, 2);
  },
};

function _approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
}
