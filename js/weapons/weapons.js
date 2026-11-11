/* =========================================================
 * WEAPONS — ARSENAL 10 KHẨU SÚNG
 * Mỗi khẩu là 1 "thẻ dữ liệu" — muốn cân bằng game chỉ sửa số ở đây.
 *
 * kind: 'hitscan' = đạn lan tức thời (tính trúng ngay lập tức)
 *       'proj'    = đạn bay thật (thấy viên đạn/chùm năng lượng bay đi)
 * spread: độ tản (radian) — càng to càng "phụt"
 * recoil: độ giật hiển thị, shake: rung camera, flash: cỡ loé sáng đầu nòng
 * barrelLen/bodyLen: để VẼ khẩu súng trên tay người que
 * ========================================================= */
window.Weapons = {
  list: [
    {
      id: 'pistol', name: 'Súng lục', short: 'PST', price: 0,
      damage: 16, fireDelay: 0.22, auto: false, pellets: 1, spread: 0.014,
      mag: 12, reload: 0.9, recoil: 0.25, shake: 0.6, flash: 1,
      kind: 'hitscan', range: 1500,
      gunStyle: 'pistol', barrelLen: 8, bodyLen: 12,
      sound: 'pistol', tracerColor: '#ffd98a', tracerWidth: 1.8,
    },
    {
      id: 'revolver', name: 'Lục lọi 6 ngoáy', short: 'REV', price: 0,
      damage: 48, fireDelay: 0.5, auto: false, pellets: 1, spread: 0.01,
      mag: 6, reload: 1.7, recoil: 0.6, shake: 1.6, flash: 1.4,
      kind: 'hitscan', range: 1700,
      gunStyle: 'revolver', barrelLen: 6, bodyLen: 14,
      sound: 'revolver', tracerColor: '#ffe9a8', tracerWidth: 2.2,
    },
    {
      id: 'smg', name: 'Tiểu liên SMG', short: 'SMG', price: 120,
      damage: 9, fireDelay: 0.075, auto: true, pellets: 1, spread: 0.065,
      mag: 32, reload: 1.4, recoil: 0.12, shake: 0.35, flash: 0.8,
      kind: 'hitscan', range: 1200,
      gunStyle: 'smg', barrelLen: 8, bodyLen: 16,
      sound: 'smg', tracerColor: '#ffcf7d', tracerWidth: 1.5,
    },
    {
      id: 'shotgun', name: 'Shotgun cận chiến', short: 'SG', price: 200,
      damage: 9, fireDelay: 0.85, auto: false, pellets: 8, spread: 0.17,
      mag: 6, reload: 1.9, recoil: 1.0, shake: 2.5, flash: 1.7,
      kind: 'hitscan', range: 620,
      gunStyle: 'shotgun', barrelLen: 18, bodyLen: 18,
      sound: 'shotgun', tracerColor: '#ffc46b', tracerWidth: 1.6,
    },
    {
      id: 'rifle', name: 'Súng trường AK', short: 'AK', price: 150,
      damage: 23, fireDelay: 0.115, auto: true, pellets: 1, spread: 0.022,
      mag: 30, reload: 1.6, recoil: 0.3, shake: 0.8, flash: 1.1,
      kind: 'hitscan', range: 1800,
      gunStyle: 'rifle', barrelLen: 14, bodyLen: 22,
      sound: 'rifle', tracerColor: '#ffd98a', tracerWidth: 2,
    },
    {
      id: 'minigun', name: 'Súng máy quay', short: 'MNG', price: 300,
      damage: 7, fireDelay: 0.048, auto: true, pellets: 1, spread: 0.095,
      mag: 100, reload: 2.8, recoil: 0.1, shake: 0.5, flash: 0.9,
      kind: 'hitscan', range: 1400,
      gunStyle: 'minigun', barrelLen: 22, bodyLen: 16,
      sound: 'minigun', tracerColor: '#ffbf66', tracerWidth: 1.5,
    },
    {
      id: 'sniper', name: 'Súng bắn tỉa', short: 'SNP', price: 400,
      damage: 95, headMult: 2, fireDelay: 1.15, auto: false, pellets: 1, spread: 0.0015,
      mag: 5, reload: 2.3, recoil: 1.2, shake: 3, flash: 1.9,
      kind: 'hitscan', range: 2600, pierceTargets: true,
      gunStyle: 'sniper', barrelLen: 20, bodyLen: 26,
      sound: 'sniper', tracerColor: '#c7f0ff', tracerWidth: 2, tracerLife: 0.12,
    },
    {
      id: 'rail', name: 'Súng điện từ RAIL', short: 'RAIL', price: 500,
      damage: 75, headMult: 1.5, fireDelay: 1.0, auto: false, pellets: 1, spread: 0,
      mag: 4, reload: 2.1, recoil: 0.9, shake: 2.2, flash: 1.5,
      kind: 'hitscan', range: 3000, pierceTargets: true, // xuyên nhiều bia, KHÔNG xuyên tường
      gunStyle: 'rail', barrelLen: 24, bodyLen: 22,
      sound: 'rail', tracerColor: '#54e0ff', tracerWidth: 3.5, tracerLife: 0.3,
    },
    {
      id: 'rocket', name: 'Phóng tên lửa', short: 'RKT', price: 450,
      damage: 85, fireDelay: 1.15, auto: false, pellets: 1, spread: 0.01,
      mag: 4, reload: 2.5, recoil: 1.0, shake: 1.2, flash: 2,
      kind: 'proj', projSpeed: 448, projRadius: 4, explodeRadius: 95, shakeOnBoom: 7, // 448 = 640 giảm 30%
      gunStyle: 'rocket', barrelLen: 34, bodyLen: 4,
      sound: 'rocket',
    },
    {
      id: 'plasma', name: 'Súng plasma', short: 'PLS', price: 350,
      damage: 36, fireDelay: 0.28, auto: true, pellets: 1, spread: 0.02,
      mag: 24, reload: 1.8, recoil: 0.2, shake: 0.7, flash: 1.2,
      kind: 'proj', projSpeed: 364, projRadius: 5, explodeRadius: 52, shakeOnBoom: 2.5, // 364 = 520 giảm 30%
      gunStyle: 'plasma', barrelLen: 10, bodyLen: 20,
      sound: 'plasma',
    },
  ],
};
