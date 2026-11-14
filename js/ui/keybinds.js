/* =========================================================
 * KEYSETTINGS — bảng ⌨️ PHÍM CHỨC NĂNG ở menu chính
 * Bấm vào ô phím → nhấn phím MỚI → gán ngay + lưu localStorage.
 * Phím trùng hành động khác → tự GỠ khỏi đó (1 phím = 1 việc).
 * Nút "Mặc định" trả toàn bộ về ban đầu. Escape = huỷ lượt học phím.
 * ========================================================= */
window.KeySettings = {
  el: null, list: null, listening: null, // hành động đang chờ nhấn phím mới

  /* tên hiển thị tiếng Việt + thứ tự sắp xếp */
  ORDER: [
    'left', 'right', 'jump', 'crouch', 'prone', 'reload', 'altfire', 'dash', 'grenade', 'pickup',
    'buy', 'guide', 'mute', 'pause',
    'slot0', 'slot1', 'slot2', 'slot3', 'slot4',
    'slot5', 'slot6', 'slot7', 'slot8', 'slot9',
  ],
  LABELS: {
    left: 'Chạy trái', right: 'Chạy phải',
    jump: 'Nhảy (×2 = nhảy đôi)', crouch: 'Ngồi thấp', prone: 'Nằm',
    reload: 'Nạp đạn', altfire: 'Bắn phụ (chuột phải / E)',
    dash: '🏃 Dash né đạn', grenade: '💣 Ném lựu đạn', pickup: 'Lụm súng / hộp đạn',
    buy: 'Cửa hàng (giữa wave)', guide: 'Đường ngắm',
    mute: 'Tắt / bật tiếng', pause: 'Tạm dừng',
    slot0: 'Súng ô 1', slot1: 'Súng ô 2', slot2: 'Súng ô 3', slot3: 'Súng ô 4',
    slot4: 'Súng ô 5', slot5: 'Súng ô 6', slot6: 'Súng ô 7', slot7: 'Súng ô 8',
    slot8: 'Súng ô 9', slot9: 'Súng ô 10',
  },

  init() {
    const $ = (id) => document.getElementById(id);
    this.el = $('keys');
    this.list = $('keysList');
    $('btnKeysReset').onclick = () => {
      AudioFX.click();
      Input.resetBinds();
      window.showToast && showToast('⌨️ Đã trả TẤT CẢ phím về mặc định');
      this.refresh();
    };
    $('btnKeysBack').onclick = () => { AudioFX.click(); this.hide(); Menu.show('menu'); };

    // bắt phím khi đang "học" — capture để chặn trước bộ nghe của Input
    window.addEventListener('keydown', (e) => this._onKey(e), true);

    this.refresh();
  },

  show() { this.refresh(); if (this.el) this.el.classList.remove('hidden'); },
  hide() { this.listening = null; if (this.el) this.el.classList.add('hidden'); },

  refresh() {
    if (!this.list) return;
    // chữ gợi ý ở menu/mẹo chơi tự đúng theo bind mới nhất
    window.Menu && Menu.refreshKeyHints && Menu.refreshKeyHints();
    this.list.innerHTML = '';
    for (const action of this.ORDER) {
      const row = document.createElement('div');
      row.className = 'krow' + (this.listening === action ? ' listening' : '');
      const codes = Input.binds[action] || [];
      const label = this.LABELS[action] || action;
      row.innerHTML =
        '<span class="klabel">' + label + '</span>' +
        '<button class="btn small kkey">' +
        (this.listening === action ? '⌨️ Nhấn phím...' : codes.map((c) => Input.keyName(c)).join(' / ') || '— CHƯA CÓ —') +
        '</button>';
      row.querySelector('button').onclick = () => {
        AudioFX.click();
        this.listening = this.listening === action ? null : action; // bấm lại = huỷ
        this.refresh();
      };
      this.list.appendChild(row);
    }
  },

  /* đang học phím → chờ phím kế tiếp */
  _onKey(e) {
    if (!this.listening) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') { this.listening = null; this.refresh(); return; } // huỷ
    if (e.repeat) return;

    const action = this.listening;
    // phím bị trùng? → báo luôn tên việc cũ nó đang làm
    let stolen = null;
    for (const k in Input.binds) {
      if (k !== action && Input.binds[k].indexOf(e.code) !== -1) stolen = this.LABELS[k] || k;
    }
    Input.rebind(action, e.code);
    AudioFX.reloadEnd(); // tiếng "chốt" vui tai
    window.showToast && showToast('⌨️ "' + Input.keyName(e.code) + '" → ' + this.LABELS[action] +
      (stolen ? ' (đã gỡ khỏi: ' + stolen + ')' : ''));
    this.listening = null;
    this.refresh();
  },
};
