/* =========================================================
 * WEAPONS — ARSENAL 10 KHẨU SÚNG
 * Mỗi khẩu là 1 "thẻ dữ liệu" — muốn cân bằng game chỉ sửa số ở đây.
 *
 * kind: 'hitscan' = đạn lan tức thời (tính trúng ngay lập tức)
 *       'proj'    = đạn bay thật (thấy viên đạn/chùm năng lượng bay đi)
 * spread: độ tản (radian) — càng to càng "phụt"
 * recoil: độ giật hiển thị, shake: rung camera, flash: cỡ loé sáng đầu nòng
 * barrelLen/bodyLen: để VẼ khẩu súng trên tay người que
 *
 * 🔧 alt : BẮN PHỤ (chuột phải / E) — MỞ ở nâng cấp cấp 3 (Config.UPGRADE.ALT_LV)
 *          delay = cooldown riêng của phát bắn phụ.
 * 🔧 perk: PERK riêng — MỞ ở nâng cấp cấp 5 (Config.UPGRADE.PERK_LV),
 *          tên + mô tả chỉ để hiển thị; hiệu số thật nằm trong GunUp.stats().
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
      alt: { name: 'LIÊN THANH ×3', desc: 'Bắn 3 phát nhanh tản nhẹ, mỗi phát 80% dame', delay: 0.5 },
      perk: { name: 'Nòng ngắn', desc: 'Nạp đạn nhanh hơn thêm 15%' },
    },
    {
      id: 'revolver', name: 'Lục lọi 6 ngoáy', short: 'REV', price: 0,
      damage: 48, fireDelay: 0.5, auto: false, pellets: 1, spread: 0.01,
      mag: 6, reload: 1.7, recoil: 0.6, shake: 1.6, flash: 1.4,
      kind: 'hitscan', range: 1700,
      gunStyle: 'revolver', barrelLen: 6, bodyLen: 14,
      sound: 'revolver', tracerColor: '#ffe9a8', tracerWidth: 2.2,
      alt: { name: 'ĐẠN XUYÊN', desc: '1 phát dame ×1.5 XUYÊN mọi bia trên đường', delay: 0.9 },
      perk: { name: 'Đạn nóng', desc: 'Sát thương thêm +15%' },
    },
    {
      id: 'smg', name: 'Tiểu liên SMG', short: 'SMG', price: 120,
      damage: 9, fireDelay: 0.075, auto: true, pellets: 1, spread: 0.065,
      mag: 32, reload: 1.4, recoil: 0.12, shake: 0.35, flash: 0.8,
      kind: 'hitscan', range: 1200,
      gunStyle: 'smg', barrelLen: 8, bodyLen: 16,
      sound: 'smg', tracerColor: '#ffcf7d', tracerWidth: 1.5,
      alt: { name: 'XỊT CÔN', desc: 'Xịt 6 phát hình quạt cự ly gần — quét góc', delay: 0.7 },
      perk: { name: 'Bớt phụt', desc: 'Tản đạn còn 75%' },
    },
    {
      id: 'shotgun', name: 'Shotgun cận chiến', short: 'SG', price: 200,
      damage: 9, fireDelay: 0.85, auto: false, pellets: 8, spread: 0.17,
      mag: 6, reload: 1.9, recoil: 1.0, shake: 2.5, flash: 1.7,
      kind: 'hitscan', range: 620,
      gunStyle: 'shotgun', barrelLen: 18, bodyLen: 18,
      sound: 'shotgun', tracerColor: '#ffc46b', tracerWidth: 1.6,
      alt: { name: 'SLUG XUYÊN', desc: '1 viên đặc 45 dame XUYÊN mọi bia (cự ly xa hơn)', delay: 1.0 },
      perk: { name: 'Nạp thêm viên', desc: 'Mỗi phát +1 viên bi' },
    },
    {
      id: 'rifle', name: 'Súng trường AK', short: 'AK', price: 150,
      damage: 23, fireDelay: 0.115, auto: true, pellets: 1, spread: 0.022,
      mag: 30, reload: 1.6, recoil: 0.3, shake: 0.8, flash: 1.1,
      kind: 'hitscan', range: 1800,
      gunStyle: 'rifle', barrelLen: 14, bodyLen: 22,
      sound: 'rifle', tracerColor: '#ffd98a', tracerWidth: 2,
      alt: { name: 'BỘ BA ×3', desc: '3 phát chính xác dính nhau, mỗi phát 90% dame', delay: 0.55 },
      perk: { name: 'Đạn AP', desc: 'Đạn thường xuyên thêm 1 bia' },
    },
    {
      id: 'minigun', name: 'Súng máy quay', short: 'MNG', price: 300,
      damage: 7, fireDelay: 0.048, auto: true, pellets: 1, spread: 0.095,
      mag: 100, reload: 2.8, recoil: 0.1, shake: 0.5, flash: 0.9,
      kind: 'hitscan', range: 1400,
      gunStyle: 'minigun', barrelLen: 22, bodyLen: 16,
      sound: 'minigun', tracerColor: '#ffbf66', tracerWidth: 1.5,
      alt: { name: 'QUAY NÒNG (giữ)', desc: 'Giữ bắn phụ để quay nòng — tản đạn giảm dần gần 0, đi chậm', delay: 0 },
      perk: { name: 'Băng đôi', desc: 'Băng đạn thêm +25%' },
    },
    {
      id: 'sniper', name: 'Súng bắn tỉa', short: 'SNP', price: 400,
      damage: 95, headMult: 2, fireDelay: 1.15, auto: false, pellets: 1, spread: 0.0015,
      mag: 5, reload: 2.3, recoil: 1.2, shake: 3, flash: 1.9,
      kind: 'hitscan', range: 2600, pierceTargets: true,
      gunStyle: 'sniper', barrelLen: 20, bodyLen: 26,
      sound: 'sniper', tracerColor: '#c7f0ff', tracerWidth: 2, tracerLife: 0.12,
      alt: { name: 'NÓC NHANH', desc: 'Bắn không ngắm: nhanh gấp 3, dame 60%, không xuyên', delay: 0.4 },
      perk: { name: 'Đạn tỉa ĐKZ', desc: 'Headshot ×2 → ×2.5' },
    },
    {
      id: 'rail', name: 'Súng điện từ RAIL', short: 'RAIL', price: 500,
      damage: 75, headMult: 1.5, fireDelay: 1.0, auto: false, pellets: 1, spread: 0,
      mag: 4, reload: 2.1, recoil: 0.9, shake: 2.2, flash: 1.5,
      kind: 'hitscan', range: 3000, pierceTargets: true, // xuyên nhiều bia, KHÔNG xuyên tường
      gunStyle: 'rail', barrelLen: 24, bodyLen: 22,
      sound: 'rail', tracerColor: '#54e0ff', tracerWidth: 3.5, tracerLife: 0.3,
      alt: { name: 'ĐÔI TIA', desc: '2 tia điện song song, mỗi tia 70% dame', delay: 1.2 },
      perk: { name: 'Cuộn siêu dẫn', desc: 'Nạp đạn nhanh hơn thêm 20%' },
    },
    {
      id: 'rocket', name: 'Phóng tên lửa', short: 'RKT', price: 450,
      damage: 85, fireDelay: 1.15, auto: false, pellets: 1, spread: 0.01,
      mag: 4, reload: 2.5, recoil: 1.0, shake: 1.2, flash: 2,
      kind: 'proj', projSpeed: 448, projRadius: 4, explodeRadius: 95, shakeOnBoom: 7, // 448 = 640 giảm 30%
      gunStyle: 'rocket', barrelLen: 34, bodyLen: 4,
      sound: 'rocket',
      alt: { name: 'KÍCH NỔ GIÓ', desc: 'Đầu đạn nổ NGAY GIỮA ĐƯỜNG gần điểm ngắm', delay: 1.3 },
      perk: { name: 'Đầu nổ to', desc: 'Vùng nổ rộng hơn +20%' },
    },
    {
      id: 'plasma', name: 'Súng plasma', short: 'PLS', price: 350,
      damage: 36, fireDelay: 0.28, auto: true, pellets: 1, spread: 0.02,
      mag: 24, reload: 1.8, recoil: 0.2, shake: 0.7, flash: 1.2,
      kind: 'proj', projSpeed: 364, projRadius: 5, explodeRadius: 52, shakeOnBoom: 2.5, // 364 = 520 giảm 30%
      gunStyle: 'plasma', barrelLen: 10, bodyLen: 20,
      sound: 'plasma',
      alt: { name: 'CẦU NẢY', desc: 'Cầu plasma NẢY tường tới 3 lần rồi mới nổ', delay: 0.4 },
      perk: { name: 'Lõi ổn định', desc: 'Vùng nổ rộng hơn +15%' },
    },
  ],
};
