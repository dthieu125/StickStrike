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
  const mouse = { x: 640, y: 360, down: false, pressed: false, wheel: 0 };

  const BINDS = {
    left:    ['KeyA', 'ArrowLeft'],
    right:   ['KeyD', 'ArrowRight'],
    jump:    ['KeyW', 'Space', 'ArrowUp'],
    crouch:  ['KeyS', 'ArrowDown'],
    reload:  ['KeyR'],
    pickup:  ['KeyG'],
    mute:    ['KeyM'],
    guide:   ['KeyT'],
    buy:     ['KeyB'],
    pause:   ['Escape'],
    slot0:   ['Digit1'], slot1: ['Digit2'], slot2: ['Digit3'], slot3: ['Digit4'],
    slot4:   ['Digit5'], slot5: ['Digit6'], slot6: ['Digit7'], slot7: ['Digit8'],
    slot8:   ['Digit9'], slot9: ['Digit0'],
  };

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
    if (e.button !== 0) return; // chỉ chuột trái
    mouse.down = true;
    mouse.pressed = true;
    if (window.AudioFX) AudioFX.ensure(); // trình duyệt cần 1 cú click mới cho phát tiếng
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
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
      mouse.wheel = 0;
    },
  };
})();
