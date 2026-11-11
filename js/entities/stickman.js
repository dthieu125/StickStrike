/* =========================================================
 * STICKMAN — vẽ người que bằng CODE (không cần file ảnh!)
 * Phân biệt nhân vật qua: màu áo (color) + kiểu mũ (hat).
 *
 * Cách dùng:
 *   drawStickman(ctx, {
 *     cx: 640,          // tâm ngang
 *     feetY: 500,       // toạ độ MẶT ĐẤT dưới chân
 *     h: 52,            // chiều cao
 *     facing: 1,        // 1 = quay phải, -1 = quay trái
 *     runPhase: 2.5,    // pha đạp chân khi chạy
 *     moving: true, onGround: true, crouch: false, vx: 100,
 *     color: '#22d3ee', hat: 'cap',
 *     aimAngle: null,   // góc ngắm (giai đoạn 1, khi cầm súng)
 *   });
 * ========================================================= */
window.drawStickman = function (ctx, o) {
  const H = o.h;
  const x = o.cx;

  // ── Tỉ lệ cơ thể (tính theo chiều cao nên ngồi vẫn đúng tỉ lệ) ──
  const headR = Math.max(6, H * 0.155);        // bán kính đầu
  const legLen = H * 0.45;                      // chiều dài chân
  const headCY = o.feetY - H + headR;           // tâm đầu
  const neckY = headCY + headR + 1;             // cổ
  const hipY = o.feetY - legLen;                // hông
  const shoulderY = neckY + (hipY - neckY) * 0.18;
  const p = o.runPhase || 0;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const thick = o.thick || 1; // quái Brute vẽ đậm hơn
  ctx.strokeStyle = o.color;
  ctx.fillStyle = o.color;
  ctx.lineWidth = Math.max(3, H * 0.07) * thick;

  /* ── CHÂN ── */
  const feet = _feetPositions(o, x, o.feetY, p);
  _limb(ctx, x, hipY, feet[0].x, feet[0].y, ctx.lineWidth);
  _limb(ctx, x, hipY, feet[1].x, feet[1].y, ctx.lineWidth);

  /* ── THÂN ── */
  ctx.beginPath();
  ctx.moveTo(x, neckY);
  ctx.lineTo(x, hipY);
  ctx.stroke();

  /* ── TAY ── */
  ctx.lineWidth = Math.max(2.6, H * 0.06);
  if (o.aimAngle !== undefined && o.aimAngle !== null) {
    // cầm súng: vẽ khẩu súng trước, tay đặt LÊN súng sau (thấy bàn tay)
    if (o.gun) _drawGun(ctx, o.gun, x, shoulderY, o.aimAngle, o.gunKick || 0, H, o);
    const ax = Math.cos(o.aimAngle) * H * 0.26;
    const ay = Math.sin(o.aimAngle) * H * 0.26;
    _limb(ctx, x - 1, shoulderY, x + ax, shoulderY + ay, ctx.lineWidth);
    _limb(ctx, x + 1, shoulderY, x + ax * 0.85, shoulderY + ay * 0.85, ctx.lineWidth);
  } else if (o.moving && o.onGround) {
    // chạy: 2 tay đung đưa ngược pha chân
    _limb(ctx, x - 1, shoulderY, x + Math.sin(p + Math.PI) * 7, shoulderY + H * 0.26, ctx.lineWidth);
    _limb(ctx, x + 1, shoulderY, x + Math.sin(p) * 7, shoulderY + H * 0.26, ctx.lineWidth);
  } else {
    // đứng yên / trên không: thõng tay xuống
    _limb(ctx, x - 1, shoulderY, x - 5, shoulderY + H * 0.27, ctx.lineWidth);
    _limb(ctx, x + 1, shoulderY, x + 5, shoulderY + H * 0.27, ctx.lineWidth);
  }

  /* ── ĐẦU ── */
  ctx.beginPath();
  ctx.arc(x, headCY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(o.color, -45);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // mắt trắng nhỏ theo hướng nhìn
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(x + (o.facing || 1) * headR * 0.42, headCY - headR * 0.1, 1.8, 0, Math.PI * 2);
  ctx.fill();

  /* ── MŨ ── */
  _drawHat(ctx, o.hat, x, headCY, headR, o.facing || 1, o.color);

  ctx.restore();
};

/* vị trí 2 chân theo tư thế */
function _feetPositions(o, x, feetY, p) {
  if (o.crouch) {
    return [{ x: x - 6, y: feetY }, { x: x + 6, y: feetY }];
  }
  if (!o.onGround) {
    // trên không: co chân lại
    return [{ x: x - 5, y: feetY - 10 }, { x: x + 7, y: feetY - 5 }];
  }
  if (o.moving) {
    // chạy: chân đảo pha, chân đang đưa tới thì nhấc lên
    const f1x = x + Math.sin(p) * 9;
    const f1y = feetY - Math.max(0, Math.cos(p)) * 5;
    const f2x = x + Math.sin(p + Math.PI) * 9;
    const f2y = feetY - Math.max(0, Math.cos(p + Math.PI)) * 5;
    return [{ x: f1x, y: f1y }, { x: f2x, y: f2y }];
  }
  return [{ x: x - 5.5, y: feetY }, { x: x + 5.5, y: feetY }]; // đứng yên
}

function _limb(ctx, x1, y1, x2, y2, w) {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* vẽ khẩu súng — mỗi loại một dáng, vẽ bằng hình chữ nhật xoay theo hướng ngắm.
 * Trục +x = hướng mũi súng. Đã xử lý cả trường hợp bắn sang trái. */
const GUN_METAL = '#a9b2c0', GUN_DARK = '#454f5e', GUN_WOOD = '#7a5433', GUN_OLIVE = '#77804f';

function _drawGun(ctx, w, sx, sy, angle, kick, H, o) {
  /* ── Weapon sway & idle breathing ──
   * đang chạy: súng lắc nhẹ theo NHỊP CHÂN (runPhase)
   * đứng yên trên đất: "thở" — lắc rất chậm theo đồng hồ thực */
  const t = performance.now() / 1000;
  let swayY = 0, swayA = 0;
  if (o && o.moving && o.onGround) {
    swayY = Math.sin((o.runPhase || 0) * 2) * H * 0.014; // dập dềnh theo bước chân
    swayA = Math.cos((o.runPhase || 0) * 2) * 0.025;     // nòng chúc nhẹ
  } else if (o && o.onGround) {
    const br = Math.sin(t * 1.8);
    swayY = br * H * 0.007; // nhịp thở chậm
    swayA = br * 0.01;
  }

  ctx.save();
  ctx.translate(sx, sy + swayY);
  ctx.rotate(angle + swayA);
  if (Math.cos(angle) < 0) ctx.scale(1, -1); // bắn sang trái: lật súng cho khỏi "đảo ngược"
  ctx.translate(-kick * 6, 0);               // giật về sau khi bắn
  ctx.translate(H * 0.08, 0);

  switch (w.gunStyle) {
    case 'pistol':
      ctx.fillStyle = GUN_DARK; ctx.fillRect(0, -3, 12, 6);
      ctx.fillStyle = GUN_METAL; ctx.fillRect(0, -3.5, 13, 3);
      ctx.fillStyle = GUN_DARK; ctx.fillRect(1, 2, 4, 8);
      break;
    case 'revolver':
      ctx.fillStyle = GUN_METAL; ctx.fillRect(0, -3, 14, 6);
      ctx.fillStyle = GUN_DARK;
      ctx.beginPath(); ctx.arc(7, 0, 4.2, 0, Math.PI * 2); ctx.fill(); // trống 6 ngoáy
      ctx.fillStyle = GUN_WOOD; ctx.fillRect(1, 2, 4, 8);
      break;
    case 'smg':
      ctx.fillStyle = GUN_DARK; ctx.fillRect(0, -3, 17, 7);
      ctx.fillStyle = GUN_METAL; ctx.fillRect(17, -2, 8, 3.5);
      ctx.fillStyle = GUN_METAL; ctx.fillRect(8, 4, 4, 10); // băng đạn
      break;
    case 'shotgun':
      ctx.fillStyle = GUN_WOOD; ctx.fillRect(0, -3, 16, 6.5);
      ctx.fillStyle = GUN_METAL; ctx.fillRect(16, -3.2, 18, 4.2);
      ctx.fillStyle = GUN_DARK; ctx.fillRect(20, 1.3, 9, 4); // ốc bơm đạn
      break;
    case 'rifle':
      ctx.fillStyle = GUN_DARK; ctx.fillRect(0, -3, 20, 7);
      ctx.fillStyle = GUN_WOOD; ctx.fillRect(2, -2, 12, 4); // ốp gỗ AK
      ctx.fillStyle = GUN_METAL; ctx.fillRect(20, -2, 14, 3.5);
      ctx.fillStyle = GUN_METAL; ctx.fillRect(9, 4, 5, 10); // băng đạn cong
      break;
    case 'minigun':
      ctx.fillStyle = GUN_DARK; ctx.fillRect(0, -6, 14, 12);
      ctx.fillStyle = GUN_METAL; ctx.fillRect(14, -4.5, 22, 9);
      ctx.fillStyle = GUN_DARK;
      ctx.fillRect(19, -4.5, 2, 9); ctx.fillRect(26, -4.5, 2, 9); ctx.fillRect(33, -4.5, 2, 9); // nòng quay
      break;
    case 'sniper':
      ctx.fillStyle = '#3e5c48'; ctx.fillRect(0, -2.5, 26, 5.5);
      ctx.fillStyle = GUN_METAL; ctx.fillRect(26, -1.8, 20, 3.5);
      ctx.fillStyle = GUN_DARK;
      ctx.beginPath(); ctx.arc(10, -7, 4, 0, Math.PI * 2); ctx.fill(); // ống ngắm
      ctx.fillStyle = 'rgba(140,220,255,0.6)';
      ctx.beginPath(); ctx.arc(10, -7, 2.2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'rail':
      ctx.fillStyle = '#2c3a4c'; ctx.fillRect(0, -4, 22, 8);
      ctx.fillStyle = GUN_METAL; ctx.fillRect(22, -2, 22, 4);
      ctx.strokeStyle = '#54e0ff'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { // vòng điện từ phát sáng
        ctx.beginPath(); ctx.arc(27 + i * 7, 0, 5, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    case 'rocket':
      ctx.fillStyle = GUN_OLIVE; ctx.fillRect(0, -5, 34, 10); // ống phóng
      ctx.fillStyle = GUN_DARK; ctx.fillRect(34, -6, 3, 12);
      ctx.fillRect(-3, -3, 3, 6);
      ctx.fillRect(6, -8, 4, 3); // thước ngắm
      break;
    case 'plasma':
      ctx.fillStyle = '#26404f'; ctx.fillRect(0, -4.5, 18, 9);
      ctx.fillStyle = 'rgba(84,224,255,0.85)'; ctx.fillRect(4, -2.5, 7, 5); // bình năng lượng
      ctx.fillStyle = '#3a6a7d'; ctx.fillRect(18, -2, 10, 4);
      ctx.fillStyle = '#54e0ff';
      ctx.beginPath(); ctx.arc(28.5, 0, 2.2, 0, Math.PI * 2); ctx.fill();
      break;
  }
  ctx.restore();
}

/* vẽ mũ — chính là "căn cước" của từng nhân vật */function _drawHat(ctx, hat, x, headCY, headR, facing, shirtColor) {
  if (!hat || hat === 'none') return;

  ctx.save();
  ctx.translate(x, headCY);
  ctx.scale(facing, 1); // vẽ mũ "hướng phải" rồi lật gương theo hướng nhìn

  if (hat === 'cap') { // mũ lưỡi trai
    ctx.fillStyle = shadeColor(shirtColor, -55);
    ctx.beginPath();
    ctx.arc(0, -headR * 0.45, headR * 0.98, Math.PI, Math.PI * 2); // nòng mũ
    ctx.fill();
    ctx.fillRect(headR * 0.1, -headR * 0.5, headR * 1.3, 2.8);      // lưỡi che nắng
  } else if (hat === 'helmet') { // mũ bảo hộ
    ctx.fillStyle = shadeColor(shirtColor, -55);
    ctx.beginPath();
    ctx.arc(0, -headR * 0.2, headR * 1.12, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; // bóng loáng
    ctx.beginPath();
    ctx.ellipse(-headR * 0.3, -headR * 0.55, headR * 0.35, headR * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === 'space') { // mũ vũ trụ có bát kính
    ctx.strokeStyle = 'rgba(190,220,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, headR * 1.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,200,255,0.14)'; // lớp kính mờ
    ctx.beginPath();
    ctx.arc(0, 0, headR * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* làm sáng/tối 1 màu hex: shadeColor('#ff0000', -40) → đỏ đậm */
window.shadeColor = function (hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
  return `rgb(${r},${g},${b})`;
};
