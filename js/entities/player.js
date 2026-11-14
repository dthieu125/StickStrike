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
      prone: false, // NẰM (giữ C): hitbox bé · bắn tĩnh · đi chậm

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
      mags: Weapons.list.map((w) => (window.GunUp ? GunUp.mag(w) : w.mag)),
      // đạn DỰ TRỮ từng khẩu: nạp đạn phải tiêu từ đây.
      // Quy tắc: súng TẶNG lúc đầu / MUA ở cửa hàng = ∞ (bắn thoải mái);
      // súng LỤM trên map = GIỚI HẠN — chỉ có băng đang cầm, đạn thêm phải kiếm.
      spare: Weapons.list.map(() => 0),
      cooldown: 0,
      reloading: 0,
      spin: 0,        // minigun: quay nòng (giữ bắn phụ) — tản đạn giảm dần
      dashT: 0,       // 🏃 thời gian lướt còn lại
      dashCd: 0,      // hồi chiêu dash
      dashDir: 1,     // hướng lướt
      iframe: 0,      // giây bất tử (dash né đạn)
      grenCd: 0,      // 💣 hồi chiêu lựu đạn
      gunKick: 0,
      muzzleTimer: 0,
      muzzle: { x: 0, y: 0 },
      aimAngle: 0,
      hurtFlash: 0,               // viền đỏ khi bị đánh

      /* đăng ký làm mục tiêu cho đạn */
      hit(dmg, isHead, hx, hy, shooterTeam) {
        if (this.dead || this.hp <= 0) return 0;
        if (this.iframe > 0) { // 🏃 DASH né đạn: bất tử trong lúc lướt
          Particles.text(this.x + this.w / 2, this.y - 6, 'NÉ!', '#7df3ff', 11);
          return 0;
        }
        this.takeDamage(dmg, hx, isHead);
        return dmg;
      },
      takeDamage(dmg, srcX, isHead) {
        /* ── TRANG BỊ từ 🏪 MARKET: nón → giáp → khiên (theo thứ tự gánh đòn) ── */
        const g = (window.Gear && Gear.state) ? Gear.state : null;
        if (g) {
          if (isHead && g.helmet) dmg = Math.max(1, Math.round(dmg * 0.65)); // ×2 → ~×1.3
          if (g.armor) dmg = Math.max(1, Math.round(dmg * 0.85));            // −15%
          if (g.shield > 0) {
            const absorb = Math.min(g.shield, dmg);
            g.shield -= absorb;
            dmg -= absorb;
            Gear.save(); // độ bền khiên GIỮ qua các trận — vỡ là mất
            if (absorb > 0) Particles.sparks(this.x + this.w / 2, this.y + this.h * 0.4, 0, 6, '#7df3ff');
            if (g.shield <= 0) {
              g.shield = 0; Gear.save();
              Particles.ring && Particles.ring(this.x + this.w / 2, this.y + this.h / 2, 26, '#7df3ff');
              window.showToast && showToast('💔 KHIÊN ÁNH SÁNG VỠ! (mua lại ở 🏪 Market)');
            }
            if (dmg <= 0) { // khiên gánh trọn vẹn đòn — không rung, không bật lùi
              this.hurtFlash = Math.max(this.hurtFlash, 0.2);
              return;
            }
          }
        }
        // modifier GIÁP NẸP: sát thương nhận giảm theo ĐỘ MẶN (thường −30% · hiếm −50%) — chỉ chế độ wave
        if (window.Wave && Wave.mods && Wave.mods.armor && Wave.state !== 'idle') {
          dmg = Math.max(1, Math.round(dmg * (1 - Wave.mods.armor)));
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
    p.prone = false;
    p.h = Config.PLAYER.H;
    Weapons.list.forEach((w, i) => { if (p.owned.has(w.id)) p.mags[i] = (window.GunUp ? GunUp.mag(w) : w.mag); });
    p.dashT = 0; p.dashCd = 0; p.iframe = 0; p.grenCd = 0; p.spin = 0;
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
    const magSize = (window.GunUp ? GunUp.mag(w) : w.mag);
    if (p.reloading > 0 || p.mags[p.wi] >= magSize) return;
    // hết đạn dự trữ → không nạp được (súng lục ∞ nên không bao giờ khô)
    if (p.spare[p.wi] !== Infinity && p.spare[p.wi] <= 0) { AudioFX.empty(); return; }
    // 🔧 NÂNG CẤP: nạp nhanh theo cấp · 🥊 BAO TAY: nạp nhanh hơn 30%
    const glovesMul = (window.Gear && Gear.state.gloves) ? 0.7 : 1;
    const reloadT = (window.GunUp ? GunUp.stats(w).reload : w.reload);
    p.reloading = reloadT * glovesMul;
    AudioFX.reloadStart();
  },

  /* tốc chạy hiện tại (giày + tư thế) — tách hàm cho test được */
  moveSpeed(p) {
    const C = Config.PLAYER;
    let s = C.SPEED;
    if (window.Gear && Gear.state.boots) s *= 1.12; // 👟 giày phản lực
    if (p.prone) return s * C.PRONE_SPEED;          // nằm: chậm nhất
    if (p.crouch) return s * C.CROUCH_SPEED;
    return s;
  },

  /* ── 🏃 DASH (Shift) — vọt nhanh 1 nhịp theo hướng đang chạy/mặt, bất tử 0.12s.
   * Tách hàm riêng để test logic được (update cần mô phỏng phím). */
  tryDash(p, dir) {
    const D = Config.DASH;
    if (p.dashCd > 0 || p.hp <= 0) return false;
    p.dashDir = dir || p.facing || 1;
    p.dashT = D.TIME;
    p.dashCd = D.CD;
    p.iframe = D.IFRAME;
    p.vy = Math.min(p.vy, -40); // nhấc nhẹ lên — lướt "trên không" tí cho đã
    AudioFX.dash();
    return true;
  },

  /* ── 💣 NÉM LỰU ĐẠN (Q) — văng theo chuột có quỹ đạo cong, nổ chạm đất/tường/quái.
   * Trúng CẢ HAI BÊN (lựu đạn là vật nổ trung lập — cẩn thận ném vào mặt mình!). */
  tryGrenade(p, mouseWorld) {
    if ((p.grenCd || 0) > 0 || p.hp <= 0) return false;
    const G = Config.GRENADE;
    p.grenCd = G.CD;
    const ox = p.x + p.w / 2, oy = p.y + p.h * 0.38;
    const dist = Math.hypot(mouseWorld.x - ox, mouseWorld.y - oy);
    Bullets.throwGrenade(ox, oy, p.aimAngle, dist, p);
    return true;
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

    const shopBlocks = window.Shop && Shop.open; // cửa hàng mở → không bắn/dash/ném
    const speedMax = this.moveSpeed(p); // giày + ngồi/nằm
    const accel = p.onGround ? C.ACCEL : C.AIR_ACCEL;
    const fric = p.onGround ? C.FRICTION : C.AIR_FRICTION;

    /* 🏃 DASH: hồi chiêu + đang lướt thì đè tốc độ thường */
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.iframe = Math.max(0, p.iframe - dt);
    if (inp.wasPressed('dash') && !shopBlocks) this.tryDash(p, dir);
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDir * Config.DASH.SPEED; // lướt đè luôn điều khiển
      // bóng mờ cyan sau lưng
      Particles.add({ type: 'dot', x: p.x + p.w / 2, y: p.y + p.h * 0.5,
        vx: -p.dashDir * 70, vy: 0, life: 0.18, size: 2.6, color: '#7df3ff', gravity: 0 });
    } else if (dir !== 0) p.vx = _approach(p.vx, dir * speedMax, accel * dt);
    else p.vx = _approach(p.vx, 0, fric * dt);

    /* ── 2. Ngắm bằng chuột ── */
    const shoulderY = p.y + p.h * 0.38;
    const cx = p.x + p.w / 2;
    p.aimAngle = Math.atan2(mouseWorld.y - shoulderY, mouseWorld.x - cx);
    p.facing = Math.cos(p.aimAngle) >= 0 ? 1 : -1;

    /* ── 3. Ngồi / NẰM (giữ C) ──
     * Nằm: hitbox còn 24px — đạn bay ngang ngực bay VƯỢT đầu, bắn tĩnh hơn
     * (tản đạn −45%) nhưng bò rất chậm và không nhảy được. */
    const wantProne = inp.isDown('prone') && p.onGround;
    if (wantProne && !p.prone) {
      const newY = p.y + p.h - C.PRONE_H;
      if (!level.rectOverlapsSolid(p.x, newY, p.w, C.PRONE_H) || p.crouch) {
        // từ NGỒI chuyển xuống NẰM thì chắc chắn vừa (cùng vị trí chân)
        p.y = p.crouch ? p.y + (C.CROUCH_H - C.PRONE_H) : newY;
        p.h = C.PRONE_H;
        p.prone = true;
        p.crouch = false;
      }
    } else if (!wantProne && p.prone) {
      // đứng dậy: ưu tiên đứng thẳng, trần quá thấp thì ngồi tạm
      const standY = p.y + p.h - C.H;
      const crouchY = p.y + p.h - C.CROUCH_H;
      if (!level.rectOverlapsSolid(p.x, standY, p.w, C.H)) {
        p.y = standY; p.h = C.H; p.prone = false;
      } else if (!level.rectOverlapsSolid(p.x, crouchY, p.w, C.CROUCH_H)) {
        p.y = crouchY; p.h = C.CROUCH_H; p.prone = false; p.crouch = true;
      }
    }

    const wantCrouch = inp.isDown('crouch') && p.onGround && !p.prone;
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

    /* ── 4. Nhảy (NẰM thì không nhảy được — phải đứng dậy trước) ── */
    p.coyote = p.onGround ? C.COYOTE : p.coyote - dt;
    p.jumpBuf = inp.wasPressed('jump') ? C.JUMP_BUF : p.jumpBuf - dt;
    if (p.onGround) p.airJumps = C.MAX_JUMPS - 1;

    if (p.jumpBuf > 0 && !p.prone) {
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
    // đang có bảng chọn (modifier 1/2/3 hoặc 🗺️ CHỌN ĐƯỜNG) → các phím số dành cho CHỌN
    const offersActive = window.Wave && Wave.state === 'intermission'
      && (Wave.offers || Wave.nodeOpen);
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
    const magSize = (window.GunUp ? GunUp.mag(w) : w.mag);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) this.finishReload(p, w);
    } else {
      if (inp.wasPressed('reload') && p.mags[p.wi] < magSize) this.startReload(p, w);
    }

    /* ── 7. BẮN (cửa hàng mở thì chỉ được đi mua đồ) ── */
    p.cooldown -= dt;
    // 🔧 minigun cấp 3+: GIỮ bắn phụ (chuột phải/E) = QUAY NÒNG — tản đạn giảm dần, đi chậm
    p.spin = (w.id === 'minigun' && window.GunUp && GunUp.altOpen(w) && !shopBlocks
      && (inp.mouse.rdown || inp.isDown('altfire'))) ? Math.min(1, (p.spin || 0) + dt / 1.1) : 0;
    const wantFire = !shopBlocks && (w.auto ? inp.mouse.down : inp.mouse.pressed);
    if (wantFire && p.reloading <= 0 && p.cooldown <= 0) {
      if (p.mags[p.wi] > 0) {
        this.fire(p, w);
      } else {
        this.startReload(p, w);
        if (inp.mouse.pressed) AudioFX.empty();
      }
    }

    /* ── 7b. BẮN PHỤ (alt-fire): chuột phải hoặc phím E — mở ở nâng cấp súng cấp 3 ── */
    const wantAlt = !shopBlocks && window.GunUp && GunUp.altOpen(w)
      && w.alt && w.alt.delay > 0 // minigun là "giữ" — xử lý ở khối spin ở trên, không bắn
      && (inp.wasPressed('altfire') || inp.mouse.rpressed)
      && p.reloading <= 0 && p.cooldown <= 0;
    if (wantAlt) this.fireAlt(p, w);

    /* ── 7c. 💣 LỰU ĐẠN (Q) — ném theo chuột, nổ chạm vật gì cũng beng, trúng cả 2 bên ── */
    p.grenCd = Math.max(0, p.grenCd - dt);
    if (!shopBlocks && inp.wasPressed('grenade')) this.tryGrenade(p, mouseWorld);

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
    const magSize = (window.GunUp ? GunUp.mag(w) : w.mag);
    const need = magSize - p.mags[p.wi];
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
    // 🔧 NÂNG CẤP: dame/băng/nạp theo cấp súng (lv5 có perk riêng)
    const s = (window.GunUp ? GunUp.stats(w) : w);
    // modifier wave: HOẢ LỰC (thường +25% · hiếm +50%), BẮN NHANH (tốc delay giảm 25%/50%)
    const mods = (window.Wave && Wave.mods && Wave.state !== 'idle') ? Wave.mods : null;
    const w2 = (mods && mods.dmg) ? { ...s, damage: s.damage * (1 + mods.dmg) } : s;
    const rate = (mods && mods.rate) ? (1 - mods.rate) : 1;

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
      // tản đạn: NẰM bắn TĨNH (55%) · 🔧 minigun GIỮ quay nòng giảm dần tới 25%
      const spMul = (p.prone ? Config.PLAYER.PRONE_SPREAD : 1) * (1 - 0.75 * (p.spin || 0));
      for (let i = 0; i < (w2.pellets || 1); i++) {
        const spread = (Math.random() - 0.5) * 2 * w2.spread * spMul;
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

  /* ── BẮN PHỤ (alt-fire) — MỞ ở nâng cấp súng cấp 3, bấm chuột phải / phím E ──
   * Mỗi khẩu một kiểu chơi khác nhau (định nghĩa trong weapons.js `alt`).
   * Tiêu 1 viên băng + cooldown riêng dài hơn bắn thường. */
  fireAlt(p, w) {
    if (p.mags[p.wi] <= 0) { this.startReload(p, w); AudioFX.empty(); return; }
    const s = (window.GunUp ? GunUp.stats(w) : w);
    p.mags[p.wi]--;
    p.cooldown = w.alt.delay;
    p.gunKick = Math.min(1, w.recoil);
    p.muzzleTimer = 0.05;
    const m = this.muzzlePos(p, w);
    const a = p.aimAngle;
    p.muzzle.x = m.x; p.muzzle.y = m.y;
    AudioFX.shot(w.sound);
    Camera.addShake(w.shake * 0.6);
    const shot = (ang, ov) => Bullets.fireHitscan(m.x, m.y, ang, { ...s, ...ov }, p.team);
    const mark = (res) => { if (res.dmg > 0) Particles.text(res.x, res.y - 10, String(res.dmg), '#7df3ff', 12); };
    const kick = w.recoil >= 1 ? 60 : 30;

    switch (w.id) {
      case 'pistol': // liên thanh 3 phát tản nhẹ, mỗi phát 80% dame
        [-0.055, 0, 0.055].forEach((off) => mark(shot(a + off, { damage: s.damage * 0.8 })));
        break;
      case 'revolver': // 1 phát xuyên mọi bia, dame ×1.5
        mark(shot(a, { pierceTargets: true, damage: s.damage * 1.5, tracerColor: '#ff9d5c', tracerWidth: 3 }));
        break;
      case 'smg': // xịt hình quạt 6 phát cự ly gần
        for (let i = 0; i < 6; i++) mark(shot(a + (i - 2.5) * 0.1, { damage: s.damage * 0.6 }));
        break;
      case 'shotgun': // SLUG xuyên, cự ly xa hơn shotgun thường
        mark(shot(a, { pierceTargets: true, damage: 45, spread: 0.015, range: 900, tracerColor: '#ffe066', tracerWidth: 3.2 }));
        break;
      case 'rifle': // bộ ba chính xác
        [-0.03, 0, 0.03].forEach((off) => mark(shot(a + off, { damage: s.damage * 0.9 })));
        break;
      case 'sniper': // nóc nhanh: không xuyên, dame 60%
        mark(shot(a, { damage: s.damage * 0.6, spread: 0.03, pierceTargets: false }));
        break;
      case 'rail': // đôi tia song song
        [-0.02, 0.02].forEach((off) => mark(shot(a + off, { damage: s.damage * 0.7, tracerColor: '#9ff3ff' })));
        break;
      case 'rocket': { // KÍCH NỔ GIÓ: nổ giữa đường gần điểm ngắm (±tối đa 520px)
        const d = Math.hypot(Input.mouse.x - m.x, Input.mouse.y - m.y) * 0.8;
        Bullets.fireProjectile(m.x, m.y, a, { ...s, airAt: Math.max(120, Math.min(520, d)) }, p.team);
        p.vx -= Math.cos(a) * 40;
        break;
      }
      case 'plasma': // cầu plasma nảy tường ×3 rồi mới nổ
        Bullets.fireProjectile(m.x, m.y, a, { ...s, bounce: 3, projSpeed: s.projSpeed * 0.9 }, p.team);
        p.vx -= Math.cos(a) * 30;
        break;
      default:
        mark(shot(a, {}));
    }
    // đẩy ngược nhẹ như bắn thường
    p.vx -= Math.cos(a) * kick;
    Particles.shell(m.x - Math.cos(a) * 10, m.y - Math.sin(a) * 10, a);
    Particles.smoke(m.x, m.y, 2);
  },
};

function _approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
}
