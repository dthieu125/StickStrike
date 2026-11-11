/* =========================================================
 * AUDIO — âm thanh TỰ TỔNG HỢP bằng Web Audio API
 * Không cần file mp3 nào: tiếng súng = hơi Noise + sóng âm (tone)
 * trộn với nhau, mỗi loại súng một "công thức".
 *
 * Lưu ý trình duyệt: phải có 1 cú click chuột đầu tiên mới được phép
 * phát tiếng → AudioFX.ensure() được gọi lúc bạn nhấn chuột.
 * ========================================================= */
window.AudioFX = {
  ctx: null,
  master: null,
  noiseBuf: null,
  muted: false,

  // gọi khi có cú click đầu tiên
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // tạo sẵn 1 giây nhiễu trắng, dùng lại cho mọi tiếng "nổ"
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    if (!this.master) return;
    this.muted = !this.muted;
    this.master.gain.value = this.muted ? 0 : 0.5;
  },

  /* hơi nhiễu trắng qua filter — dùng cho tiếng giật/nổ */
  _noise(dur, freq, filterType, gain, delay) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (delay || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType || 'highpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  },

  /* sóng âm trượt tần số f0 → f1 — dùng cho tiếng "thụp", zap */
  _tone(f0, f1, dur, type, gain, delay) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  // công thức tiếng theo từng loại súng (pitch xê dịch chút cho đỡ lặp)
  shot(kind) {
    const v = 0.94 + Math.random() * 0.12; // biến thể cao độ ngẫu nhiên
    switch (kind) {
      case 'pistol':
        this._noise(0.09, 1400 * v, 'highpass', 0.22);
        this._tone(190 * v, 60, 0.09, 'triangle', 0.25);
        break;
      case 'revolver':
        this._noise(0.16, 900 * v, 'highpass', 0.32);
        this._tone(140 * v, 45, 0.16, 'triangle', 0.4);
        this._tone(60, 40, 0.22, 'sine', 0.3);
        break;
      case 'smg':
        this._noise(0.05, 1800 * v, 'highpass', 0.14);
        this._tone(240 * v, 90, 0.05, 'square', 0.1);
        break;
      case 'minigun':
        this._noise(0.06, 1200 * v, 'highpass', 0.16);
        this._tone(180 * v, 70, 0.06, 'sawtooth', 0.12);
        break;
      case 'rifle':
        this._noise(0.11, 1000 * v, 'highpass', 0.26);
        this._tone(150 * v, 55, 0.11, 'triangle', 0.3);
        break;
      case 'shotgun':
        this._noise(0.3, 420 * v, 'lowpass', 0.55);
        this._tone(95 * v, 35, 0.28, 'sine', 0.5);
        this._noise(0.08, 2500 * v, 'highpass', 0.2);
        break;
      case 'sniper':
        this._noise(0.35, 700 * v, 'lowpass', 0.5);
        this._tone(110 * v, 30, 0.35, 'sine', 0.45);
        this._noise(0.12, 3000 * v, 'highpass', 0.15, 0.02);
        break;
      case 'rail':
        this._tone(1500 * v, 90, 0.3, 'sawtooth', 0.22);
        this._tone(2200 * v, 140, 0.25, 'sine', 0.15);
        this._noise(0.2, 2600, 'highpass', 0.12);
        break;
      case 'rocket':
        this._noise(0.4, 600 * v, 'lowpass', 0.35);
        this._tone(120 * v, 320, 0.35, 'sawtooth', 0.15); // tiếng tên lửa hú đi
        break;
      case 'plasma':
        this._tone(880 * v, 120, 0.16, 'square', 0.16);
        this._tone(1760 * v, 240, 0.12, 'sine', 0.1);
        this._noise(0.06, 3200, 'highpass', 0.06);
        break;
    }
  },

  explode() {
    this._noise(0.55, 220, 'lowpass', 0.65);
    this._tone(85, 28, 0.55, 'sine', 0.55);
    this._noise(0.15, 900, 'bandpass', 0.2);
  },

  hit(head) {
    if (head) this._tone(620, 210, 0.08, 'square', 0.14);
    else this._tone(330, 130, 0.06, 'square', 0.1);
    this._noise(0.045, 2600, 'highpass', 0.09);
  },

  kill() {
    this._tone(300, 60, 0.25, 'sawtooth', 0.2);
    this._noise(0.2, 800, 'bandpass', 0.2);
  },

  reloadStart() { this._tone(500, 380, 0.06, 'square', 0.09); this._tone(380, 500, 0.06, 'square', 0.09, 0.18); },
  reloadEnd() { this._tone(700, 900, 0.05, 'square', 0.1); },
  heal() { this._tone(520, 780, 0.09, 'sine', 0.1); this._tone(780, 1040, 0.09, 'sine', 0.08, 0.09); }, // ❤️ chime dịu
  empty() { this._tone(320, 260, 0.05, 'square', 0.08); },
  click() { this._tone(1100, 850, 0.035, 'square', 0.06); },
  hurt() { this._tone(220, 90, 0.12, 'sawtooth', 0.16); },

  /* ── NHẠC NỀN VŨ TRỤ — tự sinh: drone trầm + giai điệu ngũ cung nhẹ ── */
  _musicTimer: null,
  _musicStep: 0,
  musicOn: false,

  startMusic() {
    if (this.musicOn) return;
    this.musicOn = true;
    // drone nền: 2 sóng trầm lệch nhau, ù ù như đang bay trong khoang tàu
    const drone1 = this.ctx.createOscillator();
    const drone2 = this.ctx.createOscillator();
    const dg = this.ctx.createGain();
    drone1.frequency.value = 55; drone2.frequency.value = 55.7; // lệch nhẹ → sóng đẹp
    drone1.type = 'sine'; drone2.type = 'triangle';
    dg.gain.value = 0.028;
    drone1.connect(dg); drone2.connect(dg); dg.connect(this.master);
    drone1.start(); drone2.start();
    this._drones = [drone1, drone2];

    // giai điệu ngũ cung A nhỏ, mỗi 0.46s một nốt, thỉnh thoảng im lặng
    const NOTES = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];
    const beat = () => {
      if (!this.musicOn) return;
      if (Math.random() < 0.82) {
        const n = NOTES[Math.floor(Math.random() * NOTES.length)];
        const oct = Math.random() < 0.25 ? 0.5 : 1;
        this._tone(n * oct, n * oct * 0.995, 0.9, 'triangle', 0.03);
        if (Math.random() < 0.3) this._tone(n * 2 * oct, n * 2 * oct, 0.5, 'sine', 0.015, 0.23); // bóng treo
      }
      this._musicTimer = setTimeout(beat, 460);
    };
    beat();
  },

  stopMusic() {
    this.musicOn = false;
    if (this._musicTimer) { clearTimeout(this._musicTimer); this._musicTimer = null; }
    if (this._drones) { this._drones.forEach((d) => d.stop()); this._drones = null; }
  },
};
