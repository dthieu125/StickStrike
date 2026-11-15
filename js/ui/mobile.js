/* =========================================================
 * 📱 MOBILE — điều khiển cảm ứng cho điện thoại
 * Bật ở ⚙️ CÀI ĐẶT → 📱 THIẾT BỊ (PC / Mobile, lưu 'ss_device').
 *
 * Cụm nút TRÁI-DƯỚI:  ◀ đi trái · ▶ đi phải · 🔫 bắn
 * Cụm nút PHẢI-DƯỚI:  joystick NGẮM (kéo mọi góc) + vòng ngoài:
 *                     🔄 đổi súng · ⏫ nhảy · ⏬ xuống · 🔫 bắn
 *   ⏬ NHẤN 1 LẦN = ngồi (giữ trạng thái) · GIỮ ~0.35s = NẰM (thả = đứng)
 *   · NHẤN 2 LẦN NHANH = NẰM (giữ trạng thái, tap lần nữa → ngồi)
 * Nút mini góc TRÊN-PHẢI: ⏸ dừng · 🛒 cửa hàng · ✋ lụm · ⟳ nạp · 💣 lựu · 🏃 dash
 *
 * Module giả lập ĐỦ interface của Input (isDown/wasPressed/mouse/endFrame)
 * — main.js truyền Mobile.input vào Player.update thay cho Input.
 * Trạng thái ẢO được OR với Input thật (bàn phím vẫn xài song song).
 * ========================================================= */
