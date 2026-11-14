/* =========================================================
 * PICKUPS — súng rải trên map (CẢ DEATHMATCH LẪN SINH TỔN)
 * Mỗi map rải 9 khẩu (mọi khẩu trừ súng lục xuất phát) tại các điểm:
 *   • KHÔNG trùng vị trí, cách nhau tối thiểu ~420px (tự nới nếu map chật)
 *   • tránh chỗ xuất phát 2 đội (không ai lụm súng ngay tại sân nhà)
 *   • chỉ đặt trên bề mặt đứng được (sàn/bậc thềm) + đủ chỗ trống trên đầu
 * Người chơi đến gần bấm G để lụm → mở khoá đúng ô súng đó + đổi luôn.
 * Súng đã lụm sẽ hồi sau 15 giây để trận đấu không cạn vũ khí.
 *
 * ❤️ CỤC HỒI MÁU: chỉ ở DEATHMATCH (wave đi mua medkit ở cửa hàng) — cứ ~12 giây
 * kiểm tra map, nếu hết cục máu trên map thì random vài cục mới (hồi 25%/50%/75%/100%
 * máu, càng mạnh càng hiếm). Đi QUA là tự lụm (người chơi + bot đều được; bot chỉ
 * ăn khi máu dưới 60% để khỏi phí).
 * ========================================================= */
