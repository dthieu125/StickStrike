/* =========================================================
 * WAVE — bộ máy chế độ SINH TỔN
 * Đếm ngược → quái trồi lên theo đợt → dọn sạch → nhận tiền,
 * nghỉ 12 giây CÓ CỬA HÀNG → wave sau khó hơn. Chết = game over.
 * ========================================================= */
window.Wave = {
  num: 0, state: 'idle', // idle | countdown | active | intermission
  over: false,           // true = game đã kết thúc (đóng băng mọi thứ, chỉ còn hiệu ứng)
  timer: 0,
  queue: [],           // danh sách quái chờ trồi lên [{type, delay}]
  score: 0, kills: 0,

  /* ── MODIFIER chọn 1/3 giữa wave (kế hoạch chuyên gia) ──
   * Hết 1 wave: hiện 3 lựa chọn random → bấm 1/2/3 (hoặc tự chọn sau 2s).
   * Modifier áp dụng cho WAVE KẾ TIẾP rồi bị xoá khi wave đó dọn sạch. */
  OFFERS: [
    { id: 'dmg',    name: '🔥 HOẢ LỰC +25%',   desc: 'Đạn của bạn mạnh hơn 25% trong wave tới' },
    { id: 'rate',   name: '⚡ BẮN NHANH +25%', desc: 'Tốc độ bắn nhanh hơn 25% trong wave tới' },
    { id: 'pierce', name: '🎯 ĐẠN XUYÊN +1',   desc: 'Đạn xuyên thêm 1 mục tiêu trong wave tới' },
    { id: 'money',  name: '💰 THƯỞNG ×2',      desc: 'Tiền giết quái ×2 trong wave tới' },
    { id: 'heal',   name: '❤️ HỒI ĐẦY MÁU',    desc: 'Hồi đầy máu NGAY LẬP TỨC' },
    { id: 'armor',  name: '🛡️ GIÁP NẸP',       desc: 'Sát thương bạn nhận −30% trong wave tới' },
  ],
  mods: {},    // modifier ĐANG áp dụng (xoá khi wave dọn sạch)
  offers: null, // 3 lựa chọn đang hiện (null = không có gì để chọn)

  start() {
    this.num = 0; this.score = 0; this.kills = 0;
    this.over = false;
    this.mods = {}; this.offers = null;
    this.state = 'countdown';
    this.timer = Config.WAVE.COUNTDOWN;
  },

  reset() { this.state = 'idle'; this.over = false; this.mods = {}; this.offers = null; Monsters.clear(); },

  /* random 3 lựa chọn KHÁC nhau */
  _buildOffers() {
    const pool = [...this.OFFERS];
    this.offers = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      this.offers.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    window.showToast && showToast('⚡ Chọn 1 trong 3 cho wave tới (phím 1/2/3)!');
  },

  chooseOffer(i) {
    if (!this.offers || !this.offers[i]) return false;
    const o = this.offers[i];
    if (o.id === 'heal') {
      const p = Player.obj;
      if (p) p.hp = p.maxHp; // hồi đầy NGAY
    } else {
      this.mods[o.id] = 1;
    }
    this.offers = null;
    window.showToast && showToast('✅ Đã chọn: ' + o.name);
    return true;
  },

  onMonsterKilled(m) {
    const p = Player.obj;
    p.money += Math.round(m.money * (this.mods.money ? 2 : 1)); // modifier THƯỞNG ×2
    this.kills++;
    this.score += m.score + this.num; // wave càng cao điểm càng đắt
    Particles.text(m.x + m.w / 2, m.y - 6, '+' + m.money + '💰', '#ffe066', 13);
  },

  /* dựng danh sách quái cho wave tiếp theo — theo GIAI (kế hoạch chuyên gia):
   * early: swarm crawler · mid: + tank giáp / kamikaze · muộn: + sniper xa */
  _buildQueue() {
    this.num++;
    const W = Config.WAVE;
    const q = [];
    const crawlers = W.CRAWLER_BASE + (this.num - 1) * W.CRAWLER_PER_WAVE;
    const spitters = this.num >= W.SPITTER_FROM ? Math.floor((this.num - 1) * 0.8) : 0;
    const brutes = this.num % W.BRUTE_EVERY === 0 ? Math.floor(this.num / W.BRUTE_EVERY) : 0;
    const tanks = this.num >= W.TANK_FROM ? Math.floor((this.num - W.TANK_FROM) / W.TANK_EVERY) + 1 : 0;
    const kamikazes = this.num >= W.KAMIKAZE_FROM ? Math.floor((this.num - W.KAMIKAZE_FROM) / W.KAMIKAZE_EVERY) + 1 : 0;
    const snipers = this.num >= W.SNIPER_FROM ? Math.floor((this.num - W.SNIPER_FROM) / W.SNIPER_EVERY) + 1 : 0;
    for (let i = 0; i < crawlers; i++) q.push('crawler');
    for (let i = 0; i < spitters; i++) q.push('spitter');
    for (let i = 0; i < brutes; i++) q.push('brute');
    for (let i = 0; i < tanks; i++) q.push('tank');
    for (let i = 0; i < kamikazes; i++) q.push('kamikaze');
    for (let i = 0; i < snipers; i++) q.push('sniper');
    // xáo trộn + rải đều thời gian trồi lên
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    this.queue = q.map((type, i) => ({ type, delay: 0.4 + i * (1.6 - Math.min(0.9, this.num * 0.08)) }));
    this.spawnT = 0;
  },

  update(dt) {
    const p = Player.obj;
    switch (this.state) {
      case 'countdown':
        this.timer -= dt;
        if (this.timer <= 0) {
          this._buildQueue();
          this.state = 'active';
        }
        break;

      case 'active':
        // trồi dần từng con
        this.spawnT -= dt;
        if (this.queue.length > 0 && this.spawnT <= 0) {
          const item = this.queue.shift();
          const spots = Config.WAVE.SPAWNS;
          const sp = spots[Math.floor(Math.random() * spots.length)];
          Monsters.spawn(item.type, sp[0], sp[1], this.num);
          this.spawnT = 0.35;
        }
        // hết quái + sạch màn → wave hoàn thành!
        if (this.queue.length === 0 && Monsters.list.every((m) => m.dead)) {
          const bonus = Config.WAVE.CLEAR_BONUS + this.num * Config.WAVE.CLEAR_BONUS_PER_WAVE;
          p.money += bonus;
          this.score += bonus;
          this.mods = {};   // modifier cũ hết hạn khi wave dọn sạch
          this.offers = null;
          this.state = 'intermission';
          this.timer = Config.WAVE.INTERMISSION;
          this._buildOffers(); // hiện 3 lựa chọn NGAY (không đợi frame sau)
          AudioFX.reloadEnd(); // tiếng "hoành thành" tạm
        }
        break;

      case 'intermission':
        // chọn 1 trong 3 modifier cho wave KẾ TIẾP (bấm 1/2/3; không chọn → tự random)
        if (!this.offers) this._buildOffers();
        const inp = window.Input;
        if (inp) {
          if (inp.wasPressed('slot0')) this.chooseOffer(0);
          else if (inp.wasPressed('slot1')) this.chooseOffer(1);
          else if (inp.wasPressed('slot2')) this.chooseOffer(2);
        }
        this.timer -= dt;
        if (this.offers && this.timer <= 2) this.chooseOffer(Math.floor(Math.random() * 3));
        if (this.timer <= 0) {
          this._buildQueue();
          this.state = 'active';
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
    // lưu kỷ lục
    const bestWave = +localStorage.getItem('ss_bestWave') || 0;
    const bestScore = +localStorage.getItem('ss_bestScore') || 0;
    if (this.num > bestWave) localStorage.setItem('ss_bestWave', this.num);
    if (this.score > bestScore) localStorage.setItem('ss_bestScore', this.score);
    Menu.showGameOver(this.num, this.score, Math.max(bestWave, this.num) === this.num, Math.max(bestScore, this.score) === this.score);
  },
};
