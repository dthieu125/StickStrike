/* =========================================================
 * MAPS — bộ sưu tập bản đồ
 * Map "Boong tàu" viết bằng chữ (dễ đọc), còn lại SINH BẰNG CODE
 * qua các lệnh vẽ khối — không sợ lệch dòng như gõ tay.
 *
 * ═══ QUY TẮC THIẾT KẾ MAP (bắt buộc, có test kiểm tra) ═══
 * 1. Khối chắn chạm sàn cao TỐI ĐA 5 ô (160px) — đúng tầm nhảy đôi.
 * 2. Khối cao hơn 3 ô phải có BẬC THỀM/kệ kế bên, mỗi bậc chênh ≤ 3 ô
 *    (96px) để leo lên đỉnh — không có "bức tường chết".
 * 3. Luôn có đường đi trên cao nối 2 bên map → nhìn thấy nhau được.
 * 4. Map DM không có hố rơi xuyên map (chỉ map Wave được, vì có hồi sinh).
 * Nhảy đơn ≈ 3 ô · Nhảy đôi ≈ 5 ô (đã tính trong test).
 * ========================================================= */

/* Dựng map bằng code: tô khối đặc / bệ một chiều vào lưới trống */
function buildMap(cols, rows, paint) {
  const g = Array.from({ length: rows }, () => Array(cols).fill('.'));
  paint({
    solid(x, y, w, h) { // tường kim loại
      for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) g[r][c] = '#';
    },
    grate(x, y, w) { // bệ một chiều
      for (let c = x; c < x + w; c++) g[y][c] = '-';
    },
  });
  return g.map((r) => r.join(''));
}

