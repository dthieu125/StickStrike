/* =========================================================
 * MAIN — bộ não điều phối trò chơi
 * Trạng thái: menu → (wave | deathmatch) → pause/gameover/matchend
 * ========================================================= */
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const viewW = Config.CANVAS_W;
  const viewH = Config.CANVAS_H;

  let mode = 'menu'; // 'menu' | 'wave' | 'dm'
  let paused = false;
  let mapDef = Maps.deck;
  let fps = 60;
  let toastTimer = 0, toastText = '', errShown = false;
  let time = 0;

  /* ============ API cho menu (DOM) gọi vào ============ */
  window.Game = {
    startWave() {
      AudioFX.ensure();
      mode = 'wave'; paused = false;
      mapDef = Maps.deck;
      _setupLevel(mapDef);
      Player.create(Level.spawn, 'P', false); // wave: chỉ có súng lục + lục lọi
      Pickups.spawnForMap(mapDef, false); // rải SÚNG cả map wave — lụm bằng G như DM (không rải túi máu, máu mua ở cửa hàng)
      Props.spawnForMap(mapDef); // 🛢️ vật thể phá được — chỉ chế độ Sinh tồn (vàng rơi chỉ nghiêng về wave)
      Wave.start();
      Menu.hideAll();
      AudioFX.startMusic();
      showToast('🌊 Sống sót hết chồng quái nhé! Súng rải trên map — lụm bằng ' + Input.boundKey('pickup'));
    },
    startDM(mapId) {
      AudioFX.ensure();
      mode = 'dm'; paused = false;
      mapDef = Maps[mapId];
      _setupLevel(mapDef);
      // bạn đứng vào đội hình đội A (điểm spawn đầu tiên của đội)
      // chỉ có SÚNG LỤC — 9 khẩu còn lại rải trên map, đi lụm bằng G
      const sp = mapDef.spawns.A[0];
      Player.create({ x: sp[0], y: sp[1] - 52 }, 'A', ['pistol']);
      Pickups.spawnForMap(mapDef);
      Trees.spawnForMap(mapDef); // map rừng → dựng cây phá được (map khác không có cây)
      Match.start(mapDef);
      Menu.hideAll();
      AudioFX.startMusic();
      showToast('🤖 Đội ' + Config.DM.WIN_KILLS + ' kill thắng — Lụm súng rải trên map bằng phím G!');
    },
    resume() {
      paused = false;
      Menu.hideAll();
    },
    toMenu() {
      mode = 'menu'; paused = false;
      Wave.reset(); Match.reset();
      Monsters.clear(); Bots.clear(); Bullets.clear();
      Combatants.reset();
      Player.obj = null;
      Level.splatterClear && Level.splatterClear();
      AudioFX.stopMusic();
      Menu.refreshScores();
      Menu.show('menu');
    },
  };

  function _setupLevel(def) {
    Level.load(def);
    Bullets.clear();
    Monsters.clear();
    Bots.clear();
    Pickups.clear();
    Trees.clear();
    if (window.Props) Props.clear();
    Combatants.reset();
    Time.reset();
  }

  // xoá vết máu khi đổi map (tái tạo canvas stains)
  // (Level.load đã tạo stains mới mỗi lần nạp — đủ dùng)

  /* ============ UPDATE ============ */
  function update(rawDt) {
    time += rawDt;
    const dt = Time.step(rawDt); // hitstop làm chậm thời gian trong tích tắc

    if (fps > 0) fps += (1 / Math.max(rawDt, 0.0001) - fps) * 0.05;

    if (mode === 'menu') {
      // camera trôi chậm nhìn quanh map làm nền menu
      Camera.x = (Math.sin(time * 0.1) * 0.5 + 0.5) * Math.max(0, Level.pxW - viewW);
      Camera.y = Math.max(0, Math.min(Level.pxH - viewH, Camera.y));
      Camera.x = Math.max(0, Math.min(Level.pxW - viewW, Camera.x));
      Level.camX = Camera.x; Level.camY = Camera.y;
      Particles.update(dt);
      if (toastTimer > 0) toastTimer -= rawDt;
      return;
    }

    if (paused) return;

    /* ── TRẬN ĐÃ KẾT THÚC → mọi thứ ĐỨNG IM ngay (góp ý người chơi):
     *    không ai chạy/bắn tiếp, chỉ còn hạt hiệu ứng tàn dư + HUD ── */
    const over = (mode === 'dm' && Match.state === 'ended') || (mode === 'wave' && Wave.over);
    if (over) {
      Particles.update(dt);
      if (toastTimer > 0) toastTimer -= rawDt;
      return;
    }

    const p = Player.obj;
    const mw = { x: Input.mouse.x + Camera.x, y: Input.mouse.y + Camera.y };

    Player.update(p, Level, dt, mw);
    Monsters.update(dt);
    Bots.update(dt);
    Bullets.update(dt);
    Particles.update(dt);

    Pickups.update(dt); // súng rải trên map (cả wave lẫn DM) + túi máu (DM)
    Trees.update(dt);   // cây rung lắc (map rừng)
    if (window.Props) Props.update(dt); // 🛢️ vật thể rung + rò ga

    if (mode === 'wave') {
      Wave.update(dt);
      // bấm B mở cửa hàng khi đang nghỉ giữa các đợt (đang chọn lá 🗺️ thì KHÔNG)
      if (Input.wasPressed('buy') && Wave.state === 'intermission') {
        if (Wave.resting) Shop.setOpen(false); // 🏪 đang NGHỈ tiệm: B = đóng tiệm → chọn lại đường
        else if (!Wave.nodeOpen) Shop.toggle();
      }
      Shop.setOpen(Shop.open && Wave.state === 'intermission');
      if (Wave.state === 'intermission' && Wave.timer <= 0) Shop.setOpen(false);
      // 🛒 CLICK chuột vào món hàng / nút "RA ĐÁNH TIẾP" — cửa hàng vẽ bằng canvas
      // nên phải tự soi toạ độ click qua Shop.handleClick (nuốt luôn click để không bắn súng)
      if (Shop.open && Input.mouse.pressed) Shop.handleClick(Input.mouse.x, Input.mouse.y);
    } else if (mode === 'dm') {
      Match.update(dt);
    }

    // phím G — lụm súng đang nằm gần người (CẢ wave lẫn DM)
    if ((mode === 'wave' || mode === 'dm') && Input.wasPressed('pickup') && p.hp > 0 && !p.deadTimer) Pickups.tryPickup(p);

    // Escape → pause
    if (Input.wasPressed('pause')) {
      paused = true;
      Menu.show('pause');
    }

    // phím T — đường ngắm
    if (Input.wasPressed('guide')) {
      Config.AIM_GUIDE = !Config.AIM_GUIDE;
      showToast(Config.AIM_GUIDE ? '📍 BẬT đường ngắm' : 'Đã ẩn đường ngắm');
    }
    // phím M — tiếng
    if (Input.wasPressed('mute')) {
      AudioFX.toggleMute();
      showToast(AudioFX.muted ? '🔇 Đã tắt tiếng' : '🔊 Đã bật tiếng');
    }

    // rơi khỏi map (wave) → hồi sinh trừ máu; (dm) → tự hồi sinh hệ thống match
    if (p.y > Level.pxH + 150 && p.hp > 0) {
      if (mode === 'wave') {
        p.takeDamage(15, p.x);
        p.x = Level.spawn.x; p.y = Level.spawn.y;
        p.vx = 0; p.vy = 0;
        showToast('Rơi khỏi tàu! -15 máu');
      }
    }

    Camera.follow(p, viewW, viewH, Level, dt);
    Level.camX = Camera.x; Level.camY = Camera.y;

    if (toastTimer > 0) toastTimer -= rawDt;

    // hiện lỗi (nếu vòng lặp bắt được bug) — game vẫn chạy
    if (GameLoop.error && !errShown) {
      errShown = true;
      showToast('🐞 Lỗi: ' + GameLoop.error.message + ' (xem console F12)');
    }
  }

  /* ============ RENDER ============ */
  function render() {
    Level.drawBackground(ctx, viewW, viewH, time);

    ctx.save();
    Camera.apply(ctx);

    Level.draw(ctx, Camera.x, Camera.y, viewW, viewH, time);
    Trees.draw(ctx); // cây map rừng — vẽ sau nền, trước người (đi trước cây là được)
    if (window.Props) Props.draw(ctx); // 🛢️ thùng nổ / thùng gỗ / ống ga

    if (mode !== 'menu' && Player.obj) {
      const p = Player.obj;
      const pAlive = p.hp > 0;

      Monsters.draw(ctx, time);
      Bots.draw(ctx);
      Pickups.draw(ctx); // súng rải + túi máu (cả wave lẫn DM)

      if (pAlive) {
        drawStickman(ctx, {
          cx: p.x + p.w / 2, feetY: p.y + p.h, h: p.h,
          facing: p.facing, runPhase: p.runPhase,
          moving: Math.abs(p.vx) > 15, onGround: p.onGround, crouch: p.crouch,
          prone: p.prone,                                   // tư thế NẰM (giữ C)
          visor: true,                                      // kính ngắm ngầu hơn
          glow: window.Gear && Gear.active(),               // hào quang khi mang trang bị
          color: p.hurtFlash > 0.25 ? '#ff8080' : p.color,
          hat: p.hat, aimAngle: p.aimAngle,
          gun: Weapons.list[p.wi], gunKick: p.gunKick,
        });
        drawAimGuide();
        drawMuzzleFlash();
      }
      Bullets.draw(ctx);
      Particles.draw(ctx);
    } else {
      Particles.draw(ctx);
    }

    ctx.restore();

    if (mode !== 'menu') {
      drawHud();
      // thanh hàng súng DOM — ẩn khi ở menu, hiện khi vào game
      const bar = document.getElementById('wbar');
      bar.style.display = mode !== 'menu' ? 'flex' : 'none';
      if (mode === 'wave' && Shop.open) Shop.updateAndDraw(ctx, Input.mouse);
      if (Player.obj && Player.obj.hp > 0) drawCrosshair();
      drawVignette();
      drawFog(); // 🎲 sương mù che ngoài tầm nhìn (vẽ cuối để phủ lên hết)
      updateWeaponBar();
    }
  }

  /* viền đỏ khi bị đánh / máu thấp */
  function drawVignette() {
    const p = Player.obj;
    if (!p) return;
    const hurt = Math.min(0.55, p.hurtFlash);
    const lowHp = p.hp > 0 && p.hp < 30 ? 0.22 + 0.1 * Math.sin(time * 6) : 0;
    const a = Math.max(hurt, lowHp);
    if (a <= 0.01) return;
    const g = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.35, viewW / 2, viewH / 2, viewH * 0.75);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(255,0,30,${a.toFixed(2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  /* 🎲 event SƯƠNG MÙ: phủ lớp sương mờ ngoài tầm nhìn 300px quanh người chơi */
  function drawFog() {
    if (!(mode === 'wave' && Wave.state === 'active' && Wave.event && Wave.event.id === 'fog')) return;
    const p = Player.obj;
    if (!p) return;
    const cx = p.x + p.w / 2 - Camera.x, cy = p.y + p.h / 2 - Camera.y;
    const g = ctx.createRadialGradient(cx, cy, Config.EVENT.FOG_RANGE * 0.55, cx, cy, Config.EVENT.FOG_RANGE * 1.25);
    g.addColorStop(0, 'rgba(190,205,220,0)');
    g.addColorStop(1, 'rgba(190,205,220,0.88)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function drawAimGuide() {
    if (!Config.AIM_GUIDE) return;
    const p = Player.obj;
    const w = Weapons.list[p.wi];
    const m = Player.muzzlePos(p, w);
    const end = Bullets.previewEnd(m.x, m.y, p.aimAngle, w, p.team);

    ctx.save();
    ctx.strokeStyle = 'rgba(160,240,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(160,240,255,0.4)';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMuzzleFlash() {
    const p = Player.obj;
    if (p.muzzleTimer <= 0) return;
    const w = Weapons.list[p.wi];
    const s = w.flash || 1;
    const m = p.muzzle;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(p.aimAngle);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16 * s);
    g.addColorStop(0, 'rgba(255,255,230,0.95)');
    g.addColorStop(0.4, 'rgba(255,200,80,0.75)');
    g.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,180,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2 * s, 0);
    ctx.lineTo(16 * s + Math.random() * 7, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawCrosshair() {
    const m = Input.mouse;
    const w = Weapons.list[Player.obj.wi];
    const gap = 7 + w.spread * 260 + Player.obj.gunKick * 14;
    const len = 7;
    ctx.strokeStyle = 'rgba(120,240,220,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(m.x - gap - len, m.y); ctx.lineTo(m.x - gap, m.y);
    ctx.moveTo(m.x + gap, m.y); ctx.lineTo(m.x + gap + len, m.y);
    ctx.moveTo(m.x, m.y - gap - len); ctx.lineTo(m.x, m.y - gap);
    ctx.moveTo(m.x, m.y + gap); ctx.lineTo(m.x, m.y + gap + len);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,240,220,0.9)';
    ctx.beginPath(); ctx.arc(m.x, m.y, 1.4, 0, Math.PI * 2); ctx.fill();

    if (Player.obj.reloading > 0) {
      const wc = Weapons.list[Player.obj.wi];
      const q = 1 - Player.obj.reloading / wc.reload;
      ctx.strokeStyle = 'rgba(250,204,21,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, gap + 12, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2);
      ctx.stroke();
    }
  }

  /* ============ HUD ============ */
  function drawHud() {
    const p = Player.obj;
    ctx.textBaseline = 'top';

    /* máu + tiền (trái dưới) */
    const hw = 190;
    ctx.fillStyle = 'rgba(6,10,20,0.7)';
    ctx.fillRect(16, viewH - 74, hw + 16, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(24, viewH - 68, hw, 12);
    const hpPct = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#facc15' : '#f43f5e';
    ctx.fillRect(24, viewH - 68, hw * hpPct, 12);
    ctx.font = '700 12px Consolas, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, 28, viewH - 66);

    if (mode === 'wave') {
      ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#ffe066';
      ctx.fillText('💰 ' + p.money, 16, viewH - 104);

      // trạng thái wave (giữa trên)
      ctx.textAlign = 'center';
      ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
      let waveText = '', sub = '';
      if (Wave.state === 'countdown') { waveText = 'WAVE 1 SẮP ĐẾN...'; sub = Math.ceil(Wave.timer) + 's'; }
      else if (Wave.state === 'active') {
        const left = Monsters.list.filter((m) => !m.dead).length + Wave.queue.length;
        waveText = 'WAVE ' + Wave.num; sub = 'Còn ' + left + ' quái';
      } else if (Wave.state === 'intermission') {
        waveText = 'WAVE ' + Wave.num + ' HOÀN THÀNH!';
        sub = 'Nghỉ ' + Math.ceil(Wave.timer) + 's — bấm B mua đồ';
      }
      ctx.fillStyle = 'rgba(230,240,255,0.95)';
      ctx.fillText(waveText, viewW / 2, 14);
      ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(160,200,240,0.8)';
      ctx.fillText(sub + '   ·   Điểm: ' + Wave.score, viewW / 2, 42);

      /* ── bảng chọn 1/3 modifier cho trận NÀY — hiện trong lúc chọn lá xong (countdown)
       *    hoặc giữa 2 wave (intermission). Đặt GIỮA MÀN HÌNH (góp ý người chơi:
       *    đừng đè lên chữ WAVE + điểm ở góc trên) ── */
      if ((Wave.state === 'intermission' || Wave.state === 'countdown') && Wave.offers) {
        const midY = viewH / 2;
        ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#7df3ff';
        ctx.fillText('⚡ WAVE KẾ TIẾP — CHỌN 1 TRONG 3 (phím 1 / 2 / 3)', viewW / 2, midY - 84);

        const cw = 300, ch = 62, gap = 16;
        const total = Wave.offers.length * cw + (Wave.offers.length - 1) * gap;
        ctx.textAlign = 'left'; // chữ TRONG thẻ căn trái — căn giữa sẽ chĩa ra ngoài khung
        Wave.offers.forEach((o, i) => {
          const x = (viewW - total) / 2 + i * (cw + gap);
          const y = midY - 58;
          const hov = Input.mouse.x >= x && Input.mouse.x <= x + cw && Input.mouse.y >= y && Input.mouse.y <= y + ch;
          ctx.fillStyle = hov ? 'rgba(34,211,238,0.18)' : 'rgba(12,20,34,0.85)';
          ctx.fillRect(x, y, cw, ch);
          ctx.strokeStyle = hov ? '#22d3ee' : 'rgba(34,211,238,0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cw, ch);
          // ô phím
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(x + 10, y + 10, 22, 22);
          ctx.font = '700 15px Consolas, monospace';
          ctx.fillStyle = '#06222e';
          ctx.fillText(String(i + 1), x + 15, y + 14);
          // tên + mô tả
          ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
          ctx.fillStyle = '#ffe066';
          ctx.fillText(o.name, x + 42, y + 11);
          ctx.font = '400 12px "Segoe UI", system-ui, sans-serif';
          ctx.fillStyle = 'rgba(200,220,245,0.85)';
          ctx.fillText(o.desc, x + 42, y + 34);
        });
        if (Wave.timer <= 6) {
          ctx.textAlign = 'center';
          ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255,180,120,0.85)';
          ctx.fillText('Tự chọn ngẫu nhiên sau ' + Math.max(0, Math.ceil(Wave.timer - 2)) + 's', viewW / 2, midY + 16);
        }
      }

      ctx.textAlign = 'left';
    } else if (mode === 'dm') {
      // tỷ số 2 đội (giữa trên)
      ctx.textAlign = 'center';
      ctx.font = '700 26px Consolas, monospace';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(String(Match.scoreA), viewW / 2 - 60, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('—', viewW / 2, 12);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(String(Match.scoreB), viewW / 2 + 60, 12);
      ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(160,180,220,0.7)';
      ctx.fillText('ĐỘI BẠN (' + Config.DM.WIN_KILLS + ' kill thắng) — ĐỘI ĐỊCH', viewW / 2, 44);
      ctx.textAlign = 'left';

      if (p.deadTimer > 0) {
        ctx.textAlign = 'center';
        ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,90,90,0.95)';
        ctx.fillText('BẠN ĐÃ GỤC — hồi sinh sau ' + Math.ceil(p.deadTimer) + 's', viewW / 2, viewH / 2 - 40);
        ctx.textAlign = 'left';
      }
    }

    // hướng dẫn
    ctx.font = '400 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(180,195,225,0.6)';
    // gợi ý phím ĐỘNG theo bind hiện tại (đổi phím ở menu → chữ tự đổi theo)
    const K = (a) => Input.boundKey(a);
    const hint = K('pause') + ' pause · ' + K('guide') + ' đường ngắm · ' + K('prone') + ' nằm · ' + K('pickup') + ' lụm súng'
      + (mode === 'dm' ? '' : ' · ' + K('buy') + ' cửa hàng') + ' · ' + K('mute') + ' tắt tiếng';
    ctx.fillText(hint, 20, viewH - 96);

    if (toastTimer > 0) {
      ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,180,120,${Math.min(1, toastTimer).toFixed(2)})`;
      ctx.fillText(toastText, viewW / 2, 84);
      ctx.textAlign = 'left';
    }
  }

  /* ============ HÀNG SÚNG — thanh DOM NGỎI DƯỚI CANVAS ============
   * Không vẽ đè lên map nữa. Ô khóa hiện giá (wave — mua ở cửa hàng)
   * hoặc "tìm trên map" (deathmatch — lụm bằng G). Bấm chuột vào ô để đổi súng. */
  let wbarSlots = null, wbarInfo = null, wbarSig = '';

  function updateWeaponBar() {
    const p = Player.obj;
    if (!p) return;
    if (!wbarSlots) buildWeaponBar();

    // chỉ đụng DOM khi có gì đó thay đổi (đỡ reflow mỗi frame)
    let sig = p.wi + '|' + Math.ceil(p.reloading) + '|' + Math.ceil((p.grenCd || 0) * 10) + '|';
    Weapons.list.forEach((w, i) => {
      const sp = p.spare ? p.spare[i] : Infinity;
      sig += (p.owned.has(w.id) ? 1 : 0) + ',' + p.mags[i] + ',' + (sp === Infinity ? '∞' : sp) + ';';
    });
    if (sig === wbarSig) return;
    wbarSig = sig;

    Weapons.list.forEach((w, i) => {
      const d = wbarSlots[i];
      const owned = p.owned.has(w.id);
      const active = i === p.wi;
      d.className = 'wslot' + (active ? ' active' : '') + (owned ? '' : ' locked');
      if (owned) {
        const sp = p.spare ? p.spare[i] : Infinity;
        const ammoText = p.mags[i] + (sp === Infinity ? '/∞' : '+' + sp);
        d.innerHTML = '<span class="num">' + ((i + 1) % 10) + '</span>' +
          '<span class="nm">' + w.short + '</span>' +
          '<span class="ammo">' + ammoText + '</span>';
      } else if (mode === 'wave') {
        d.innerHTML = '<span class="num">' + ((i + 1) % 10) + '</span>' +
          '<span class="nm">🔒</span><span class="ammo">' + w.price + '💰</span>';
      } else {
        d.innerHTML = '<span class="num">' + ((i + 1) % 10) + '</span>' +
          '<span class="nm">🔒</span><span class="ammo">lụm trên map</span>';
      }
    });

    const cur = Weapons.list[p.wi];
    const curSp = p.spare ? p.spare[p.wi] : Infinity;
    wbarInfo.querySelector('.wname').textContent = cur.name;
    wbarInfo.querySelector('.wammo').textContent =
      p.reloading > 0 ? '⟳ NẠP...' :
      p.mags[p.wi] + ' / ' + (curSp === Infinity ? '∞' : curSp + ' dự trữ');
    // dòng BẮN PHỤ (alt-fire) — hiện khi đã mở ở nâng cấp cấp 3
    const altEl = wbarInfo.querySelector('.walt');
    if (window.GunUp && GunUp.altOpen(cur) && cur.alt) {
      const key = (window.Input && Input.boundKey) ? Input.boundKey('altfire') : 'E';
      altEl.textContent = '⓶ ALT [' + key + ']: ' + cur.alt.name;
      altEl.style.display = '';
    } else {
      altEl.textContent = '';
      altEl.style.display = 'none';
    }
    // dòng 💣 LỰU ĐẠN (Q) — hiện hồi chiêu, sẵn sàng thì sáng
    const grenEl = wbarInfo.querySelector('.wgren');
    const gkey = (window.Input && Input.boundKey) ? Input.boundKey('grenade') : 'Q';
    if (p.grenCd > 0) {
      grenEl.textContent = '💣 ' + p.grenCd.toFixed(1) + 's';
      grenEl.className = 'wgren wait';
    } else {
      grenEl.textContent = '💣 [' + gkey + '] SẴN SÀNG';
      grenEl.className = 'wgren ready';
    }
  }

  function buildWeaponBar() {
    const bar = document.getElementById('wbar');
    bar.innerHTML = '';
    wbarSlots = [];
    Weapons.list.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'wslot';
      d.onclick = () => {
        const pl = Player.obj;
        if (pl && pl.hp > 0) Player.selectWeapon(pl, i);
      };
      bar.appendChild(d);
      wbarSlots.push(d);
    });
    const info = document.createElement('div');
    info.className = 'winfo';
    info.innerHTML = '<div class="wname"></div><div class="wammo"></div><div class="walt"></div><div class="wgren"></div>';
    bar.appendChild(info);
    wbarInfo = info;
  }

  function showToast(text) {
    toastText = text;
    toastTimer = 2.2;
  }
  window.showToast = showToast; // shop.js dùng chung

  /* ── Khởi động ── */
  Market.init();              // nạp ví vàng + trang bị đã lưu (🏪 Market)
  KeySettings.init();         // nạp phím đã đổi (⌨️ PHÍM CHỨC NĂNG)
  Nodes.init();               // 🗺️ bảng chọn đường roguelite (ẩn mặc định)
  Level.load(Maps.deck);      // map nền cho menu
  Menu.init(window.Game);
  Menu.show('menu');
  GameLoop.start(update, render);
})();
