/* =========================================================
 * BOTS — bot Deathmatch, AI theo máy trạng thái:
 *   TUẦN TRA → PHÁT HIỆN (nhìn thẳng) → BẮN theo loạt → RÚT LUI khi yếu
 * Bot dùng đúng hệ physics + súng của người chơi, aim có "độ gà"
 * giảm dần khi đã ngắm lâu — chơi vừa sức mà không dễ quá.
 * ========================================================= */
window.Bots = {
  list: [],
  HATS: ['helmet', 'cap', 'space', 'none'],

  /* ── TÍNH CÁCH BOT — mỗi bot một cá tính riêng khi giao tranh ──
   * near/far : khoảng cách chiến đấu hợp lý (đứng xa hơn far → tiến, gần hơn near → lùi)
   * retreatHp: máu dưới mức này thì chuồn
   * strafe   : thời gian đổi hướng dáo díu (dài = lắc ÍT, kiểu "núp bắn")
   * flank    : khi tuần tra thì LẠC theo hướng vòng ra SƯỜN/LƯNG địch vừa thấy */
  PERSONALITIES: {
    normal:     { id: 'normal',     name: 'Cân bằng',  near: 170, far: 420, retreatHp: 35, strafeMin: 0.5, strafeMax: 1.4, flank: false },
    aggressive: { id: 'aggressive', name: 'Hung hăng', near: 80,  far: 260, retreatHp: 15, strafeMin: 0.3, strafeMax: 0.9, flank: false },
    campy:      { id: 'campy',      name: 'Núp bắn',   near: 380, far: 640, retreatHp: 50, strafeMin: 1.2, strafeMax: 2.4, flank: false },
    flanker:    { id: 'flanker',    name: 'Vòng sườn', near: 200, far: 460, retreatHp: 60, strafeMin: 0.4, strafeMax: 1.2, flank: true },
  },
  // rút thăm khi spawn — "Cân bằng" chiếm 2/5 nên đa số bot vẫn như cũ
  PICK: ['normal', 'normal', 'aggressive', 'campy', 'flanker'],

  clear() { for (const b of this.list) Combatants.unregister(b); this.list.length = 0; },

  spawn(team, x, y, weaponId, color) {
    const w = Weapons.list.find((wp) => wp.id === weaponId);
    const bot = {
      x: x - 10, y: y - 52, w: 20, h: 52,
      vx: 0, vy: 0, onGround: false, crouch: false,
      hp: 100, maxHp: 100, team, dead: false,
      airJumps: 0,                // số lần nhảy còn lại giữa không trung (như người chơi)
      headRatio: 0.28, bloodColor: '#e23b3b',
      color, hat: this.HATS[Math.floor(Math.random() * this.HATS.length)],
      weapon: w,
      mag: w.mag, reloadT: 0,
      spare: w.id === 'pistol' ? Infinity : 0, // súng lục bot bắn ∞; súng lụm = giới hạn như người chơi
      aimAngle: 0, facing: 1, runPhase: 0, gunKick: 0, muzzleTimer: 0, muzzle: { x: 0, y: 0 },
      state: 'roam', roamX: 0, thinkT: 0,
      target: null, lockT: 0, fireT: 0, burst: 0, burstPause: 0,
      strafe: 1, strafeT: 0, retreatT: 0, respawnT: 0, flash: 0,
      pers: this.PERSONALITIES[this.PICK[Math.floor(Math.random() * this.PICK.length)]],
      lastEnemyX: null, // ghi nhớ vị trí địch cuối — cho tính cách "Vòng sườn"

      hit(dmg, isHead, hx, hy, shooterTeam) {
        if (this.dead) return 0;
        this.hp -= dmg;
        this.flash = 0.12;
        if (this.hp <= 0) {
          this.dead = true;
          this.respawnT = Config.DM.RESPAWN;
          Particles.poof(this.x + this.w / 2, this.y + this.h / 2);
          Match.onKill(shooterTeam);
        }
        return dmg;
      },
    };
    this._newRoam(bot);
    this.list.push(bot);
    Combatants.register(bot);
    return bot;
  },

  _newRoam(bot) {
    // tính cách "Vòng sườn": nhớ vị trí địch vừa thấy → lác qua SƯỜN/LƯNG bên kia
    // (đi tiếp QUA MÉP map nếu cần) thay vì đi tới chừng ngẫu nhiên
    if (bot.pers && bot.pers.flank && bot.lastEnemyX != null) {
      const side = Level.wrapDx(bot.lastEnemyX - (bot.x + bot.w / 2)) >= 0 ? 1 : -1;
      bot.roamX = ((bot.lastEnemyX + side * (180 + Math.random() * 160)) % Level.pxW + Level.pxW) % Level.pxW;
      return;
    }
    bot.roamX = 100 + Math.random() * (Level.pxW - 200);
  },

  update(dt) {
    for (const b of this.list) {
      /* hồi sinh */
      if (b.dead) {
        b.respawnT -= dt;
        if (b.respawnT <= 0) {
          const sp = Match.spawnPoint(b.team);
          b.x = sp.x - 10; b.y = sp.y - 52;
          b.hp = b.maxHp; b.dead = false;
          b.mag = b.weapon.mag; b.reloadT = 0; b.state = 'roam'; b.target = null;
          Particles.smoke(sp.x, sp.y - 20, 4);
        }
        continue;
      }

      b.flash = Math.max(0, b.flash - dt);
      b.gunKick = Math.max(0, b.gunKick - dt * 7);
      b.muzzleTimer -= dt;

      /* ── 1. Tìm mục tiêu: kẻ địch gần nhất đang nhìn thấy được ── */
      const eyeX = b.x + b.w / 2, eyeY = b.y + b.h * 0.3;
      let best = null, bestD = 1e9;
      for (const c of Combatants.hostiles(b.team)) {
        const d = Math.hypot(Level.wrapDx(c.x + c.w / 2 - eyeX), c.y + c.h / 2 - eyeY); // gần theo map vòng tròn
        if (d < bestD && Combatants.canSee(eyeX, eyeY, c, 720)) { best = c; bestD = d; }
      }
      if (best) {
        if (b.target !== best) { b.target = best; b.lockT = 0; }
        b.state = 'engage';
      } else if (b.state === 'engage') {
        b.state = 'roam'; b.target = null;
        this._newRoam(b);
      }

      /* ── 2. Di chuyển theo trạng thái ── */
      let moveDir = 0;
      const dry = b.mag <= 0 && b.spare !== Infinity && b.spare <= 0; // hết cả băng lẫn dự trữ
      if (b.state === 'engage' && b.target) {
        b.lockT += dt;
        const P = b.pers; // tính cách của bot này
        const dx = Level.wrapDx(b.target.x + b.target.w / 2 - eyeX); // map vòng tròn: bám địch qua mép map
        b.lastEnemyX = b.target.x + b.target.w / 2;
        // giữ khoảng cách chiến đấu theo TÍNH CÁCH (Hung hăng áp sát, Núp bắn giữ xa)
        if (bestD > P.far) moveDir = Math.sign(dx);
        else if (bestD < P.near) moveDir = -Math.sign(dx);
        else {
          // đứng đánh nhau: dáo díu trái phải (tần suất theo tính cách)
          b.strafeT -= dt;
          if (b.strafeT <= 0) { b.strafe *= -1; b.strafeT = P.strafeMin + Math.random() * (P.strafeMax - P.strafeMin); }
          moveDir = b.strafe;
        }
        // yếu máu → chuồn (ngưỡng theo tính cách: Hung hăng liều tới cùng)
        if (b.hp < P.retreatHp && b.retreatT <= 0) { b.retreatT = 1.3; b.state = 'retreat'; }
      } else if (b.state === 'retreat') {
        b.retreatT -= dt;
        // rút lui về phía CÓ TÚI MÁU nếu gần — vừa chạy vừa hồi (như người chơi)
        const med = (window.Pickups && b.hp < b.maxHp * 0.9) ? Pickups.nearestHealthFor(b) : null;
        if (med) {
          const dx = Level.wrapDx(med.x - eyeX);
          moveDir = Math.abs(dx) < 20 ? 0 : Math.sign(dx);
        } else if (b.target) {
          moveDir = -Math.sign(b.target.x - b.x);
        }
        if (b.retreatT <= 0) b.state = 'roam';
      } else {
        // tuần tra — thứ tự ưu tiên: 1) HẾT ĐẠN → đi LỤM hộp đạn/súng mình cầm,
        // 2) yếu máu → chạy ĂN TÚI CỨU THƯƠNG gần nhất,
        // 3) đi LỤM SÚNG rải trên map (như người chơi bấm G), 4) đi dạo ngẫu nhiên
        if (dry) {
          const am = window.Pickups ? Pickups.nearestAmmoFor(b) : null;
          if (am) {
            const dx = Level.wrapDx(am.x - eyeX);
            moveDir = Math.abs(dx) < 16 ? 0 : Math.sign(dx);
          } else {
            // không có hộp đạn/khẩu đó quanh đây → đổi sang lục súng mạnh khác
            const goal = window.Pickups ? Pickups.nearestFor(b) : null;
            if (goal) {
              const dx = Level.wrapDx(goal.x - eyeX);
              moveDir = Math.abs(dx) < 16 ? 0 : Math.sign(dx);
            }
          }
        } else {
        const med = (b.hp < b.maxHp * 0.6 && window.Pickups) ? Pickups.nearestHealthFor(b) : null;
        if (med) {
          const dx = Level.wrapDx(med.x - eyeX);
          moveDir = Math.abs(dx) < 20 ? 0 : Math.sign(dx);
        } else {
          const goal = window.Pickups ? Pickups.nearestFor(b) : null;
          if (goal) {
            const dx = Level.wrapDx(goal.x - eyeX);
            moveDir = Math.abs(dx) < 16 ? 0 : Math.sign(dx);
          } else {
            const dx = Level.wrapDx(b.roamX - eyeX);
            if (Math.abs(dx) < 40) this._newRoam(b);
            else moveDir = Math.sign(dx);
          }
        }
        } // hết nhánh !dry
      }

      const spd = 206 * (b.state === 'retreat' ? 1.15 : 1); // 206 = 295 giảm ~30%
      b.vx = _approach2(b.vx, moveDir * spd, (b.onGround ? 2400 : 1400) * dt);

      // vướng tường → nhảy; tường CAO vẫn vướng khi sắp chạm đỉnh nhảy → NHẢY LẦN 2
      // (dùng đúng thông số người chơi: JUMP_VEL -823, tối đa 2 nhịp — leo nổi mọi khối trên map)
      if (moveDir !== 0) {
        const aheadX = b.x + b.w / 2 + Math.sign(b.vx || moveDir) * 18;
        const blocked = Level.isSolid(Level.tileAt(Math.floor(aheadX / Level.T), Math.floor((b.y + b.h - 6) / Level.T)));
        if (blocked) {
          if (b.onGround) {
            b.vy = Config.PLAYER.JUMP_VEL;            // nhịp 1: nhảy đất
          } else if (b.airJumps > 0 && b.vy > -80) {  // nhịp 2: sắp rơi mà vẫn vướng tường
            b.vy = Config.PLAYER.JUMP_VEL * 0.92;
            b.airJumps--;
          }
        }
      }

      /* ── 3. Ngắm + bắn theo loạt ── */
      if (b.state === 'engage' && b.target) {
        const aimAt = b.target;
        const tx = aimAt.x + aimAt.w / 2, ty = aimAt.y + aimAt.h * 0.45;
        // map vòng tròn: ngắm QUA MÉP map khi địch đứng bên kia seam
        const want = Math.atan2(ty - eyeY, Level.wrapDx(tx - eyeX));
        // độ gà: sai số co lại khi đã "khoá" mục tiêu lâu
        const err = Math.max(0.03, 0.26 - b.lockT * 0.22) * (Math.random() - 0.5) * 2;
        b.aimAngle = want + err;
        b.facing = Math.cos(b.aimAngle) >= 0 ? 1 : -1;

        const w = b.weapon;
        if (b.reloadT > 0) {
          b.reloadT -= dt;
          if (b.reloadT <= 0) {
            // nạp đạn TIÊU từ kho dự trữ (súng lục ∞ nên luôn nạp được)
            const take = b.spare === Infinity ? w.mag : Math.min(w.mag - b.mag, b.spare);
            if (b.spare !== Infinity) b.spare -= take;
            b.mag += take;
          }
        } else if (b.mag <= 0) {
          if (b.spare === Infinity || b.spare > 0) b.reloadT = 1.5;
          // hết cả dự trữ → KHÔNG nạp nữa: bot tự đi lục hộp đạn (phần di chuyển)
        } else {
          b.fireT -= dt;
          if (b.burst <= 0 && b.burstPause <= 0) {
            b.burst = 2 + Math.floor(Math.random() * 4);
            b.burstPause = 0.35 + Math.random() * 0.7;
          }
          if (b.burst > 0 && b.fireT <= 0 && b.burstPause <= 0) {
            this._fire(b, w, eyeX, eyeY);
            b.burst--;
            b.fireT = w.fireDelay;
            if (b.burst <= 0) b.burstPause = 0.4 + Math.random() * 0.8;
          }
          b.burstPause -= dt;
        }
      }

      /* ── 4. Vật lý + animate ── */
      b.vy = Math.min(b.vy + Config.GRAVITY * dt, Config.MAX_FALL);
      Physics.moveAndCollide(b, Level, dt);
      if (b.onGround) b.airJumps = Config.PLAYER.MAX_JUMPS - 1; // chạm đất → được nhảy thêm 1 lần nữa
      if (b.onGround && Math.abs(b.vx) > 15) b.runPhase += Math.abs(b.vx) * dt * 0.055;
      else b.runPhase = 0;

      // đi ngang qua súng rải → tự lụm (bot không cần bấm G)
      if (window.Pickups && Pickups.tryBotPickup(b)) b.lockT = 0; // súng mới → ngắm lại
    }
  },

  _fire(b, w, eyeX, eyeY) {
    b.mag--;
    b.gunKick = Math.min(1, w.recoil);
    b.muzzleTimer = 0.05;
    const dist = b.h * 0.08 + w.bodyLen + w.barrelLen;
    const mx = eyeX + Math.cos(b.aimAngle) * dist - (eyeX - (b.x + b.w / 2));
    const my = eyeY + Math.sin(b.aimAngle) * dist;
    b.muzzle.x = mx; b.muzzle.y = my;
    AudioFX.shot(w.sound);
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const spread = (Math.random() - 0.5) * 2 * w.spread;
      Bullets.fireHitscan(mx, my, b.aimAngle + spread, w, b.team);
    }
    Particles.smoke(mx, my, 1);
    Particles.shell(mx, my, b.aimAngle);
  },

  draw(ctx) {
    for (const b of this.list) {
      if (b.dead) {
        ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('⟳ ' + b.respawnT.toFixed(1), b.x + b.w / 2, b.y + b.h + 14);
        ctx.textAlign = 'left';
        continue;
      }
      const col = b.flash > 0 ? '#ffffff' : b.color;
      drawStickman(ctx, {
        cx: b.x + b.w / 2, feetY: b.y + b.h, h: b.h,
        facing: b.facing, runPhase: b.runPhase,
        moving: Math.abs(b.vx) > 15, onGround: b.onGround, crouch: false,
        color: col, hat: b.hat, aimAngle: b.state === 'engage' ? b.aimAngle : null,
        gun: b.weapon, gunKick: b.gunKick,
      });
      // loé sáng đầu nòng
      if (b.muzzleTimer > 0) {
        ctx.save();
        ctx.translate(b.muzzle.x, b.muzzle.y);
        ctx.rotate(b.aimAngle);
        ctx.fillStyle = 'rgba(255,240,180,0.9)';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // thanh máu nhỏ trên đầu + nhãn tính cách
      const bw = 30, pct = b.hp / b.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(b.x + b.w / 2 - bw / 2, b.y - 12, bw, 4);
      ctx.fillStyle = b.team === 'A' ? '#22d3ee' : '#f43f5e';
      ctx.fillRect(b.x + b.w / 2 - bw / 2 + 0.5, b.y - 11.5, (bw - 1) * pct, 3);
      ctx.font = '600 9px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(b.pers.name, b.x + b.w / 2, b.y - 16);
      ctx.textAlign = 'left';
    }
  },
};

function _approach2(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
}
