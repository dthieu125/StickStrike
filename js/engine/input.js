/* =========================================================
 * INPUT — bàn phím + chuột
 * Phím:   Input.isDown('left')      → đang giữ?
 *         Input.wasPressed('jump')  → vừa nhấn frame này?
 * Chuột:  Input.mouse = { x, y, down, pressed, wheel }
 *         (x,y theo toạ độ canvas 1280×720, đã tính scale CSS)
 * ========================================================= */
(function () {
  const down = Object.create(null);
  const pressed = Object.create(null);
  const mouse = { x: 640, y: 360, down: false, pressed: false, rdown: false, rpressed: false, wheel: 0 };

  /* Phím MẶC ĐỊNH — người chơi tự đổi được ở menu ⌨️ PHÍM CHỨC NĂNG
   * (prone = NẰM thấp người: bắn tĩnh, hitbox bé, nhưng đi chậm) */
  const DEFAULT_BINDS = {
    left:    ['KeyA', 'ArrowLeft'],
    right:   ['KeyD', 'ArrowRight'],
    jump:    ['KeyW', 'Space', 'ArrowUp'],
    crouch:  ['KeyS', 'ArrowDown'],
    prone:   ['KeyC'],
    reload:  ['KeyR'],
    pickup:  ['KeyG'],
    altfire: ['KeyE'],  // BẮN PHỤ (cũng bấm được bằng CHUỘT PHẢI) — mở ở nâng cấp súng cấp 3
    dash:    ['ShiftLeft'], // 🏃 DASH né đạn
    grenade: ['KeyQ'],  // 💣 NÉM LỰU ĐẠN
    mute:    ['KeyM'],
    guide:   ['KeyT'],
    buy:     ['KeyB'],
    pause:   ['Escape'],
    slot0:   ['Digit1'], slot1: ['Digit2'], slot2: ['Digit3'], slot3: ['Digit4'],
    slot4:   ['Digit5'], slot5: ['Digit6'], slot6: ['Digit7'], slot7: ['Digit8'],
    slot8:   ['Digit9'], slot9: ['Digit0'],
  };

  /* Nạp phím người chơi ĐÃ ĐỔI (lưu localStorage 'ss_binds') — chưa lưu lần nào → dùng mặc định */
  const BINDS = JSON.parse(JSON.stringify(DEFAULT_BINDS));
  try {
    const saved = JSON.parse(localStorage.getItem('ss_binds') || 'null');
    if (saved) {
      for (const k in DEFAULT_BINDS) {
        if (Array.isArray(saved[k]) && saved[k].length) BINDS[k] = saved[k];
      }
    }
  } catch (e) { /* file lưu hỏng → bỏ qua, dùng mặc định */ }

  function saveBinds() {
    try { localStorage.setItem('ss_binds', JSON.stringify(BINDS)); } catch (e) { /* Ignore */ }
  }

  function actionOf(code) {
    for (const action in BINDS) {
      if (BINDS[action].indexOf(code) !== -1) return action;
    }
    return null;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (e.repeat) return;
    const action = actionOf(e.code);
    if (action) { down[action] = true; pressed[action] = true; }
  });

  window.addEventListener('keyup', (e) => {
    const action = actionOf(e.code);
    if (action) down[action] = false;
  });

  window.addEventListener('blur', () => {
    for (const k in down) down[k] = false;
    mouse.down = false;
    mouse.rdown = false;
  });

  /* ── Chuột (tính đúng toạ độ khi canvas bị scale bằng CSS) ── */
  const canvas = document.getElementById('game');

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  }

  canvas.addEventListener('mousemove', (e) => {
    toCanvas(e);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) { // CHUỘT PHẢI = bắn phụ (alt-fire)
      mouse.rdown = true;
      mouse.rpressed = true;
      if (window.AudioFX) AudioFX.ensure();
      return;
    }
    if (e.button !== 0) return; // chỉ chuột trái
    mouse.down = true;
    mouse.pressed = true;
    if (window.AudioFX) AudioFX.ensure(); // trình duyệt cần 1 cú click mới cho phát tiếng
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rdown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    mouse.wheel = e.deltaY > 0 ? 1 : -1;
  }, { passive: false });

  window.Input = {
    isDown: (action) => !!down[action],
    wasPressed: (action) => !!pressed[action],
    mouse,
    endFrame() {
      for (const k in pressed) pressed[k] = false;
      mouse.pressed = false;
      mouse.rpressed = false;
      mouse.wheel = 0;
    },

    /* ── ⌨️ ĐỔI PHÍM (bảng setting ở menu) ── */
    binds: BINDS,
    DEFAULT_BINDS,

    /* Gán 1 phím cho 1 hành động. Phím trùng với hành động khác → GỠ khỏi đó
     * (không cho 2 hành động dùng chung 1 phím). Lưu localStorage ngay. */
    rebind(action, code) {
      if (!DEFAULT_BINDS[action] || !code) return false;
      for (const k in BINDS) {
        if (k === action) continue;
        const i = BINDS[k].indexOf(code);
        if (i !== -1) BINDS[k].splice(i, 1); // gỡ phím khỏi hành động cũ
      }
      BINDS[action] = [code];
      saveBinds();
      return true;
    },

    /* Trả mọi phím về mặc định */
    resetBinds() {
      for (const k in DEFAULT_BINDS) BINDS[k] = [...DEFAULT_BINDS[k]];
      saveBinds();
    },

    /* Mã phím → chữ đẹp để hiển thị (KeyA → A, Digit1 → 1, ArrowLeft → ←) */
    keyName(code) {
      if (!code) return '—';
      if (code.indexOf('Key') === 0) return code.slice(3);
      if (code.indexOf('Digit') === 0) return code.slice(5);
      if (code.indexOf('Numpad') === 0) return 'Num' + code.slice(6);
      const MAP = {
        Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB', Backquote: '`',
        Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';',
        Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
        ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
        ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT',
        ControlLeft: 'CTRL', ControlRight: 'CTRL',
        AltLeft: 'ALT', AltRight: 'ALT',
      };
      return MAP[code] || code.toUpperCase();
    },

    /* Tên phím ĐANG GÁN cho 1 hành động (lấy phím đầu) — để vẽ chữ gợi ý tự đúng theo bind */
    boundKey(action) {
      const arr = BINDS[action];
      return arr && arr.length ? this.keyName(arr[0]) : '—';
    },
  };
})();
