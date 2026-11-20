/* =========================================================
 * HAZARDS — ☠️ nguy hiểm CỐ ĐỊNH đọc từ mapDef.hazards
 * Mỗi map khai báo mảng `hazards`, ví dụ:
 *   hazards: [ { kind: 'gas', c: 12 }, { kind: 'zap', c: 30, c2: 34 } ]
 *   • gas: ống ga nằm ở cột ô `c` → mây độc quanh ống, đốt máu DẦN
 *   • zap: 2 cột điện ở cột `c` và `c2` → tích điện (tia lửa báo trước)
 *     rồi phóng tia ngang giữa 2 cột, dính là ăn đòn NGAY
 * Deterministic: cả 2 máy đọc cùng mapDef → tự dựng GIỐNG nhau
 * (không cần đồng bộ qua mạng).
 * Damage:
 *   • người chơi → takeDamage (knockback nhẹ, vì thế đốt theo TICK 0.5s
 *     tích luỹ chứ không trừ từng frame);
 *   • quái/bot → hit(dmg,false,hx,hy,'M') — team 'M' nên KHÔNG ai được
 *     điểm match khi hazard giết hộ (no foul).
 * ========================================================= */
window.Hazards = {
  list: [],

  clear() { this.list.length = 0; },

  /* đọc mapDef.hazards → dựng danh sách hazard với toạ độ px + mặt đất.
   * Ô cột phải TRỐNG 2 ô ngay trên mặt đất (ống cao 46px) — không cắm vào bê tông! */
  spawnForMap(mapDef) {
    this.clear();
    const dc = Level.colOffset || 0; // 🪟 map nới 2 bên → cột hazard dời theo
    const clearAbove = (c, baseY) => {
      const r0 = baseY / Level.T - 1;
      return Level.tileAt(c, r0) === '.' && Level.tileAt(c, r0 - 1) === '.';
    };
    for (const h of (mapDef.hazards || [])) {
      const c = h.c + dc;
      const floorY = this._floorTop(c);
      if (floorY >= Level.pxH || !clearAbove(c, floorY)) continue; // cột không có chỗ trống → bỏ qua
      if (h.kind === 'gas') {
        this.list.push({
          kind: 'gas', x: c * Level.T + Level.T / 2, y: floorY,
          t: Math.random() * 2,          // lệch pha giữa các ống cho đỡ đồng loạt
          dmgT: 0,                        // đồng hồ tick sát thương 0.5s
          active: false,                  // đang phóng mây không?
        });
      } else if (h.kind === 'zap' && h.c2 != null) {
        const c2 = h.c2 + dc;
        const floorY2 = this._floorTop(c2);
        if (floorY2 >= Level.pxH || !clearAbove(c2, floorY2)) continue;
        this.list.push({
          kind: 'zap', x1: c * Level.T + Level.T / 2, x2: c2 * Level.T + Level.T / 2,
          y1: floorY, y2: floorY2,
          t: Math.random() * 1,           // lệch pha
          prevPh: 0, struck: false,       // đã trúng đòn đợt phóng này chưa
        });
      }
    }
    return this.list.length;
  },

  /* Mặt đất của cột ô c (soi xuống tìm ô đặc ĐẦU TIÊN từ dưới lên — như Trees._baseYAt) */
  _floorTop(c) {
    for (let r = Level.rows - 2; r >= 0; r--) {
      if (Level.isSolid(Level.tileAt(c, r))) return r * Level.T;
    }
    return Level.pxH;
  },

  /* Chỗ nào đang NGUY HIỆM? (người chơi đứng trong mây độc → viền xanh lá) */
  gasAt(px, py) {
    const G = Config.HAZARD.GAS;
    for (const h of this.list) {
      if (h.kind !== 'gas' || !h.active) continue;
      const dy = (h.y - py) * 0.55; // mây hơi dẹt — cao trên mặt đất ngắn hơn chút
      if (Math.hypot(h.x - px, dy) < G.RADIUS) return true;
    }
    return false;
  },

  update(dt) {
    const G = Config.HAZARD.GAS, Z = Config.HAZARD.ZAP;
    const targets = this._targets();
    for (const h of this.list) {
      if (h.kind === 'gas') {
        /* chu kỳ: NGHỈ → PHÓNG mây (EMIT giây) → nghỉ... */
        h.t += dt;
        const ph = h.t % G.PERIOD;
        h.active = ph < G.EMIT;
        if (!h.active) continue;
        /* đốt máu theo TICK 0.5s (không trừ từng frame → không loạn knockback) */
        h.dmgT -= dt;
        if (h.dmgT <= 0) {
          h.dmgT = G.TICK;
          const dmgTick = G.DMG * G.TICK;
          for (const e of targets) {
            const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
            const dy = (h.y - cy) * 0.55;
            if (Math.hypot(h.x - cx, dy) < G.RADIUS) {
              if (e.team === 'P' || e.team === 'A' || e.team === 'B') {
                e.takeDamage(dmgTick, h.x);
              } else if (e.hit) {
                e.hit(dmgTick, false, cx, cy, 'M'); // team 'M' → không ai được điểm
              }
            }
          }
        }
      } else if (h.kind === 'zap') {
        /* chu kỳ: NGHỈ → TÍCH ĐIỆN (CHARGE, tia lửa báo trước) → PHÓNG (ON) */
        h.prevPh = h.t % Z.PERIOD;
        h.t += dt;
        const ph = h.t % Z.PERIOD;
        /* vừa VƯỢT mốc CHARGE → PHÓNG TIA NGAY: trúng 1 lần/đợt */
        if (h.prevPh < Z.CHARGE && ph >= Z.CHARGE) {
          h.struck = false;
        }
        const on = ph >= Z.CHARGE && ph < Z.CHARGE + Z.ON;
        if (on && !h.struck) {
          h.struck = true;
          const beamY = Math.min(h.y1, h.y2) - 38;
          const lo = Math.min(h.x1, h.x2), hi = Math.max(h.x1, h.x2);
          for (const e of targets) {
            const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
            if (cx > lo - 10 && cx < hi + 10 && Math.abs(cy - beamY) < Z.BEAM_HALF + e.h / 2) {
              if (e.team === 'P' || e.team === 'A' || e.team === 'B') {
                e.takeDamage(Z.DMG, (h.x1 + h.x2) / 2);
              } else if (e.hit) {
                e.hit(Z.DMG, false, cx, cy, 'M');
              }
            }
          }
        }
      }
    }
  },

  /* mọi thứ có thể dính hazard: người chơi + quái + bot */
  _targets() {
    const out = [];
    for (const pl of Player.list) {
      if (!pl.dead && pl.hp > 0) out.push(pl);
    }
    for (const m of Monsters.list) if (!m.dead && m.hp > 0) out.push(m);
    if (window.Bots) for (const b of Bots.list) {
      if (!b.dead && b.hp > 0 && !out.includes(b)) out.push(b);
    }
    return out;
  },

  draw(ctx, time) {
    const G = Config.HAZARD.GAS, Z = Config.HAZARD.ZAP;
    for (const h of this.list) {
      if (h.kind === 'gas') {
        const ph = h.t % G.PERIOD;
        const on = ph < G.EMIT;
        /* ống ga cắm dưới đất — màu đồng xỉn */
        ctx.fillStyle = '#7a5c3a';
        ctx.fillRect(h.x - 6, h.y - 40, 12, 40);
        ctx.fillStyle = '#9c7a4e';
        ctx.fillRect(h.x - 6, h.y - 40, 4, 40);
        /* miệng ống: nghỉ = tối · phóng = sáng độc */
        ctx.fillStyle = on ? '#9dff5c' : '#3a4a2a';
        ctx.fillRect(h.x - 8, h.y - 46, 16, 7);
        if (on) {
          /* mây độc: 3 lớp tròn mờ nhấp nhô */
          const life = ph / G.EMIT;                     // 0..1 trong đợt phóng
          const a = Math.min(1, life * 3) * (0.30 + 0.10 * Math.sin(time * 3 + h.t));
          const r = G.RADIUS * Math.min(1, 0.35 + life * 0.9);
          for (let i = 0; i < 3; i++) {
            const ox = Math.sin(time * 1.7 + i * 2.1) * 18;
            const oy = -8 - i * 16;
            const rr = r * (0.85 - i * 0.18);
            const g = ctx.createRadialGradient(h.x + ox, h.y - 20 + oy, 4, h.x + ox, h.y - 20 + oy, rr);
            g.addColorStop(0, `rgba(130,255,90,${(a * 0.5).toFixed(2)})`);
            g.addColorStop(1, 'rgba(130,255,90,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(h.x + ox, h.y - 20 + oy, rr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (h.kind === 'zap') {
        const ph = h.t % Z.PERIOD;
        const charging = ph >= Z.CHARGE * 0.55 && ph < Z.CHARGE; // 0.55×CHARGE → nửa sau mới có tia lửa
        const on = ph >= Z.CHARGE && ph < Z.CHARGE + Z.ON;
        /* 2 cột điện */
        for (const px of [h.x1, h.x2]) {
          ctx.fillStyle = '#5a6b80';
          ctx.fillRect(px - 3, (px === h.x1 ? h.y1 : h.y2) - 62, 6, 62);
          ctx.fillStyle = '#8fa5c0';
          ctx.fillRect(px - 3, (px === h.x1 ? h.y1 : h.y2) - 62, 2, 62);
          /* đầu cột (nam châm) */
          ctx.fillStyle = on ? '#ffe066' : charging ? '#ffcc55' : '#3d4a5c';
          ctx.fillRect(px - 7, (px === h.x1 ? h.y1 : h.y2) - 68, 14, 7);
        }
        if (charging) {
          /* TIA LỬA báo trước quanh 2 đầu cột — sắp phóng, né khỏi dải giữa! */
          const a = 0.4 + 0.5 * Math.abs(Math.sin(time * 20));
          for (const px of [h.x1, h.x2]) {
            const py = (px === h.x1 ? h.y1 : h.y2) - 64;
            Particles.sparks(px, py, -90, 2, '#ffe066');
            ctx.strokeStyle = `rgba(255,224,102,${(a * 0.6).toFixed(2)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(px, py, 6 + Math.sin(time * 16) * 2, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (on) {
          /* TIA ĐIỆN ngang giữa 2 cột — răng cưa loang loáng */
          const beamY = Math.min(h.y1, h.y2) - 38;
          const lo = Math.min(h.x1, h.x2), hi = Math.max(h.x1, h.x2);
          ctx.save();
          ctx.strokeStyle = '#9df2ff';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#7df3ff';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(lo, beamY);
          const seg = 6;
          for (let x = lo + (hi - lo) / seg, i = 1; x < hi; x += (hi - lo) / seg, i++) {
            ctx.lineTo(x, beamY + (i % 2 ? -7 : 7) * (0.5 + Math.random() * 0.5));
          }
          ctx.lineTo(hi, beamY);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  },
};
