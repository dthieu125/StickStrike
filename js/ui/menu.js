/* =========================================================
 * MENU — giao diện DOM (menu chính, pause, game over, kết thúc trận)
 * Hiệu ứng CSS thuần (không phụ thuộc thư viện ngoài — chơi offline vẫn ổn);
 * muốn "xa xỉ" hơn sau này có thể cắm Anime.js v4 animate các panel này.
 * ========================================================= */
window.Menu = {
  dmMaps: ['hangar', 'reactor', 'cargo', 'forest'],
  mapIndex: 0,
  game: null, // API từ main.js: { startWave, startDM, resume, toMenu, restartWave, restartDM }
  previewPhase: 0,

  init(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      menu: $('menu'), pause: $('pause'), gameover: $('gameover'), matchend: $('matchend'), tips: $('tips'),
      mapName: $('mapName'), records: $('records'), hatBtn: $('hatBtn'),
      goTitle: $('goTitle'), goStats: $('goStats'),
      meTitle: $('meTitle'), meStats: $('meStats'),
    };

    // nút menu chính
    $('btnWave').onclick = () => { AudioFX.click(); this.game.startWave(); };
    $('btnDM').onclick = () => { AudioFX.click(); this.game.startDM(this.dmMaps[this.mapIndex]); };
    $('btnTips').onclick = () => { AudioFX.click(); this.show('tips'); };
    $('btnTipsBack').onclick = () => { AudioFX.click(); this.show('menu'); };
    $('mapPrev').onclick = () => { this.mapIndex = (this.mapIndex + this.dmMaps.length - 1) % this.dmMaps.length; this._updateMapName(); AudioFX.click(); };
    $('mapNext').onclick = () => { this.mapIndex = (this.mapIndex + 1) % this.dmMaps.length; this._updateMapName(); AudioFX.click(); };

    // ── tuỳ chọn DEATHMATCH: số người/đội (1-10) + điểm thắng (5-100, bước 5) ──
    // chỉnh ngay tại menu, áp dụng cho trận tiếp theo (Match đọc Config.DM mỗi frame)
    const dmSizeRender = () => { $('dmSizeLabel').textContent = '👥 ' + Config.DM.TEAM_SIZE + ' người/đội'; };
    $('dmSizeMinus').onclick = () => { Config.DM.TEAM_SIZE = Math.max(1, Config.DM.TEAM_SIZE - 1); dmSizeRender(); AudioFX.click(); };
    $('dmSizePlus').onclick = () => { Config.DM.TEAM_SIZE = Math.min(10, Config.DM.TEAM_SIZE + 1); dmSizeRender(); AudioFX.click(); };
    const dmKillsRender = () => { $('dmKillsLabel').textContent = '🏁 ' + Config.DM.WIN_KILLS + ' kill thắng'; };
    $('dmKillsMinus').onclick = () => { Config.DM.WIN_KILLS = Math.max(5, Config.DM.WIN_KILLS - 5); dmKillsRender(); AudioFX.click(); };
    $('dmKillsPlus').onclick = () => { Config.DM.WIN_KILLS = Math.min(100, Config.DM.WIN_KILLS + 5); dmKillsRender(); AudioFX.click(); };
    dmSizeRender();
    dmKillsRender();
    this.el.hatBtn.onclick = () => {
      const hats = Config.HATS;
      const next = hats[(hats.indexOf(Config.PLAYER.HAT) + 1) % hats.length];
      Config.PLAYER.HAT = next;
      localStorage.setItem('ss_hat', next);
      this.el.hatBtn.textContent = '🎩 Mũ: ' + next;
      AudioFX.click();
    };

    // pause
    $('btnResume').onclick = () => { AudioFX.click(); this.game.resume(); };
    $('btnQuit').onclick = () => { AudioFX.click(); this.game.toMenu(); };

    // game over
    $('btnRetryWave').onclick = () => { AudioFX.click(); this.game.startWave(); };
    $('btnGoMenu1').onclick = () => { AudioFX.click(); this.game.toMenu(); };

    // kết thúc trận
    $('btnRematch').onclick = () => { AudioFX.click(); this.game.startDM(this.dmMaps[this.mapIndex]); };
    $('btnGoMenu2').onclick = () => { AudioFX.click(); this.game.toMenu(); };

    // chấm màu áo
    const dots = $('colorDots');
    Config.TEAM_COLORS.forEach((col) => {
      const d = document.createElement('div');
      d.className = 'dot' + (col === Config.PLAYER.COLOR ? ' active' : '');
      d.style.background = col;
      d.onclick = () => {
        Config.PLAYER.COLOR = col;
        localStorage.setItem('ss_color', col);
        dots.querySelectorAll('.dot').forEach((x) => x.classList.remove('active'));
        d.classList.add('active');
        AudioFX.click();
      };
      dots.appendChild(d);
    });

    // khôi phục tuỳ chọn đã lưu
    const savedColor = localStorage.getItem('ss_color');
    if (savedColor && Config.TEAM_COLORS.includes(savedColor)) Config.PLAYER.COLOR = savedColor;
    const savedHat = localStorage.getItem('ss_hat');
    if (savedHat && Config.HATS.includes(savedHat)) Config.PLAYER.HAT = savedHat;
    this.el.hatBtn.textContent = '🎩 Mũ: ' + Config.PLAYER.HAT;

    this.refreshScores();
    this._previewLoop();
  },

  _updateMapName() {
    this.el.mapName.textContent = Maps[this.dmMaps[this.mapIndex]].name;
  },

  refreshScores() {
    const bw = localStorage.getItem('ss_bestWave') || 0;
    const bs = localStorage.getItem('ss_bestScore') || 0;
    this.el.records.textContent = `🏆 Kỷ lục của bạn: Wave ${bw} · ${bs} điểm`;
  },

  show(panel) {
    ['menu', 'pause', 'gameover', 'matchend', 'tips'].forEach((id) => {
      this.el[id].classList.toggle('hidden', id !== panel);
    });
  },
  hideAll() {
    ['menu', 'pause', 'gameover', 'matchend', 'tips'].forEach((id) => this.el[id].classList.add('hidden'));
  },

  showGameOver(wave, score, waveRecord, scoreRecord) {
    this.el.goTitle.textContent = '💀 BẠN ĐÃ GỤC';
    this.el.goStats.innerHTML =
      `Sống sót đến <b>Wave ${wave}</b> · <b>${score} điểm</b>` +
      (waveRecord ? '<br><span class="record">🌟 KỶ LỤC WAVE MỚI!</span>' : '') +
      (scoreRecord ? '<br><span class="record">🌟 KỶ LỤC ĐIỂM MỚI!</span>' : '');
    this.refreshScores();
    this.show('gameover');
  },

  showMatchEnd(won, a, b) {
    this.el.meTitle.textContent = won ? '🏆 ĐỘI BẠN THẮNG!' : '☠️ THUA RỒI!';
    this.el.meTitle.className = won ? 'win-title' : 'lose-title';
    this.el.meStats.innerHTML = `Tỷ số cuối: <b>${a} — ${b}</b> (cần ${Config.DM.WIN_KILLS} kill)`;
    this.show('matchend');
  },

  /* người que chạy tại chỗ preview trong menu — nhìn là thấy đồ ngay */
  _previewLoop() {
    const cv = document.getElementById('preview');
    const c2 = cv.getContext('2d');
    const loop = () => {
      const menuVisible = !this.el.menu.classList.contains('hidden');
      if (menuVisible) {
        this.previewPhase += 0.14;
        c2.clearRect(0, 0, cv.width, cv.height);
        // sàn nhỏ
        c2.strokeStyle = 'rgba(120,140,170,0.5)';
        c2.lineWidth = 2;
        c2.beginPath(); c2.moveTo(20, 190); c2.lineTo(180, 190); c2.stroke();
        drawStickman(c2, {
          cx: 100, feetY: 188, h: 62,
          facing: 1, runPhase: this.previewPhase, moving: true, onGround: true,
          crouch: false, color: Config.PLAYER.COLOR, hat: Config.PLAYER.HAT, aimAngle: null,
        });
      }
      requestAnimationFrame(loop);
    };
    loop();
  },
};
