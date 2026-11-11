/* =========================================================
 * PHYSICS — di chuyển + va chạm
 * Thuật toán: di chuyển từng trục (X rồi Y), va chạm thì đẩy lùi.
 * Cách làm chuẩn của game 2D, chống xuyên tường ở mọi tốc độ.
 * ========================================================= */
window.Physics = {
  EPS: 0.01,

  // Di chuyển entity (có x,y,w,h,vx,vy) theo dt và xử lý va chạm với map
  moveAndCollide(e, level, dt) {
    /* --- Trục X (ngang) --- */
    e.x += e.vx * dt;
    let hit = level.rectOverlapsSolid(e.x, e.y, e.w, e.h);
    if (hit) {
      if (e.vx > 0) e.x = hit.left - e.w - this.EPS;      // đụng tường phải
      else if (e.vx < 0) e.x = hit.right + this.EPS;      // đụng tường trái
      e.vx = 0;
    }

    /* --- Trục Y (dọc) --- */
    const prevBottom = e.y + e.h; // chân ở vị trí trước khi rơi (cho bệ một chiều)
    e.y += e.vy * dt;
    e.onGround = false;

    // 1) Va chạm tường cứng
    hit = level.rectOverlapsSolid(e.x, e.y, e.w, e.h);
    if (hit) {
      if (e.vy > 0) {                    // đang rơi → đáp lên mặt ô
        e.y = hit.top - e.h;
        e.onGround = true;
      } else if (e.vy < 0) {             // đang bay lên → đụng trần
        e.y = hit.bottom + this.EPS;
      }
      e.vy = 0;
    }

    // 2) Bệ một chiều: chỉ chặn khi ĐANG rơi xuống và chân ở phía trên bệ
    if (!e.onGround && e.vy > 0) {
      const grateTop = level.oneWayUnder(e.x, e.y, e.w, e.h, prevBottom);
      if (grateTop !== null) {
        e.y = grateTop - e.h;
        e.vy = 0;
        e.onGround = true;
      }
    }

    // 3) MAP VÒNG TRÒN: đi hết biên phải → vòng về biên trái (và ngược lại).
    //    Ai cũng được (người, bot, quái) — camera tự bám theo nên thấy "quay đầu".
    if (e.x >= level.pxW) e.x -= level.pxW;
    else if (e.x < 0) e.x += level.pxW;
  },
};
