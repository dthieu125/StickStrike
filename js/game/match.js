/* =========================================================
 * MATCH — bộ máy DEATHMATCH đội nhóm
 * Đội A (bạn + bot cùng màu áo) vs Đội B (bot đỏ).
 * 30 kill trước là thắng. Chết hồi sinh sau 3 giây.
 * ========================================================= */
window.Match = {
  scoreA: 0, scoreB: 0, state: 'idle', // idle | playing | ended
  mapDef: null,

  start(mapDef, perTeam) {
    this.mapDef = mapDef;
    this.scoreA = 0; this.scoreB = 0;
    this.state = 'playing';

    // dọn bots cũ, dựng trận
    Bots.clear();
    const colors = Config.TEAM_COLORS;
    const N = Config.DM.TEAM_SIZE;

    // CẢ 2 ĐỘI đều chỉ có súng lục lúc đầu — công bằng như người chơi,
    // súng tốt nằm rải trên map, bot tự đi lục (qua Pickups)
    // 🌐 mạng: truyền perTeam (số bot MỖI ĐỘI) — mỗi đội 1 slot là NGƯỜI THẬT
    //   • chơi đơn: perTeam bỏ trống → đội A có N-1 bot (bạn chiếm 1 slot), đội B đủ N
    //   • guest dựng view: perTeam = 0 (bot thật do snapshot máy host dựng lại)
    const nA = (perTeam != null) ? perTeam : N - 1;
    const nB = (perTeam != null) ? perTeam : N;
    for (let i = 0; i < nA; i++) {
      const sp = this.spawnPoint('A');
      Bots.spawn('A', sp.x, sp.y, 'pistol', colors[4]); // xanh lá
    }
    for (let i = 0; i < nB; i++) {
      const sp = this.spawnPoint('B');
      Bots.spawn('B', sp.x, sp.y, 'pistol', '#f43f5e');
    }
  },

  reset() { this.state = 'idle'; Bots.clear(); },

  spawnPoint(team) {
    const arr = this.mapDef.spawns[team];
    const s = arr[Math.floor(Math.random() * arr.length)];
    return { x: s[0], y: s[1] };
  },

  /* đủ điểm thắng chưa? → kết thúc + hiện bảng kết quả (gọi từ onKill lẫn khi người gục) */
  _checkEnd() {
    if (this.scoreA >= Config.DM.WIN_KILLS || this.scoreB >= Config.DM.WIN_KILLS) {
      this.state = 'ended';
      const playerWon = this.scoreA > this.scoreB;
      Menu.showMatchEnd(playerWon, this.scoreA, this.scoreB);
      return true;
    }
    return false;
  },

  onKill(shooterTeam) {
    if (this.state !== 'playing') return;
    if (shooterTeam === 'A') this.scoreA++;
    else if (shooterTeam === 'B') this.scoreB++;
    Time.hitstop(0.05);
    this._checkEnd();
  },

  // người gục → đợi hồi sinh (nếu trận chưa kết thúc)
  // 🤝 co-op/versus mạng: quét TẤT CẢ người — ai gục thì ĐỘI ĐỊCH +1 điểm,
  // hồi sinh tại spawn ĐỘI MÌNH (chơi đơn: chỉ có người đội A — đúng behavior cũ)
  update(dt) {
    if (this.state !== 'playing') return;
    for (const p of Player.list) {
      if (p.hp > 0) continue;
      const enemy = p.team === 'A' ? 'B' : 'A';
      if (!p.deadTimer) {
        p.deadTimer = Config.DM.RESPAWN;
        // đội đối phương ăn điểm khi "hạ" được người này
        if (enemy === 'A') this.scoreA++; else this.scoreB++;
        Particles.poof(p.x + p.w / 2, p.y + p.h / 2);
        Level.splatter(p.x + p.w / 2, p.y + p.h / 2, 0, true);
        if (this._checkEnd()) return;
      }
      p.deadTimer -= dt;
      if (p.deadTimer <= 0) {
        p.deadTimer = 0;
        const sp = this.spawnPoint(p.team);
        p.x = sp.x; p.y = sp.y - 52;
        p.vx = 0; p.vy = 0;
        p.hp = p.maxHp;
        p.dead = false; // sống lại — đạn địch có thể trúng tiếp
        p.airJumps = 0;
        // nạp đầy đạn các SÚNG ĐANG CÓ (chưa lụm thì chưa có đạn) — 🔧 theo băng nâng cấp
        Weapons.list.forEach((w, i) => { if (p.owned.has(w.id)) p.mags[i] = (window.GunUp ? GunUp.mag(w) : w.mag); });
        Particles.smoke(sp.x, sp.y - 20, 4);
      }
    }
  },
};
