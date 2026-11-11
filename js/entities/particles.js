/* =========================================================
 * PARTICLES — hạt hiệu ứng: tia lửa, vỏ đạn, khói, số damage,
 * vòng xung kích nổ... Mọi thứ "juice" của game đi qua đây.
 * ========================================================= */
window.Particles = {
  list: [],

  MAX: 450, // trần số hạt — quá trần thì xả hạt CŨ NHẤT (pooling-lite, giữ 60 FPS)

  add(p) {
    p.maxLife = p.life;
    this.list.push(p);
    if (this.list.length > this.MAX) this.list.splice(0, this.list.length - this.MAX);
  },

  /* tia lửa văng theo hướng dir */
  sparks(x, y, dir, n, color) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * 1.6;
      const sp = 60 + Math.random() * 260;
      this.add({
        type: 'dot', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.2 + Math.random() * 0.25, size: 1.2 + Math.random() * 1.6,
        color, gravity: 900,
      });
    }
  },

  smoke(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.add({
        type: 'smoke', x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30,
        life: 0.4 + Math.random() * 0.3, size: 3 + Math.random() * 4,
        gravity: -70,
      });
    }
  },

  /* vỏ đạn văng vuông góc nòng súng, nảy trên sàn */
  shell(x, y, angle) {
    const a = angle - Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    this.add({
      type: 'shell', x, y,
      vx: Math.cos(a) * (90 + Math.random() * 90), vy: -110 - Math.random() * 100,
      rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 22,
      life: 1.1, gravity: 1500,
    });
  },

  text(x, y, str, color, size) {
    this.add({ type: 'text', x, y, vx: 0, vy: -55, life: 0.8, size: size || 13, color, str, gravity: -25 });
  },

  /* vụ nổ: chớp sáng + vòng xung kích + lửa + khói */
  explosion(x, y, r) {
    this.add({ type: 'flash', x, y, vx: 0, vy: 0, life: 0.14, size: r * 0.85 });
    this.add({ type: 'ring', x, y, vx: 0, vy: 0, life: 0.38, size: r * 1.25 });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 340;
      this.add({
        type: 'dot', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.3 + Math.random() * 0.4, size: 1.5 + Math.random() * 2.5,
        color: Math.random() < 0.5 ? '#ffb347' : '#ff7043', gravity: 700,
      });
    }
    this.smoke(x, y, 7);
  },

  /* máu văng — màu tuỳ loại "thịt" (đỏ người, xanh lá quái...) */
  blood(x, y, dir, n, color) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * 1.1;
      const sp = 40 + Math.random() * 220;
      this.add({
        type: 'dot', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.3 + Math.random() * 0.35, size: 1.5 + Math.random() * 2.5,
        color, gravity: 1000,
      });
    }
  },

  /* bụi khói khi bia nổ hỏng */
  poof(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 150;
      this.add({
        type: 'dot', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.4 + Math.random() * 0.3, size: 2 + Math.random() * 3,
        color: '#f8b4a0', gravity: 500,
      });
    }
    this.smoke(x, y, 4);
  },

  /* vệt sau đạn bay (tên lửa để khói, plasma để chấm sáng) */
  trail(x, y, w) {
    if (w.id === 'plasma') {
      this.add({
        type: 'dot', x: x - (Math.random() - 0.5) * 4, y: y - (Math.random() - 0.5) * 4,
        vx: 0, vy: 0, life: 0.22, size: 2.5, color: '#54e0ff', gravity: 0,
      });
    } else {
      this.add({
        type: 'smoke', x, y,
        vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
        life: 0.35, size: 2.5 + Math.random() * 2, gravity: -50,
      });
    }
  },

  update(dt) {
    const T = Level.T;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }

      // phòng thủ: hạt thiếu vx/vy/gravity vẫn tính được (tránh NaN làm vỡ canvas)
      p.vx = p.vx || 0;
      p.vy = p.vy || 0;
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'shell') {
        p.rot += p.vrot * dt;
        // vỏ đạn chạm sàn thì nảy (kiểm tra ô map dưới chân)
        if (p.vy > 0 && Level.isSolid(Level.tileAt(Math.floor(p.x / T), Math.floor((p.y + 2) / T)))) {
          p.vy *= -0.42; p.vx *= 0.7; p.vrot *= 0.6;
          if (Math.abs(p.vy) < 40) { p.vy = 0; p.vrot = 0; }
        }
      }
    }
  },

  draw(ctx) {
    for (const p of this.list) {
      const q = p.life / p.maxLife; // 1 → 0, dùng làm độ mờ
      switch (p.type) {
        case 'dot':
          ctx.globalAlpha = q;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case 'smoke':
          ctx.globalAlpha = q * 0.35;
          ctx.fillStyle = '#9aa3b2';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - q) * 6, 0, Math.PI * 2); ctx.fill();
          break;
        case 'shell':
          ctx.globalAlpha = Math.min(1, q * 3);
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = '#e8c15a';
          ctx.fillRect(-2.5, -1.2, 5, 2.4);
          ctx.restore();
          break;
        case 'text':
          ctx.globalAlpha = Math.min(1, q * 2);
          ctx.font = `700 ${p.size}px "Segoe UI", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.strokeText(p.str, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.str, p.x, p.y);
          ctx.textAlign = 'left';
          break;
        case 'flash': {
          ctx.globalAlpha = q;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, 'rgba(255,255,230,0.95)');
          g.addColorStop(0.5, 'rgba(255,180,80,0.7)');
          g.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'ring':
          ctx.globalAlpha = q * 0.8;
          ctx.strokeStyle = '#ffd9a0';
          ctx.lineWidth = 2 + q * 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - q) + 4, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;
  },
};
