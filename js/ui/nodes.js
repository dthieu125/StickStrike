/* =========================================================
 * NODES — 🗺️ BẢN ĐỒ CHỌN ĐƯỜNG (roguelite, kiểu Slay the Spire)
 * Dọn 1 wave → panel hiện 2-3 LÁ → bấm 1/2/3 hoặc CLICK chọn:
 *   ⚔️ battle · 👹 elite · 🏪 shop · ❤️ reward · 👑 boss
 * Logic nằm ở Wave (_buildNodes/chooseNode) — file này chỉ là DOM.
 * ========================================================= */
window.Nodes = {
  el: null,
  listEl: null,

  init() {
    this.el = document.getElementById('nodePanel');
    this.listEl = document.getElementById('nodeList');
    if (!this.el || !this.listEl) return;
    this.el.classList.add('hidden'); // ẩn mặc định
  },

  show() {
    if (!this.el) return;
    this.el.classList.remove('hidden');
    this.refresh();
  },

  hide() {
    if (this.el) this.el.classList.add('hidden');
  },

  /* vẽ lại các lá theo Wave.nextNodes */
  refresh() {
    if (!this.listEl || !window.Wave || !Wave.nextNodes) return;
    this.listEl.innerHTML = '';
    Wave.nextNodes.forEach((n, i) => {
      const card = document.createElement('button');
      card.className = 'node-card n' + n.t;
      card.innerHTML =
        '<span class="nkey">' + (i + 1) + '</span>' +
        '<span class="nicon">' + n.icon + '</span>' +
        '<span class="nname">' + n.name + '</span>' +
        '<span class="ndesc">' + n.desc + '</span>';
      card.onclick = () => {
        // 🌐 co-op: máy guest KHÔNG tự chọn — gửi yêu cầu sang máy host xử lý
        if (window.Net && Net.mode === 'guest') Net.send({ t: 'node', i });
        else Wave.chooseNode(i);
      };
      this.listEl.appendChild(card);
    });
  },
};
