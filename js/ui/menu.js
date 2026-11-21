/* =========================================================
 * MENU — giao diện DOM (menu chính, pause, game over, kết thúc trận)
 * Hiệu ứng CSS thuần (không phụ thuộc thư viện ngoài — chơi offline vẫn ổn);
 * muốn "xa xỉ" hơn sau này có thể cắm Anime.js v4 animate các panel này.
 * ========================================================= */
window.Menu = {
  /* 🗺️ MAP dùng chung cho SINH TỔN lẫn ĐẤU ĐỘI — chọn 1 phát, chế độ nào cũng xài */
  maps: ['deck', 'hangar', 'reactor', 'cargo', 'forest', 'colosseum'],
  mapIndex: 0,
  game: null, // API từ main.js: { startWave, startDM, startSolo, resume, toMenu, restartWave, restartDM }
  previewPhase: 0,

  init(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      menu: $('menu'), pause: $('pause'), gameover: $('gameover'), matchend: $('matchend'), tips: $('tips'), market: $('market'), keys: $('keys'), net: $('net'), settings: $('settings'), mymaps: $('mymaps'), setModal: $('setModal'), achievements: $('achievements'),
      mapName: $('mapName'), records: $('records'), hatBtn: $('hatBtn'),
      goTitle: $('goTitle'), goStats: $('goStats'),
      meTitle: $('meTitle'), meStats: $('meStats'),
      netStatus: $('netStatus'), netStart: $('btnNetStart'),
    };

    // nút menu chính
    // 🗺️ map chọn 1 lần — SINH TỔN lẫn ĐẤU ĐỘI đều chơi trên map đang chọn
    $('btnWave').onclick = () => { AudioFX.click(); this.game.startWave(this.maps[this.mapIndex]); };
    // 🤖 ĐẤU ĐỘI: bấm = MỞ/ĐÓNG panel thiết lập (số người · điểm thắng) — vào trận ở nút ▶ VÀO TRẬN
    $('btnDM').onclick = () => {
      AudioFX.click();
      const setup = document.getElementById('dmSetup');
      setup.classList.toggle('hidden');
      this._updateMapName(); // lần đầu mở phải có tên map đúng
    };
    $('btnDMStart').onclick = () => { AudioFX.click(); this.game.startDM(this.maps[this.mapIndex]); };
    // 🎯 1 vs NHIỀU: một mình bạn vs cả đội bot đỏ trên map Đấu Trường RỘNG
    $('btnSolo').onclick = () => { AudioFX.click(); this.game.startSolo(); };
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
    // máy chủ bấm SINH TỔN khi đã đủ 2 người — dùng đúng map đang chọn ở menu
    this.el.netStart.onclick = () => {
      AudioFX.click();
      if (window.Net && Net.mode === 'host' && Net.peer) this.game.startWave(this.maps[this.mapIndex]);
    };
    // ⚔️ máy chủ bấm ĐỐI ĐẦU khi đã đủ 2 người — mỗi đội 1 người thật + bot đi kèm
    $('btnNetDM').onclick = () => {
      AudioFX.click();
      if (window.Net && Net.mode === 'host' && Net.peer) this.game.startNetDM(this.maps[this.mapIndex]);
    };
    $('btnMarket').onclick = () => { AudioFX.click(); Market.show(); };
    $('btnMarketBack').onclick = () => { AudioFX.click(); Market.hide(); this.show('menu'); };
    // 🏆 THÀNH TỰU & THỐNG KÊ — tiến độ từng mốc + số liệu tổng hợp
    $('btnAchievements').onclick = () => {
      AudioFX.click();
      if (window.Achievements) Achievements.render();
      this.show('achievements');
    };
    $('btnAchBack').onclick = () => { AudioFX.click(); this.show('menu'); };
    $('btnTips').onclick = () => { AudioFX.click(); this.show('tips'); };
    $('btnTipsBack').onclick = () => { AudioFX.click(); this.show('menu'); };
    // ⚙️ CÀI ĐẶT — mỗi mục 1 DÒNG, bấm mở hộp thoại riêng (✔ OK lưu · ✖ HUỶ bỏ)
    $('btnSettings').onclick = () => { AudioFX.click(); this.show('settings'); this._setRefresh(); };
    $('btnSettingsBack').onclick = () => { AudioFX.click(); this.show('menu'); };
    $('btnKeysOpen').onclick = () => { AudioFX.click(); this.show('keys'); };
    // 🗺️ BẢN ĐỒ CỦA TÔI — tải map mẫu / nhập map tự thiết kế
    $('btnMaps').onclick = () => { AudioFX.click(); this.show('mymaps'); this._myMapRender(); };
    $('btnMapsBack').onclick = () => { AudioFX.click(); this.show('menu'); };
    $('mapPrev').onclick = () => { this.mapIndex = (this.mapIndex + this.maps.length - 1) % this.maps.length; this._updateMapName(); AudioFX.click(); };
    $('mapNext').onclick = () => { this.mapIndex = (this.mapIndex + 1) % this.maps.length; this._updateMapName(); AudioFX.click(); };

    // ── tuỳ chọn ĐẤU ĐỘI (dùng chung cho chơi đơn lẫn ĐỐI ĐẦU qua mạng):
    // số người/đội (1-10) + điểm thắng (5-100, bước 5) — áp dụng cho trận tiếp theo
    const dmSizeRender = () => { $('dmSizeLabel').textContent = '👥 ' + Config.DM.TEAM_SIZE + ' người/đội'; };
    $('dmSizeMinus').onclick = () => { Config.DM.TEAM_SIZE = Math.max(1, Config.DM.TEAM_SIZE - 1); dmSizeRender(); AudioFX.click(); };
    $('dmSizePlus').onclick = () => { Config.DM.TEAM_SIZE = Math.min(10, Config.DM.TEAM_SIZE + 1); dmSizeRender(); AudioFX.click(); };
    const dmKillsRender = () => { $('dmKillsLabel').textContent = '🏁 ' + Config.DM.WIN_KILLS + ' kill thắng'; };
    $('dmKillsMinus').onclick = () => { Config.DM.WIN_KILLS = Math.max(5, Config.DM.WIN_KILLS - 5); dmKillsRender(); AudioFX.click(); };
    $('dmKillsPlus').onclick = () => { Config.DM.WIN_KILLS = Math.min(100, Config.DM.WIN_KILLS + 5); dmKillsRender(); AudioFX.click(); };
    dmSizeRender();
    dmKillsRender();

    // pause
    $('btnResume').onclick = () => { AudioFX.click(); this.game.resume(); };
    $('btnQuit').onclick = () => { AudioFX.click(); this.game.toMenu(); };

    // game over
    $('btnRetryWave').onclick = () => { AudioFX.click(); this.game.startWave(); };
    $('btnGoMenu1').onclick = () => { AudioFX.click(); this.game.toMenu(); };

    // kết thúc trận
    $('btnRematch').onclick = () => {
      AudioFX.click();
      // 🎯 1 vs NHIỀU: vừa chơi solo → ĐẤU LẠI = dựng lại trận solo (map Đấu Trường)
      if (this.game._soloMode) {
        this.game.startSolo();
      // 🌐 mạng: vừa chơi ĐỐI ĐẦU LAN → ĐẤU LẠI = dựng lại trận MẠNG cùng map
      //   (máy guest nhận 'start-dm' mới → tự nhảy vào trận, không cần tạo phòng lại)
      } else if (window.Net && Net.mode === 'host' && Net.peer && this.game._netDMMap) {
        this.game.startNetDM(this.game._netDMMap);
      } else {
        this.game.startDM(this.maps[this.mapIndex]);
      }
    };
    $('btnGoMenu2').onclick = () => { AudioFX.click(); this.game.toMenu(); };

    // ── 👕 Trang phục — chấm màu + mũ (chỉ LƯU khi bấm ✔ OK trong hộp thoại) ──
    // khôi phục tuỳ chọn đã lưu
    const savedColor = localStorage.getItem('ss_color');
    if (savedColor && Config.TEAM_COLORS.includes(savedColor)) Config.PLAYER.COLOR = savedColor;
    const savedHat = localStorage.getItem('ss_hat');
    if (savedHat && Config.HATS.includes(savedHat)) Config.PLAYER.HAT = savedHat;

    const dots = $('colorDots');
    const dotEls = [];
    Config.TEAM_COLORS.forEach((col) => {
      const d = document.createElement('div');
      d.className = 'dot';
      d.style.background = col;
      d.onclick = () => {
        Config.PLAYER.COLOR = col;
        AudioFX.click();
        renderLook();
        this._lookPreview();
      };
      dots.appendChild(d);
      dotEls.push(d);
    });
    const renderLook = () => {
      dotEls.forEach((d, i) => d.classList.toggle('active', Config.TEAM_COLORS[i] === Config.PLAYER.COLOR));
      this.el.hatBtn.textContent = '🎩 Mũ: ' + Config.PLAYER.HAT;
    };
    this.el.hatBtn.onclick = () => {
      const hats = Config.HATS;
      Config.PLAYER.HAT = hats[(hats.indexOf(Config.PLAYER.HAT) + 1) % hats.length];
      AudioFX.click();
      renderLook();
      this._lookPreview();
    };
    renderLook();

    // ── 🎯 ĐƯỜNG NGẮM (⚙️ Cài Đặt) — khôi phục 'ss_aim'; chỉ LƯU khi bấm OK ──
    try {
      const saved = JSON.parse(localStorage.getItem('ss_aim') || 'null');
      if (saved) Object.assign(Config.AIM, saved);
    } catch (e) { /* hỏng file lưu thì dùng mặc định */ }
    const aim = Config.AIM;
    const aimW = $('aimWidth'), aimA = $('aimAlpha'), aimC = $('aimColor'), aimD = $('aimDash');
    const aimWl = $('aimWidthLabel'), aimAl = $('aimAlphaLabel');
    const syncAim = () => {
      aimW.value = aim.WIDTH;
      aimA.value = Math.round(aim.ALPHA * 100);
      aimC.value = aim.COLOR;
      aimD.value = String(aim.DASH);
      aimWl.textContent = aim.WIDTH + 'px';
      aimAl.textContent = Math.round(aim.ALPHA * 100) + '%';
    };
    syncAim();
    aimW.oninput = () => { aim.WIDTH = +aimW.value; aimWl.textContent = aim.WIDTH + 'px'; this._drawAimPreview(); };
    aimA.oninput = () => { aim.ALPHA = +aimA.value / 100; aimAl.textContent = aimA.value + '%'; this._drawAimPreview(); };
    aimC.oninput = () => { aim.COLOR = aimC.value; this._drawAimPreview(); };
    aimD.onchange = () => { aim.DASH = aimD.value; AudioFX.click(); this._drawAimPreview(); };

    // ── 📱 THIẾT BỊ (🖥️ PC / 📱 Mobile) — đổi chế độ điều khiển, lưu 'ss_device' ──
    // Mobile.init() đã tự chọn theo thiết bị; 2 nút này cho đổi tay bất cứ lúc nào
    const devRender = () => {
      const mob = !!(window.Mobile && Mobile.enabled);
      $('devPC').classList.toggle('active', !mob);
      $('devMobile').classList.toggle('active', mob);
      const cur = $('devCur');
      if (cur) cur.textContent = mob ? '📱 MOBILE' : '🖥️ MÁY TÍNH';
    };
    $('devPC').onclick = () => { AudioFX.click(); if (window.Mobile) Mobile.setEnabled(false); devRender(); };
    $('devMobile').onclick = () => {
      AudioFX.click();
      if (window.Mobile) {
        Mobile.setEnabled(true);
        if (window.showToast) window.showToast('📱 Chế độ MOBILE — nút cảm ứng trên màn hình');
      }
      devRender();
    };
    devRender();

    // ── 🤖 ĐỘ CHÍNH XÁC CỦA NPC (DỄ 50% · VỪA 75% · KHÓ 90% · SIÊU KHÓ 100%) ──
    // lưu 'ss_aiLv'; bot đọc Config.AI.accuracy() khi ngắm bắn (bot.js)
    let aiRender = () => {};
    if (window.Config && Config.AI) {
      Config.AI.load();
      const aiIds = ['aiEasy', 'aiNormal', 'aiHard', 'aiInsane'];
      aiRender = () => {
        aiIds.forEach((id, i) => $(id).classList.toggle('active', i === Config.AI.LEVEL));
        const lv = Config.AI.LEVELS[Config.AI.LEVEL] || Config.AI.LEVELS[1];
        const note = $('aiNote');
        if (note) note.textContent = 'NPC sẽ bắn trúng khoảng ' + Math.round(lv.acc * 100) +
          '% phát — ' + lv.desc + '.';
      };
      aiIds.forEach((id, i) => {
        $(id).onclick = () => {
          Config.AI.LEVEL = i;
          aiRender();
          AudioFX.click();
        };
      });
      aiRender();
    }

    /* ═══ HỘP THOẠI CÀI ĐẶT — mỗi mục 1 dòng, ✔ OK lưu · ✖ HUỶ trả lại như cũ ═══
     * Khi mở: chụp lại giá trị hiện tại. Slider/nút trong hộp thoại đổi TRỰC TIẾP
     * Config (để thấy ngay hiệu ứng) nhưng KHÔNG ghi localStorage — chỉ khi OK mới
     * lưu; HUỶ/ESC thì khôi phục ảnh chụp. */
    const setModal = $('setModal');
    const panes = { aim: 'paneAim', look: 'paneLook', ai: 'paneAi', device: 'paneDevice' };
    const titles = {
      aim: '🎯 ĐƯỜNG NGẮM BẮN',
      look: '👕 TRANG PHỤC',
      ai: '🤖 ĐỘ CHÍNH XÁC CỦA NPC',
      device: '📱 THIẾT BỊ ĐIỀU KHIỂN',
    };
    let paneNow = null, snap = null;
    const openPane = (pane) => {
      snap = {
        aim: { WIDTH: aim.WIDTH, ALPHA: aim.ALPHA, COLOR: aim.COLOR, DASH: aim.DASH },
        color: Config.PLAYER.COLOR,
        hat: Config.PLAYER.HAT,
        ai: (window.Config && Config.AI) ? Config.AI.LEVEL : 1,
        mobile: !!(window.Mobile && Mobile.enabled),
      };
      paneNow = pane;
      const tt = $('setModalTitle');
      if (tt) tt.textContent = titles[pane] || 'Cài đặt';
      Object.keys(panes).forEach((k) => {
        const el2 = $(panes[k]);
        if (el2 && el2.classList) el2.classList.toggle('hidden', k !== pane);
      });
      setModal.classList.remove('hidden');
      if (pane === 'aim') { syncAim(); this._drawAimPreview(); }
      else if (pane === 'look') { renderLook(); this._lookPreview(); }
      else if (pane === 'ai') aiRender();
      else if (pane === 'device') devRender();
    };
    const closePane = () => { setModal.classList.add('hidden'); paneNow = null; };
    const applyPane = () => {
      if (paneNow === 'aim') {
        try {
          localStorage.setItem('ss_aim', JSON.stringify({
            WIDTH: aim.WIDTH, ALPHA: aim.ALPHA, COLOR: aim.COLOR, DASH: aim.DASH,
          }));
        } catch (e) { /* bỏ qua */ }
      } else if (paneNow === 'look') {
        try {
          localStorage.setItem('ss_color', Config.PLAYER.COLOR);
          localStorage.setItem('ss_hat', Config.PLAYER.HAT);
        } catch (e) { /* bỏ qua */ }
      } else if (paneNow === 'ai' && window.Config && Config.AI) {
        Config.AI.save();
        const lv = Config.AI.LEVELS[Config.AI.LEVEL] || Config.AI.LEVELS[1];
        if (window.showToast) window.showToast('🤖 NPC bắn trúng ~' + Math.round(lv.acc * 100) + '% — ' + lv.desc);
      }
      this._setRefresh();
      closePane();
    };
    const cancelPane = () => {
      if (snap) {
        if (paneNow === 'aim') {
          Object.assign(aim, snap.aim);
          syncAim();
          this._drawAimPreview();
        } else if (paneNow === 'look') {
          Config.PLAYER.COLOR = snap.color;
          Config.PLAYER.HAT = snap.hat;
          renderLook();
          this._lookPreview();
        } else if (paneNow === 'ai' && window.Config && Config.AI) {
          Config.AI.LEVEL = snap.ai;
          aiRender();
        } else if (paneNow === 'device' && window.Mobile) {
          Mobile.setEnabled(snap.mobile);
          devRender();
        }
      }
      this._setRefresh();
      closePane();
    };
    $('setAimRow').onclick = () => { AudioFX.click(); openPane('aim'); };
    $('setLookRow').onclick = () => { AudioFX.click(); openPane('look'); };
    $('setAiRow').onclick = () => { AudioFX.click(); openPane('ai'); };
    $('setDeviceRow').onclick = () => { AudioFX.click(); openPane('device'); };
    $('btnSetOK').onclick = () => { AudioFX.click(); applyPane(); };
    $('btnSetCancel').onclick = () => { AudioFX.click(); cancelPane(); };
    if (setModal && setModal.addEventListener) {
      setModal.addEventListener('click', (e) => { if (e.target === setModal) cancelPane(); });
    }
    // ESC = HUỶ hộp thoại (chặn ở pha capture để main.js không mở pause/menu)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && setModal && !setModal.classList.contains('hidden')) {
        e.preventDefault();
        e.stopPropagation();
        cancelPane();
      }
    }, true);

    /* ═══ 🗺️ BẢN ĐỒ CỦA TÔI — map tự thiết kế (JSON) ═══ */
    // thông báo ngay trong màn (toast vẽ trên canvas bị màn phủ che)
    const setMapMsg = (txt, bad) => {
      const el = $('mapMsg');
      if (!el) return;
      el.textContent = txt || '';
      el.style.color = bad ? '#f43f5e' : '#4ade80';
    };
    if (window.MapEdit) {
      MapEdit.loadAll();
      for (const m of MapEdit.list) if (!this.maps.includes(m.id)) this.maps.push(m.id);
    }
    $('btnMapTemplate').onclick = () => {
      AudioFX.click();
      if (!window.MapEdit) return;
      const ok = MapEdit.download(MapEdit.template(), 'stickstrike-map-mau.json');
      setMapMsg(ok ? '⬇️ Đã tải map mẫu — mở bằng Notepad / VS Code, sửa lưới rồi bấm NHẬP MAP'
        : '❌ Trình duyệt chặn tải file — thử lại nhé', !ok);
      if (window.showToast) {
        window.showToast(ok ? '⬇️ Đã tải map mẫu — mở bằng Notepad / VS Code để sửa'
          : '❌ Trình duyệt chặn tải file — thử lại nhé');
      }
    };
    $('btnMapExport').onclick = () => {
      AudioFX.click();
      if (!window.MapEdit) return;
      const id = this.maps[this.mapIndex];
      const obj = MapEdit.exportCurrent(id);
      if (!obj) {
        setMapMsg('❌ Map này không xuất được', true);
        return;
      }
      const ok = MapEdit.download(obj, 'stickstrike-' + id + '.json');
      setMapMsg(ok ? '📤 Đã tải map "' + obj.name + '"' : '❌ Trình duyệt chặn tải file', !ok);
      if (window.showToast) window.showToast(ok ? '📤 Đã tải map "' + obj.name + '"' : '❌ Trình duyệt chặn tải file');
    };
    $('btnMapImport').onclick = () => {
      AudioFX.click();
      const f = $('mapFile');
      if (!f) return;
      f.value = '';
      f.click();
    };
    $('mapFile').onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !window.MapEdit) return;
      const rd = new FileReader();
      rd.onload = () => {
        const r = MapEdit.importText(String(rd.result));
        if (!r.ok) {
          setMapMsg('❌ ' + r.error, true);
          return;
        }
        this._myMapRender();
        setMapMsg('✅ Đã nhập map "' + r.def.name + '" — đã chọn sẵn, bấm ‹ Về menu rồi vào trận');
        if (window.showToast) window.showToast('✅ Đã nhập map "' + r.def.name + '" — chọn sẵn trong menu');
      };
      rd.onerror = () => setMapMsg('❌ Không đọc được file', true);
      rd.readAsText(file);
    };
    $('mapFile').accept = '.json,application/json';
    // xoá thông báo cũ mỗi lần mở lại màn
    $('btnMaps').addEventListener('click', () => setMapMsg(''));
    this._myMapRender();
    this._setRefresh();

    this.refreshScores();
    this._previewLoop();
  },

  /* chữ tóm tắt ở từng DÒNG trong ⚙️ Cài Đặt (cập nhật sau khi OK) */
  _setRefresh() {
    const $ = (id) => document.getElementById(id);
    const A = Config.AIM;
    if ($('aimCur')) $('aimCur').textContent = A.WIDTH + 'px · ' + Math.round(A.ALPHA * 100) + '%';
    if ($('lookCur')) $('lookCur').textContent = '🎩 ' + Config.PLAYER.HAT;
    if (window.Config && Config.AI && $('aiCur')) {
      const lv = Config.AI.LEVELS[Config.AI.LEVEL] || Config.AI.LEVELS[1];
      $('aiCur').textContent = lv.name + ' · ' + Math.round(lv.acc * 100) + '%';
    }
    if ($('devCur')) $('devCur').textContent = (window.Mobile && Mobile.enabled) ? '📱 MOBILE' : '🖥️ MÁY TÍNH';
  },

  /* 🗺️ danh sách map tự tạo — mỗi dòng: tên + kích thước + nút CHƠI/XUẤT/XOÁ */
  _myMapRender() {
    const box = document.getElementById('myMapList');
    if (!box) return;
    if (!window.MapEdit || !MapEdit.list.length) {
      box.innerHTML = '<p class="market-note">Chưa có map tự tạo nào — bấm <b>📥 NHẬP MAP (.json)</b> để thêm.</p>';
      return;
    }
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    box.innerHTML = MapEdit.list.map((m) => {
      const cols = m.rows[0].length, rows = m.rows.length;
      return '<div class="mymap-row">' +
        '<span class="mymap-name">' + esc(m.name) +
        '<small>' + cols + '×' + rows + ' ô · ' + (cols * 32) + '×' + (rows * 32) + 'px</small></span>' +
        '<button class="btn small primary" data-myplay="' + esc(m.id) + '">▶ CHƠI</button>' +
        '<button class="btn small" data-myexport="' + esc(m.id) + '">📤 XUẤT</button>' +
        '<button class="btn small" data-mydelete="' + esc(m.id) + '">🗑 XOÁ</button>' +
        '</div>';
    }).join('');
    box.querySelectorAll('button[data-myplay]').forEach((b) => {
      b.onclick = () => { AudioFX.click(); this._playMyMap(b.getAttribute('data-myplay')); };
    });
    box.querySelectorAll('button[data-myexport]').forEach((b) => {
      b.onclick = () => {
        AudioFX.click();
        const id = b.getAttribute('data-myexport');
        const obj = MapEdit.exportCurrent(id);
        if (obj) MapEdit.download(obj, 'stickstrike-' + id + '.json');
        if (window.showToast) window.showToast(obj ? '📤 Đã tải map "' + obj.name + '"' : '❌ Không xuất được map');
      };
    });
    box.querySelectorAll('button[data-mydelete]').forEach((b) => {
      b.onclick = () => {
        AudioFX.click();
        const id = b.getAttribute('data-mydelete');
        const m = MapEdit.list.find((x) => x.id === id);
        if (m && window.confirm && !window.confirm('Xoá map "' + m.name + '"? Không khôi phục được.')) return;
        MapEdit.remove(id);
        this._myMapRender();
        if (window.showToast) window.showToast('🗑 Đã xoá map');
      };
    });
  },

  /* chọn map tự tạo làm map đang chơi rồi về menu */
  _playMyMap(id) {
    if (!Maps[id]) return;
    if (!this.maps.includes(id)) this.maps.push(id);
    this.mapIndex = this.maps.indexOf(id);
    this._updateMapName();
    if (window.showToast) {
      window.showToast('🗺️ Đã chọn "' + Maps[id].name + '" — bấm 🎮 SINH TỒN hoặc 🤖 ĐẤU ĐỘI');
    }
    this.show('menu');
  },

  /* 🎯 vẽ xem trước ĐƯỜNG NGẮM đúng cài đặt hiện tại (canvas #aimPrev) */
  _drawAimPreview() {
    const cv = document.getElementById('aimPrev');
    if (!cv) return;
    const c2 = cv.getContext('2d');
    const A = Config.AIM;
    c2.clearRect(0, 0, cv.width, cv.height);
    c2.save();
    c2.globalAlpha = A.ALPHA;
    c2.strokeStyle = A.COLOR;
    c2.lineWidth = A.WIDTH;
    if (A.DASH && A.DASH !== '0') c2.setLineDash(String(A.DASH).split(',').map(Number));
    c2.beginPath();
    c2.moveTo(18, cv.height / 2);
    c2.lineTo(cv.width - 26, cv.height / 2);
    c2.stroke();
    c2.setLineDash([]);
    c2.fillStyle = A.COLOR;
    c2.beginPath();
    c2.arc(cv.width - 26, cv.height / 2, Math.max(2.5, A.WIDTH + 1), 0, Math.PI * 2);
    c2.fill();
    c2.restore();
  },

  /* 👕 vẽ xem trước ÁO + MŨ hiện tại (canvas #lookPrev) */
  _lookPreview() {
    const cv = document.getElementById('lookPrev');
    if (!cv) return;
    const c2 = cv.getContext('2d');
    c2.clearRect(0, 0, cv.width, cv.height);
    c2.strokeStyle = 'rgba(120,140,170,0.5)';
    c2.lineWidth = 2;
    c2.beginPath(); c2.moveTo(30, 122); c2.lineTo(170, 122); c2.stroke();
    drawStickman(c2, {
      cx: 100, feetY: 120, h: 62,
      facing: 1, runPhase: 2, moving: false, onGround: true, crouch: false, prone: false,
      color: Config.PLAYER.COLOR, hat: Config.PLAYER.HAT, aimAngle: null, visor: true, glow: false,
    });
  },

  _updateMapName() {
    const def = Maps[this.maps[this.mapIndex]];
    this.el.mapName.textContent = def ? def.name : '❔ Map';
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
    // đóng hộp thoại Cài Đặt nếu đang mở (đổi màn hình = bỏ chỉnh dở)
    if (this.el.setModal) this.el.setModal.classList.add('hidden');
    ['menu', 'pause', 'gameover', 'matchend', 'tips', 'market', 'keys', 'net', 'settings', 'mymaps', 'achievements'].forEach((id) => {
      this.el[id].classList.toggle('hidden', id !== panel);
    });
  },
  hideAll() {
    if (this.el.setModal) this.el.setModal.classList.add('hidden');
    ['menu', 'pause', 'gameover', 'matchend', 'tips', 'market', 'keys', 'net', 'settings', 'mymaps', 'achievements'].forEach((id) => this.el[id].classList.add('hidden'));
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
        ? '✅ Bạn 2 ĐÃ VÀO PHÒNG — bấm SINH TỔN hoặc ĐỐI ĐẦU để bắt đầu!'
        : '✅ Phòng đã mở — chờ bạn 2 vào (máy 2 gõ IP rồi bấm VÀO PHÒNG)...';
      const ready = Net.mode === 'host' && Net.peer;
      this.el.netStatus.textContent = s;
      this.el.netStart.classList.toggle('hidden', !ready);
      const dmBtn = document.getElementById('btnNetDM');
      if (dmBtn) dmBtn.classList.toggle('hidden', !ready);
    }, 300);
  },

  showGameOver(wave, score, waveRecord, scoreRecord) {
    this.el.goTitle.textContent = '💀 BẠN ĐÃ GỤC';
    this.el.goStats.innerHTML =
      `Sống sót đến <b>Wave ${wave}</b> · <b>${score} điểm</b>` +
      (waveRecord ? '<br><span class="record">🌟 KỶ LỤC WAVE MỚI!</span>' : '') +
      (scoreRecord ? '<br><span class="record">🌟 KỶ LỤC ĐIỂM MỚI!</span>' : '');
    // 📊 THỐNG KÊ CHI TIẾT + 🏆 thành tựu vừa mở trong trận
    const detail = document.getElementById('goDetail');
    if (detail) {
      const snap = (window.Stats) ? Stats.finish() : null;
      detail.innerHTML = (snap ? Stats.html(snap) : '') +
        (window.Achievements ? Achievements.takePendingHtml() : '');
    }
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
    // 📊 thống kê chi tiết trận đối đầu
    const detail = document.getElementById('meDetail');
    if (detail) {
      const snap = (window.Stats) ? Stats.finish() : null;
      detail.innerHTML = (snap ? Stats.html(snap) : '') +
        (window.Achievements ? Achievements.takePendingHtml() : '');
    }
    // 🌐 co-op/đối đầu: chỉ máy CHỦ mới "đánh lại" được (máy 2 phải đợi host)
    const rematch = document.getElementById('btnRematch');
    if (rematch) rematch.classList.toggle('hidden', window.Net && Net.mode === 'guest');
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
