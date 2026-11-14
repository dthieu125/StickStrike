/* =========================================================
 * COMBATANTS — sổ quản lý mọi "thứ có thể bắn trúng"
 * Người chơi, bot, quái vật đều đăng ký vào đây. Đạn chỉ trúng
 * thằng khác TEAM (không bắn đồng đội).
 * Mỗi combatant cần: x, y, w, h, team, dead,
 *   headRatio (vùng đầu tính từ trên xuống), bloodColor,
 *   hit(dmg, isHead, hx, hy, shooterTeam) → trả về damage thật
 * ========================================================= */
window.Combatants = {
  list: [],

  register(c) { this.list.push(c); },
  unregister(c) {
    const i = this.list.indexOf(c);
    if (i !== -1) this.list.splice(i, 1);
  },
  reset() { this.list.length = 0; },

  // kẻ thù của 1 team (kết quả mới mỗi lần gọi — số lượng nhỏ nên rẻ)
  hostiles(team) {
    return this.list.filter((c) => c.team !== team && !c.dead);
  },

  // nhìn thẳng có thấy mục tiêu không? (đường ngắm không vướng tường)
  canSee(fromX, fromY, target, range) {
    // 🎲 event SƯƠNG MÙ: tầm nhìn MỌI bên bị capped còn ~300px
    if (window.Wave && Wave.state === 'active' && Wave.event && Wave.event.id === 'fog') {
      range = Math.min(range, Config.EVENT.FOG_RANGE);
    }
    const dx = Level.wrapDx(target.x + target.w / 2 - fromX); // map vòng tròn: nhìn QUA MÉP là được
    const dy = target.y + target.h / 2 - fromY;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return false;
    const step = 8;
    const sx = dx / dist * step, sy = dy / dist * step;
    let x = fromX, y = fromY;
    for (let d = 0; d < dist; d += step) {
      x += sx; y += sy;
      // đường ngắm vượt mép map thì vòng qua mép kia (tileAt tự wrap)
      if (x >= Level.pxW) x -= Level.pxW; else if (x < 0) x += Level.pxW;
      if (Level.blocksShotAt(x, y)) return false; // bậc thềm cũng che tầm nhìn
    }
    return true;
  },
};