window.Pickups = {
  list: [],
  RESPAWN: 15,   // giây súng hồi sau khi lụm
  PICK_R: 42,    // bán kính lụm (px, tính từ tâm người chơi)

  /* ── máu ── */
  health: [],            // các cục hồi máu đang nằm trên map
  HEALTH_EVERY: 12,      // giây giữa 2 lần "kiểm tra map có cục máu chưa"
  healthT: 0,            // đồng hồ đếm ngược (0 = kiểm tra ngay khi vào trận)
  TOUCH_R: 36,           // đi tới gần thế nào là "chạm" cục máu
  healthOn: false,       // map này CÓ rải túi máu không? (DM: có — wave: không)

  clear() {
    this.list.length = 0;
    this.health.length = 0;
    this.healthT = 0;
    this.healthOn = false;
  },

  /* "Độ mạnh" của khẩu súng — bot dùng để quyết định có nên lụm không
   * (đại ý DPS: sát thương × số mảnh đạn / tốc độ bắn, nổ được cộng thêm) */
  score(w) {
    return (w.damage * (w.pellets || 1)) / w.fireDelay + (w.explodeRadius ? 20 : 0);
  },

  /* Cho bot tìm khẩu súng ĐÁNG LỤM gần nhất (cùng tầng sàn, mạnh hơn đang cầm).
   * Chọn ngẫu nhiên trong 3 khẩu gần nhất → cả đội không dồn hết vào 1 khẩu. */
  nearestFor(b) {
    const cur = this.score(b.weapon);
    const cands = [];
    for (const pk of this.list) {
      if (pk.taken) continue;
      if (this.score(pk.w) <= cur) continue;            // tệ hơn súng đang cầm → bỏ
      const feetY = b.y + b.h;
      if (Math.abs(pk.y - feetY) > 40) continue;         // khác tầng (≥2 ô) → không tới chắc
      const d = Math.hypot(Level.wrapDx(pk.x - (b.x + b.w / 2)), pk.y - feetY); // gần theo map vòng tròn
      cands.push({ pk, d });
    }
    if (cands.length === 0) return null;
    cands.sort((a, b2) => a.d - b2.d);
    return cands[Math.floor(Math.random() * Math.min(3, cands.length))].pk;
  },

  /* Bot HẾT ĐẠN → tìm hộp đạn CHO KHẤU ĐANG CẦM hoặc lụm lại CHÍNH khẩu đó
   * (gần nhất cùng tầng). Không có gì → trả null (bot quay lại tuần tra). */
  nearestAmmoFor(b) {
    const feetY = b.y + b.h;
    const cands = [];
    for (const pk of this.list) {
      if (pk.taken) continue;
      const isMyAmmo = pk.kind === 'ammo' && pk.w === b.weapon;
      const isMyGun = pk.kind === 'gun' && pk.w === b.weapon;
      if (!isMyAmmo && !isMyGun) continue;
      if (Math.abs(pk.y - feetY) > 40) continue; // khác tầng → không tới chắc
      const d = Math.hypot(Level.wrapDx(pk.x - (b.x + b.w / 2)), pk.y - feetY);
      cands.push({ pk, d });
    }
    if (cands.length === 0) return null;
    cands.sort((a, b2) => a.d - b2.d);
    return cands[0].pk;
  },

  /* Cục máu gần nhất CÙNG TẦNG cho bot đang yếu máu — bot tự chạy đi ăn
   * như người chơi (chỉ tính tầng tới được: lệch ≤ 1 bậc 1 ô = 32px). */
  nearestHealthFor(c) {
    const feetY = c.y + c.h;
    let best = null, bestD = 1e9;
    for (const h of this.health) {
      if (Math.abs(h.y - feetY) > 40) continue; // đứng trên bậc cao mà túi máu dưới sàn → với NGHIÊN, đừng đứng ngắm
      const d = Math.hypot(Level.wrapDx(h.x - (c.x + c.w / 2)), h.y - feetY);
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  },

  /* Bot đi ngang qua đồ → tự lụm:
   * • SÚNG mạnh hơn đang cầm → đổi (băng đầy, dự trữ nửa băng — bot AI ngu hơn
   *   người nên được nới một chút);
   * • SÚNG đang cầm → bồi đạn như người chơi (băng đầy + dự trữ);
   * • HỘP ĐẠN của khẩu mình → cộng dự trữ (tối đa 2 băng, đỡ phí). */
  tryBotPickup(b) {
    for (const pk of this.list) {
      if (pk.taken) continue;
      const d = Math.hypot(Level.wrapDx(b.x + b.w / 2 - pk.x), b.y + b.h / 2 - pk.y);
      if (d > 40) continue;

      if (pk.kind === 'ammo') {
        if (pk.w !== b.weapon) continue;
        if (b.spare !== Infinity && b.spare < b.weapon.mag * Config.AMMO.SPARE_CAP) {
          b.spare = Math.min(b.weapon.mag * Config.AMMO.SPARE_CAP, b.spare + pk.amount);
          pk.taken = true;
          pk.respawnT = this.RESPAWN;
          return true;
        }
        continue;
      }

      if (pk.w === b.weapon) { // chính khẩu đang cầm → bồi đạn
        b.mag = pk.w.mag;
        if (b.spare !== Infinity) b.spare += pk.w.mag;
        pk.taken = true;
        pk.respawnT = this.RESPAWN;
        return true;
      }
      if (this.score(pk.w) <= this.score(b.weapon)) continue;
      b.weapon = pk.w;   // cầm luôn khẩu mới
      b.mag = pk.w.mag;
      b.spare = Math.ceil(pk.w.mag * 0.5); // nửa băng dự trữ cho bot
      pk.taken = true;
      pk.respawnT = this.RESPAWN;
      return true;
    }
    return false;
  },

  /* Các điểm "đứng được" trên map (sàn/bậc thềm, trống trên đầu) — dùng chung
   * cho việc rải súng lẫn đặt cục hồi máu. Trả về mảng {x, y} (y = mặt sàn). */
  _standSpots() {
    const spots = [];
    for (let r = 2; r < Level.rows - 1; r++) {
      for (let c = 2; c < Level.cols - 2; c++) {
        if (Level.tileAt(c, r) !== '.') continue;
        const below = Level.tileAt(c, r + 1);
        if (!Level.isSolid(below) && !Level.isOneWay(below)) continue;
        if (Level.tileAt(c, r - 1) !== '.' || Level.tileAt(c, r - 2) !== '.') continue;
        spots.push({ x: c * Level.T + Level.T / 2, y: (r + 1) * Level.T });
      }
    }
    return spots;
  },

  /* Rải súng cho map mới vào.
   * withHealth: có gieo túi hồi máu không? (DM: true — wave: false, máu mua ở cửa hàng)
   * Xen kẽ SÚNG + HỘP ĐẠN: 9 khẩu như cũ, thêm vài hộp đạn ở chỗ khác
   * (hộp đạn cho khẩu random, lượng random 50%-100% băng đầy). */
  spawnForMap(mapDef, withHealth = true) {
    this.clear();
    this.healthOn = !!withHealth;

    // ── 1. Thu hết các ô "đứng được" + xáo trộn ──
    const pool = this._standSpots();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // ── 2. Chọn điểm: tôn trọng khoảng cách tối thiểu, né chỗ spawn 2 đội ──
    const guns = Weapons.list.filter((w) => w.id !== 'pistol'); // 9 khẩu rải
    const avoid = mapDef.spawns ? [...mapDef.spawns.A, ...mapDef.spawns.B] : [];
    const SPAWN_CLEAR = 150; // súng cách điểm xuất phát ít nhất 150px

    let chosen = [];
    for (let minDist = 420; minDist >= 130; minDist -= 60) {
      // xáo trộn lại pool MỖI lần thử — greedy cụt cụm do thứ tự duyệt sẽ tự chữa
      for (let attempt = 0; attempt < 8 && chosen.length < guns.length; attempt++) {
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        chosen = [];
        for (const p of pool) {
          if (chosen.length >= guns.length) break;
          if (avoid.some((s) => Math.hypot(s[0] - p.x, s[1] - p.y) < SPAWN_CLEAR)) continue;
          if (chosen.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < minDist)) continue;
          chosen.push(p);
        }
      }
      if (chosen.length >= guns.length) break; // đủ với khoảng cách đẹp → thôi
    }

    // ── 3. Gán súng vào điểm (đảo vị trí lần nữa cho khỏi đoán) ──
    for (let i = 0; i < guns.length && i < chosen.length; i++) {
      const s = chosen[i];
      this.list.push({
        kind: 'gun', w: guns[i], x: s.x, y: s.y,
        taken: false, respawnT: 0,
        bob: Math.random() * Math.PI * 2, // pha lơ lửng riêng từng khẩu
      });
    }

    // ── 3b. Map chật chưa đủ chỗ đúng chuẩn → lấy thêm điểm bất kỳ (miễn không
    //    trùng chỗ, vẫn né spawn) — không bao giờ để thiếu khẩu trên map ──
    for (const p of pool) {
      if (this.list.length >= guns.length) break;
      if (chosen.some((q) => q.x === p.x && q.y === p.y)) continue;
      if (avoid.some((s) => Math.hypot(s[0] - p.x, s[1] - p.y) < SPAWN_CLEAR)) continue;
      this.list.push({
        kind: 'gun', w: guns[this.list.length], x: p.x, y: p.y,
        taken: false, respawnT: 0,
        bob: Math.random() * Math.PI * 2,
      });
    }

    // ── 3c. HỘP ĐẠN xen kẽ: đặt ở điểm đứng được KHÁC chỗ súng, cách xa chỗ spawn.
    //    Khẩu trong hộp random (trừ súng lục), lượng random ≥ 50% băng đầy ──
    const boxGuns = guns; // 9 khẩu (súng lục là đạn ∞ sẵn — không cần hộp)
    const boxCount = Config.AMMO.BOXES_PER_MAP;
    // Xáo trộn pool rồi quét TUẦN TỰ — luôn đủ hộp nếu map còn chỗ đứng hợp lệ
    // (chỉ thử random vài chục lần là không đủ, map đông súng sẽ trượt hết)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let placed = 0;
    for (const s of pool) {
      if (placed >= boxCount) break;
      if (this.list.some((q) => Math.hypot(q.x - s.x, q.y - s.y) < 130)) continue; // tránh chồng chỗ súng
      if (avoid.some((sp) => Math.hypot(sp[0] - s.x, sp[1] - s.y) < SPAWN_CLEAR)) continue;
      const bw = boxGuns[Math.floor(Math.random() * boxGuns.length)];
      const amount = Math.max(1, Math.ceil(bw.mag * (Config.AMMO.BOX_MIN + Math.random() * (1 - Config.AMMO.BOX_MIN))));
      this.list.push({
        kind: 'ammo', w: bw, amount, x: s.x, y: s.y,
        taken: false, respawnT: 0,
        bob: Math.random() * Math.PI * 2,
      });
      placed++;
    }

    // ── 4. Gieo sẵn vài cục hồi máu lúc mới vào trận (CHỈ DM — wave mua ở cửa hàng) ──
    if (withHealth) this.spawnHealth(3);
    return this.list.length;
  },

  /* Random vài cục hồi máu ở các điểm đứng được (không trùng nhau).
   * % hồi: 25% dễ gặp nhất → 100% hiếm (tỷ lệ 40/30/20/10). */
  spawnHealth(n) {
    const pool = this._standSpots();
    for (let i = 0; i < n && pool.length; i++) {
      const s = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const roll = Math.random();
      const pct = roll < 0.4 ? 0.25 : roll < 0.7 ? 0.5 : roll < 0.9 ? 0.75 : 1.0;
      this.health.push({ x: s.x, y: s.y, pct, bob: Math.random() * Math.PI * 2 });
    }
  },

  /* Đi QUA cục máu là tự lụm (không cần bấm gì). Người chơi ăn khi thiếu máu;
   * bot "biết điều" hơn — chỉ ăn khi máu dưới 60% để khỏi phí cục to. */
  tryTouch(c) {
    if (c.hp >= c.maxHp) return false;
    if (c !== Player.obj && c.hp > c.maxHp * 0.6) return false;
    for (let i = this.health.length - 1; i >= 0; i--) {
      const h = this.health[i];
      const d = Math.hypot(c.x + c.w / 2 - h.x, c.y + c.h / 2 - h.y);
      if (d > this.TOUCH_R) continue;
      const heal = Math.min(c.maxHp - c.hp, Math.round(h.pct * c.maxHp));
      c.hp += heal;
      this.health.splice(i, 1);
      AudioFX.heal();
      if (c === Player.obj) showToast('❤️ Hồi ' + heal + ' máu (+' + Math.round(h.pct * 100) + '%)');
      return true;
    }
    return false;
  },

  /* Bấm G: lụm SÚNG hoặc HỘP ĐẠN gần nhất.
   * • Lụm súng MỚI → mở khoá + ĐỔI RA TAY, chỉ có băng đầy — ĐẠN GIỚI HẠN,
   *   không bắn hoài được (muốn đạn phải nhặt lại / lục hộp đạn).
   * • Lụm lại súng ĐÃ CÓ → băng đầy lại + dự trữ thêm 1 băng.
   * • Hộp đạn: chỉ dùng được khi ĐÃ CÓ khẩu đó → +lượng random vào dự trữ
   *   (tối đa 2 băng, không tích trữ vô hạn). */
  tryPickup(p) {
    // gom mọi thứ trong tầm với → lấy THỨ GẦN NHẤT (không bị hộp đạn che khuất súng)
    const cands = [];
    for (const pk of this.list) {
      if (pk.taken) continue;
      const d = Math.hypot(Level.wrapDx(p.x + p.w / 2 - pk.x), p.y + p.h / 2 - pk.y);
      if (d <= this.PICK_R) cands.push({ pk, d });
    }
    if (cands.length === 0) return false;
    cands.sort((a, b) => a.d - b.d);

    for (const { pk } of cands) {
      const idx = Weapons.list.indexOf(pk.w);
      if (pk.kind === 'ammo') {
        if (!p.owned.has(pk.w.id)) {
          showToast('📦 Hộp đạn ' + pk.w.short + ' — cần CẦM súng này đã!');
          continue; // không tiêu hộp
        }
        if (p.spare[idx] !== Infinity) {
          const cap = (window.GunUp ? GunUp.mag(pk.w) : pk.w.mag) * Config.AMMO.SPARE_CAP;
          p.spare[idx] = Math.min(cap, p.spare[idx] + pk.amount);
        }
        showToast('📦 +' + pk.amount + ' đạn ' + pk.w.short);
        pk.taken = true;
        pk.respawnT = this.RESPAWN;
        AudioFX.reloadEnd();
        return true;
      }

      if (!p.owned.has(pk.w.id)) {
        p.owned.add(pk.w.id);
        p.mags[idx] = (window.GunUp ? GunUp.mag(pk.w) : pk.w.mag); // 🔧 băng đã nâng cấp
        p.spare[idx] = 0; // súng LỤM: chỉ có băng đang cầm — đạn thêm phải đi kiếm
        Player.selectWeapon(p, idx); // active đúng khẩu vừa lụm
        showToast('🎁 Đã lụm ' + pk.w.name + '! (đạn giới hạn — nhặt lại/lục hộp để bồi)');
      } else {
        const magSize = (window.GunUp ? GunUp.mag(pk.w) : pk.w.mag);
        p.mags[idx] = magSize;      // băng đầy lại
        p.spare[idx] += magSize;    // +1 băng dự trữ
        showToast('💧 ' + pk.w.name + ': đạn đầy + dự trữ +' + magSize);
      }
      pk.taken = true;
      pk.respawnT = this.RESPAWN;
      AudioFX.reloadEnd();
      return true;
    }
    return false;
  },

  update(dt) {
    for (const pk of this.list) {
      if (pk.taken) {
        pk.respawnT -= dt;
        if (pk.respawnT <= 0) pk.taken = false;
      }
      pk.bob += dt * 3;
    }

    /* ── ❤️ MÁU: định kỳ kiểm tra map, hết cục máu trên map → random vài cục mới
     *    (chỉ chạy ở DM — wave không rải túi máu) ── */
    this.healthT -= dt;
    if (this.healthOn && this.healthT <= 0) {
      this.healthT = this.HEALTH_EVERY;
      if (this.health.length === 0) this.spawnHealth(2 + Math.floor(Math.random() * 3)); // 2-4 cục
    }
    for (const h of this.health) h.bob += dt * 3;

    // ai đi qua là tự lụm (🤝 co-op: CẢ 2 người đều lụm được + bot còn sống)
    for (const p of Player.list) {
      if (!p.dead && p.hp > 0) this.tryTouch(p);
    }
    for (const b of Bots.list) if (!b.dead) this.tryTouch(b);
  },

  draw(ctx) {
    const p = Player.obj;
    for (const pk of this.list) {
      const bobY = Math.sin(pk.bob) * 3;

      if (pk.taken) {
        // chỗ súng đã bị lụm: vẽ vòng hồi phục đếm ngược
        const pct = 1 - Math.max(0, pk.respawnT) / this.RESPAWN;
        ctx.strokeStyle = 'rgba(120,200,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y - 12, 12, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        ctx.stroke();
        continue;
      }

      // hào quang dưới đồ
      const auraCol = pk.kind === 'ammo' ? '102,200,255' : '255,224,102';
      const g = ctx.createRadialGradient(pk.x, pk.y - 12, 0, pk.x, pk.y - 12, 22);
      g.addColorStop(0, `rgba(${auraCol},0.30)`);
      g.addColorStop(1, `rgba(${auraCol},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(pk.x - 22, pk.y - 34, 44, 44);

      if (pk.kind === 'ammo') {
        /* ── HỘP ĐẠN: thùng vàng đồng, nhãn khẩu + lượng đạn random ── */
        ctx.save();
        ctx.translate(pk.x, pk.y - 14 + bobY);
        ctx.fillStyle = '#8a6d3b';          // thùng gỗ/đạn
        ctx.fillRect(-12, -8, 24, 16);
        ctx.strokeStyle = '#5d4a26';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-12, -8, 24, 16);
        ctx.fillStyle = '#ffe066';          // 3 viên đạn trên mặt hộp
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(i * 6 - 1.5, -5, 3, 9);
        }
        ctx.restore();
        ctx.font = '600 10px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(102,200,255,0.95)';
        ctx.fillText('📦 +' + pk.amount + ' ' + pk.w.short, pk.x, pk.y - 30 + bobY);
        ctx.textAlign = 'left';
      } else {
        // khẩu súng lơ lửng (tái dùng hàm vẽ súng của người que)
        ctx.save();
        ctx.globalAlpha = 0.95;
        _drawGun(ctx, pk.w, pk.x - 12, pk.y - 14 + bobY, 0, 0, 52, null);
        ctx.restore();

        // tên súng nhỏ phía trên
        ctx.font = '600 10px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,224,102,0.85)';
        ctx.fillText(pk.w.short, pk.x, pk.y - 30 + bobY);
        ctx.textAlign = 'left';
      }

      // gợi ý phím LỤM khi người chơi lại gần (tính cả khoảng cách vòng qua mép map)
      // — lấy phím thật đang bind (đổi ở menu ⌨️ là chữ tự đổi theo)
      if (p && Math.hypot(Level.wrapDx(p.x + p.w / 2 - pk.x), p.y + p.h / 2 - pk.y) < this.PICK_R + 14) {
        const k = (window.Input && Input.boundKey) ? Input.boundKey('pickup') : 'G';
        ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#7df3ff';
        ctx.fillText('[' + k + '] ' + (pk.kind === 'ammo' ? 'Lục đạn' : 'Lụm'), pk.x, pk.y - 44 + bobY);
      }
      ctx.textAlign = 'left';
    }

    /* ── ❤️ các cục hồi máu: hộp cứu thương trắng + chữ thập đỏ, cỡ theo % hồi ── */
    for (const h of this.health) {
      const bobY = Math.sin(h.bob) * 3;
      const s = h.pct >= 1 ? 15 : h.pct >= 0.75 ? 13 : h.pct >= 0.5 ? 11 : 9; // nửa cạnh hộp

      // hào quang xanh lá
      const g = ctx.createRadialGradient(h.x, h.y - 14, 0, h.x, h.y - 14, 24);
      g.addColorStop(0, 'rgba(74,222,128,0.35)');
      g.addColorStop(1, 'rgba(74,222,128,0)');
      ctx.fillStyle = g;
      ctx.fillRect(h.x - 24, h.y - 38, 48, 48);

      // hộp trắng
      ctx.fillStyle = '#eef2f6';
      ctx.fillRect(h.x - s, h.y - 14 + bobY - s, s * 2, s * 2);
      // chữ thập đỏ
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(h.x - s * 0.2, h.y - 14 + bobY - s * 0.75, s * 0.4, s * 1.5);
      ctx.fillRect(h.x - s * 0.75, h.y - 14 + bobY - s * 0.2, s * 1.5, s * 0.4);

      // % hồi phía trên
      ctx.font = '600 10px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(74,222,128,0.95)';
      ctx.fillText('+' + Math.round(h.pct * 100) + '%', h.x, h.y - 24 + bobY);
      ctx.textAlign = 'left';
    }
  },
};
