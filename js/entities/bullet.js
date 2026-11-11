/* =========================================================
 * BULLETS — đạn của mọi khẩu súng (người chơi, bot, quái)
 * • fireHitscan: tia đạn lan TỨC THỜI — bắn dần theo hướng, chạm
 *   tường/bia là dừng (sniper & railgun xuyên NHIỀU BIA, không xuyên tường)
 * • fireProjectile: đạn bay thật (tên lửa, plasma, axit quái)
 * • Đạn chỉ trúng TEAM KHÁC — đồng đội đi ngang qua vô hại.
 * ========================================================= */
window.Bullets = {
  projectiles: [],
  tracers: [],
  _rayId: 0,

  /* Bắn 1 tia. Trả về { dmg, head, kill, x, y } */
  fireHitscan(x, y, angle, w, shooterTeam) {
    const step = 5;
    const dx = Math.cos(angle) * step, dy = Math.sin(angle) * step;
    let cx = x, cy = y;
    let endX = x + Math.cos(angle) * w.range;
    let endY = y + Math.sin(angle) * w.range;
    let totalDmg = 0, anyHead = false, killed = false;

    const enemies = Combatants.hostiles(shooterTeam);

    // modifier wave "ĐẠN XUYÊN +1": đạn người chơi xuyên thêm 1 mục tiêu
    let pierceLeft = (!w.pierceTargets && shooterTeam === 'P'
      && window.Wave && Wave.mods && Wave.mods.pierce && Wave.state !== 'idle') ? 1 : 0;

    this._rayId++;
    let stopped = false;
    let seamY = null, seamSide = 0; // tia xuyên mép map: vị trí + phía vòng qua
    for (let d = 0; d < w.range && !stopped; d += step) {
      cx += dx; cy += dy;

      // map vòng tròn: tia vượt biên phải → vòng về biên trái (và ngược lại)
      if (cx >= Level.pxW) { seamY = cy; seamSide = 1; cx -= Level.pxW; }
      else if (cx < 0) { seamY = cy; seamSide = -1; cx += Level.pxW; }

      // tường + bậc thềm đều chặn tia (bậc thềm không bắn xuyên được)
      if (Level.blocksShotAt(cx, cy)) {
        endX = cx; endY = cy;
        break;
      }
      // trúng ai không?
      for (const c of enemies) {
        if (c._rayId === this._rayId) continue;
        if (cx >= c.x - 2 && cx <= c.x + c.w + 2 && cy >= c.y - 2 && cy <= c.y + c.h + 2) {
          c._rayId = this._rayId; // 1 tia chỉ trúng 1 mục tiêu 1 lần
          const isHead = cy < c.y + c.h * (c.headRatio || 0.28);
          const dmg = Math.round(w.damage * (isHead ? (w.headMult || 2) : 1));
          const applied = c.hit(dmg, isHead, cx, cy, shooterTeam);

          totalDmg += applied;
          if (isHead) { anyHead = true; Time.hitstop(0.045); } // hitstop headshot!
          if (applied > 0 && c.bloodColor) {
            Particles.blood(cx, cy, angle, isHead ? 12 : 6, c.bloodColor);
            Level.splatter(cx, cy, angle, isHead);
          }
          endX = cx; endY = cy;
          if (!w.pierceTargets) {
            if (pierceLeft > 0) pierceLeft--; // modifier xuyên: tiếp tục bay
            else stopped = true;
          }
          break;
        }
      }
    }

    // vệt đạn: nếu tia xuyên mép map thì vẽ 2 đoạn rời nhau (không kẻ ngang cả map)
    const tracer = (x1, y1, x2, y2) => this.tracers.push({
      x1, y1, x2, y2,
      life: w.tracerLife || 0.07, maxLife: w.tracerLife || 0.07,
      color: w.tracerColor || '#ffe9a8', width: w.tracerWidth || 1.8,
    });
    if (seamSide === 1) { tracer(x, y, Level.pxW, seamY); tracer(0, seamY, endX, endY); }
    else if (seamSide === -1) { tracer(x, y, 0, seamY); tracer(Level.pxW, seamY, endX, endY); }
    else tracer(x, y, endX, endY);
    Trees.hitAt(endX, endY, w.damage); // tia dừng tại cây → cây hao mòn dần
    Particles.sparks(endX, endY, angle + Math.PI, 4, '#ffce54');
    return { dmg: totalDmg, head: anyHead, kill: killed, x: endX, y: endY };
  },

  fireProjectile(x, y, angle, w, shooterTeam) {
    this.projectiles.push({
      x, y, angle, w, shooterTeam,
      vx: Math.cos(angle) * w.projSpeed,
      vy: Math.sin(angle) * w.projSpeed,
      dist: 0,
    });
  },

  /* nổ tại (x,y): sát thương vùng cho kẻ địch + hiệu ứng + rung + tiếng
   * • Nhìn THẲNG tới nạn nhân → sát thương nổ thường (giảm dần theo khoảng cách)
   * • Bị TƯỜNG chặn → sóng xung kích vẫn xuyên yếu: trúng 50% máu tối đa
   * • Nổ ngay DƯỚI sàn MỎNG (1 ô) mà nạn nhân đang đứng → trúng 75% máu tối đa
   *   (đạn không xuyên sàn nhưng rung sập sàn — đúng góp ý "bazoka phóng lựu") */
  explode(x, y, w, shooterTeam) {
    for (const c of Combatants.hostiles(shooterTeam)) {
      const tx = c.x + c.w / 2, ty = c.y + c.h / 2;
      const d = Math.hypot(tx - x, ty - y);
      if (d < w.explodeRadius + 12) {
        let dmg;
        if (Combatants.canSee(x, y, c, w.explodeRadius + 20)) {
          const fall = 1 - 0.7 * Math.min(1, d / w.explodeRadius);
          dmg = Math.round(w.damage * fall);
        } else {
          // nổ bị chặn → phần trăm máu tối đa (sàn mỏng dưới chân thì nặng hơn)
          const thinFloor = this._thinFloorUnder(x, y, c);
          dmg = Math.round(c.maxHp * (thinFloor
            ? Config.EXPLODE.THROUGH_FLOOR
            : Config.EXPLODE.THROUGH_WALL));
        }
        const applied = c.hit(dmg, false, tx, ty, shooterTeam);
        if (applied > 0) {
          Particles.text(tx, ty - 20, String(applied), '#ff9d5c', 14);
          if (c.bloodColor) {
            Particles.blood(tx, ty, Math.atan2(ty - y, tx - x), 10, c.bloodColor);
            Level.splatter(tx, ty, Math.atan2(ty - y, tx - x), true);
          }
        }
      }
    }
    Particles.explosion(x, y, w.explodeRadius);
    Trees.explodeAt(x, y, w.explodeRadius); // vụ nổ quét qua → cây trong bán kính bay màu cả cây
    Camera.addShake(w.shakeOnBoom || 6);
    AudioFX.explode();
  },

  /* Nạn nhân có đang đứng trên SÀN MỎNG (1 ô) mà vụ nổ ở ngay DƯỚI chân không?
   * Đúng 2 điều kiện: (1) nổ thấp hơn nạn nhân, (2) sàn dưới chân dày đúng 1 ô. */
  _thinFloorUnder(ex, ey, c) {
    if (ey <= c.y + c.h * 0.5) return false; // nổ không hẳn ở dưới người
    const col = Math.floor((c.x + c.w / 2) / Level.T);
    let r = Math.floor((c.y + c.h) / Level.T); // ô đầu tiên dưới chân
    let thick = 0;
    while (thick < 2 && (Level.isSolid(Level.tileAt(col, r)) || Level.isOneWay(Level.tileAt(col, r)))) {
      thick++;
      r++;
    }
    return thick === 1; // mỏng đúng 1 ô
  },

  update(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      const w = b.w;
      const SUB = 2, sdt = dt / SUB;
      let boom = false, bx = b.x, by = b.y;

      for (let s = 0; s < SUB; s++) {
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        b.dist += w.projSpeed * sdt;
        // map vòng tròn: đạn vượt biên → vòng qua mép kia rồi mới nổ
        if (b.x >= Level.pxW) b.x -= Level.pxW;
        else if (b.x < 0) b.x += Level.pxW;
        if (Level.blocksShotAt(b.x, b.y)) boom = true; // tường + bậc thềm đều dội nổ
        for (const c of Combatants.hostiles(b.shooterTeam)) {
          if (b.x >= c.x && b.x <= c.x + c.w && b.y >= c.y && b.y <= c.y + c.h) boom = true;
        }
        if (boom) { bx = b.x; by = b.y; break; }
      }

      if (!boom) {
        Particles.trail(b.x, b.y, w);
        if (b.dist > 1800) boom = true;
      }
      if (boom) { this.explode(bx, by, w, b.shooterTeam); this.projectiles.splice(i, 1); }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
  },

  /* mô phỏng đường đạn thẳng → điểm kết thúc (vẽ đường ngắm mờ) */
  previewEnd(x, y, angle, w, shooterTeam) {
    const step = 6;
    const dx = Math.cos(angle) * step, dy = Math.sin(angle) * step;
    let cx = x, cy = y;
    const enemies = Combatants.hostiles(shooterTeam);
    for (let d = 0; d < w.range; d += step) {
      cx += dx; cy += dy;
      // map vòng tròn: đường ngắm cũng vòng qua mép kia
      if (cx >= Level.pxW) cx -= Level.pxW;
      else if (cx < 0) cx += Level.pxW;
      if (Level.blocksShotAt(cx, cy)) break; // đường ngắm cũng bị bậc thềm chặn
      let hitTarget = false;
      for (const c of enemies) {
        if (cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h) { hitTarget = true; break; }
      }
      if (hitTarget) break;
    }
    return { x: cx, y: cy };
  },

  draw(ctx) {
    for (const tr of this.tracers) {
      ctx.globalAlpha = (tr.life / tr.maxLife) * 0.9;
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = tr.width;
      ctx.beginPath();
      ctx.moveTo(tr.x1, tr.y1);
      ctx.lineTo(tr.x2, tr.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const b of this.projectiles) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      if (b.w.id === 'plasma') {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
        g.addColorStop(0, 'rgba(220,255,255,0.95)');
        g.addColorStop(0.45, 'rgba(84,224,255,0.8)');
        g.addColorStop(1, 'rgba(84,224,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      } else if (b.w.acid) { // giọt axit quái phun
        ctx.fillStyle = '#8ef27a';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(142,242,122,0.4)';
        ctx.beginPath(); ctx.arc(-4, -3, 2.5, 0, Math.PI * 2); ctx.fill();
      } else { // tên lửa
        ctx.fillStyle = '#ffb347';
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-14 - Math.random() * 6, -2); ctx.lineTo(-14 - Math.random() * 6, 2); ctx.fill();
        ctx.fillStyle = '#a9b2c0';
        ctx.fillRect(-5, -2.5, 11, 5);
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(1, -2.5); ctx.lineTo(1, 2.5); ctx.fill();
      }
      ctx.restore();
    }
  },

  clear() { this.projectiles.length = 0; this.tracers.length = 0; },
};
