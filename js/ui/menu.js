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
      menu: $('menu'), pause: $('pause'), gameover: $('gameover'), matchend: $('matchend'), tips: $('tips'), market: $('market'), keys: $('keys'), net: $('net'),
      mapName: $('mapName'), records: $('records'), hatBtn: $('hatBtn'),
      goTitle: $('goTitle'), goStats: $('goStats'),
      meTitle: $('meTitle'), meStats: $('meStats'),
      netStatus: $('netStatus'), netStart: $('btnNetStart'),
    };

    // nút menu chính
    $('btnWave').onclick = () => { AudioFX.click(); this.game.startWave(); };
    $('btnDM').onclick = () => { AudioFX.click(); this.game.startDM(this.dmMaps[this.mapIndex]); };
    $('btnNet').onclick = () => { AudioFX.click(); this.show('net'); };
    $('btnNetBack').onclick = () => {
      AudioFX.click();
      if (window.Net && Net.mode !== 'off' && !Net.peer) Net.off(); // chưa vào trận → huỷ phòng
      this.show('menu');
    };
    // 🌐 LAN: tạo phòng (máy chủ) / vào phòng (máy 2)
    $('btnNetHost').onclick = () => {
      AudioFX.ensure(); AudioFX.click();
      if (!window.Net) return;
      Net.host();
      this._netPoll();
    };
    $('btnNetJoin').onclick = () => {
      AudioFX.ensure(); AudioFX.click();
      if (!window.Net) return;
      const ip = $('netIP').value;
      if (Net.join(ip)) this._netPoll();
    };
    // máy chủ bấm SINH TỔN khi đã đủ 2 người
    this.el.netStart.onclick = () => {
      AudioFX.click();
      if (window.Net && Net.mode === 'host' && Net.peer) this.game.startWave();
    };
    $('btnMarket').onclick = () => { AudioFX.click(); Market.show(); };
    $('btnMarketBack').onclick = () => { AudioFX.click(); Market.hide(); this.show('menu'); };
    $('btnMarketBack').onclick = () => { AudioFX.click(); Market.hide(); this.show('menu'); };
    $('btnTips').onclick = () => { AudioFX.click(); this.show('tips'); };
    $('btnTipsBack').onclick = () => { AudioFX.click(); this.show('menu'); };
    $('btnKeys').onclick = () => { AudioFX.click(); this.show('keys'); };
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

  /* Cập nhật CHỮ GỢI Ý PHÍM theo bind hiện tại — đổi phím ở menu là chữ tự đổi theo */
  refreshKeyHints() {
    const K = (a) => Input.boundKey(a);
    const h1 = document.getElementById('hintKeys');
    if (h1) {
      h1.innerHTML = K('left') + ' / ' + K('right') + ' chạy · ' + K('jump') + ' nhảy x2 · ' + K('crouch') + ' ngồi' +
        '<br>Chuột ngắm bắn · ' + K('reload') + ' nạp · ' + K('pickup') + ' lụm súng';
    }
    const h2 = document.getElementById('tipControlsP');
    if (h2) {
      h2.innerHTML = K('left') + ' / ' + K('right') + ' chạy · ' + K('jump') + ' nhảy (nhấn 2 lần = nhảy đôi) · ' +
        K('crouch') + ' ngồi thấp · <b>' + K('prone') + ' NẰM</b> (hitbox bé · bắn tĩnh −45% tản đạn · đi chậm) · ' +
        'Chuột ngắm + bắn · ' + K('reload') + ' nạp đạn · <b>' + K('altfire') + ' / chuột phải BẮN PHỤ</b> (cần nâng cấp súng cấp 3) · ' +
        '<b>' + K('dash') + ' DASH</b> né đạn (bất tử lúc lướt) · <b>' + K('grenade') + ' LỰU ĐẠN</b> (nổ trúng cả 2 bên!) · ' +
        K('pickup') + ' lụm súng/hộp đạn · ' + K('buy') +
        ' cửa hàng (giữa wave) · 1–0 / lăn chuột đổi súng · ' + K('guide') + ' đường ngắm · ' + K('mute') +
        ' tắt tiếng · ' + K('pause') + ' tạm dừng. <b>Đổi được hết</b> ở menu ⌨️ PHÍM CHỨC NĂNG!';
    }
    const h3 = document.getElementById('creditKeys');
    if (h3) {
      h3.innerHTML = K('pause') + ': tạm dừng · ' + K('guide') + ': đường ngắm mờ · ' + K('mute') +
        ': tắt tiếng — làm với ❤️ để giải trí sau giờ làm';
    }
  },

  refreshScores() {
    const bw = localStorage.getItem('ss_bestWave') || 0;
    const bs = localStorage.getItem('ss_bestScore') || 0;
    let line = `🏆 Kỷ lục: Wave ${bw} · ${bs} điểm`;
    // thống kê VÀNG kiếm được từ Sinh tồn (yêu cầu người chơi)
    if (window.Gold) line += ` · 💰 đã kiếm tổng ${Gold.earned} vàng`;
    this.el.records.textContent = line;
  },

  show(panel) {
    Market.hide(); KeySettings.hide(); // rời chợ / bảng phím nếu đang mở
    ['menu', 'pause', 'gameover', 'matchend', 'tips', 'market', 'keys', 'net'].forEach((id) => {
      this.el[id].classList.toggle('hidden', id !== panel);
    });
  },
  hideAll() {
    ['menu', 'pause', 'gameover', 'matchend', 'tips', 'market', 'keys', 'net'].forEach((id) => this.el[id].classList.add('hidden'));
  },

  /* 🌐 màn hình LAN: cập nhật dòng trạng thái + hiện nút BẮT ĐẦU khi đủ 2 người */
  _netPoll() {
    if (this._netT) clearInterval(this._netT);
    this._netT = setInterval(() => {
      if (this.el.net.classList.contains('hidden') || !window.Net || Net.mode === 'off') {
        clearInterval(this._netT); this._netT = null;
        return;
      }
      let s = Net.status || 'Đang chờ...';
      if (Net.mode === 'host') s = Net.peer
        ? '✅ Bạn 2 ĐÃ VÀO PHÒNG — bấm SINH TỔN để bắt đầu!'
        : '✅ Phòng đã mở — chờ bạn 2 vào (máy 2 gõ IP rồi bấm VÀO PHÒNG)...';
      this.el.netStatus.textContent = s;
      this.el.netStart.classList.toggle('hidden', !(Net.mode === 'host' && Net.peer));
    }, 300);
  },

  showGameOver(wave, score, waveRecord, scoreRecord) {
    this.el.goTitle.textContent = '💀 BẠN ĐÃ GỤC';
    this.el.goStats.innerHTML =
      `Sống sót đến <b>Wave ${wave}</b> · <b>${score} điểm</b>` +
      (waveRecord ? '<br><span class="record">🌟 KỶ LỤC WAVE MỚI!</span>' : '') +
      (scoreRecord ? '<br><span class="record">🌟 KỶ LỤC ĐIỂM MỚI!</span>' : '');
    // 🌐 co-op: chỉ máy CHỦ mới "đánh lại" được (máy 2 phải đợi host)
    const retry = document.getElementById('btnRetryWave');
    if (retry) retry.classList.toggle('hidden', window.Net && Net.mode === 'guest');
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
          visor: true, glow: window.Gear && Gear.active(), // nhìn thấy ngay đồ ngầu trong menu
        });
      }
      requestAnimationFrame(loop);
    };
    loop();
  },
};
