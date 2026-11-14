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
      // 🌐 co-op LAN: máy host TẠO THÊM người 2 (máy guest gửi phím sang, host mô phỏng hộ)
      if (window.Net && Net.mode === 'host' && Net.peer) {
        Net.initRemoteInp();  // input ẢNH của bạn 2 bắt đầu từ số 0
        Net._monMap = {};     // dựng lại bảng ghép quái theo id
        Player.create({ x: Level.spawn.x + 46, y: Level.spawn.y }, 'P', false, 1);
        Player.list[1].color = '#ffb347'; // người 2 màu CAM để phân biệt
        // 🔧 Player.create gán Player.obj = người MỚI NHẤT — phải trả về NGƯỜI 1
        // (không thì host update nhầm người 2, người 1 đóng băng, input đè nhau!)
        Player.obj = Player.list[0];
        Net.send({ t: 'start', mapId: 'deck' });
      }
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
      this._netDMMap = null; // chơi đơn — ĐẤU LẠI sẽ về DM thường
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
    /* ⚔️ ĐỐI ĐẦU 1v1 QUA MẠNG (máy host bấm): BẠN vs BẠN 2, mỗi đội có bot như chơi đơn */
    startNetDM(mapId) {
      if (!(window.Net && Net.mode === 'host' && Net.peer)) {
        showToast('❌ Cần 2 người trong phòng mới đối đầu qua mạng được!');
        return;
      }
      AudioFX.ensure();
      mode = 'dm'; paused = false;
      this._netDMMap = mapId; // nhớ map trận MẠNG — ĐẤU LẠI dựng lại đúng map này
      mapDef = Maps[mapId];
      _setupLevel(mapDef);
      // MÁY HOST = ĐỘI A (xanh lá) · MÁY GUEST = ĐỘI B (đỏ) — mỗi đội 1 người thật
      const spA = mapDef.spawns.A[0], spB = mapDef.spawns.B[0];
      Player.create({ x: spA[0], y: spA[1] - 52 }, 'A', ['pistol']);
      Player.create({ x: spB[0], y: spB[1] - 52 }, 'B', ['pistol'], 1);
      Player.list[1].color = '#f43f5e'; // bạn 2 = ĐỘI B → áo ĐỎ (dù host chọn màu gì)
      Player.obj = Player.list[0]; // 🔧 host = ĐỘI A (người 1) — create gán obj = người mới nhất
      Net.initRemoteInp();            // input ẢNH của bạn 2 bắt đầu từ số 0
      Net._monMap = {}; Net._botMap = {}; // dựng lại bảng ghép quái + bot theo id
      Pickups.spawnForMap(mapDef);    // súng + túi máu rải cả map (guest nhận qua snapshot)
      Trees.spawnForMap(mapDef);      // cây dựng từ mapDef — 2 máy tự dựng GIỐNG nhau
      Match.start(mapDef, Config.DM.TEAM_SIZE - 1); // mỗi đội bớt 1 bot (slot đó là NGƯỜI THẬT)
      Net.send({ t: 'start-dm', mapId, teamSize: Config.DM.TEAM_SIZE, winKills: Config.DM.WIN_KILLS });
      Menu.hideAll();
      AudioFX.startMusic();
      showToast('⚔️ BẠN (ĐỘI A xanh) vs BẠN 2 (ĐỘI B đỏ) — ' + Config.DM.WIN_KILLS + ' kill thắng!');
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
      Player.obj = null; Player.list = [];
      Level.splatterClear && Level.splatterClear();
      if (window.Net && Net.mode !== 'off') Net.off(); // rời trận → đứt kết nối (máy kia nhận 'bye' → về menu)
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

  /* ═════════ 🌐 MẠNG LAN — luồng tin nhắn giữa 2 máy ═════════ */

  /* MÁY GUEST nhận "bắt đầu trận" → dựng map + 2 người que (chỉ để VẼ — mô phỏng do host lo) */
  function _guestStart(m) {
    AudioFX.ensure();
    mode = 'wave'; paused = false;
    mapDef = Maps[m.mapId] || Maps.deck;
    _setupLevel(mapDef);
    // 2 entity người que ĐỂ VẼ: số 1 là đồng đội, số 2 là MÌNH (snapshot host sẽ ghi đè dữ liệu)
    Player.create(Level.spawn, 'P', false);
    Player.create({ x: Level.spawn.x + 46, y: Level.spawn.y }, 'P', false, 1);
    Player.list[1].color = '#ffb347'; // người 2 màu CAM
    Player.obj = Player.list[1]; // 🔧 máy guest = NGƯỜI 2 (chắc chắn đúng, không phụ thuộc create)
    Wave.start();            // trạng thái ban đầu (snapshot máy host sẽ đè lên ngay)
    Net._monMap = {};        // dựng lại bảng ghép quái
    _gNodeOpen = false; _gOverShown = false;
    // gửi BỘ TRANG BỊ MARKET của mình sang host (host mô phỏng damage GIỮ HỘ)
    const g = (window.Gear && Gear.state) ? Gear.state : {};
    Net.send({ t: 'gear', g: { helmet: !!g.helmet, armor: !!g.armor, shield: g.shield || 0 } });
    Menu.hideAll();
    AudioFX.startMusic();
    showToast('🤝 Đã vào trận! Bạn là NGƯỜI 2 (màu cam) — giữ gần đồng đội để cứu nhau.');
  }

  /* ⚔️ MÁY GUEST nhận "bắt đầu ĐỐI ĐẦU" → dựng map + 2 người que đội A/B (chỉ để VẼ) */
  function _guestStartDM(m) {
    AudioFX.ensure();
    mode = 'dm'; paused = false;
    mapDef = Maps[m.mapId] || Maps.deck;
    _setupLevel(mapDef);
    if (m.teamSize) Config.DM.TEAM_SIZE = m.teamSize;   // nhận cấu hình từ máy host
    if (m.winKills) Config.DM.WIN_KILLS = m.winKills;
    // 2 entity người que ĐỂ VẼ — THỨ TỰ PHẢI KHỚP host: số 1 đội A (địch), số 2 = MÌNH đội B
    const spA = mapDef.spawns.A[0], spB = mapDef.spawns.B[0];
    Player.create({ x: spA[0], y: spA[1] - 52 }, 'A', ['pistol']);
    Player.create({ x: spB[0], y: spB[1] - 52 }, 'B', ['pistol'], 1);
    Player.obj = Player.list[1]; // 🔧 máy guest = ĐỘI B (người 2 — chỉ để vẽ + đọc snapshot)
    Net._guestColor = Player.obj.color; // giữ MÀU ÁO mình chọn (snapshot host sẽ đè, khôi phục sau)
    Trees.spawnForMap(mapDef);          // cây dựng từ mapDef — giống hệt máy host
    // gửi BỘ TRANG BỊ MARKET của mình sang host (host mô phỏng damage GIỮ HỘ)
    const g = (window.Gear && Gear.state) ? Gear.state : {};
    Net.send({ t: 'gear', g: { helmet: !!g.helmet, armor: !!g.armor, shield: g.shield || 0 } });
    Match.start(mapDef, 0);  // KHÔNG tạo bot — bot thật do host mô phỏng, snapshot dựng lại
    Net._monMap = {}; Net._botMap = {};
    _gNodeOpen = false; _gOverShown = false; _gEndShown = false;
    Menu.hideAll();
    AudioFX.startMusic();
    showToast('⚔️ ĐỐI ĐẦU! Bạn là ĐỘI B (đỏ) — hạ ' + Config.DM.WIN_KILLS + ' kill để thắng!');
  }

  /* MÁY GUEST mỗi frame: bấm chọn lá/modifier/tiệm/lụm → GỬI YÊU CẦU (không tự quyết) */
  function _guestUi() {
    const inp = Input;
    // 🗺️ bảng chọn đường: host đóng/mở → mình mở/đóng panel theo snapshot
    if (Wave.nodeOpen !== _gNodeOpen) {
      _gNodeOpen = Wave.nodeOpen;
      if (_gNodeOpen) Nodes.show(); else Nodes.hide();
    }
    if (Wave.nodeOpen) { // phím 1/2/3 chọn lá
      if (inp.wasPressed('slot0')) Net.send({ t: 'node', i: 0 });
      else if (inp.wasPressed('slot1')) Net.send({ t: 'node', i: 1 });
      else if (inp.wasPressed('slot2')) Net.send({ t: 'node', i: 2 });
    }
    // ⚡ modifier 1/2/3 (lựa chọn CHUNG cả 2 người)
    if (Wave.offers && (Wave.state === 'countdown' || Wave.state === 'intermission')) {
      if (inp.wasPressed('slot0')) Net.send({ t: 'offer', i: 0 });
      else if (inp.wasPressed('slot1')) Net.send({ t: 'offer', i: 1 });
      else if (inp.wasPressed('slot2')) Net.send({ t: 'offer', i: 2 });
    }
    // 🏪 tiệm: phím B + CLICK món hàng (nuốt click → gửi yêu cầu MUA sang host)
    if (Wave.state === 'intermission') {
      if (inp.wasPressed('buy')) Net.send({ t: 'shop' });
      if (Shop.open && inp.mouse.pressed) {
        const hit = Shop.rows.find((r) =>
          inp.mouse.x >= r.x && inp.mouse.x <= r.x + r.w && inp.mouse.y >= r.y && inp.mouse.y <= r.y + r.h);
        if (hit) {
          if (hit.action === 'close') Net.send({ t: 'shop' });
          else if (typeof hit.action === 'object') {
            Net.send({ t: 'buy', kind: hit.action.kind, w: hit.action.kind === 'weapon' ? hit.action.w.id : null });
          }
        }
      }
    }
    // phím G lụm súng
    const p = Player.obj;
    if (inp.wasPressed('pickup') && p && p.hp > 0 && !p.dead) Net.send({ t: 'pickup' });
    // T đường ngắm + M tiếng: đồ của MÁY MÌNH — vẫn cho phép
    if (inp.wasPressed('guide')) {
      Config.AIM_GUIDE = !Config.AIM_GUIDE;
      showToast(Config.AIM_GUIDE ? '📍 BẬT đường ngắm' : 'Đã ẩn đường ngắm');
    }
    if (inp.wasPressed('mute')) {
      AudioFX.toggleMute();
      showToast(AudioFX.muted ? '🔇 Đã tắt tiếng' : '🔊 Đã bật tiếng');
    }
    // Escape KHÔNG pause được — máy host điều phối
    if (inp.wasPressed('pause')) showToast('🔒 Chế độ mạng: máy CHỦ điều phối — không pause được');
  }

  /* BỘ PHÂN TIN NHẮN — host nhận input/yêu cầu của guest, guest nhận snapshot/lệnh */
  function _netMsg(m) {
    if (Net.mode === 'host') {
      switch (m.t) {
        case 'in': Net.applyRemoteInput(m); break;   // phím + chuột của bạn 2
        case 'node': Wave.chooseNode(m.i); break;    // bạn 2 chọn lá 🗺️
        case 'offer': Wave.chooseOffer(m.i); break;  // bạn 2 chọn modifier ⚡
        case 'shop': // bạn 2 bấm B / nút đóng tiệm
          if (Wave.state === 'intermission') {
            if (Wave.resting) Shop.setOpen(false);
            else if (!Wave.nodeOpen) Shop.setOpen(!Shop.open);
          }
          break;
        case 'buy': { // bạn 2 mua hàng — host MUA HỘ vào túi người 2
          const p2 = Player.list[1];
          if (!p2 || !Shop.open) break;
          const item = Shop.items(p2).find((it) => it.kind === m.kind
            && (it.kind !== 'weapon' || (it.w && it.w.id === m.w)));
          if (item) Shop.buy(item, p2);
          break;
        }
        case 'pickup': { // bạn 2 bấm G lụm súng
          const p2 = Player.list[1];
          if (p2 && p2.hp > 0 && !p2.dead) Pickups.tryPickup(p2);
          break;
        }
        case 'gear': // bộ trang bị Market của bạn 2 (host mô phỏng GIỮ HỘ)
          if (Player.list[1]) {
            Player.list[1].gear = { helmet: !!m.g.helmet, armor: !!m.g.armor, shield: m.g.shield || 0 };
          }
          break;
        case 'wi': { // 🔫 bạn 2 đổi súng (số 1-0 / bấm thanh súng ở máy nó)
          const p2 = Player.list[1];
          if (p2 && p2.hp > 0) Player.selectWeapon(p2, m.i);
          break;
        }
        case 'wiw': { // 🔫 bạn 2 lăn chuột đổi súng
          const p2 = Player.list[1];
          if (p2 && p2.hp > 0) Player.selectWeapon(p2, Player.nextOwned(p2, m.d));
          break;
        }
      }
    } else if (Net.mode === 'guest') {
      switch (m.t) {
        case 'start': _guestStart(m); break; // host bắt đầu trận co-op
        case 'start-dm': _guestStartDM(m); break; // ⚔️ host bắt đầu trận ĐỐI ĐẦU
        case 'snap': Net.snap = m; break;    // "ảnh chụp" thế giới — tickGuest sẽ áp
      }
    }
  }

  /* ============ UPDATE ============ */
  let _gNodeOpen = false, _gOverShown = false, _gEndShown = false; // (guest) trạng thái UI đang hiển thị

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

    /* ── 🌐 MÁY GUEST: KHÔNG mô phỏng gì cả — chỉ gửi phím + áp "ảnh chụp" máy host ── */
    if (window.Net && Net.mode === 'guest') {
      // ⚔️ ĐỐI ĐẦU: camera tự bám NGƯỜI MÌNH (không dùng camera co-op từ snapshot —
      // mỗi máy nhìn từ phía đội mình). tickGuest gửi chuột theo toạ độ thế giới
      // nên camera phải đúng TRƯỚC khi gửi input.
      if (mode === 'dm' && Player.obj) {
        Camera.follow(Player.obj, viewW, viewH, Level, dt);
        Level.camX = Camera.x; Level.camY = Camera.y;
      }
      Net.tickGuest(dt);       // gửi input ~30Hz + áp snapshot mới nhất
      Particles.update(dt);    // hạt hiệu ứng riêng của máy mình
      _guestUi();              // bấm lá/modifier/tiệm → GỬI YÊU CẦU sang host
      // host báo trận kết thúc (snapshot Wave.over) → màn hình kết quả
      if (Wave.over && !_gOverShown) {
        _gOverShown = true;
        Menu.showGameOver(Wave.num, Wave.score, false, false);
      }
      // ⚔️ host báo trận đối đầu kết thúc (snapshot Match.state) → bảng kết quả
      //   mình là ĐỘI B → thắng khi scoreB > scoreA
      if (mode === 'dm' && Match.state === 'ended' && !_gEndShown) {
        _gEndShown = true;
        Menu.showMatchEnd(Match.scoreB > Match.scoreA, Match.scoreA, Match.scoreB);
      }
      if (toastTimer > 0) toastTimer -= rawDt;
      if (GameLoop.error && !errShown) {
        errShown = true;
        showToast('🐞 Lỗi: ' + GameLoop.error.message + ' (xem console F12)');
      }
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

    /* 🤝 CO-OP/⚔️ ĐỐI ĐẦU LAN: host chạy mô phỏng CHO CẢ 2 người — mỗi người 1 bộ input riêng */
    const coop = window.Net && Net.mode === 'host' && Net.peer && Player.list.length > 1;
    if (coop) {
      Player.update(p, Level, dt, mw); // người 1: chuột + phím của máy này
      const r = Net.remoteInp;         // người 2: input ẢNH gửi từ máy guest
      // guest gửi chuột theo TOẠ ĐỘ THẾ GIỚI (tự cộng camera máy nó) → host dùng NGUYÊN
      Player.update(Player.list[1], Level, dt, { x: r.mouse.x, y: r.mouse.y }, r);
      // 🔧 "ăn" xong cạnh phím ẢNH phải XOÁ NGAY trong frame (input guest ~30Hz sẽ đặt lại)
      r.endFrame();
    } else {
      Player.update(p, Level, dt, mw);
    }
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
      // 🌐 host tick: gửi snapshot ~20Hz cho máy guest
      if (coop) Net.tickHost(dt);
    } else if (mode === 'dm') {
      Match.update(dt);
      // 🌐 host tick: gửi snapshot ~20Hz cho máy guest (co-op lẫn đối đầu)
      if (coop) Net.tickHost(dt);
    }

    // phím G — lụm súng đang nằm gần người (CẢ wave lẫn DM) · 🌐 chỉ NGƯỜI MÌNH
    // bấm mới lụm — bạn 2 bấm G ở máy nó → gửi tin nhắn 'pickup' riêng sang đây
    if (Input.wasPressed('pickup') && p.hp > 0 && !p.deadTimer) Pickups.tryPickup(p);

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
    for (const pl of (coop ? Player.list : [p])) {
      if (pl.y > Level.pxH + 150 && pl.hp > 0) {
        if (mode === 'wave') {
          pl.takeDamage(15, pl.x);
          pl.x = Level.spawn.x; pl.y = Level.spawn.y;
          pl.vx = 0; pl.vy = 0;
          if (pl === p) showToast('Rơi khỏi tàu! -15 máu');
        }
      }
    }

    // camera bám: co-op SINH TỐN → ĐIỂM GIỮA 2 người (cả 2 cùng 1 khung hình);
    // ⚔️ ĐỐI ĐẦU → bám NGƯỜI MÌNH (2 máy 2 phía map, guest cũng tự bám người nó)
    let camTarget = p;
    if (coop && mode === 'wave') {
      const a = Player.list[0], b = Player.list[1];
      camTarget = {
        x: (a.x + a.w / 2 + b.x + b.w / 2) / 2,
        y: (a.y + a.h / 2 + b.y + b.h / 2) / 2,
        w: 0, h: 0, // "điểm" chứ không phải entity — follow chỉ cần toạ độ tâm
      };
    }
    Camera.follow(camTarget, viewW, viewH, Level, dt);
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
      Monsters.draw(ctx, time);
      Bots.draw(ctx);
      Pickups.draw(ctx); // súng rải + túi máu (cả wave lẫn DM)

      // 🤝 co-op: vẽ CẢ 2 người — người gục nằm SƠN SẶT để đồng đội biết đường mà chạy tới cứu
      for (const pl of Player.list) {
        const isLocal = pl === Player.obj || (window.Net && pl.idx === Net.localIdx);
        drawStickman(ctx, {
          cx: pl.x + pl.w / 2, feetY: pl.y + pl.h, h: pl.h,
          facing: pl.facing, runPhase: pl.runPhase,
          moving: Math.abs(pl.vx) > 15, onGround: pl.onGround, crouch: pl.crouch,
          prone: pl.prone || (pl.dead || pl.hp <= 0),         // gục → vẽ NẰM SƠN SẶT
          visor: true,
          glow: !!(window.Gear && pl.idx === 0 && Gear.active()),
          color: (pl.dead || pl.hp <= 0) ? 'rgba(110,120,135,0.75)'
            : (pl.hurtFlash > 0.25 ? '#ff8080' : pl.color),
          hat: pl.hat, aimAngle: pl.aimAngle,
          gun: Weapons.list[pl.wi], gunKick: pl.gunKick,
        });
        if (isLocal && pl.hp > 0) { // đường ngắm + chớp nòng CHỈ của máy MÌNH
          drawAimGuide(pl);
          drawMuzzleFlash(pl);
        }
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
      if (Shop.open) Shop.updateAndDraw(ctx, Input.mouse);
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

  function drawAimGuide(p) {
    if (!Config.AIM_GUIDE) return;
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

  function drawMuzzleFlash(p) {
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

      // 🤝 co-op: thanh máu ĐỒNG ĐỘI + tiến độ đang CỨU (gục = chạy tới cứu!)
      if (Player.list.length > 1) {
        const mate = Player.list[0] === p ? Player.list[1] : Player.list[0];
        if (mate) {
          const bx = 16, by = viewH - 132, bw = 190;
          ctx.fillStyle = 'rgba(6,10,20,0.7)';
          ctx.fillRect(bx, by, bw + 16, 24);
          const mp = mate.dead || mate.hp <= 0 ? 0 : Math.max(0, mate.hp / mate.maxHp);
          ctx.fillStyle = mp > 0.5 ? '#4ade80' : mp > 0.25 ? '#facc15' : '#f43f5e';
          ctx.fillRect(bx + 8, by + 12, bw * mp, 8);
          ctx.fillStyle = mate.dead || mate.hp <= 0 ? '#ff6b6b' : 'rgba(255,255,255,0.85)';
          ctx.font = '700 10px Consolas, monospace';
          ctx.fillText(mate.idx === 0 ? 'ĐỒNG ĐỘI · NGƯỜI 1' : 'ĐỒNG ĐỘI · NGƯỜI 2', bx + 8, by + 1);
          if (mate.dead || mate.hp <= 0) {
            // ⚠️ đồng đội gục: hiện thanh tiến độ CỨU nhấp nháy nhắc chạy tới
            const rp = Math.min(1, (mate.reviveT || 0) / Wave.REVIVE_NEED);
            ctx.fillStyle = 'rgba(20,0,0,0.6)';
            ctx.fillRect(bx + 8, by + 12, bw, 8);
            ctx.fillStyle = '#7ef27a';
            ctx.fillRect(bx + 8, by + 12, bw * rp, 8);
            ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
            ctx.fillStyle = (Math.floor(time * 3) % 2) ? '#ff6b6b' : '#ffe066';
            ctx.fillText('⚠️ ĐỒNG ĐỘI GỤC — ĐỨNG CẠNH ĐỂ CỨU ' + Math.round(rp * 100) + '%', bx, by - 20);
          }
        }
      }

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
      // tỷ số 2 đội (giữa trên) — 🌐 mạng: mỗi máy nhìn từ góc ĐỘI MÌNH
      //   host (đội A): xanh lá trái · guest (đội B): đỏ trái
      const guest = window.Net && Net.mode === 'guest';
      const myScore = guest ? Match.scoreB : Match.scoreA;
      const enScore = guest ? Match.scoreA : Match.scoreB;
      const myCol = guest ? '#f43f5e' : '#4ade80';
      const enCol = guest ? '#4ade80' : '#f43f5e';
      ctx.textAlign = 'center';
      ctx.font = '700 26px Consolas, monospace';
      ctx.fillStyle = myCol;
      ctx.fillText(String(myScore), viewW / 2 - 60, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('—', viewW / 2, 12);
      ctx.fillStyle = enCol;
      ctx.fillText(String(enScore), viewW / 2 + 60, 12);
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
        if (pl && pl.hp > 0) {
          // 🌐 máy guest: bấm thanh súng = GỬI YÊU CẦU (host đổi hộ — view theo snapshot)
          if (window.Net && Net.mode === 'guest') Net.send({ t: 'wi', i });
          else Player.selectWeapon(pl, i);
        }
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
  if (window.Net) Net.onMsg = _netMsg; // 🌐 mạng LAN: bộ phân tin nhắn 2 máy
  Level.load(Maps.deck);      // map nền cho menu
  Menu.init(window.Game);
  Menu.show('menu');
  GameLoop.start(update, render);
})();
