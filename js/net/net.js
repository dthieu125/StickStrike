/* =========================================================
 * NET — nối mạng LAN 2 người (server relay là server.js chạy bằng Node)
 * • MÁY HOST: chạy toàn bộ mô phỏng (quái/wave/đạn/damage) — như chơi đơn,
 *   thêm: nhận PHÍM của bạn 2 đút vào người chơi 2, gửi SNAPSHOT ~20 lần/s
 * • MÁY GUEST: gửi phím + nhận snapshot → xây lại thế giới bằng CHÍNH
 *   các object/draw code sẵn có (không cần renderer riêng), đạn tự đà theo quán tính
 * • Tiện ích: Net.fx() gom hiệu ứng/tiếng → gửi sang máy kia phát lại
 * ========================================================= */
window.Net = {
  mode: 'off',        // 'off' | 'host' | 'guest'
  ws: null,
  peer: false,        // đã thấy máy kia (host: guest đã vào; guest: đã nối được host)
  status: '',
  localIdx: 0,        // máy mình điều khiển người chơi thứ mấy (host=0, guest=1)

  /* ── GOM EVENT hiệu ứng trong 1 frame (host) → gửi kèm snapshot ── */
  _fxQueue: [],
  fx(ev) {
    if (this.mode === 'host') this._fxQueue.push(ev);
  },

  /* ═══ KẾT NỐI ═══ */
  host() {
    this._reset('host');
    return this._open('ws://' + (location.hostname || 'localhost') + ':7331', 'host');
  },
  join(ip) {
    this._reset('guest');
    const addr = (ip || '').trim().replace(/^ws(s?):\/\//, '');
    if (!addr) return false;
    return this._open('ws://' + addr + ':7331', 'guest');
  },
  _reset(mode) {
    this.mode = mode; this.peer = false; this._fxQueue = [];
    this.localIdx = mode === 'host' ? 0 : 1;
    if (this.ws) { try { this.ws.close(); } catch (e) { /* bỏ qua */ } }
    this.ws = null;
  },
  _open(url, role) {
    try { this.ws = new WebSocket(url); } catch (e) { this.status = 'Lỗi: ' + e.message; return false; }
    this.status = 'Đang nối tới máy chủ...';
    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'hello', role }));
    this.ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'full') { this.status = '❌ Phòng đã đủ 2 người!'; this.mode = 'off'; return; }
      if (m.t === 'role') { this.status = role === 'host' ? '✅ Phòng đã mở — chờ bạn 2...' : '✅ Đã vào phòng — chờ máy chủ bắt đầu...'; return; }
      if (m.t === 'peer') { this.peer = true; if (window.showToast) showToast('👥 Bạn 2 đã vào phòng — chọn map rồi bấm SINH TỔN!'); return; }
      if (m.t === 'bye') { this.onDisconnect(); return; }
      if (this.onMsg) this.onMsg(m);
    };
    this.ws.onclose = () => { if (this.mode !== 'off') this.onDisconnect(); };
    this.ws.onerror = () => { this.status = '❌ Không nối được máy chủ — chạy node server.js chưa?'; };
    return true;
  },
  onDisconnect() {
    const wasInGame = this.peer && this.mode !== 'off';
    this.off();
    if (window.showToast && wasInGame) showToast('🔌 Mất kết nối mạng!');
    if (window.Menu && wasInGame) { window.Game && Game.toMenu(); Menu.show('menu'); }
  },
  off() {
    // báo máy kia mình đi rồi mới đứt (guest về menu / host đóng trận)
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify({ t: 'bye' })); } catch (e) { /* bỏ qua */ }
    }
    this.mode = 'off'; this.peer = false; this.status = ''; this._fxQueue = [];
    this._monMap = {}; this.snap = null;
    if (this.ws) { try { this.ws.close(); } catch (e) { /* bỏ qua */ } }
    this.ws = null; this.onMsg = null;
  },
  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  },

  /* ═══════════════════ BÊN HOST ═══════════════════ */

  /* input ẢNH của bạn 2 — cùng "hình dạng" với window.Input nên Player.update xài được */
  remoteInp: null,
  _snapT: 0,      // đồng hồ gửi snapshot
  _inT: 0,        // (guest) đồng hồ gửi input

  initRemoteInp() {
    this.remoteInp = {
      _down: {}, _pressed: {}, _prev: {},
      mouse: { x: 0, y: 0, down: false, pressed: false, rdown: false, rpressed: false, wheel: 0 },
      isDown(a) { return !!this._down[a]; },
      wasPressed(a) { return !!this._pressed[a]; },
      endFrame() { this._pressed = {}; this.mouse.pressed = false; this.mouse.rpressed = false; this.mouse.wheel = 0; },
    };
  },

  /* host nhận 1 gói input từ guest → cập nhật input ẢNH (bắt CẠNH phím) */
  applyRemoteInput(msg) {
    const r = this.remoteInp;
    if (!r) return;
    const A = msg.a;
    for (const k in A) {
      const v = !!A[k];
      r._pressed[k] = v && !r._prev[k]; // vừa nhấn = có giờ, không có trước đó
      r._prev[k] = v;
      r._down[k] = v;
    }
    const mx = msg.mx, my = msg.my;
    r.mouse.pressed = !!(msg.mp && !r._prevMP); r._prevMP = !!msg.mp;
    r.mouse.rpressed = !!(msg.rp && !r._prevRP); r._prevRP = !!msg.rp;
    r.mouse.down = !!msg.md; r.mouse.rdown = !!msg.rd;
    r.mouse.x = mx || 0; r.mouse.y = my || 0;
  },

  /* host tick mỗi frame: gửi snapshot đều ~20Hz + xả event đã gom */
  tickHost(dt) {
    this._snapT -= dt;
    if (this._snapT <= 0) {
      this._snapT = 0.05; // 20 lần/giây — LAN rất nhanh nên đủ mượt
      const snap = this.buildSnap();
      snap.fx = this._fxQueue;
      this._fxQueue = [];
      this.send(snap);
    }
  },

  /* ═══ SNAPSHOT — "ảnh chụp" thế giới của host để máy guest dựng lại ═══
   * Chụp ĐỦ thứ guest cần để vẽ: camera, wave/bản đồ, modifier, tiệm,
   * người chơi (kể cả túi tiền/gear/đang được cứu), quái theo id,
   * vệt đạn + đạn bay, đồ lụm/vật thể, rồi hàng hiệu ứng đang gom. */
  _monSeq: 0,

  /* gom 1 object thành "dữ liệu trần" — bỏ HẲN hàm/method, Set→mảng, ∞→-1 */
  _snapObj(o) {
    const out = {};
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'function' || k[0] === '_') continue; // method + biến nội bộ
      if (v instanceof Set) out[k] = Array.from(v);
      else if (v === Infinity) out[k] = -1;
      else if (Array.isArray(v)) out[k] = v.map((x) => (x === Infinity ? -1 : x));
      else if (v && typeof v === 'object') {
        out[k] = (v instanceof Set) ? Array.from(v)
          : { ...v }; // object nhỏ (muzzle/mouseW/gear) — chép nông là đủ
      } else out[k] = v;
    }
    return out;
  },

  buildSnap() {
    const snap = {
      t: 'snap',
      cam: { x: Camera.x, y: Camera.y },
      wave: {
        state: Wave.state, num: Wave.num, timer: Wave.timer,
        score: Wave.score, kills: Wave.kills, over: Wave.over,
        bossCleared: Wave.bossCleared, nodeOpen: Wave.nodeOpen, resting: Wave.resting,
      },
      event: Wave.event ? Wave.event.id : null,
      nodes: Wave.nextNodes ? Wave.nextNodes.map((n) => ({ ...n })) : null,
      offers: Wave.offers ? Wave.offers.map((o) => ({ ...o })) : null,
      shopOpen: !!(window.Shop && Shop.open),
      players: Player.list.map((p) => this._snapObj(p)),
      monsters: Monsters.list.map((m) => {
        if (!m._netId) m._netId = 'm' + (++this._monSeq);
        const s = this._snapObj(m);
        s.id = m._netId; // guest ghép quái theo id này
        delete s.lastHitBy; // tham chiếu entity — không gửi được (guest tự tính lại)
        return s;
      }),
      tracers: Bullets.tracers.map((tr) => ({ ...tr })),
      proj: Bullets.projectiles.map((b) => ({
        x: b.x, y: b.y, vx: b.vx, vy: b.vy, g: b.g || 0, dist: b.dist || 0,
        angle: b.angle || 0, team: b.shooterTeam, id: b.w.id, acid: !!b.w.acid,
      })),
      pickups: (window.Pickups ? Pickups.list.map((pk) => ({
        x: Math.round(pk.x * 10) / 10, y: Math.round(pk.y * 10) / 10,
        kind: pk.kind, amount: pk.amount || 0,
        wId: pk.w ? pk.w.id : null, taken: !!pk.taken,
        respawnT: Math.round((pk.respawnT || 0) * 10) / 10, bob: pk.bob || 0,
      })) : []),
      props: (window.Props ? Props.list.map((pr) => ({
        type: pr.type, x: pr.x, baseY: pr.baseY, w: pr.w, h: pr.h,
        hp: pr.hp, maxHp: pr.maxHp, gone: !!pr.gone, shake: Math.round((pr.shake || 0) * 100) / 100,
      })) : []),
    };
    return snap;
  },

  /* ═══════════════════ BÊN GUEST ═══════════════════ */
  snap: null,        // snapshot mới nhất (chưa áp)

  /* guest tick: gửi input ~30Hz + áp snapshot mới (nếu có) */
  tickGuest(dt) {
    this._inT -= dt;
    if (this._inT <= 0 && window.Input) {
      this._inT = 1 / 30;
      const inp = Input;
      this.send({
        t: 'in',
        a: {
          left: inp.isDown('left'), right: inp.isDown('right'), jump: inp.isDown('jump'),
          crouch: inp.isDown('crouch'), prone: inp.isDown('prone'), reload: inp.isDown('reload'),
          pickup: inp.isDown('pickup'), altfire: inp.isDown('altfire'),
          dash: inp.isDown('dash'), grenade: inp.isDown('grenade'), buy: inp.isDown('buy'),
        },
        mx: Math.round(inp.mouse.x), my: Math.round(inp.mouse.y),
        md: inp.mouse.down, mp: inp.mouse.pressed,
        rd: inp.mouse.rdown, rp: inp.mouse.rpressed,
      });
    }
    if (this.snap) { this._applySnap(this.snap); this.snap = null; }
  },

  /* ÁP snapshot: ghi đè dữ liệu vào các entity đã tạo — draw code dùng lại nguyên xi */
  _applySnap(s) {
    const P = window.Player, M = window.Monsters, W = window.Wave, B = window.Bullets;
    if (!P || !M || !W || !B) return;

    /* camera: máy guest dùng NGUYÊN camera máy host (toạ độ chuột đổi ra world đúng) */
    if (window.Camera) { Camera.x = s.cam.x; Camera.y = s.cam.y; }
    if (window.Level) { Level.camX = s.cam.x; Level.camY = s.cam.y; }

    /* ── người chơi ── */
    this._applyPlayers(s.players);

    /* ── Wave + bản đồ node + modifier + cửa hàng ── */
    W.state = s.wave.state; W.num = s.wave.num; W.timer = s.wave.timer;
    W.score = s.wave.score; W.kills = s.wave.kills;
    W.over = s.wave.over; W.bossCleared = s.wave.bossCleared;
    W.nodeOpen = s.wave.nodeOpen; W.resting = s.wave.resting;
    W.event = s.event ? W.EVENTS.find((e) => e.id === s.event) || null : null;
    W.nextNodes = s.nodes || null;
    W.offers = s.offers || null;
    if (window.Shop) Shop.open = !!s.shopOpen;

    /* ── quái: map theo id — mới thì tạo, mất thì gỡ ── */
    const seen = new Set();
    for (const sm of s.monsters) {
      seen.add(sm.id);
      let m = this._monMap[sm.id];
      if (!m) {
        m = Monsters.spawn(sm.type, sm.x + sm.w / 2, sm.y + sm.h, 0); // tạo đúng "hình dạng" object
        this._monMap[sm.id] = m;
        m._netId = sm.id;
      }
      this._copyFields(m, sm);
      if (m.dead) m.deadT = Math.max(m.deadT || 0, sm.deadT || 0);
    }
    for (let i = M.list.length - 1; i >= 0; i--) {
      const m = M.list[i];
      if (m._netId && !seen.has(m._netId)) {
        Combatants.unregister(m);
        M.list.splice(i, 1);
        delete this._monMap[m._netId];
      }
    }

    /* ── đạn: tia = vệt vẽ ngay · đạn bay = tái tạo + tự đà theo quán tính ── */
    B.tracers = s.tracers || [];
    B.projectiles = (s.proj || []).map((pb) => ({
      x: pb.x, y: pb.y, vx: pb.vx, vy: pb.vy, g: pb.g || 0,
      dist: pb.dist || 0, angle: pb.angle || 0, shooterTeam: pb.team || 'M',
      w: { id: pb.id, kind: 'proj', acid: pb.acid || false, projSpeed: Math.hypot(pb.vx, pb.vy) || 1 },
      _viewOnly: true,
    }));

    /* ── đồ rải: host rải NGẪU NHIÊN → guest XÂY LẠI nguyên danh sách từ snapshot ── */
    if (window.Pickups) {
      Pickups.list = (s.pickups || []).map((pk) => ({
        x: pk.x, y: pk.y, kind: pk.kind, amount: pk.amount,
        w: pk.wId ? Weapons.list.find((w) => w.id === pk.wId) : null,
        taken: !!pk.taken, respawnT: pk.respawnT || 0, bob: pk.bob || 0,
      }));
      Pickups.health = []; // wave không dùng túi máu (DM chưa chơi qua mạng)
    }
    if (window.Props) {
      Props.list = (s.props || []).map((pr) => ({
        type: pr.type, x: pr.x, baseY: pr.baseY, w: pr.w, h: pr.h,
        hp: pr.hp, maxHp: pr.maxHp, gone: !!pr.gone, shake: pr.shake || 0,
      }));
    }

    /* ── hiệu ứng/tiếng/tost gom từ host ── */
    if (s.fx && s.fx.length) this._playFx(s.fx);
  },

  /* ghi đè an toàn: chỉ các TRƯỜNG dữ liệu có trong bản chụp */
  _copyFields(dst, src) {
    for (const k in src) {
      if (k === 'id') continue;
      dst[k] = src[k];
    }
  },

  _applyPlayers(pls) {
    /* guest dùng CHÍNH Player.list (2 entity người que đã tạo khi nhận 'start') */
    for (let i = 0; i < Player.list.length && i < pls.length; i++) {
      const v = Player.list[i];
      const sp = pls[i];
      this._copyFields(v, sp);
      // Set kho súng + mảng ∞ cần "giải mã" lại
      if (sp.owned) v.owned = new Set(sp.owned);
      if (sp.spare) v.spare = sp.spare.map((x) => (x === -1 ? Infinity : x));
      if (sp.mags) v.mags = sp.mags.slice();
    }
  },

  /* phát lại hiệu ứng host gửi sang (tiếng nổ/tost/vàng/...) */
  _playFx(list) {
    for (const ev of list) {
      if (ev.k === 'boom') {
        Particles.explosion(ev.x, ev.y, ev.r); // nổ lại y hệt (máy host tự thấy rồi)
        Camera.addShake(ev.shake || 4);
        AudioFX.explode();
      } else if (ev.k === 'toast') {
        window.showToast && showToast(ev.s);
      } else if (ev.k === 'gold') {
        window.Gold && Gold.add(ev.v);
        window.showToast && showToast('💰 +' + ev.v + ' vàng tích luỹ (Market)');
      } else if (ev.k === 'poof') {
        Particles.poof(ev.x, ev.y);
      } else if (ev.k === 'gear') {
        // độ bền khiên của MÌNH thay đổi trên máy host → lưu lại vào Market của mình
        if (window.Gear && Gear.state) { Gear.state.shield = ev.shield; Gear.save(); }
      } else if (ev.k === 'shot') {
        AudioFX.shot && AudioFX.shot(ev.w);
      } else if (ev.k === 'hit') {
        Particles.blood(ev.x, ev.y, ev.a || 0, 5, ev.c || '#e23b3b');
        AudioFX._tone && AudioFX._tone(220, 90, 0.08, 'square', 0.06);
      }
    }
  },

  _monMap: {},
};
