/* =========================================================
 * MATCH — bộ máy DEATHMATCH đội nhóm
 * Đội A (bạn + bot cùng màu áo) vs Đội B (bot đỏ).
 * 30 kill trước là thắng. Chết hồi sinh sau 3 giây.
 * ========================================================= */
window.Match = {
  scoreA: 0, scoreB: 0, state: 'idle', // idle | playing | ended
  mapDef: null,

  start(mapDef) {
    this.mapDef = mapDef;
    this.scoreA = 0; this.scoreB = 0;
    this.state = 'playing';

    // dọn bots cũ, dựng trận
    Bots.clear();
    const colors = Config.TEAM_COLORS;
    const N = Config.DM.TEAM_SIZE;

    // CẢ 2 ĐỘI đều chỉ có súng lục lúc đầu — công bằng như người chơi,
    // súng tốt nằm rải trên map, bot tự đi lục (qua Pickups)
    for (let i = 0; i < N - 1; i++) {
      const sp = this.spawnPoint('A');
      Bots.spawn('A', sp.x, sp.y, 'pistol', colors[4]); // xanh lá
    }
    for (let i = 0; i < N; i++) {
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

  onKill(shooterTeam) {
    if (this.state !== 'playing') return;
    if (shooterTeam === 'A') this.scoreA++;
    else if (shooterTeam === 'B') this.scoreB++;
    Time.hitstop(0.05);

    if (this.scoreA >= Config.DM.WIN_KILLS || this.scoreB >= Config.DM.WIN_KILLS) {
      this.state = 'ended';
      const playerWon = this.scoreA > this.scoreB;
      Menu.showMatchEnd(playerWon, this.scoreA, this.scoreB);
    }
  },

  // người chơi gục → đợi hồi sinh (nếu trận chưa kết thúc)
  update(dt) {
    if (this.state !== 'playing') return;
    const p = Player.obj;
    if (p.hp <= 0) {
      if (!p.deadTimer) {
        p.deadTimer = Config.DM.RESPAWN;
        // đội đối phương ăn điểm khi "hạ" được bạn
        this.scoreB++;
        Particles.poof(p.x + p.w / 2, p.y + p.h / 2);
        Level.splatter(p.x + p.w / 2, p.y + p.h / 2, 0, true);
        if (this.scoreB >= Config.DM.WIN_KILLS) {
          this.state = 'ended';
          Menu.showMatchEnd(false, this.scoreA, this.scoreB);
        }
      }
      p.deadTimer -= dt;
      if (p.deadTimer <= 0) {
        p.deadTimer = 0;
        const sp = this.spawnPoint('A');
        p.x = sp.x; p.y = sp.y - 52;
        p.vx = 0; p.vy = 0;
        p.hp = p.maxHp;
        p.dead = false; // sống lại — đạn địch có thể trúng tiếp
        p.airJumps = 0;
        // nạp đầy đạn các SÚNG ĐANG CÓ (chưa lụm thì chưa có đạn)
        Weapons.list.forEach((w, i) => { if (p.owned.has(w.id)) p.mags[i] = w.mag; });
        Particles.smoke(sp.x, sp.y - 20, 4);
      }
    }
  },
};