window.Maps = {
  /* ── BOONG TÀU (map sinh tồn — phiên bản đầu tiên, viết tay) ── */
  deck: {
    id: 'deck', name: '🚀 Boong tàu — Khoang lái', mode: 'wave',
    rows: [
      '............................................................',
      '............................................................',
      '............................................................',
      '............................................................',
      '............................................................',
      '............................................................',
      '............................................................',
      '............................................................',
      '............................................................',
      '......................------.........................-----..',
      '............................................................',
      '............------..........................................',
      '.................................------...........------....',
      '............................................................',
      '................------......................................',
      '............................................------..........',
      '..............................------........................',
      '..........------............................................',
      '..................................##........................',
      '..................................##........................',
      '........................####......##........................',
      '....P...................####......##........................',
      '##################...#######################################',
      '##################...#######################################',
    ],
    playerSpawn: { x: 4 * 32, y: 20 * 32 - 52 },
  },

  /* ── BUỒNG CHỨA HÀNG (deathmatch) ──
     Leo vòng: sàn → bậc 2 ô → container cao 5 ô → giàn giáo hàng 13
     → cầu đi giữa hàng 10 → sang giàn giáo bên kia. Hai bên thấy nhau
     qua tầng trên; tầng giữa dùng làm ẩn nấp. */
  hangar: {
    id: 'hangar', name: '📦 Buồng chứa hàng', mode: 'dm',
    build: () => buildMap(60, 24, (m) => {
      m.solid(0, 22, 60, 2);                    // sàn
      // ── bên trái ──
      m.solid(8, 21, 2, 1);                     // bậc 1 ô
      m.solid(10, 19, 5, 3);                    // container thấp (3 ô)
      m.solid(17, 20, 3, 2);                    // bậc 2 ô → bước lên container cao
      m.solid(20, 17, 5, 5);                    // container cao (5 ô)
      m.solid(0, 16, 7, 1);                     // kệ treo trái
      m.grate(12, 13, 10);                      // giàn giáo trên trái
      // ── bên phải (đối xứng) ──
      m.solid(50, 21, 2, 1);                    // bậc 1 ô
      m.solid(45, 19, 5, 3);                    // container thấp phải
      m.solid(40, 20, 3, 2);                    // bậc 2 ô
      m.solid(35, 17, 5, 5);                    // container cao phải
      m.solid(53, 16, 7, 1);                    // kệ treo phải
      m.grate(38, 13, 10);                      // giàn giáo trên phải
      // ── giữa map ──
      m.grate(25, 10, 10);                      // cầu đi giữa không trung
    }),
    spawns: {
      A: [[96, 652], [200, 652], [128, 460], [352, 556], [320, 416]],
      B: [[1808, 652], [1704, 652], [1776, 460], [1536, 556], [1728, 416]],
    },
  },

  /* ── KHOANG PHẢN ỨNG (deathmatch) ──
     Lõi lò chỉ 5 ô (hạ từ 8 ô — trước đây chặn tầm nhìn 2 bên!) +
     bậc 2 ô hai bên: leo lên đỉnh lõi bắn sang đội bạn, hoặc chạy
     vành đai hàng 13 nhìn thẳng qua map. */
  reactor: {
    id: 'reactor', name: '☢️ Khoang phản ứng', mode: 'dm',
    build: () => buildMap(60, 24, (m) => {
      m.solid(0, 22, 60, 2);                    // sàn
      m.solid(8, 20, 4, 2);                     // bo-check trái (2 ô)
      m.solid(48, 20, 4, 2);                    // bo-check phải (2 ô)
      m.solid(26, 20, 2, 2);                    // bậc trái lên lõi
      m.solid(28, 17, 4, 5);                    // lõi lò phản ứng (5 ô — leo được!)
      m.solid(32, 20, 2, 2);                    // bậc phải lên lõi
      m.grate(22, 13, 6);                       // vành đai quanh lò (trái)
      m.grate(33, 13, 6);                       // vành đai quanh lò (phải)
      m.grate(18, 9, 8);                        // tầng trên trái
      m.grate(35, 9, 8);                        // tầng trên phải
      m.solid(0, 6, 10, 1);                     // hành lang cao trái
      m.solid(50, 6, 10, 1);                    // hành lang cao phải
      m.grate(11, 7, 6);                        // bậc trung gian lên hành lang
      m.grate(43, 7, 6);                        // bậc trung gian bên phải
    }),
    glows: [{ x: 30 * 32, y: 19 * 32, r: 90, color: '80,255,120' }], // hào quang lò
    spawns: {
      A: [[96, 652], [160, 652], [128, 140], [256, 588], [96, 460]],
      B: [[1856, 652], [1792, 652], [1800, 140], [1664, 588], [1808, 460]],
    },
  },

  /* ── KHO HÀNG GỖ (deathmatch) ──
     Cầu thang thùng hàng 2-4-5 ô LIỀN NHAU bên phải, bậc giữa 3 ô +
     giàn giáo leo dần lên cầu đi dài trên cao. */
  cargo: {
    id: 'cargo', name: '🗄️ Kho hàng tầng tầng', mode: 'dm',
    build: () => buildMap(60, 24, (m) => {
      m.solid(0, 22, 60, 2);                    // sàn
      m.solid(4, 18, 10, 1);                    // kệ trái 1
      m.solid(6, 14, 8, 1);                     // kệ trái 2
      m.solid(4, 10, 8, 1);                     // kệ trái 3
      m.solid(0, 6, 8, 1);                      // sào huyệt trên trái
      m.solid(40, 20, 3, 2);                    // thùng 2 ô ┐
      m.solid(43, 18, 3, 4);                    // thùng 4 ô ├ cầu thang liền nhau
      m.solid(46, 17, 3, 5);                    // thùng 5 ô ┘ (đỉnh ngắm toàn map)
      m.solid(21, 19, 3, 3);                    // thùng 3 ô giữa — bậc lên cầu đi
      m.grate(24, 16, 6);                       // bậc giữa dưới
      m.grate(30, 12, 8);                       // bậc giữa trên
      m.grate(24, 10, 4);                       // bậc phụ
      m.grate(20, 7, 20);                       // cầu đi dài trên cao
    }),
    spawns: {
      A: [[96, 652], [200, 652], [192, 268], [256, 524], [128, 140]],
      B: [[1808, 652], [1664, 652], [1472, 524], [1120, 172], [1760, 652]],
    },
  },

  /* ── RỪNG TRONG KHOANG (deathmatch) ──
     Khoang sinh học của tàu trồng cây thật 🌲 — cây CHẶN ĐẠN + che mắt
     nhưng đi len được (xem js/game/trees.js): bắn nhiều thì cây cụt dần
     từ ngọn xuống còn gốc, dính tên lửa là bay màu cả cây.
     Địa hình theo đúng quy tắc: mô đất ≤2 ô, cành cây là bậc thềm leo
     tầng (sàn 704 → cành 544 → tán cao 384, mỗi nhịp ≤2 ô nhảy). */
  forest: {
    id: 'forest', name: '🌲 Rừng trong khoang', mode: 'dm',
    build: () => buildMap(60, 24, (m) => {
      m.solid(0, 22, 60, 2);                    // sàn
      m.solid(28, 20, 4, 2);                    // mô đất giữa (2 ô — nhảy lên được)
      m.grate(17, 17, 4);                       // cành cây trái (bậc lên tầng trên)
      m.grate(40, 17, 4);                       // cành cây phải
      m.grate(24, 12, 12);                      // giàn leo giữa tầng cao (tán phủ)
      m.grate(10, 8, 6);                        // giàn cao trái
      m.grate(44, 8, 6);                        // giàn cao phải
    }),
    /* 10 cây hai bên + giữa — né chỗ spawn, né mô đất (cột 28-31) */
    trees: [
      { c: 6, h: 5 }, { c: 11, h: 6 }, { c: 16, h: 4 }, { c: 22, h: 7 }, { c: 27, h: 5 },
      { c: 33, h: 7 }, { c: 38, h: 4 }, { c: 44, h: 6 }, { c: 49, h: 5 }, { c: 54, h: 6 },
    ],
    spawns: {
      A: [[96, 652], [180, 652], [560, 492], [900, 588], [700, 652]],
      B: [[1824, 652], [1740, 652], [1360, 492], [1020, 588], [1220, 652]],
    },
  },
};