window.Mobile = {
  enabled: false,        // đang ở chế độ MOBILE? (toggle ở Cài Đặt)
  _root: null,           // DOM #mobileUI (chỉ có trong trình duyệt)
  _down: Object.create(null),   // phím ẢO đang giữ
  _pressed: Object.create(null), // phím ẢO vừa bấm frame này
  mouse: { x: 640, y: 360, down: false, pressed: false, rdown: false, rpressed: false, wheel: 0 },

  /* 🎯 joystick ngắm: kéo lên 1 hướng → "chuột ảo" lệch khỏi người theo hướng đó
   * len = khoảng cách ngắm (px, clamp AIM_MIN..AIM_MAX) — kéo ngắn ngắm gần, kéo hết càng ngắm xa */
  aim: { active: false, dx: 0, dy: -1, len: 220 },

  /* ⏬ máy trạng thái ngồi/nằm */
  pose: {
    state: 'stand',      // 'stand' | 'crouch' | 'prone' (trạng thái GIỮ — latched)
    latch: false,        // nằm KÉO DÀI (nhấn 2 lần)
    hold: false,         // nằm TẠM (giữ nút ≥ PRONE_HOLD giây)
    _down: false,        // ngón tay đang đè nút ⏬?
    _t0: 0,              // thời điểm bắt đầu đè (performance.now/1000)
    _lastTap: 0,         // thời điểm tap TRƯỚC (phát hiện nhấn 2 lần)
    _latchedThisPress: false, // nhấn 2 lần ĐÃ kịch hoạt trong lần đè này — thả tay không huỷ
  },

  /* 🔫 bắn: tương ứng chuột trái — giữ = down, chạm đầu = pressed */
  _fireHeld: false, _firePressed: false,

  /* ═══════════ INPUT WRAPPER — interface giống hệt window.Input ═══════════ */
  input: {
    isDown(a) { return !!Mobile._down[a] || (window.Input && Input.isDown(a)); },
    wasPressed(a) { return !!Mobile._pressed[a] || (window.Input && Input.wasPressed(a)); },
    get mouse() { return Mobile.mouse; },
    endFrame() { /* Mobile.endFrame() lo hộ — để trống cho an toàn */ },
  },

  /* Bật/tắt chế độ mobile (⚙️ Cài Đặt gọi vào). Lưu localStorage + dựng/gỡ DOM */
  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem('ss_device', on ? 'mobile' : 'pc'); } catch (e) { /* bỏ qua */ }
    if (on && !this._root) this._build();
    this.setVisible(this.enabled && this._visible);
    if (!on) this._resetTouch();
  },

  /* Khởi động: đọc thiết bị đã lưu — chưa lưu lần nào mà là máy CẢM ỨNG → tự bật mobile */
  init() {
    let saved = null;
    try { saved = localStorage.getItem('ss_device'); } catch (e) { /* bỏ qua */ }
    if (saved === 'mobile') this.setEnabled(true);
    else if (!saved && typeof window.ontouchstart !== 'undefined') this.setEnabled(true);
  },

  _visible: false,
  /* main.js gọi MỖI FRAME: hiện nút khi đang vào trận (không phải menu/pause) */
  setVisible(v) {
    this._visible = !!v;
    if (this._root) this._root.style.display = (v && this.enabled) ? 'block' : 'none';
  },

  active() { return this.enabled && !!this._root; },

  /* Xoá toàn bộ trạng thái chạm (ra khỏi trận / tắt mobile) — chống "phím ma" */
  _resetTouch() {
    this._down = Object.create(null);
    this._pressed = Object.create(null);
    this._fireHeld = false; this._firePressed = false;
    this.mouse.down = false; this.mouse.pressed = false;
    this.aim.active = false;
    this.pose.state = 'stand'; this.pose.latch = false; this.pose.hold = false;
    this.pose._down = false;
  },

  /* ═══════════ ⏬ MÁY TRẠNG THÁI NGỒI/NẰM ═══════════
   * tap ngắn (<0.35s)  : đứng→ngồi · ngồi→đứng · nằm→ngồi
   * giữ ≥0.35s         : NẰM tạm — thả tay về đứng
   * nhấn 2 lần <0.3s   : NẰM KÉO DÀI (tap lần nữa → ngồi) */
  _poseDown(t) {
    const P = this.pose;
    P._down = true; P._t0 = t; P._latchedThisPress = false;
    // tap lần 2 trong 0.3s kể từ tap trước → NẰM KÉO DÀI
    if (P._lastTap && (t - P._lastTap) < Config.MOBILE.DOUBLE_TAP) {
      P.latch = true; P.state = 'prone'; P._latchedThisPress = true;
      P._lastTap = 0;
    }
  },
  _poseUp(t) {
    const P = this.pose;
    P._down = false; P.hold = false;
    const held = t - P._t0;
    if (P._latchedThisPress) { P._latchedThisPress = false; return; } // vừa kịch nằm bằng nhấn đôi — giữ nguyên
    if (held >= Config.MOBILE.PRONE_HOLD) {
      // thả sau khi GIỮ nằm → về đứng (trừ khi đã kịch nằm bằng nhấn đôi trước đó)
      if (!P.latch) P.state = 'stand';
      return;
    }
    // tap ngắn
    P._lastTap = t;
    if (P.state === 'prone') { P.latch = false; P.state = 'crouch'; } // nằm → gỡ kịch + về ngồi
    else if (P.state === 'crouch') P.state = 'stand'; // ngồi → đứng
    else P.state = 'crouch';                          // đứng → ngồi
  },

  /* ═══════════ MỖI FRAME — dồn trạng thái thật + ẢO, rồi xoá cạnh ═══════════
   * gameLoop gọi Mobile.endFrame() TRƯỚC Input.endFrame() (cạnh thật còn nguyên) */
  endFrame() {
    const t = performance.now() / 1000;
    // ⏬ giữ đủ lâu → NẰM tạm
    const P = this.pose;
    if (P._down && !P.hold && (t - P._t0) >= Config.MOBILE.PRONE_HOLD) P.hold = true;

    // ra phím ảo ngồi/nằm (nằm THẮNG ngồi — Player đọc prone trước crouch)
    const prone = P.latch || P.hold;
    this._down.prone = prone;
    this._down.crouch = !prone && (P.state === 'crouch');

    // 🎯 "chuột ảo": đang kéo joystick → ngắm quanh NGƯỜI CHƠI theo hướng kéo
    if (this.aim.active) {
      const p = (window.Player && Player.obj) ? Player.obj : null;
      const M = Config.MOBILE;
      const len = Math.max(M.AIM_MIN, Math.min(M.AIM_MAX, this.aim.len));
      if (p && window.Camera) {
        // vị trí NGỰC người chơi trên màn hình (toạ độ canvas) = world − camera
        const sx = p.x + p.w / 2 - Camera.x;
        const sy = p.y + p.h * 0.35 - Camera.y;
        this.mouse.x = sx + this.aim.dx * len;
        this.mouse.y = sy + this.aim.dy * len;
      }
      this.mouse.wheel = 0;
    } else {
      // không kéo joystick → dùng đúng chuột/touch thật (tap cửa hàng, bắn bằng chạm canvas)
      if (window.Input) {
        this.mouse.x = Input.mouse.x;
        this.mouse.y = Input.mouse.y;
        this.mouse.wheel = Input.mouse.wheel;
      }
    }

    // 🔫 dồn cạnh bắn: nút ẢO OR chuột thật
    this.mouse.down = this._fireHeld || (window.Input ? Input.mouse.down : false);
    this.mouse.pressed = this._firePressed || (window.Input ? Input.mouse.pressed : false);
    this.mouse.rdown = window.Input ? Input.mouse.rdown : false;
    this.mouse.rpressed = window.Input ? Input.mouse.rpressed : false;

    // xoá CẠNH ẢO (down giữ nguyên nếu vẫn đè nút)
    this._pressed = Object.create(null);
    this._firePressed = false;
  },

  /* ═══════════ TRỢ LÝ ═══════════ */
  /* 🔄 đổi súng sang KẾ (giống lăn bánh xe chuột) — đang chọn lá/modifier thì bỏ qua */
  _switchWeapon(dir) {
    const p = window.Player && Player.obj;
    if (!p || p.hp <= 0) return;
    if (window.Wave && Wave.state === 'intermission' && (Wave.offers || Wave.nodeOpen)) return;
    if (window.Net && Net.mode === 'guest') { Net.send({ t: 'wiw', d: dir }); return; } // guest xin host đổi hộ
    Player.selectWeapon(p, Player.nextOwned(p, dir));
  },
  /* bấm nút = "bấm phím" ẢO 1 lần (pause/buy/pickup/reload/grenade/dash...) */
  _tap(action) { this._pressed[action] = true; this._down[action] = true; },

  /* ═══════════ DỰNG DOM — chỉ chạy trong trình duyệt (Node test bỏ qua) ═══════════ */
  _build() {
    try {
      const wrap = document.querySelector('.game-wrap');
      if (!wrap) return;
      const root = document.createElement('div');
      root.id = 'mobileUI';
      root.innerHTML =
        /* ── cụm TRÁI: đi + bắn ── */
        '<div class="mb-cluster mb-left">' +
          '<button class="mbtn" id="mbL">◀</button>' +
          '<button class="mbtn" id="mbR">▶</button>' +
          '<button class="mbtn mb-fire" id="mbFireL">🔫</button>' +
        '</div>' +
        /* ── cụm PHẢI: joystick ngắm + vòng nút ── */
        '<div class="mb-cluster mb-right">' +
          '<div class="mb-row">' +
            '<button class="mbtn" id="mbSwitch">🔄</button>' +
            '<button class="mbtn" id="mbDown">⏬</button>' +
          '</div>' +
          '<div class="mb-row">' +
            '<button class="mbtn" id="mbJump">⏫</button>' +
            '<div id="mbJoy"><div id="mbKnob"></div></div>' +
            '<button class="mbtn mb-fire" id="mbFireR">🔫</button>' +
          '</div>' +
        '</div>' +
        /* ── nút mini TRÊN-PHẢI ── */
        '<div class="mb-mini">' +
          '<button class="mbtn small" id="mbPause">⏸</button>' +
          '<button class="mbtn small" id="mbShop">🛒</button>' +
          '<button class="mbtn small" id="mbPickup">✋</button>' +
          '<button class="mbtn small" id="mbReload">⟳</button>' +
          '<button class="mbtn small" id="mbGren">💣</button>' +
          '<button class="mbtn small" id="mbDash">🏃</button>' +
        '</div>';
      wrap.appendChild(root);
      this._root = root;

      const byId = (id) => root.querySelector('#' + id);
      /* nút GIỮ (đi/bắn/nhảy): đè = down, thả = hết — pointer capture để rê tay ra ngoài vẫn tính */
      const hold = (id, action, fireMode) => {
        const el = byId(id);
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          try { el.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
          if (fireMode) { // 🔫 bắn = "nút chuột trái ảo"
            this._fireHeld = true; this._firePressed = true;
            if (window.AudioFX) AudioFX.ensure();
          } else {
            this._down[action] = true;
            this._pressed[action] = true; // wasPressed cho nhảy/nhặt...
          }
          if (window.AudioFX) AudioFX.ensure();
        });
        const up = (e) => {
          if (fireMode) this._fireHeld = false;
          else this._down[action] = false;
        };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('lostpointercapture', up);
      };
      hold('mbL', 'left'); hold('mbR', 'right');
      hold('mbFireL', null, true); hold('mbFireR', null, true);
      hold('mbJump', 'jump'); hold('mbPickup', 'pickup'); hold('mbReload', 'reload');
      hold('mbGren', 'grenade'); hold('mbDash', 'dash'); hold('mbShop', 'buy');

      /* nút BẤM 1 LẦN */
      byId('mbPause').addEventListener('pointerdown', (e) => { e.preventDefault(); this._tap('pause'); });
      /* 🔄 đổi súng sang KẾ */
      byId('mbSwitch').addEventListener('pointerdown', (e) => { e.preventDefault(); this._switchWeapon(1); });
      /* ⏬ ngồi/nằm — máy trạng thái */
      const downBtn = byId('mbDown');
      downBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { downBtn.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
        this._poseDown(performance.now() / 1000);
      });
      const downUp = () => this._poseUp(performance.now() / 1000);
      downBtn.addEventListener('pointerup', downUp);
      downBtn.addEventListener('pointercancel', downUp);
      downBtn.addEventListener('lostpointercapture', downUp);

      /* 🎯 JOYSTICK NGẮM: kéo mọi góc — vector kéo = hướng ngắm, độ dài = tầm ngắm */
      const joy = byId('mbJoy'), knob = byId('mbKnob');
      let joyId = null, jcx = 0, jcy = 0;
      const joyCenter = () => {
        const r = joy.getBoundingClientRect();
        jcx = r.left + r.width / 2; jcy = r.top + r.height / 2;
      };
      joy.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        joyId = e.pointerId;
        try { joy.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
        joyCenter();
        this._joyMove(e, jcx, jcy, knob);
        if (window.AudioFX) AudioFX.ensure();
      });
      joy.addEventListener('pointermove', (e) => {
        if (e.pointerId !== joyId) return;
        this._joyMove(e, jcx, jcy, knob);
      });
      const joyEnd = () => {
        joyId = null;
        this.aim.active = false;
        knob.style.transform = 'translate(-50%, -50%)';
      };
      joy.addEventListener('pointerup', joyEnd);
      joy.addEventListener('pointercancel', joyEnd);
      joy.addEventListener('lostpointercapture', joyEnd);

      // chặn menu chuột phải / chọn chữ trên nút điều khiển
      root.addEventListener('contextmenu', (e) => e.preventDefault());
    } catch (e) { /* Node test không có DOM thật → bỏ qua, module vẫn xài được logic */ }
  },

  /* vector kéo joystick → hướng ngắm + độ dài ngắm + vị trí núm xoay */
  _joyMove(e, jcx, jcy, knob) {
    const R = Config.MOBILE.JOY_R; // bán kính núm tối đa (px màn hình)
    let dx = e.clientX - jcx, dy = e.clientY - jcy;
    const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, R);
    this.aim.active = true;
    this.aim.dx = dx / d;
    this.aim.dy = dy / d;
    // độ dài kéo (0..R) → tầm ngắm AIM_MIN..AIM_MAX
    this.aim.len = Config.MOBILE.AIM_MIN +
      (cl / R) * (Config.MOBILE.AIM_MAX - Config.MOBILE.AIM_MIN);
    if (knob) knob.style.transform =
      'translate(-50%, -50%) translate(' + (this.aim.dx * cl).toFixed(1) + 'px,' +
      (this.aim.dy * cl).toFixed(1) + 'px)';
  },
};
