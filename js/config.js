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
    W: 20, H: 52, CROUCH_H: 34,
    SPEED: 231, ACCEL: 2800, FRICTION: 2400, // 231 = 330 giảm ~30% (giao tranh chậm rãi hơn)
    AIR_ACCEL: 1700, AIR_FRICTION: 300,
    JUMP_VEL: -823, MAX_JUMPS: 2, // -823 = nhảy cao ~154px (+50% so với -672/~103px)
    COYOTE: 0.09, JUMP_BUF: 0.12, CROUCH_SPEED: 0.5,
    MAX_HP: 100,
    COLOR: '#22d3ee', // áo người chơi (đổi được ở menu)
    HAT: 'cap',
  },

  // Bảng màu áo + kiểu mũ để tuỳ biến ở menu
  TEAM_COLORS: ['#22d3ee', '#f43f5e', '#facc15', '#a78bfa', '#4ade80', '#fb923c'],
  HATS: ['cap', 'helmet', 'space', 'none'],

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
