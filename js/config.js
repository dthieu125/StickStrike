/* =========================================================
 * CONFIG — MỌI SỐ LIỆU CỦA GAME NẰM Ở ĐÂY
 * Muốn chỉnh cảm giác game chỉ cần sửa số ở file này.
 * ========================================================= */
window.Config = {
  // Kích thước cửa sổ game
  CANVAS_W: 1280,
  CANVAS_H: 720,

  // Kích thước 1 ô tilemap (px)
  TILE: 32,

  // Vật lý chung
  GRAVITY: 2200,
  MAX_FALL: 1200,

  // Đường ngắm mờ giúp canh đạn (bật/tắt trong game bằng phím T)
  AIM_GUIDE: true,

  // Vụ NỔ xuyên chướng ngại: nổ BÊN KIA tường (không nhìn thẳng) vẫn làm mất
  // một PHẦN TRĂM MÁU; nổ ngay DƯỚI sàn mỏng (1 ô) dưới chân địch thì nặng hơn
  EXPLODE: {
    THROUGH_WALL: 0.5,   // nổ bị tường chặn → trúng 50% máu tối đa
    THROUGH_FLOOR: 0.75, // nổ dưới sàn mỏng 1 ô đang đứng → trúng 75% máu tối đa
  },

  // HỘP ĐẠN rải trên map: lượng đạn random 50%-100% băng đầy, dự trữ tối đa 2 băng
  AMMO: {
    BOX_MIN: 0.5,        // ít nhất 50% băng đầy
    SPARE_CAP: 2,        // dự trữ tối đa = 2 × băng đầy (không tích trữ vô hạn)
    BOXES_PER_MAP: 4,    // số hộp đạn rải xen kẽ với súng
  },

  // Vũ trụ nền
  STAR_COUNT: 220,

  // Người chơi
  PLAYER: {
    W: 20, H: 52, CROUCH_H: 34, PRONE_H: 24,
    SPEED: 231, ACCEL: 2800, FRICTION: 2400, // 231 = 330 giảm ~30% (giao tranh chậm rãi hơn)
    AIR_ACCEL: 1700, AIR_FRICTION: 300,
    JUMP_VEL: -823, MAX_JUMPS: 2, // -823 = nhảy cao ~154px (+50% so với -672/~103px)
    COYOTE: 0.09, JUMP_BUF: 0.12, CROUCH_SPEED: 0.5, PRONE_SPEED: 0.3,
    PRONE_SPREAD: 0.55, // nằm bắn TĨNH hơn: tản đạn còn 55%
    MAX_HP: 100,
    COLOR: '#22d3ee', // áo người chơi (đổi được ở menu)
    HAT: 'cap',
  },

  /* ── 🏃 DASH (phím Shift) — né đạn: vọt nhanh 1 nhịp, bất tử 0.12s ── */
  DASH: {
    SPEED: 840,  // tốc độ vụ lướt (px/s) — ~110px mỗi lần
    TIME: 0.13,  // kéo dài vụ lướt (giây)
    CD: 0.85,    // hồi chiêu giữa 2 lần dash
    IFRAME: 0.12, // giây bất tử trong lúc lướt (đạn/lao văng qua người)
  },

  /* ── 💣 LỰU ĐẠN (phím Q) — ném theo chuột, nổ chạm đất/tường/quái ── */
  GRENADE: {
    CD: 6,       // hồi chiêu ném (giây)
    DAMAGE: 55,  // sát thương tâm nổ (giảm dần theo cự ly như rocket)
    RADIUS: 110, // bán kính nổ
    THROW_MIN: 180, THROW_MAX: 640, // tầm ném theo khoảng cách chuột (px/s)
    LIFT: 150,   // độ cong quỹ đạo (đẩy lên lúc mới ném)
    GRAV: 900,   // trọng lực riêng của lựu đạn (nhẹ hơn người — ném được xa)
  },

  /* ── 🏪 MARKET — trang bị mua bằng VÀNG tích luỹ từ Sinh tồn ──
   * Định giá theo sát thương súng (lục 16 · AK 23 · shotgun 72/phát ·
   * sniper 95 · rocket 85) và đòn quái (cắn 12 · brute 25 · kamikaze 45):
   *   giáp   −15% MOI đòn  → 1 ván wave 5-6 đã "lãi" lại cái giáp
   *   nón    headshot vào bạn ×2 → ×1.3 (giảm 35% đòn đầu)
   *   giày   +12% tốc chạy (sống lâu hơn = kiếm nhiều hơn)
   *   bao tay nạp đạn nhanh 30% (ít giây khô đạn = ít máu mất)
   *   khiên  HẤP THỤ 100 sát thương rồi vỡ — giá bằng ~1 mạng (100 máu) */
  MARKET: {
    armor:  { name: '🦺 Giáp chiến thuật', desc: 'Sát thương nhận vào −15% (mọi đòn)', price: 600, kind: 'perm' },
    helmet: { name: '🪖 Nón thép',         desc: 'Headshot vào bạn chỉ còn ×1.3 thay vì ×2', price: 450, kind: 'perm' },
    boots:  { name: '👟 Giày phản lực',    desc: 'Chạy nhanh hơn +12%', price: 300, kind: 'perm' },
    gloves: { name: '🥊 Bao tay chiến thuật', desc: 'Nạp đạn nhanh hơn 30%', price: 300, kind: 'perm' },
    shield: { name: '🛡️ Khiên ánh sáng',   desc: 'Hấp thụ 100 sát thương rồi tự vỡ (xài 1 lần)', price: 250, kind: 'use' },
  },

  // Bảng màu áo + kiểu mũ để tuỳ biến ở menu
  TEAM_COLORS: ['#22d3ee', '#f43f5e', '#facc15', '#a78bfa', '#4ade80', '#fb923c'],
  HATS: ['cap', 'helmet', 'space', 'none'],

  /* ── 🔧 NÂNG CẤP SÚNG — mua bằng vàng ở 🏪 Market, lưu vĩnh viễn (ss_gunLv) ──
   * Mỗi khẩu 10 cấp: mỗi cấp +5% dame · +5% băng · nạp nhanh thêm 2.5%.
   * (lv10 = +50% dame/băng, nạp nhanh 25% — mạnh nhưng không phá cân bằng)
   * Cấp 3 mở ALT-FIRE (bắn phụ chuột phải / E) · cấp 6 mở PERK riêng từng khẩu. */
  UPGRADE: {
    MAX_LV: 10,
    DMG_PER_LV: 0.05,     // +5% sát thương mỗi cấp (lv10 = +50%)
    MAG_PER_LV: 0.05,     // +5% băng đạn mỗi cấp
    RELOAD_PER_LV: 0.025, // nạp nhanh thêm 2.5% mỗi cấp (lv10 = −25%)
    ALT_LV: 3,            // cấp 3 = mở alt-fire
    PERK_LV: 6,           // cấp 6 = mở perk riêng
    // giá lên cấp = giá súng (súng miễn phí tính 220) × 0.3 × (cấp hiện tại + 1)
    // súng miễn phí: 66 → 132 → ... → 660 (tổng ~3.6k💰 lên max — đường dài, có mục tiêu)
    COST_BASE_MIN: 220, COST_MUL: 0.3,
  },

  /* ── 🛢️ VẬT THỂ PHÁ ĐƯỢC — rải ngẫu nhiên trên map, che đạn như cover động ── */
  PROPS: {
    PER_MAP: 9,          // số vật thể mỗi map
    MIN_GAP: 90,         // không đặt 2 vật quá gần nhau (px)
    SPAWN_CLEAR: 150,    // tránh chỗ xuất phát (px)
    TYPES: {
      barrel: { hp: 30, w: 26, h: 34, chance: 0.35 }, // 🛢️ thùng nổ TO — vỡ là nổ lớn, dãn nổ dây chuyền
      crate:  { hp: 60, w: 30, h: 26, chance: 0.45 }, // 📦 thùng gỗ — vỡ rơi vàng 20-35💰
      pipe:   { hp: 40, w: 14, h: 46, chance: 0.20 }, // 🔧 ống ga — vỡ nổ nhỏ hơi ga
    },
    BOOM: {
      barrel: { damage: 60, radius: 95 }, // nổ như nửa trái rocket
      pipe:   { damage: 35, radius: 65 }, // nổ nhỏ
    },
    LOOT: { crate: [20, 35] }, // thùng gỗ vỡ rơi vàng random
  },

  /* ── 🎲 EVENT NGẪU NHIÊN GIỮA WAVE — 30% cơ hội sau khi dọn 1 wave ── */
  EVENT: {
    CHANCE: 0.3,     // 30% wave kế có event bất ngờ
    FOG_RANGE: 300,  // 🌫️ sương mù: tầm nhìn mọi bên capped còn 300px
    RAIN: { EVERY: 2.2, DROPS: 3, DMG: 9, RADIUS: 46, SPEED: 430 }, // 🌧️ mưa axit
    FAST: 0.25,      // 🏃 quái cuồng tốc +25%
    RICH: 1.5,       // 💰 mùa vàng: tiền quái +50%
  },

  /* ── 🗺️ ROGUELITE MAP/NODE — mỗi wave xong chọn ĐƯỜNG ĐI kiểu Slay the Spire ── */
  ROGUE: {
    NODES: 3,        // số lá trên bản đồ mỗi lần chọn
    ELITE: {
      HP: 1.35,      // quái elite TRÂU hơn ×1.35
      SPEED: 1.15,   // ...và nhanh hơn ×1.15
      EXTRA: 0.4,    // thêm +40% số lính (làm tròn lên)
      GOLD: 1.6,     // tiền quái ×1.6 — cái giá của cái rủi ro
      SCORE: 1.5,    // điểm wave ×1.5
    },
    REWARD: {
      HEAL: 0.5,     // ôasis: hồi ngay 50% máu tối đa
      GOLD_MIN: 60, GOLD_MAX: 120, // + vàng 60-120💰
    },
  },

  /* ── Chế độ SINH TỔN (Wave) ── */
  WAVE: {
    COUNTDOWN: 4,          // giây đếm ngược trước wave đầu
    INTERMISSION: 12,      // giây nghỉ giữa các wave (mở cửa hàng)
    CRAWLER_BASE: 4,       // wave 1 có 4 con crawler
    CRAWLER_PER_WAVE: 2,   // mỗi wave thêm 2 con
    SPITTER_FROM: 2,       // từ wave 2 có spitter
    BRUTE_EVERY: 3,        // mỗi 3 wave có brute (wave 3, 6, 9...)
    // Quái mới theo giai (kế hoạch chuyên gia): mid có tank/kamikaze, sau đó sniper
    TANK_FROM: 3,          // từ wave 3 có tank GIÁP TRƯỚC (bắn lưng mới đau)
    TANK_EVERY: 2,         // thêm 1 tank mỗi 2 wave
    KAMIKAZE_FROM: 4,      // từ wave 4 có kamikaze lao nổ
    KAMIKAZE_EVERY: 2,
    SNIPER_FROM: 5,        // từ wave 5 có sniper đứng xa bắn tỉa
    SNIPER_EVERY: 2,
    KAMIKAZE: { BOOM_R: 85, BOOM_DMG: 45 }, // vụ nổ kamikaze: bán kính + sát thương
    HP_SCALE: 0.09,        // máu quái +9% mỗi wave
    SPEED_SCALE: 0.015,    // nhanh hơn 1.5% mỗi wave
    CLEAR_BONUS: 25,       // tiền thưởng dọn sạch wave
    CLEAR_BONUS_PER_WAVE: 5,
    /* ── 👑 BOSS CỘT MỐC — xuất hiện mỗi 5 wave (5, 10, 15...) ──
     * 3 PHASE theo MÁU CÒN LẠI, mỗi phase đổi CÁCH CHIẾN + ĐIỂM YẾU:
     *   P1 PHÁO THỦ (máu > 2/3): giữ xa, ném loạt 3 viên có báo trước → điểm yếu ĐẦU
     *   P2 GỌI QUÂN  (máu 2/3 → 1/3): trồi crawler liên tục → điểm yếu NGỰC
     *   P3 CUỒNG NỘ  (máu < 1/3): lao nhanh nhảy đè, đập mạnh → điểm yếu CHÂN
     * Đổi phase: choáng STUN giây (đứng im trắng xóa) — dồn đạn ngay là lãi!
     * Bắn trúng ĐIỂM YẾU vàng nhấp nháy → ×2 sát thương. Thưởng: vàng lớn + modifier HIẾM. */
    BOSS: {
      FROM: 5, EVERY: 5,        // boss tại wave 5, 10, 15, 20...
      HP: 700,                  // máu gốc (× hệ số scale theo wave như quái thường)
      SPEED: 55, DMG: 30,       // tốc đi gốc · đòn đập cận chiến
      MINION_CAP: 6,            // tối đa lính dưới trướng sống cùng lúc
      MINIONS_PER_CALL: 3,      // mỗi lần gọi trồi bao nhiêu con
      MINION_CD: 4.5,           // giây giữa 2 lần gọi quân (P2)
      VOLLEY_SHOTS: 3,          // P1: mỗi loạt bắn mấy viên
      VOLLEY_CD: 2.6,           // giây giữa 2 loạt
      TELEGRAPH: 0.8,           // giây BÁO TRƯỚC trước khi ném loạt (vòng đỏ chớp)
      STUN: 1.2,                // giây choáng khi ĐỔI PHASE — cơ hội dồn damage
      WEAK_MULT: 2,             // đạn trúng điểm yếu ×2 sát thương
      WEAK_R: 13,               // bán kính điểm yếu (px)
      PHASE2_AT: 2 / 3,         // máu ≤ 2/3 → phase 2
      PHASE3_AT: 1 / 3,         // máu ≤ 1/3 → phase 3
    },
    // các điểm quái trồi lên trong map Boong tàu (px)
    SPAWNS: [[64, 652], [1856, 652], [1500, 236], [400, 236], [900, 236]],
  },

  /* ── Chế độ DEATHMATCH (đội) — chỉnh được ở menu chính ── */
  DM: {
    TEAM_SIZE: 5,      // số người mỗi đội (1-10): bạn + (TEAM_SIZE-1) bot vs TEAM_SIZE bot
    WIN_KILLS: 30,     // đội nào đạt số kill này trước là thắng (5-100, bước 5)
    RESPAWN: 3,        // giây hồi sinh
  },
};
