/* =========================================================
 * WAVE — bộ máy chế độ SINH TỔN (ROGUELITE)
 * Đếm ngược → quái trồi lên theo đợt → dọn sạch → 🗺️ CHỌN ĐƯỜNG ĐI
 * (⚔️ thường / 👹 elite / 🏪 tiệm / ❤️ ôasis) → modifier 1/2/3 → lặp lại.
 * 👑 BOSS theo chu kỳ trận ĐÁNH. Chết = game over.
 * ========================================================= */
window.Wave = {
  num: 0, state: 'idle', // idle | countdown | active | intermission
  over: false,           // true = game đã kết thúc (đóng băng mọi thứ, chỉ còn hiệu ứng)
  timer: 0,
  queue: [],           // danh sách quái chờ trồi lên [{type, delay}]
  score: 0, kills: 0,

  /* ── MODIFIER chọn 1/3 giữa wave (kế hoạch chuyên gia) ──
   * Hết 1 wave: hiện 3 lựa chọn random → bấm 1/2/3 (hoặc tự chọn sau 2s).
   * Modifier áp dụng cho WAVE KẾ TIẾP rồi bị xoá khi wave đó dọn sạch.
   * `mag` = ĐỘ MẶN thật của modifier (mods lưu số, không phải cờ on/off):
   *   thường +25% · HIẾM (rare: chỉ boss rơi ra) +50%.
   * `key` = ô trong Wave.mods mà nó áp vào. */
  OFFERS: [
    { id: 'dmg',    key: 'dmg',    mag: 0.25, name: '🔥 HOẢ LỰC +25%',   desc: 'Đạn của bạn mạnh hơn 25% trong wave tới' },
    { id: 'rate',   key: 'rate',   mag: 0.25, name: '⚡ BẮN NHANH +25%', desc: 'Tốc độ bắn nhanh hơn 25% trong wave tới' },
    { id: 'pierce', key: 'pierce', mag: 1,    name: '🎯 ĐẠN XUYÊN +1',   desc: 'Đạn xuyên thêm 1 mục tiêu trong wave tới' },
    { id: 'money',  key: 'money',  mag: 2,    name: '💰 THƯỞNG ×2',      desc: 'Tiền giết quái ×2 trong wave tới' },
    { id: 'heal',   key: 'heal',   mag: 0,    name: '❤️ HỒI ĐẦY MÁU',    desc: 'Hồi đầy máu NGAY LẬP TỨC' },
    { id: 'armor',  key: 'armor',  mag: 0.3,  name: '🛡️ GIÁP NẸP',       desc: 'Sát thương bạn nhận −30% trong wave tới' },
    /* modifier HIẾM — chỉ xuất hiện trong phần thưởng dọn BOSS */
    { id: 'dmg2',    key: 'dmg',    mag: 0.5, rare: true, name: '🌋 HOẢ LỰC +50%',   desc: 'Đạn mạnh hơn 50% (HIẾM — boss rơi ra)' },
    { id: 'rate2',   key: 'rate',   mag: 0.5, rare: true, name: '⚡ BẮN NHANH +50%', desc: 'Nhanh hơn 50% (HIẾM)' },
    { id: 'pierce2', key: 'pierce', mag: 2,   rare: true, name: '🎯 ĐẠN XUYÊN +2',   desc: 'Xuyên thêm 2 mục tiêu (HIẾM)' },
    { id: 'armor2',  key: 'armor',  mag: 0.5, rare: true, name: '🛡️ GIÁP NẸP 50%',   desc: 'Sát thương nhận −50% (HIẾM)' },
    { id: 'money3',  key: 'money',  mag: 3,   rare: true, name: '💎 THƯỞNG ×3',      desc: 'Tiền giết quái ×3 (HIẾM)' },
  ],
  mods: {},    // modifier ĐANG áp dụng (xoá khi wave dọn sạch)
  offers: null, // 3 lựa chọn đang hiện (null = không có gì để chọn)
  bossCleared: false, // vừa dọn xong wave CÓ BOSS → modifier hiếm xuất hiện

  /* ── 🗺️ ROGUELITE MAP/NODE — mỗi wave xong CHỌN ĐƯỜNG ĐI (kiểu Slay the Spire) ──
   * Dọn 1 wave → hiện 2-3 LÁ (node) → bấm 1/2/3 (hoặc click) chọn đường:
   *   ⚔️ battle — trận thường · 👹 elite — quái trâu/nhiều hơn nhưng VÀNG ×1.6
   *   🏪 shop   — vào tiệm KHÔNG đếm ngược · ❤️ reward — hồi 50% máu + 60-120💰 ngay
   * 👑 BOSS đến hạn (mỗi BOSS.EVERY trận ĐÁNH) → lá BOSS xuất hiện bắt buộc.
   * Quy tắc: lá đầu luôn là lá ĐÁNH · không 2 lá NGHỈ liền nhau trên đường đi.
   * Đồng hồ nghỉ ĐÓNG BĂNG khi đang chọn lá / đang ở tiệm — thư giãn mà chọn. */
  nextNodes: null,  // các lá đangOffer trên bản đồ (null = không có gì để chọn)
  nodeOpen: false,  // bảng chọn đường đang mở (đóng băng đồng hồ nghỉ)
  resting: false,   // đang NGHỈ ở tiệm (chờ cửa hàng đóng → chọn lại đường)
  lastRest: false,  // lá vừa chọn có phải lá NGHỈ? → hàng kế không cho nghỉ nữa
  nodeType: null,   // loại của TRẬN ĐANG ĐÁNH: 'battle' | 'elite' | 'boss'
  pendingElite: false, // trận KẾ là elite (đút vào _buildQueue khi dựng hàng đợi)

  /* ── 🎲 EVENT NGẪU NHIÊN — 30% sau khi dọn 1 wave, wave kế dính 1 "biến số" ── */
  EVENTS: [
    { id: 'rain', name: '🌧️ MƯA AXIT', desc: 'Giọt axit rơi từ trời trúng ai đứa dính — nhìn chớp đỏ né!' },
    { id: 'fog',  name: '🌫️ SƯƠNG MÙ', desc: 'Tầm nhìn MỌI bên (kể cả quái) còn ~300px — sníp khó ăn!' },
    { id: 'fast', name: '🏃 QUÁI CUỒNG TỐC', desc: 'Quái wave này nhanh hơn 25% — giữ khoảng cách!' },
    { id: 'rich', name: '💰 MÙA VÀNG', desc: 'Tiền giết quái +50% — săn cho đã!' },
  ],
  event: null,        // event ĐANG chạy trong wave hiện tại
  pendingEvent: null, // event bốc cho wave KẾ TIẾP
  rainT: 0,           // đồng hồ giọt axit rơi

  _rollEvent() {
    if (Math.random() >= Config.EVENT.CHANCE) { this.pendingEvent = null; return; }
    const ev = this.EVENTS[Math.floor(Math.random() * this.EVENTS.length)];
    this.pendingEvent = ev;
    window.showToast && showToast('🎲 EVENT wave tới: ' + ev.name + ' — ' + ev.desc);
  },

  start() {
    this.num = 0; this.score = 0; this.kills = 0;
    this.over = false;
    this.mods = {}; this.offers = null;
    this.event = null; this.pendingEvent = null; this.rainT = 0;
    this.bossCleared = false;
    this.nextNodes = null; this.nodeOpen = false; this.resting = false;
    this.lastRest = false; this.nodeType = null; this.pendingElite = false;
    window.Nodes && Nodes.hide();
    this.state = 'countdown';
    this.timer = Config.WAVE.COUNTDOWN;
  },

  reset() {
    this.state = 'idle'; this.over = false; this.mods = {}; this.offers = null;
    this.event = null; this.pendingEvent = null;
    this.nextNodes = null; this.nodeOpen = false; this.resting = false;
    this.lastRest = false; this.nodeType = null; this.pendingElite = false;
    window.Nodes && Nodes.hide();
    Monsters.clear();
  },

  /* random 3 lựa chọn KHÁC nhau — vừa dọn BOSS thì có 2 HIẾM + 1 thường */
  _buildOffers() {
    const rares = this.OFFERS.filter((o) => o.rare);
    let pool;
    if (this.bossCleared) {
      pool = [];
      // 2 HIẾM random
      const r = [...rares];
      for (let i = 0; i < 2 && r.length; i++) pool.push(r.splice(Math.floor(Math.random() * r.length), 1)[0]);
      // + 1 thường random (khác id với 2 ô hiếm cho đỡ trùng key)
      const normals = this.OFFERS.filter((o) => !o.rare && !pool.some((p) => p.key === o.key));
      if (normals.length) pool.push(normals[Math.floor(Math.random() * normals.length)]);
      window.showToast && showToast('👑 THƯỞNG BOSS: 2 lựa chọn HIẾM xuất hiện!');
    } else {
      pool = [...this.OFFERS.filter((o) => !o.rare)];
    }
    this.offers = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      this.offers.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    if (!this.bossCleared) window.showToast && showToast('⚡ Chọn 1 trong 3 cho wave tới (phím 1/2/3)!');
  },

  chooseOffer(i) {
    if (!this.offers || !this.offers[i]) return false;
    const o = this.offers[i];
    if (o.key === 'heal') {
      const p = Player.obj;
      if (p) p.hp = p.maxHp; // hồi đầy NGAY
    } else {
      this.mods[o.key] = o.mag; // lưu ĐỘ MẶN (dmg 0.25/0.5 · pierce 1/2 · money 2/3...)
    }
    this.offers = null;
    window.showToast && showToast('✅ Đã chọn: ' + o.name);
    return true;
  },

  /* ── 🗺️ dựng các LÁ trên bản đồ cho lần chọn đường kế ──
   * next battle = num + 1 (num CHỈ tăng khi ĐÁNH thật — tiệm/ôasis không đếm,
   * nên chu kỳ BOSS "mỗi 5 trận đánh" vẫn đúng như cũ). */
  _buildNodes() {
    const N = Config.ROGUE.NODES;
    const next = this.num + 1;
    const B = Config.WAVE.BOSS;
    const bossDue = next >= B.FROM && next % B.EVERY === 0;
    const BATTLE = { t: 'battle', icon: '⚔️', name: 'GẶP ĐỘI QUÂN',
      desc: 'Trận đánh thường — an toàn, vàng chuẩn' };
    const ELITE = { t: 'elite', icon: '👹', name: 'ĐỘI ELITE',
      desc: 'Quái TRÂU ×1.35 · nhanh ×1.15 · +40% số lượng — đổi lại VÀNG ×1.6, ĐIỂM ×1.5' };
    const SHOP = { t: 'shop', icon: '🏪', name: 'TIỆM NGHỈ ĐƯỜNG',
      desc: 'Vào cửa hàng KHÔNG đếm ngược — mua đồ thảnh thơi rồi chọn đường tiếp' };
    const REWARD = { t: 'reward', icon: '❤️', name: 'Ổ OÁSIS',
      desc: 'Hồi NGAY 50% máu + vàng 60-120💰 — rồi chọn đường tiếp' };
    // vừa nghỉ xong → hàng này CẤM lá nghỉ (không nghỉ 2 lần liền)
    const restPool = this.lastRest ? [] : [SHOP, REWARD];
    const cards = [];
    if (bossDue) {
      // 👑 BOSS đến hạn: lá đầu BẮT BUỘC là boss — còn lại chỉ lá NGHỈ
      // (không cho chọn trận thường để "lách" mất chu kỳ boss)
      cards.push({ t: 'boss', icon: '👑', name: 'BOSS CỘT MỐC',
        desc: 'Trận BOSS theo chu kỳ — lính ít hơn 40%, chuẩn bị tinh thần!' });
      if (restPool.length) cards.push(restPool[Math.floor(Math.random() * restPool.length)]);
    } else {
      // lá đầu luôn là LÁ ĐÁNH — 30% là elite (nguy hiểm hơn nhưng béo hơn)
      cards.push(Math.random() < 0.3 ? ELITE : BATTLE);
      const fightPool = [BATTLE, ELITE];
      let restLeft = restPool.length ? 1 : 0; // mỗi hàng tối đa 1 lá nghỉ
      while (cards.length < N && (fightPool.length || restLeft)) {
        if (restLeft && Math.random() < 0.35) {
          cards.push(restPool[Math.floor(Math.random() * restPool.length)]);
          restLeft = 0;
        } else {
          cards.push(fightPool[Math.floor(Math.random() * fightPool.length)]);
        }
      }
    }
    this.nextNodes = cards;
    this.nodeOpen = true;
  },

  /* 🗺️ chọn 1 lá trên bản đồ (phím 1/2/3 hoặc click) */
  chooseNode(i) {
    if (!this.nodeOpen || !this.nextNodes || !this.nextNodes[i]) return false;
    const n = this.nextNodes[i];
    this.nodeOpen = false;
    this.nextNodes = null;
    window.Nodes && Nodes.hide();
    if (n.t === 'battle' || n.t === 'elite' || n.t === 'boss') {
      this.nodeType = n.t;
      this.pendingElite = n.t === 'elite';
      this.lastRest = false;
      window.showToast && showToast(n.t === 'elite'
        ? '👹 ELITE! Quái mạnh hơn nhưng vàng ×1.6 — liều ăn nhiều!'
        : (n.t === 'boss' ? '👑 Vào trận BOSS — chuẩn bị súng đạn!' : '⚔️ Trận thường — chuẩn bị!'));
      this.state = 'countdown';
      this.timer = Config.WAVE.COUNTDOWN;
      this._buildOffers(); // chọn modifier 1/2/3 CHO TRẬN NÀY (trong lúc đếm ngược)
    } else if (n.t === 'shop') {
      // 🏪 nghỉ: vào tiệm KHÔNG có đồng hồ — đóng tiệm (B) để chọn lại đường
      this.lastRest = true;
      this.resting = true;
      window.Shop && Shop.setOpen(true);
      window.showToast && showToast('🏪 Nghỉ ở tiệm — mua thoải mái, bấm B đóng tiệm để chọn đường tiếp!');
    } else if (n.t === 'reward') {
      // ❤️ ôasis: hồi 50% máu + 60-120💰 NGAY, xong chọn đường tiếp luôn
      this.lastRest = true;
      const p = Player.obj;
      const heal = Math.round(p.maxHp * Config.ROGUE.REWARD.HEAL);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const RG = Config.ROGUE.REWARD;
      const gold = RG.GOLD_MIN + Math.floor(Math.random() * (RG.GOLD_MAX - RG.GOLD_MIN + 1));
      p.money += gold;
      if (window.Gold) Gold.add(gold);
      Particles.text(p.x + p.w / 2, p.y - 12, '+' + heal + '❤️ +' + gold + '💰', '#7ef27a', 14);
      window.showToast && showToast('❤️ Ổ oasis: +' + heal + ' máu, +' + gold + '💰!');
      this._buildNodes(); // chọn đường tiếp ngay
      window.Nodes && Nodes.show();
    }
    return true;
  },

  /* 🎲 BẬT event đã bốc cho wave này (gọi khi chuyển sang 'active') */
  _activateEvent() {
    this.event = this.pendingEvent || null;
    this.pendingEvent = null;
    this.rainT = 0.4; // giọt đầu rơi nhanh thôi cho có cảm giác ngay
    if (this.event) {
      window.showToast && showToast('🎲 ' + this.event.name + ': ' + this.descOf(this.event));
      AudioFX._tone(300, 150, 0.3, 'square', 0.12);
    }
  },

  descOf(ev) { return ev ? ev.desc : ''; },

  onMonsterKilled(m) {
    const p = Player.obj;
    let gain = Math.round(m.money * (this.mods.money || 1)); // modifier THƯỞNG (×2/×3)
    if (this.event && this.event.id === 'rich') gain = Math.round(gain * Config.EVENT.RICH); // 🎲 MÙA VÀNG +50%
    if (this.nodeType === 'elite') gain = Math.round(gain * Config.ROGUE.ELITE.GOLD); // 👹 ELITE vàng ×1.6
    p.money += gain;
    if (window.Gold) Gold.add(gain); // vàng tích luỹ vĩnh viễn → xài ở 🏪 Market
    this.kills++;
    this.score += Math.round((m.score + this.num)
      * (this.nodeType === 'elite' ? Config.ROGUE.ELITE.SCORE : 1)); // 👹 elite điểm ×1.5
    Particles.text(m.x + m.w / 2, m.y - 6, '+' + gain + '💰', '#ffe066', 13);
  },

  /* dựng danh sách quái cho wave tiếp theo — theo GIAI (kế hoạch chuyên gia):
   * early: swarm crawler · mid: + tank giáp / kamikaze · muộn: + sniper xa
   * 👑 mỗi 5 wave (từ BOSS.FROM): BOSS CỘT MỐC trồi CUỐI CÙNG — lính thường giảm còn 60% */
  _buildQueue() {
    this.num++;
    const W = Config.WAVE;
    const isBossWave = this.num >= W.BOSS.FROM && this.num % W.BOSS.EVERY === 0;
    const bossMul = isBossWave ? 0.6 : 1; // wave boss: ít lính thường hơn để tập trung boss
    const q = [];
    const crawlers = Math.round((W.CRAWLER_BASE + (this.num - 1) * W.CRAWLER_PER_WAVE) * bossMul);
    const spitters = this.num >= W.SPITTER_FROM ? Math.floor((this.num - 1) * 0.8 * bossMul) : 0;
    const brutes = this.num % W.BRUTE_EVERY === 0 ? Math.floor(this.num / W.BRUTE_EVERY * bossMul) : 0;
    const tanks = this.num >= W.TANK_FROM ? Math.floor(((this.num - W.TANK_FROM) / W.TANK_EVERY + 1) * bossMul) : 0;
    const kamikazes = this.num >= W.KAMIKAZE_FROM ? Math.floor(((this.num - W.KAMIKAZE_FROM) / W.KAMIKAZE_EVERY + 1) * bossMul) : 0;
    const snipers = this.num >= W.SNIPER_FROM ? Math.floor(((this.num - W.SNIPER_FROM) / W.SNIPER_EVERY + 1) * bossMul) : 0;
    for (let i = 0; i < crawlers; i++) q.push('crawler');
    for (let i = 0; i < spitters; i++) q.push('spitter');
    for (let i = 0; i < brutes; i++) q.push('brute');
    for (let i = 0; i < tanks; i++) q.push('tank');
    for (let i = 0; i < kamikazes; i++) q.push('kamikaze');
    for (let i = 0; i < snipers; i++) q.push('sniper');
    // 👹 ELITE: thêm +40% lính (làm tròn lên) — đội đông hơn hẳn
    if (this.pendingElite) {
      const extra = Math.ceil(crawlers * Config.ROGUE.ELITE.EXTRA);
      for (let i = 0; i < extra; i++) q.push('crawler');
    }
    // xáo trộn + rải đều thời gian trồi lên
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    const interval = 1.6 - Math.min(0.9, this.num * 0.08);
    this.queue = q.map((type, i) => ({ type, delay: 0.4 + i * interval }));
    // 👑 BOSS trồi SAU CÙNG — dọn lính trước, nghỉ tay chút rồi boss ló mặt
    if (isBossWave) this.queue.push({ type: 'boss', delay: 0.4 + q.length * interval + 1.6 });
    this.spawnT = 0;
  },

  update(dt) {
    const p = Player.obj;
    switch (this.state) {
      case 'countdown':
        this.timer -= dt;
        // modifier 1/2/3 cho trận này (đã chọn lá xong) — tự chọn random nếu lơ là
        if (this.offers) {
          const inp = window.Input;
          if (inp) {
            if (inp.wasPressed('slot0')) this.chooseOffer(0);
            else if (inp.wasPressed('slot1')) this.chooseOffer(1);
            else if (inp.wasPressed('slot2')) this.chooseOffer(2);
          }
          if (this.offers && this.timer <= 2) this.chooseOffer(Math.floor(Math.random() * this.offers.length));
        }
        if (this.timer <= 0) {
          this._buildQueue();
          this.state = 'active';
          this._activateEvent(); // 🎲 event bốc từ lần nghỉ trước (nếu có)
        }
        break;

      case 'active':
        // trồi dần từng con
        this.spawnT -= dt;
        if (this.queue.length > 0 && this.spawnT <= 0) {
          const item = this.queue.shift();
          const spots = Config.WAVE.SPAWNS;
          const sp = spots[Math.floor(Math.random() * spots.length)];
          // 🎲 event QUÁI CUỒNG TỐC: quái wave này nhanh hơn (đút mult vào lúc spawn)
          // 👹 ELITE: nhanh hơn ×1.15 + TRÂU hơn ×1.35 (hpMul)
          let spdMul = (this.event && this.event.id === 'fast') ? (1 + Config.EVENT.FAST) : 1;
          let hpMul = 1;
          if (this.nodeType === 'elite') {
            spdMul *= Config.ROGUE.ELITE.SPEED;
            hpMul = Config.ROGUE.ELITE.HP;
          }
          Monsters.spawn(item.type, sp[0], sp[1], this.num, spdMul, hpMul);
          if (item.type === 'boss') {
            window.showToast && showToast('👑 BOSS XUẤT HIỆN! Bắn vào chấm vàng = ×2 sát thương!');
            AudioFX._tone(90, 60, 0.8, 'sawtooth', 0.18);
          }
          this.spawnT = 0.35;
        }
        // 🎲 event MƯA AXIT: giọt axit rơi ngẫu nhiên quanh người chơi
        if (this.event && this.event.id === 'rain') {
          this.rainT -= dt;
          if (this.rainT <= 0) {
            this.rainT = Config.EVENT.RAIN.EVERY;
            for (let i = 0; i < Config.EVENT.RAIN.DROPS; i++) {
              const rx = p.x + (Math.random() - 0.5) * 2 * (160 + Math.random() * 320); // quanh người ±160-480
              Bullets.fireProjectile(rx, Math.max(60, p.y - 420), Math.PI / 2, {
                id: 'rain-acid', acid: true, kind: 'proj', damage: Config.EVENT.RAIN.DMG,
                explodeRadius: Config.EVENT.RAIN.RADIUS, projSpeed: Config.EVENT.RAIN.SPEED,
                shakeOnBoom: 1.2,
              }, 'M');
            }
          }
        }
        // hết quái + sạch màn → wave hoàn thành!
        if (this.queue.length === 0 && Monsters.list.every((m) => m.dead)) {
          const bonus = Config.WAVE.CLEAR_BONUS + this.num * Config.WAVE.CLEAR_BONUS_PER_WAVE;
          p.money += bonus;
          if (window.Gold) Gold.add(bonus); // thưởng dọn wave cũng vào ví tích luỹ
          this.score += bonus;
          // vừa dọn wave BOSS → modifier HIẾM xuất hiện ở lần chọn kế
          this.bossCleared = this.num >= Config.WAVE.BOSS.FROM && this.num % Config.WAVE.BOSS.EVERY === 0;
          this.mods = {};   // modifier cũ hết hạn khi wave dọn sạch
          this.event = null; // 🎲 event cũng hết hiệu lực khi wave dọn
          this.offers = null;
          this.nodeType = null; this.pendingElite = false; // 👹/👑 hết hiệu lực khi wave dọn
          this.state = 'intermission';
          this.timer = Config.WAVE.INTERMISSION;
          this._buildNodes(); // 🗺️ hiện BẢN ĐỒ chọn đường (modifier chọn SAU khi chọn lá)
          window.Nodes && Nodes.show();
          window.showToast && showToast('🗺️ Dọn sạch! Chọn đường đi tiếp — bấm 1/2/3 hoặc click thẻ');
          this._rollEvent();   // 🎲 30% bốc 1 event bất ngờ cho wave tới
          AudioFX.reloadEnd(); // tiếng "hoành thành" tạm
        }
        break;

      case 'intermission':
        // 🏪 đang NGHỈ ở tiệm: đồng hồ đóng băng — chờ cửa hàng đóng → hiện lại bản đồ
        if (this.resting) {
          if (window.Shop && !Shop.open) {
            this.resting = false;
            this._buildNodes();
            window.Nodes && Nodes.show();
          }
          break;
        }
        // 🗺️ bảng chọn ĐƯỜNG mở → đồng hồ ĐÓNG BĂNG, chọn lá 1/2/3 thoải mái
        if (this.nodeOpen) {
          const inp = window.Input;
          if (inp) {
            if (inp.wasPressed('slot0')) this.chooseNode(0);
            else if (inp.wasPressed('slot1')) this.chooseNode(1);
            else if (inp.wasPressed('slot2')) this.chooseNode(2);
          }
          break;
        }
        break;
    }

    // người chơi gục → game over
    if (p.hp <= 0 && this.state !== 'idle') {
      this.gameOver();
    }
  },

  gameOver() {
    this.state = 'idle';
    this.over = true; // trận đã xong — main.js đóng băng mọi nhân vật (góp ý người chơi)
    this.nodeOpen = false; this.resting = false;
    this.nextNodes = null;
    window.Nodes && Nodes.hide();
    // lưu kỷ lục
    const bestWave = +localStorage.getItem('ss_bestWave') || 0;
    const bestScore = +localStorage.getItem('ss_bestScore') || 0;
    if (this.num > bestWave) localStorage.setItem('ss_bestWave', this.num);
    if (this.score > bestScore) localStorage.setItem('ss_bestScore', this.score);
    Menu.showGameOver(this.num, this.score, Math.max(bestWave, this.num) === this.num, Math.max(bestScore, this.score) === this.score);
  },
};
