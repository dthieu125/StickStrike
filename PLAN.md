# 🎮 PLAN — Game Bắn Súng Người Que (StickStrike)

> Game bắn súng 2D side-scroll kiểu **Plazma Burst / Thing Thing** — bắn trong phi thuyền,
> giết quái vật và đối thủ, cảm giác bắn "thật". Tên tạm gọi: **StickStrike**.

---

## 1. Tầm nhìn

- Người chơi là **người que** phân biệt nhau qua **màu áo + mũ** (không cần vẽ chi tiết).
- Bối cảnh: **trong vũ trụ** — khoang phi thuyền, hành lang tàu, phòng máy, khung cảnh ngoài cửa sổ là sao và trái đất.
- 2 chế độ chơi:
  - **Sinh tồn (Wave)**: quái vật tấn công theo đợt, giữa các đợt được mua/nâng cấp súng. *(chế độ chính)*
  - **Deathmatch với Bot**: bắn team bot người que, giới hạn điểm.
- Ưu tiên số 1: **cảm giác bắn** — giật súng, tia đạn, vỏ đạn văng, máu văng, rung màn hình, âm thanh đanh thép. Game mượt 60 FPS.

## 2. Vì sao chọn HTML5 Canvas + JS

| Lý do | Chi tiết |
|---|---|
| Không cần cài đặt | Chỉ cần trình duyệt. Mở file là chơi. |
| Người que = vẽ bằng code | Vẽ người que bằng lệnh canvas (đường thẳng, tròn) → **không cần biết vẽ, không cần file ảnh**. |
| Dễ chia sẻ | Gửi file cho bạn bè chơi luôn. |
| Nhẹ, mượt | Canvas vẽ 60FPS tốt, đủ cho game 2D. |
| Tương lai | Muốn lên game portal hay thùng game riêng vẫn dùng được code này. |

Không dùng ảnh sprite trong giai đoạn đầu — **mọi thứ vẽ bằng code** (người que, súng, map, hiệu ứng).
Âm thanh **tự sinh bằng Web Audio API** (tiếng "pew", tiếng đạn rơi, nổ...) — cũng không cần file âm thanh.

## 3. Thiết kế game

### 3.1 Nhân vật người que
- Cấu trúc vẽ bằng code: đầu (hình tròn), thân, 2 chân (animate khi chạy/nhảy), 2 tay cầm súng theo hướng chuột.
- **Màu áo** = màu thân (đỏ, xanh, vàng, tím...).
- **Mũ** = nhận dạng phụ: mũ lưỡi trai, mũ bảo hộ, mũ vũ trụ có bát kính... (vẽ vài nét thêm).
- Vũ khí đang cầm vẽ theo khẩu súng → nhìn là biết ngay.

### 3.2 Vũ khí — ARSENAL 10 KHẨU (cân bằng trong `js/weapons/weapons.js`)

| # | Súng | Damage | Tốc độ | Đặc điểm |
|---|---|---|---|---|
| 1 | Súng lục (PST) | 16 | semi-auto | xịn, đạn chuẩn — súng dự phòng |
| 2 | Lục lọi 6 ngoáy (REV) | 48 | chậm | một phát ăn ngay, giật mạnh |
| 3 | Tiểu liên SMG | 9 | rất nhanh | tản đạn nhiều, tầm gần |
| 4 | Shotgun cận chiến | 9×8 viên | chậm | dội bzzung tầm gần, 8 mảnh đạn |
| 5 | Súng trường AK | 23 | nhanh | súng chủ lực, auto |
| 6 | Súng máy quay (MNG) | 7 | cực nhanh | 100 viên/băng, mưa đạn |
| 7 | Súng bắn tỉa (SNP) | 95 | rất chậm | xuyên nhiều mục tiêu, headshot x2 |
| 8 | Súng điện từ RAIL | 75 | chậm | **xuyên nhiều bia** (không xuyên tường), tia xanh khét |
| 9 | Phóng tên lửa (RKT) | 85 | chậm | đạn bay + nổ vùng, rung màn hình |
| 10 | Súng plasma (PLS) | 36 | auto | chùm năng lượng vũ trụ, nổ nhẹ |

Mỗi khẩu có: damage, fire rate, giật nòng, độ tản đạn, thời gian nạp đạn, cỡ loé đầu nòng — tất cả là số liệu trong file, chỉnh như chỉnh bảng.

### 3.3 Bản đồ (phi thuyền)
Tất cả làm bằng **tilemap** (lưới ô vuông 32px) — vẽ map kiểu so chữ trong code:
1. **Khoang lái** — nhiều cửa sổ nhìn ra sao trời, bàn điều khiển nhấp nháy. *(map đầu tiên)*
2. **Hành lang & khoang ngủ** — hẹp, đánh cận chiến.
3. **Khoang máy / lò phản ứng** — có băng chuyền, thùng hàng làm bệ nhảy.
4. **Buồng chứa hàng** — rộng, có giàn giáo trên cao để nhảy bắn từ trên xuống.

**📐 QUY TẮC THIẾT KẾ MAP (bắt buộc — có test tự động kiểm tra):**
- Vật lý nhảy: nhảy đơn ≈ 3 ô (96px), nhảy đôi ≈ 5 ô (160px).
- Khối chắn chạm sàn **cao tối đa 5 ô** — đúng tầm nhảy đôi.
- Khối cao hơn 3 ô phải có **bậc thềm/kệ kế bên** (chênh 1–3 ô mỗi bậc) để leo
  lên đỉnh — cấm "bức tường chết" chặn tầm nhìn 2 bên mà không cách nào vượt
  *(bài học: lõi lò phản ứng từng cao 8 ô → 2 bên không thấy nhau, không nhảy qua nổi)*.
- Luôn có **đường đi trên cao** nối 2 bên map (giàn giáo/cầu đi).
- Map Deathmatch **không có hố rơi xuyên map**; map Wave chỉ cho hố có hồi sinh.

Nền ngoài cửa sổ: nền đen, ngôi sao, trái đất xanh — vẽ code, rất "vũ trụ".

### 3.4 Quái vật (wave mode)
- **Crawler** — bò nhanh, lao vào cắn. Nhiều, rẻ máu.
- **Spitter** — đứng xa, phun nhựa axit theo vòng cung.
- **Brute** — chậm, máu trâu, đập một phát bay nửa cái máu.
- Wave sau nhiều hơn, máu dày hơn. Mỗi 5 wave có "wave boss" nhẹ.

### 3.5 Điều khiển
| Phím | Hành động |
|---|---|
| A / D | Chạy trái / phải |
| W hoặc Space | Nhảy (có double-jump nhẹ như Plazma Burst) |
| S | Ngồi/bò thấp |
| Chuột | Ngắm + bắn |
| R | Nạp đạn |
| G | Lụm súng rải trên map (deathmatch) |
| 1–0 / lăn chuột | Đổi súng (10 khẩu) |
| B | Mở cửa hàng (khi nghỉ giữa wave) |
| T | Bật/tắt đường ngắm mờ |
| M | Tắt/bật tiếng |
| Esc | Tạm dừng |

## 4. Kiến trúc code (cấu trúc thư mục)

```
game_ban_sung_nguoi_que/
├── index.html              ← mở file này là chơi (kèm các panel menu DOM)
├── css/
│   └── style.css           ← nền đen toàn màn hình, canvas giữa, hiệu ứng menu
├── js/
│   ├── main.js             ← bộ não: menu → wave/deathmatch → pause/kết quả, HUD
│   ├── config.js           ← TẤT CẢ số liệu chỉnh sửa: tốc độ, damage, màu áo...
│   ├── engine/
│   │   ├── gameLoop.js     ← vòng lặp 60FPS (requestAnimationFrame, chống crash)
│   │   ├── camera.js       ← theo người chơi, rung màn hình
│   │   ├── input.js        ← bàn phím + chuột
│   │   ├── time.js         ← hitstop (khựng thời gian khi headshot)
│   │   └── audio.js        ← tổng hợp tiếng súng + nhạc nền (Web Audio)
│   ├── world/
│   │   ├── maps.js         ← 4 map (Boong tàu viết tay, 3 map DM sinh bằng code)
│   │   ├── level.js        ← nạp tilemap, vẽ map, lớp vết máu
│   │   └── physics.js      ← trọng lực, va chạm AABB, bệ một chiều
│   ├── game/
│   │   ├── combatants.js   ← sổ mục tiêu: team, LOS — đạn chỉ trúng đội khác
│   │   ├── wave.js         ← bộ máy chế độ sinh tồn
│   │   └── match.js        ← bộ máy deathmatch (điểm, hồi sinh)
│   ├── entities/
│   │   ├── stickman.js     ← vẽ người que theo màu áo + mũ (dùng chung)
│   │   ├── player.js
│   │   ├── bot.js          ← bot deathmatch (tuần tra → bắn → rút lui)
│   │   ├── monster.js      ← 3 loại quái
│   │   ├── bullet.js       ← đạn hitscan + đạn bay + nổ + đường ngắm mờ
│   │   └── particles.js    ← máu, vỏ đạn, lửa, khói, tia đạn
│   ├── weapons/weapons.js  ← bảng thông số 10 khẩu súng (+ giá mua)
│   └── ui/
│       ├── shop.js         ← cửa hàng giữa wave (vẽ canvas, bấm chuột)
│       └── menu.js         ← menu chính, pause, game over (DOM)
└── PLAN.md                 ← file này
```

Nguyên tắc: **mỗi file một việc rõ ràng**, số liệu game nằm trong `config.js` — muốn chỉnh game chỉ cần sửa 1 chỗ.

## 5. Lộ trình theo giai đoạn (mỗi buổi làm 1–2 giờ)

### ✅ Giai đoạn 0 — Dựng khung (HOÀN THÀNH) ✅ kết quả: người que chạy nhảy được
- [x] `index.html` + canvas nền đen + vòng lặp game 60FPS
- [x] Camera theo nhân vật
- [x] Vẽ người que bằng code (thân, đầu, chân animate)
- [x] Chạy trái/phải, nhảy, trọng lực, va chạm sàn
- [x] Map khoang tàu bằng tilemap (có double-jump, coyote time, jump buffer, nhảy biến thiên)
- [x] Feedback người chơi: đã tăng nhảy +10% (JUMP_VEL -672)

### ✅ Giai đoạn 1 — Bắn được (HOÀN THÀNH) ✅ kết quả: bắn bia đứng yên nổ tung
- [x] Ngắm bằng chuột (tay + súng quay theo chuột)
- [x] Đạn hitscan (tia lan tức thời) + đạn bay (tên lửa, plasma) + va chạm map
- [x] Muzzle flash (loé sáng đầu nòng), tia đạn mờ dần, vỏ đạn văng nảy trên sàn
- [x] Tiếng súng tổng hợp (Web Audio) theo từng loại súng
- [x] Bia tập bắn: người que đỏ có máu, nháy trắng khi trúng, headshot x2, chết đổ ngựa + hồi sinh
- [x] Số damage dâng lên tại chỗ trúng
- [x] Arsenal 10 khẩu súng (xem bảng 3.2) + HUD đổi súng (phím 1-0, lăn chuột) + tâm ngắm tự vẽ
- [x] 🐛 FIX lỗi đóng băng khi tên lửa/plasma nổ (hạt hiệu ứng thiếu vx/vy → NaN → canvas vỡ)
- [x] 🛡️ Vòng lặp game "chống đạn": bug cũng không làm game chết im — hiện lỗi lên màn hình
- [x] Đường ngắm mờ canh đạn cho người mới (mặc định bật, phím T bật/tắt, cấu hình trong Config.AIM_GUIDE)
- [x] RAIL không xuyên tường nữa (chỉ xuyên nhiều bia) — theo feedback người chơi

### ✅ Giai đoạn 2 — Cảm giác bắn "thật" (HOÀN THÀNH) ✅ quan trọng nhất theo yêu cầu
- [x] Giật nòng khi bắn, súng giật lên, người chơi lùi nhẹ (shotgun/sniper đẩy ngược)
- [x] Độ tản đạn theo từng khẩu súng + tâm ngắm giãn theo độ tản
- [x] Vỏ đạn văng ra, nảy trên sàn
- [x] Máu văng thành particles + vệt máu dính tường vĩnh viễn (lớp `Level.stains` theo map)
- [x] **Screen shake** nhẹ khi bắn súng lớn + rung mạnh khi nổ
- [x] **Hitstop** (khựng ~45ms) khi bắn trúng đầu — `js/engine/time.js`
- [x] Headshot ×2 damage + chữ "HEADSHOT!" vàng + tiếng riêng
- [x] Nạp đạn có vòng tròn quay quanh tâm ngắm + tiếng "click-click"
- [x] Viền đỏ nhấp nháy khi bị đánh / máu thấp (vignette)

### ✅ Giai đoạn 3 — Quái vật + Wave mode (HOÀN THÀNH) ✅ kết quả: chơi được sinh tồn trọn vẹn
- [x] 3 loại quái người que mắt đỏ: **Crawler** (lao cắn), **Spitter** (phun axit
      theo vòng cung tính ballistic trúng đích), **Brute** (trâu chậm, đập 25 dmg)
- [x] AI quái: đuổi theo, nhảy qua vật cản, spitter giữ khoảng cách 190–330px
- [x] Hệ thống wave: đếm ngược 4s → quái trồi lên dần → dọn sạch → nghỉ 12s có cửa hàng
- [x] Độ khó tăng dần: +2 crawler/wave, spitter từ wave 2, brute mỗi 3 wave, máu +9%/wave
- [x] Giết quái rơi tiền 💰 → **cửa hàng giữa wave** (canvas, bấm chuột): mua 8 khẩu súng,
      nạp đạn 50💰, hồi máu 75💰 (phím B mở khi đang nghỉ)
- [x] Map **Boong tàu** hoàn chỉnh (khoang lái, hố rơi trừ máu, giàn giáo 1 chiều)
- [x] Game over + kỷ lục wave/điểm (lưu `localStorage`, hiện ở menu)

### ✅ Giai đoạn 4 — Deathmatch với Bot (HOÀN THÀNH) ✅ kết quả: bắn team bot 5v5
- [x] Bot AI máy trạng thái: tuần tra → nhìn thấy địch (raycast LOS 720px) → bắn theo
      loạt 2-5 viên → dáo díu trái/phải → rút lui khi máu < 35 → hồi sinh
- [x] Bot aim có "độ gà" giảm dần khi đã khoá mục tiêu lâu (0.26 → 0.03 rad)
- [x] 2 đội: A (bạn + 4 bot xanh lá) vs B (5 bot đỏ), phân biệt màu áo + mũ random
- [x] Respawn sau 3 giây (cả bot lẫn người chơi), thắng khi đội đạt 30 kills
- [x] 3 map DM sinh bằng code: **Buồng chứa hàng**, **Khoang phản ứng** (lõi phát sáng),
      **Kho hàng tầng tầng** — chọn ở menu bằng nút ‹ ›
- [x] Đạn chỉ trúng đội khác (hệ thống `Combatants` registry) — đồng đội vô hại
- [x] **SÚNG RẢI TRÊN MAP** (góp ý người chơi): vào trận chỉ có súng lục — 9 khẩu còn lại
      rải khắp map, **bấm G để lụm** khi ở gần. Quy tắc đặt súng (có test kiểm tra):
      không trùng vị trí, cách nhau tối thiểu ~420px (tự nới nếu map chật),
      cách chỗ xuất phát 2 đội ≥ 150px. Lụm → mở khoá đúng ô + đổi luôn ra tay;
      súng hồi sau 15 giây. Đã có khẩu đó → bồi đạn
- [x] **BOT TỰ LỤM SÚNG** (góp ý người chơi): CẢ 2 ĐỘI bot cũng chỉ xuất phát với súng lục
      (công bằng như người chơi). Khi không thấy địch, bot đi thẳng tới khẩu súng
      ĐANG MẠNH HƠN khẩu mình cầm gần nhất cùng tầng (chọn random trong 3 khẩu gần nhất
      để cả đội không dồn vào 1 chỗ), đi ngang qua là tự lụm — không cần bấm G.
      Súng "độ mạnh" ước theo DPS ~ damage × pellets / fireDelay (+20 nếu nổ được)
- [x] **MAP 🌲 RỪNG TRONG KHOANG** (góp ý người chơi): khoang sinh học trồng 10 cây thật —
      cây CHẶN ĐẠN + che tầm nhìn nhưng đi len lỏi qua được. Cây PHÁ ĐƯỢC (js/game/trees.js):
      bắn trúng cây mất máu theo sát thương viên đạn → **cụt dần từ ngọn xuống** (tán lá rụng,
      thân ngắn dần, rung lắc, gỗ vụn văng) — hết máu còn **GỐC cây** chứ không mất hẳn;
      đạn nổ (tên lửa 🔥/plasma) quét qua thì cây trong bán kính nổ **BAY MÀU cả cây kể cả gốc**
- [x] **BOT TỰ CHẠY ĐI ĂN MÁU** (góp ý người chơi): bot yếu máu (< 60%) chủ động chạy tới
      túi cứu thương gần nhất cùng tầng để hồi — cả khi tuần tra lẫn khi rút lui (< 90% máu);
      đứng trên bậc cao với túi máu dưới chân thì KHÔNG ngu ngốc đứng ngắm (chỉ tính tầng
      với tới được, lệch ≤ 1 bậc)
- [x] **Lăn chuột nhảy qua ô khóa** (góp ý người chơi): lăn để đổi súng giờ bỏ qua
      hết các khẩu chưa lụm/mua (`Player.nextOwned`) — không kẹt ở ô khóa nữa
- [x] **BOT NHẢY 2 LẦN** (góp ý người chơi): bot dùng đúng thông số người chơi
      (`JUMP_VEL -823` sau lần tăng độ cao nhảy +50%, tối đa 2 nhịp) — đang bay mà vẫn vướng
      tường cao là nhảy nhịp 2 → leo nổi container 5 ô (160px), không còn "nhảy tại chỗ" ngốc nghếch
- [x] **CỤC HỒI MÁU trên map** (góp ý người chơi, chỉ Deathmatch — wave đã có medkit
      ở cửa hàng): vào trận gieo sẵn 3 cục; cứ ~12 giây kiểm tra, map hết cục máu là
      random 2-4 cục mới (hồi 25%/50%/75%/100% — càng to càng hiếm, tỷ lệ 40/30/20/10).
      Đi QUA là TỰ LỤM (không cần bấm), người chơi + bot đều ăn được; đầy máu thì không
      ăn (để dành); bot chỉ ăn khi máu dưới 60% cho khỏi phí cục to. Hộp cứu thương
      trắng chữ thập đỏ, cỡ hộp + số % hiện phía trên
- [x] **NHẢY CAO HƠN +50%** (góp ý người chơi): `JUMP_VEL` -672 → **-823** — 1 nhịp nhảy
      từ ~103px lên **~150px** (tính cả bot — dùng chung `Config.PLAYER`). Chèo lên
      container thấp/bậc 2 nhẹ như bơ; tường 5 ô (160px) vẫn cần nhảy đôi
- [x] **MAP VÒNG TRÒN trái ↔ phải** (góp ý người chơi): đi thẳng hết biên phải là ra
      biên trái (và ngược lại) — như vòng quanh thế giới. Áp dụng TOÀN BỘ: người chơi,
      bot, quái (`Physics.moveAndCollide` wrap vị trí), đạn tia + đạn nổ + đường ngắm
      (`Bullets` wrap toạ độ), tầm nhìn bot (`Combatants.canSee`), đuổi đánh/tìm súng/
      tìm túi máu/tuần tra (mọi `dx` đều qua `Level.wrapDx` — luôn chọn đường NGẮN nhất
      qua mép map). Vệt đạn xuyên mép được vẽ tách 2 đoạn cho khỏi kẻ ngang cả màn hình
- [x] **TUỲ CHỌN DEATHMATCH ngay tại menu** (góp ý người chơi): 2 hàng nút +/− mới —
      **👥 số người/đội 1-10** (1 = single player vs bot, 10 = 10vs10) và
      **🏁 điểm thắng 5-100** (bước 5, mặc định giữ 30). Match đọc `Config.DM` lúc
      dựng trận → không cần sửa code khi đổi
- [x] **MAP WAVE CŨNG RẢI SÚNG** (góp ý người chơi): `Pickups.spawnForMap(map, false)` —
      map Boong tàu rải đủ 9 khẩu như DM, **bấm G để lụm** giữa các đợt quái.
      Riêng TÚI MÁU vẫn chỉ có ở DM (wave mua medkit ở cửa hàng — tránh trùng lặp)
- [x] **Hàng súng HUD chuyển thành thanh DOM dưới canvas** — không đè lên map nữa;
      bấm chuột vào ô để đổi súng; ô khoá hiện giá (wave) / "lụm trên map" (DM)
- [x] **Bậc thềm (giàn giáo 1 chiều) chặn đạn + che tầm nhìn** như tường —
      đứng dưới kệ không bị bắn xuyên lên (nhảy xuyên qua vẫn bình thường)

### ✅ Giai đoạn 6 — Điều nhịp game + Cảm giác bắn (Core Feel) + Tính cách bot (HOÀN THÀNH)
- [x] **GIẢM TỐC ~30%** (góp ý người chơi: giao tranh diễn ra quá mau lẹ) — chỉnh ĐỀU
      mọi thứ để giữ tương quan cân bằng: người chơi `SPEED 330→231`, bot `295→206`,
      tên lửa `640→448`, plasma `520→364`, quái crawler `200→140` / spitter `110→77` /
      brute `85→60` + đạn axit phun chậm tương ứng. KHÔNG đổi nhảy/trọng lực/nhịp bắn
- [x] **CORE FEEL — phần còn thiếu của kế hoạch chuyên gia** (80% đã có sẵn:
      recoil/shake/flash từng khẩu, vỏ đạn nảy có spin, tracer mờ dần, hitstop
      headshot/kill, máu splat tường, tiếng súng random pitch ±6%):
  - [x] **Trần particle 450 hạt** (`Particles.MAX`) — quá trần xả hạt CŨ NHẤT
        (pooling-lite, giữ 60 FPS khi bắn minigun/shotgun liên tục)
  - [x] **Weapon sway + idle breathing** — súng đang chạy lắc nhẹ theo NHỊP CHÂN
        (dập dềnh + nòng chúc theo `runPhase`), đứng yên "thở" chậm theo đồng hồ thực
  - [ ] *Bỏ* zoom-out khi bắn liên tục (camera chỉ translate, không đáng đổi pipeline)
- [x] **TÍNH CÁCH BOT — 4 loại rút thăm khi spawn** (hiện tên nhỏ trên thanh máu):
  - **Cân bằng** — giữ nguyên hành vi cũ (170/420, rút lui máu <35) — đa số bot
  - **Hung hăng** — áp sát (80/260), liều tới cùng (chỉ rút lui máu <15), dáo díu nhanh
  - **Núp bắn** — giữ xa (380/640), rút lui sớm hơn (máu <50), lắc chậm như "camp"
  - **Vòng sườn** — khi mất dấu địch thì LÁC QUA SƯỜN/LƯNG địch vừa thấy
        (nhớ `lastEnemyX`, qua mép map vòng tròn nếu cần), rút lui máu <60 để đổi chỗ

### ✅ Giai đoạn 7 — Đạn giới hạn + Nổ xuyên tường + Freeze kết thúc + Mẹo chơi (HOÀN THÀNH)
- [x] **ĐẠN KHÔNG CÒN VÔ HẠN với súng lụm** (góp ý người chơi): thêm kho **dự trữ**
      từng khẩu (`spare`) — nạp đạn phải TIÊU dự trữ:
  - Súng **TẶNG lúc đầu / MUA ở cửa hàng** → đạn ∞ (như cũ)
  - Súng **LỤM trên map** → chỉ có **1 băng** (dự trữ = 0) — hết là khô!
  - Lụm **LẠI chính khẩu đó** → băng đầy lại + **+1 băng dự trữ**
  - **📦 HỘP ĐẠN xen kẽ trên map** (4 hộp/map, hồi 15s như súng): lượng random
        **50%–100% băng đầy** cho khẩu random (trừ súng lục ∞ sẵn); phải CẦM đúng
        khẩu mới dùng được; dự trữ trần **2 băng** (không tích trữ vô hạn)
  - Shop "Nạp đầy đạn 50💰" bồi đủ trần dự trữ luôn; HUD hiển thị `băng + dự trữ`
  - Bot cũng bị giới hạn như người (hơi nới: lụm súng mới được nửa băng dự trữ);
        bot HẾT ĐẠN tự đi lục hộp đạn/khẩu mình cầm — ưu tiên cao nhất khi tuần tra
- [x] **TRẬN KẾT THÚC → MỌI THỨ ĐỨNG IM NGAY** (góp ý người chơi): DM đạt đủ điểm
      hoặc wave game over → ngừng update người/bot/quái/đạn/pickup, chỉ còn
      hạt hiệu ứng tàn dư + HUD (cờ `Wave.over` / `Match.state 'ended'`)
- [x] **BAZOKA PHÓNG LỰU NỔ XUYÊN CHƯỚNG NGẠI** (góp ý người chơi):
  - Nổ **nhìn thẳng** tới nạn nhân → sát thương nổ thường (giảm dần theo khoảng cách)
  - Nổ **bị TƯỜNG chặn** → sóng xung kích vẫn xuyên yếu: trúng **50% máu tối đa**
  - Nổ **ngay dưới SÀN MỎNG (1 ô)** mà địch đang đứng trên → dù đạn KHÔNG xuyên
        sàn, trúng **75% máu tối đa** — bắn sàn dưới chân địch là chiêu bự!
- [x] **💡 MẸO CHƠI ngay ở menu** (góp ý người chơi): nút mới mở panel gom hết tips —
      điều khiển, luật đạn, mẹo bazoka xuyên tường/sàn, nấp & sníp, tính cách bot

### ✅ Giai đoạn 8 — Modifier chọn 1/3 + 3 quái mới theo giai (HOÀN THÀNH)

- [x] **⚡ MODIFIER GIỮA WAVE — chọn 1 trong 3**: dọn sạch wave → hiện 3 thẻ random
      (trong 6 loại: 🔥 hoả lực +25% · ⚡ bắn nhanh +25% · 🎯 đạn xuyên +1 bia ·
      💰 tiền ×2 · ❤️ hồi đầy máu NGAY · 🛡️ giáp nẹp −30% sát thương nhận)
  - Bấm **1 / 2 / 3** để chọn (phím số bị "đoạt" khỏi đổi súng khi bảng đang mở);
        không chọn → **tự random** khi giờ nghỉ còn 2 giây
  - Modifier áp dụng cho **wave kế tiếp** rồi hết hạn khi wave đó dọn sạch
  - Đè lên HUD: `Player.fire` copy súng ×1.25 dmg / delay ×0.8, pierceLeft trong
        `Bullets.fireHitscan`, armor trong `takeDamage`, ×2 trong `onMonsterKilled`
- [x] **👹 3 QUÁI MỚI THEO GIAI** (từ từ thêm, wave càng cao càng đông):
  - **TANK giáp trước** (wave 3+): đạn trúng ngực chỉ còn **20% sát thương** (văng
        tia lửa) — phải đi vòng **bắn LƯNG** hoặc headshot; máu 160, đập 20 dmg
  - **KAMIKAZE** (wave 4+): lao **cực nhanh**, gần 55px là **tự nổ** 45 dmg / r85;
        **bị bắn chết CŨNG NỔ** (vạ người đứng gần) — vẫn thưởng tiền/điểm khi bẫy
  - **SNIPER** (wave 5+): giữ khoảng cách 400–640px, **tia đỏ ngắm 0.7s** rồi bắn
        hitscan 25 dmg (headshot ×1.5) — thấy tia đỏ là né!
- [x] Vẽ riêng từng loại: tấm giáp thép trước ngực tank, vòng đỏ chớp chớp cảnh báo
      kamikaze (khi tới gần), tia đỏ nét đứt của sniper
- [x] Panel 💡 Mẹo chơi bổ sung: luật modifier + cách đối phó 3 quái mới

### ✅ Giai đoạn 9 — Sửa HUD · Quái đi vòng · Người que ngầu · NẰM · Market (HOÀN THÀNH)

- [x] **HUD không đè chữ nữa** (góp ý người chơi): bảng chọn 1/3 modifier dời xuống
      **GIỮA MÀN HÌNH** — khỏi đè chữ WAVE/điểm/toast ở góc trên
- [x] **Quái ĐI VÒNG thay vì đứng nhảy tại chỗ** (góp ý người chơi): tường thấp ≤2 ô
      → nhảy qua như cũ; tường CAO → quét 2 phía, chọn phía CÓ LỐI, lóc ra ~1-2s
      rồi xác định lại vị trí người chơi và xông tới (áp cho crawler/tank/kamikaze/brute)
- [x] **Người que TÂN TRANG**: nét vẽ 2 LỚP (viền đậm + màu chính → dáng nét "comic"),
      yếm giáp ngực, **kính ngắm** theo hướng nhìn (người chơi), hào quang xanh khi
      mang trang bị, preview menu cũng thấy ngay
- [x] **Kỹ năng NẰM (giữ C)**: hitbox còn **24px** (đạn ngang ngực bay vượt đầu),
      bắn **tĩnh hơn** (tản đạn −45%), đổi lại bò chậm (30%) và không nhảy được;
      trần thấp thì đứng dậy tự rơi về tư thế ngồi
- [x] **💰 Vàng tích luỹ vĩnh viễn từ Sinh tồn** (`ss_gold` + tổng kiếm được `ss_goldTotal`)
      — chết không mất; menu hiện **thống kê tổng vàng đã kiếm**
- [x] **🏪 MARKET ở menu chính** (mua bằng vàng tích luỹ, giá cân theo dame súng
      lục 16 · AK 23 · shotgun 72/phát · sniper 95 · rocket 85 · đòn quái 12–45):
  | Món | Giá | Hiệu quả |
  |---|---|---|
  | 🦺 Giáp chiến thuật | 600💰 | Sát thương nhận **−15%** (mọi đòn) |
  | 🪖 Nón thép | 450💰 | Headshot vào bạn **×2 → ×1.3** |
  | 👟 Giày phản lực | 300💰 | Tốc chạy **+12%** |
  | 🥊 Bao tay chiến thuật | 300💰 | Nạp đạn **nhanh 30%** |
  | 🛡️ Khiên ánh sáng | 250💰 | Hấp thụ **100 sát thương** rồi vỡ (xài 1 lần, độ bền giữ qua các trận) |
  - Khiên tự hình thành khi mang, hao bền theo từng đòn chặn, về 0 → vỡ mất (mua lại)
  - Trang bị vĩnh viễn áp cả wave lẫn DM; khiên gánh trọn đòn thì không rung/không bật lùi

### ✅ Giai đoạn 10 — ⌨️ Phím chức năng tự đổi (HOÀN THÀNH)

- [x] **Bảng ⌨️ PHÍM CHỨC NĂNG ở menu chính** (góp ý người chơi — khỏi sửa source code):
  - Bấm ô phím → nhấn phím MỚI → gán + lưu `localStorage` ngay (mở lại game vẫn nhớ)
  - Phím trùng hành động khác → **tự gỡ khỏi việc cũ** (1 phím = 1 việc), toast báo rõ
  - **ESC** = huỷ lượt học phím · nút **🔄 Mặc định** trả toàn bộ về ban đầu
  - Đổi được TẤT CẢ: chạy/nhảy/ngồi/nằm/nạp/lụm/cửa hàng/đường ngắm/tiếng/tạm dừng/10 ô súng
  - `Input.rebind/resetBinds/keyName` — binds động nạp từ `ss_binds`, test logic 70/70 PASS

### ✅ Giai đoạn 11 — 👑 BOSS THEO PHASE (mỗi 5 wave) (HOÀN THÀNH)

- [x] **Boss CỘT MỐC xuất hiện wave 5, 10, 15, 20...** (ưu tiên 1 của người chơi) —
      trồi CUỐI CÙNG sau lính, lính thường giảm còn 60% để tập trung boss
- [x] **3 PHASE theo máu còn lại** (máu ≤ 2/3 · ≤ 1/3 đổi phase):
  | Phase | Tên | Cách đánh | Điểm yếu |
  |---|---|---|---|
  | 1 | PHÁO THỦ (tím) | giữ xa 300-460px, ném loạt 3 viên cầu nổ (vòng đỏ chớp 0.8s trước) | **ĐẦU** |
  | 2 | GỌI QUÂN (cam) | đứng trụ trồi 3 crawler mỗi 4.5s (tối đa 6 con) + phun axit | **NGỰC** |
  | 3 | CUỒNG NỘ (đỏ) | lao nhanh ×1.7, BỒ lên đè, đập 30 dmg | **CHÂN** |
- [x] **ĐIỂM YẾU vàng nhấp nháy ĐỔI CHỖ theo phase** — bắn trúng **×2 sát thương**,
      văng sáng vàng báo trúng; đổi phase boss CHOÁNG 1.2s (đứng im trắng xoá) — dồn đạn!
- [x] **Telegraph rõ ràng mọi hành động**: vòng đỏ trước loạt ném · khựng trước khi bồ
      nhảy · vòng sáng vàng khi choáng · chữ "⚠️ PHASE n!" + toast + tiếng động
- [x] **Thanh máu Boss riêng** rộng + nhãn "👑 BOSS · PHASE n/3" đổi màu theo phase
- [x] **Thưởng**: 150💰 (+score 200, scale theo wave) + lần chọn modifier sau boss
      có **2 HIẾM + 1 thường**: 🌋 Hoả lực +50% · ⚡ Bắn nhanh +50% · 🎯 Xuyên +2 ·
      🛡️ Giáp nẹp 50% · 💎 Thưởng ×3 — modifier chuyển sang lưu ĐỘ MẶN thật
      (mods.dmg = 0.25/0.5...) thay vì cờ on/off, áp xuyên suốt dmg/rate/pierce/armor/money

### ✅ Giai đoạn 12 — 🔧 NÂNG CẤP SÚNG + ⓶ ALT-FIRE 10 KHẨU (HOÀN THÀNH)

- [x] **NÂNG CẤP SÚNG bằng vàng tích luỹ** (`GunUp`, `js/weapons/gunup.js`) — mua ở 🏪 Market
      (menu chính), **lưu vĩnh viễn `ss_gunLv`**, dùng cho cả Wave + Deathmatch (bot không được nâng):
      - Mỗi khẩu **5 cấp**: mỗi cấp **+10% dame · +10% băng · nạp nhanh thêm 5%**
      - Giá lên cấp = `max(giá súng, 220) × 0.5 × (cấp hiện tại + 1)` — càng lên càng đắt
        (ví dụ súng miễn phí: 110 → 220 → 330 → 440 → 550 = tổng 1650💰 lên max)
      - **Cấp 3 mở ALT-FIRE** (bắn phụ) · **cấp 5 mở PERK riêng từng khẩu**
      - Market có mục riêng 🔧 (ô `#upList`): pip `●●○○○` + mô tả stats hiện tại + gì sắp mở
      - Perk lv5: pistol nạp nhanh 15% · revolver dame +15% · smg tản đạn −25% ·
        shotgun +1 viên bi · rifle đạn AP xuyên 1 bia · minigun băng đôi +25% ·
        sniper headshot ×2.5 · rail nạp nhanh 20% · rocket nổ rộng +20% · plasma nổ rộng +15%
- [x] **ALT-FIRE cho đủ 10 khẩu** — bấm **chuột phải hoặc phím E** (rebind được, phím trùng tự gỡ),
      tiêu 1 viên băng + cooldown riêng dài hơn bắn thường; thanh súng hiện `⓶ ALT [E]: tên`:
      | Súng | Alt-fire | Perk (lv 5) |
      |---|---|---|
      | Súng lục | Liên thanh ×3 (mỗi phát 80% dame) | Nòng ngắn — nạp nhanh 15% |
      | Lục lọi | Đạn XUYÊN mọi bia ×1.5 | Đạn nóng — dame +15% |
      | SMG | Xịt côn 6 phát hình quạt | Bớt phụt — tản 75% |
      | Shotgun | SLUG đặc 45 dame xuyên + tầm xa | Nạp thêm viên — +1 viên bi |
      | AK | Bộ ba 3 phát chính xác (90%) | Đạn AP — xuyên 1 bia |
      | Minigun | **GIỮ chuột phải/E = QUAY NÒNG** — tản đạn giảm dần gần 0, đi chậm | Băng đôi +25% |
      | Sniper | Nóc nhanh — ×3 tốc, 60% dame, không xuyên | Đạn ĐKZ — headshot ×2.5 |
      | Rail | Đôi tia song song (70% mỗi tia) | Cuộn siêu dẫn — nạp nhanh 20% |
      | Tên lửa | **KÍCH NỔ GIÓ** — nổ giữa đường gần điểm ngắm | Đầu nổ to +20% |
      | Plasma | **CẦU NẢY** — dội tường ×3 rồi mới nổ (vẽ cam nóng) | Lõi ổn định +15% |
- [x] Nổ giữa đường (`airAt`) + phản xạ dội tường (tách trục ngang/dọc) trong `bullet.js`
- [x] Mọi chỗ dùng băng đều theo cấp nâng cấp: create/hồi sinh/nạp đạn/shop refill/lụm súng/hộp đạn
- [x] 84/84 test logic PASS ×4 lần chạy liên tiếp (thêm 8 test mới cho GunUp + alt-fire)

### ✅ Giai đoạn 13 — 🔟 10 CẤP NÂNG CẤP + 🏃 DASH + 💣 LỰU ĐẠN + 🛢️ VẬT THỂ PHÁ ĐƯỢC + 🎲 EVENT (HOÀN THÀNH)

- [x] **NÂNG CẤP SÚNG lên 10 CẤP** (góp ý người chơi — 5 cấp quá nhanh chạm max):
      mỗi cấp **+5% dame · +5% băng · nạp nhanh 2.5%** (lv10 = +50% dame/băng, nạp −25%);
      giá `max(giá súng, 220) × 0.3 × (cấp+1)` — súng miễn phí tổng ~3.6k💰 lên max (đường dài có mục tiêu);
      **cấp 3 mở ALT-FIRE · cấp 6 mở PERK** (trước là cấp 5)
- [x] **🏃 DASH (Shift, rebind được)**: lướt ~110px theo hướng chạy/mặt — **BẤT TỬ 0.12s** lúc lướt
      (đạn/lao quái văng qua người, văng chữ "NÉ!"), hồi chiêu 0.85s, bóng mờ cyan sau lưng, tiếng whoosh
- [x] **💣 LỰU ĐẠN (Q, rebind được)**: ném theo chuột quỹ đạo CONG (trọng lực riêng 900),
      nổ chạm đất/tường/quái/vật thể — **TRUNG LẬP: trúng CẢ HAI BÊN** (cẩn thận ném vào mặt mình!),
      55 dmg vùng 110px, hồi chiêu 6s; HUD hiện `💣 [Q] SẴN SÀNG / đếm ngược`
- [x] **🛢️ VẬT THỂ PHÁ ĐƯỢC** (`js/world/props.js`) — rải 9 vật ngẫu nhiên trên map Sinh tồn
      (đủ 3 loại, tránh spawn, không chồng nhau): che đạn + che tầm nhìn như cover ĐỘNG,
      người/quái đi XUYÊN qua được, bắn nát được (đạn thường lẫn nổ):
      - 🛢️ **Thùng nổ** (30hp): vỡ → nổ lớn 60dmg/95px **trung lập** + **DÃN NỔ DÂY CHUYỀN** các thùng gần
      - 📦 **Thùng gỗ** (60hp): vỡ → rơi vàng 20-35💰 vào ví vĩnh viễn
      - 🔧 **Ống ga** (40hp): vỡ → nổ nhỏ hơi ga 35dmg; còn sống thì rò ga (khói) báo hiệu nguy hiểm
- [x] **🎲 EVENT NGẪU NHIÊN giữa wave** — 30% sau khi dọn 1 wave, toast báo trước:
      🌧️ **Mưa axit** (giọt rơi quanh người 9dmg/2.2s) · 🌫️ **Sương mù** (tầm nhìn MỌI bên capped 300px,
      vẽ overlay quanh người) · 🏃 **Quái cuồng tốc** (+25%) · 💰 **Mùa vàng** (tiền +50%)
- [x] 92/92 test logic PASS ×4 lần chạy liên tiếp (thêm 8 test mới: dash/lựu/vật thể/event)

### ✅ Giai đoạn 14 — 🗺️ ROGUELITE MAP/NODE — CHỌN ĐƯỜNG ĐI KIỂU SLAY THE SPIRE (HOÀN THÀNH — xong lộ trình 2-7)

- [x] **Dọn mỗi wave → chọn 1 trong các LÁ** (`Wave._buildNodes` + panel `#nodePanel`,
      `js/ui/nodes.js`): bấm **1/2/3** hoặc **click thẻ** — đồng hồ nghỉ **ĐÓNG BĂNG** khi chọn
- [x] **4 loại lá**: ⚔️ **Gặp đội quân** (thường) · 👹 **Đội ELITE** (quái trâu ×1.35 · nhanh ×1.15 ·
      +40% số lượng — đổi lại **vàng ×1.6 · điểm ×1.5**, lá đầu 30% là elite) ·
      🏪 **Tiệm nghỉ đường** (vào cửa hàng KHÔNG đếm ngược, bấm B đóng tiệm → chọn lại đường) ·
      ❤️ **Ổ oasis** (hồi NGAY 50% máu + 60-120💰 rồi chọn tiếp)
- [x] **Quy tắc roguelite**: lá đầu luôn là lá ĐÁNH · mỗi hàng tối đa 1 lá nghỉ ·
      **vừa nghỉ xong → hàng kế CẤM lá nghỉ** (không nghỉ 2 lần liền)
- [x] **👑 BOSS theo chu kỳ TRẬN ĐÁNH** (mỗi 5 trận, từ trận 5): lá BOSS xuất hiện BẮT BUỘC —
      vào tiệm/ôasis KHÔNG làm trôi chu kỳ (Wave.num chỉ tăng khi ĐÁNH thật);
      hàng boss chỉ có boss + lá nghỉ (không lách boss bằng trận thường)
- [x] **Modifier 1/2/3 dời SAU khi chọn lá** — hiện trong lúc đếm ngược 4s của trận đã chọn
      (tự chọn random nếu lơ là); panel canvas vẽ được ở cả countdown lẫn intermission
- [x] Phím B (tiệm) bị chặn khi đang chọn lá/đang nghỉ tiệm — không đè lên bản đồ
- [x] **🐛 VÁ BUG người chơi báo**: cửa hàng tàu (canvas) **KHÔNG bấm được** — `Shop.handleClick`
      chưa bao giờ được nối chuột → nối vào vòng update main.js (click món hàng + nút RA ĐÁNH TIẾP);
      đồng thời chặn lỗ hổng **kẹt trong tiệm nghỉ** (phím B bị cấm khi resting) → B giờ ĐÓNG tiệm được,
      nút trong tiệm nghỉ đổi chữ "XONG? ĐÓNG TIỆM → CHỌN ĐƯỜNG" (đồng hồ đóng băng, không hiện đếm ngược sai)
- [x] 97/97 test logic PASS ×4 lần chạy liên tiếp (thêm 4 test roguelite + 1 test click cửa hàng)

### ✅ Giai đoạn 15 — 🌐 2 NGƯỜI QUA MẠNG LAN — CO-OP SINH TỒN (HOÀN THÀNH)

- [x] **`server.js` — máy chủ LAN relay thuần Node** (không cài gì thêm): `node server.js`
      → bắt tay WebSocket RFC 6455 tự viết, **chỉ 2 slot** (vào trước = HOST, sau = GUEST,
      đủ 2 người nhận `{t:'full'}`), relay tin nhắn nguyên văn 2 chiều, in banner IP LAN để máy 2 gõ,
      port **7331** — đã test thật: phân vai + relay đúng
- [x] **`js/net/net.js` — client mạng**: tạo phòng (host nối ws://localhost:7331) / vào phòng (guest gõ IP),
      báo `{t:'full'}`, mất kết nối → toast + về menu (`{t:'bye'}` 2 chiều)
- [x] **KIẾN TRÚC HOST-AUTHORITATIVE**: máy host chạy TOÀN BỘ mô phỏng (quái/wave/đạn/damage/vật thể);
      máy guest chỉ GỬI input ~30Hz + NHẬN snapshot ~20Hz rồi GHI ĐỀ dữ liệu vào CHÍNH các entity
      sẵn có (Player/Monsters/Wave/Bullets/Pickups/Props) → toàn bộ draw code dùng lại nguyên xi;
      đạn bay giữa 2 snapshot tự vẽ theo vị trí mới nhất
- [x] **Người chơi 2 full điều khiển trên MÁY MÌNH** (chuột + phím riêng — không auto-aim):
      input guest gói ~30Hz, host đổi thành "input ẢNH" (`Net.remoteInp` — bắt CẠNH phím)
      đút thẳng vào `Player.update(p, ..., inputObj)` cho entity người 2
- [x] **`Player.list` + `Player.nearest(x,y)`** — refactor chỗ nào từng gắn cứng `Player.obj`:
      quái đuổi NGƯỜI GẦN NHẤT còn sống (co-op bị quây đúng nghĩa), lụm đồ/vàng thùng gỗ
      chia cho người gần nhất, đồng hồ rain event vẫn P1-centered (giữ đơn giản)
- [x] **🤝 ĐỒNG ĐỘI CỨU TẠI CHỖ**: 1 người gục nằm SƠN SẶT (vẽ nằm xám) — đồng đội đứng cạnh
      ~70px trong **3 giây** → hồi sinh tại chỗ **50% máu** + bất tử 1.2s; đi xa → tiến độ tụt nhanh;
      HUD hiện thanh tiến độ cứu + cảnh báo nhấp nháy; **CẢ 2 gục cùng lúc mới game over**
- [x] **💰 TIỀN RIÊNG TÚI TỪNG NGƯỜI**: đạn/lựu/nổ luồn `owner` (người bắn) — quái nhớ `lastHitBy`,
      chết thì tiền về túi NGƯỜI ĐÓ (không ai bắn → người gần nhất); vàng Market cộng riêng
      (host giữ hộ gear/khiên người 2, gửi `{k:'gold'}`/`{k:'gear'}` event về máy guest tự lưu)
- [x] **GEAR RIÊNG TỪNG NGƯỜI**: nón/giáp/khiên đọc theo từng người (`p.gear`); guest gửi bộ
      Market của mình sang host lúc vào trận, thay đổi khiên host báo ngược về guest lưu lại
- [x] **Chia sẻ quyết định qua mạng**: chọn lá 🗺️ (phím/click) · modifier 1/2/3 · tiệm (B + CLICK
      món hàng — host MUA HỘ vào túi người 2) · lụm súng G → guest chỉ GỬI YÊU CẦU, host xử lý
- [x] **Đồng bộ thế giới**: camera bám ĐIỂM GIỮA 2 người (snapshot mang `cam` → guest đổi
      chuột↔world nhất quán); FX nổ/máu/tiếng súng/tiền/toast gom frame (`Net.fx`) gửi kèm snapshot
      phát lại máy guest; xác quái ghép theo `_netId`, đồ rải host XÂY LẠI từ snapshot
      (2 máy rải random là khác nhau — không tự rải); vẽ CẢ 2 người que (người 2 màu CAM)
- [x] **Menu 🌐 2 NGƯỜI QUA MẠNG**: TẠO PHÒNG / ô IP + VÀO PHÒNG / dòng trạng thái poll 300ms /
      nút SINH TỔN hiện khi đủ 2 người (chỉ máy chủ bấm); guest không pause được (máy chủ điều phối)
- [x] **100/100 test logic PASS ×3 lần chạy** (thêm 3 test: snapshot round-trip JSON,
      cứu đồng đội 3s/tụt/cả-2-gục-mới-thua, chia tiền riêng túi qua `lastHitBy`)

### ✅ Giai đoạn 16 — ⚔️ ĐỐI ĐẦU 1v1 QUA MẠNG — MỖI ĐỘI CÓ BOT (HOÀN THÀNH)

- [x] **Match tổng quát hoá**: `Match.start(mapDef, perTeam)` — chơi đơn để trống (đội A
      N-1 bot, đội B đủ N); qua mạng truyền `TEAM_SIZE-1` (mỗi đội 1 slot là NGƯỜI THẬT);
      guest dựng view truyền `0` (bot thật do host mô phỏng, snapshot dựng lại).
      `Match.update` quét TẤT CẢ người: ai gục → ĐỘI ĐỊCH +1 điểm, hồi sinh ở spawn ĐỘI MÌNH
- [x] **Snapshot mở rộng**: chụp thêm `bots` (id-mapped như quái — bỏ `target`, súng gửi id),
      `health` (túi máu hồi rải ngẫu nhiên), `match` (scoreA/scoreB/state) — guest dựng lại
      bot bằng `Bots.spawn(...)` + copy trường + giải súng từ id; bot mất khỏi snapshot bị gỡ
- [x] **Chuột guest → TOẠ ĐỘ THẾ GIỚI** (`mouse + Camera` máy guest): co-op (camera giống host)
      lẫn đối đầu (mỗi máy bám camera người mình) đều đúng — host dùng tọa độ NGUYÊN
- [x] **Camera đối đầu**: host bám NGƯỜI MÌNH (không ghim giữa 2 người như co-op),
      guest tự bám người mình sau khi áp snapshot; màu áo guest giữ màu ĐỘI B (đỏ)
      + màu guest TỰ CHỌN được khôi phục sau mỗi snapshot (`Net._guestColor`)
- [x] **Luồng trận**: `Game.startNetDM(mapId)` (host tạo 2 người đội A/B + gửi `start-dm`
      kèm teamSize/winKills) · `_guestStartDM` (guest dựng view + Match.start(mapDef, 0))
      · kết thúc qua snapshot `Match.state='ended'` → bảng kết quả (guest thắng khi scoreB>scoreA)
      · host tick snapshot cả ở nhánh DM · fx 'poof' bot chết gửi sang guest
- [x] **Menu + HUD**: nút ⚔️ ĐỐI ĐẦU 1v1 hiện cạnh SINH TỔN khi đủ 2 người (chỉ máy chủ);
      tỷ số HUD mỗi máy nhìn từ góc ĐỘI MÌNH (điểm mình bên trái, màu đội mình);
      nút ĐẤU LẠI ẩn trên máy guest (phải đợi host)
- [x] **102/102 test logic PASS ×3 lần chạy** (thêm 2 test: snapshot DM round-trip
      bot/súng/túi máu/điểm + gỡ bot mất, Match respawn đúng spawn đội + chia điểm 2 chiều)

### ✅ Giai đoạn 17 — ⚔️ ĐẤU LẠI QUA MẠNG (HOÀN THÀNH)

- [x] **Host ghi nhớ map trận mạng** (`Game._netDMMap` — set trong `startNetDM`,
      xoá trong `startDM` chơi đơn): bấm **ĐẤU LẠI** ở bảng kết quả nếu vừa chơi
      ĐỐI ĐẦU LAN → dựng lại trận mạng **cùng map đó**, còn không → DM thường như cũ
- [x] **Máy guest tự vào lại**: host bấm ĐẤU LẠI → gửi `start-dm` mới → guest nhận
      `_guestStartDM` (reset điểm/cờ `_gEndShown`) → `Menu.hideAll()` nhảy thẳng vào trận,
      không cần tạo phòng lại hay bấm gì ở máy guest
- [x] **103/103 test logic PASS ×3 lần chạy** (thêm test ĐẤU LẠI: Match.start lại
      phải xoá điểm + dựng lại đủ bot sống mới)

### 🔧 SỬA LỖI PLAYTEST MẠNG (GĐ 15-16) — chơi 2 người: ngắm đứng im + bạn 2 không điều khiển được

- [x] **GỐC RỄ**: `Player.create` luôn gán `Player.obj = người MỚI NHẤT` — host tạo người 2
      sau cùng → `Player.obj` thành nhân vật CỦA BẠN 2 → host update nhầm người: người 1
      host ĐÓNG BĂNG (đường ngắm đứng 1 chỗ, bắn lại bay ra từ nhân vật bạn 2), bạn 2 bị
      2 bộ input + physics ×2 đè lên nhau (điều khiển rất lạ)
      → **fix**: trả `Player.obj` về đúng máy mình ở cả 3 luồng (co-op host / DM host /
      guest view) + test khoá hành vi "2 người điều khiển ĐỘC LẬP"
- [x] **Cạnh phím ẢNH bị "dính"**: `remoteInp` chưa từng được `endFrame()` → `wasPressed`
      đúng ~2 frame/nhấn (nhảy/bắn đôi) → host xoá ngay sau frame dùng (`r.endFrame()`)
- [x] **Bạn 2 đổi được súng**: trước đây số 1-0/lăn chuột/bấm thanh súng trên máy guest
      vô dụng (snapshot ghi đè `wi` ngay) → thêm tin nhắn `wi`/`wiw` (guest GỬI YÊU CẦU,
      host `selectWeapon` hộ; đang chọn lá/modifier thì phím 1-3 dành cho chọn)
- [x] **104/104 test logic PASS ×3 lần chạy** (thêm test điều khiển độc lập 2 người)

### ✅ Giai đoạn 18 — ⚙️ MÀN CÀI ĐẶT RIÊNG (HOÀN THÀNH) — đường ngắm · trang phục · phím

- [x] **🎯 ĐƯỜNG NGẮM chỉnh được** (`Config.AIM`): ĐỘ DÀY (1-6px) · ĐỘ ĐẬM (10-100%) ·
      MÀU (bảng chọn màu) · KIỂU NÉT (nét đứt ngắn/dài · chấm · chấm gạch · liền mạch) —
      có canvas XEM TRƯỚC trực tiếp khi kéo; lưu `ss_aim` vào localStorage;
      `drawAimGuide` đọc Config.AIM (mặc định dày 2px, đậm 35% — đậm hơn cũ vì bạn thân kêu mờ)
- [x] **Màn ⚙️ CÀI ĐẶT gom 3 thứ**: đường ngắm + TRANG PHỤC (chấm màu áo + chọn mũ,
      có canvas xem trước người que) + nút vào ⌨️ PHÍM CHỨC NĂNG — menu chính gọn lại
      (SINH TỔN / DEATHMATCH / 2 NGƯỜI QUA MẠNG / MARKET / CÀI ĐẶT / MẸO CHƠI);
      màn PHÍM "Về menu" đổi thành "Về cài đặt" · dọn nút MARKET bị gắn onclick ×2

### ✅ Giai đoạn 19 — 👹 BOSS NHỎ THEO PHASE (HOÀN THÀNH) — elite_mini cuồng nộ

- [x] **Quái mới `elite_mini`** (config `WAVE.ELITE_MINI`): to 40×68, máu 240, tiền/điểm 60 —
      trồi CUỐI CÙNG mỗi 3 wave từ wave 3 (3, 6, 9, 12... — wave BOSS lớn 5/10/15 nhường)
      với toast '👹 BOSS NHỎ xuất hiện!' + tiếng gầm
- [x] **Phase CUỒNG NỘ khi máu ≤ 50%**: nhanh ×1.6 + NHẢY ĐÈ người chơi (leap vy −700)
      mỗi ~3.2s (mới cuồng nhảy sớm sau 1.2s) — báo trước bằng text '⚠️ CUỒNG NỘ!',
      tia lửa đỏ, nháy trắng, toast; màu đổi TÍM → ĐỎ + vương miện chớp chớp
- [x] **Thanh máu riêng kiểu boss** ('👹 BOSS NHỎ' → '👹 BOSS NHỎ · CUỒNG NỘ!') + xác chết
      loé sáng 'BOSS NHỎ GỤC!' (không có modifier hiếm như boss lớn)

### ✅ Giai đoạn 20 — ☠️ HAZARD + 🌌 PARALLAX (HOÀN THÀNH) — mây độc, tia điện, nền sâu

- [x] **Module mới `js/world/hazards.js`** — hazard CỐ ĐỊNH đọc từ `mapDef.hazards`
      (deterministic — 2 máy mạng tự dựng GIỐNG nhau, không cần đồng bộ):
      • **gas**: ống ga phóng mây độc chu kỳ 6s (phóng 3.2s) bán kính 95 — đốt 7 máu/giây
        theo TICK 0.5s (tránh knockback loạn), trúng CẢ người + quái + bot (quái chết vì gas
        vẫn thưởng vàng người gần nhất); đứng trong mây → viền XANH LÁ phập phù
      • **zap**: 2 cột điện phóng tia ngang — tích điện 1.1s (tia lửa + vòng chớp BÁO TRƯỚC)
        rồi PHÓNG tia 0.55s dính đòn 18 NGAY (mỗi đợt trúng tối đa 1 lần); nhảy lên né được
- [x] **🚨 Đèn báo động** từ wave 8 (`HAZARD.ALARM_AT`): viền ĐỎ nhấp nháy + còi bíp bíp
      đều đặn — biết là map đang nguy hiểm; máy guest CHỈ VẼ hazard (host mô phỏng damage)
- [x] **🌌 Parallax nền**: thêm 2 lớp sao XA (hệ số thị sai 0.45/0.7 — trôi chậm hơn lớp cũ
      0.25) + 3 vệt TINH VÂN tím/teal/hồng trôi cực chậm — nền vũ trụ có chiều sâu
- [x] **Map có hazard**: Boong tàu (wave: 2 ống ga + cặp cột điện trên dầm giữa) ·
      Buồng chứa hàng (DM: 2 ống ga + cột điện giữa map) — đặt xa điểm spawn
- [x] **107/107 test logic PASS ×3 lần chạy** (thêm 3 test: queue boss nhỏ · cuồng nộ/nhảy đè ·
      hazard spawn/gas tick/zap qua biên CHARGE)

### 🔧 SỬA LỖI PLAYTEST — GĐ 19/20 (item chìm trong bê tông + menu nhóm + Đấu Đội tiếng Việt)

- [x] **🧱 Item chôn trong khối bê tông** (góp ý người chơi): Props dùng `_baseYAt` = mặt sàn
      THẤP NHẤT của cột → trên map có tháp/container ngay trên sàn, thùng nổ/gỗ/ống ga bị
      CHÔN trong bê tông mà vẫn bắn trúng được → đổi sang logic "điểm đứng được" như súng rải
      (trống 2 ô trên đầu) — vật nằm TRÊN ĐỈNH container/bậc thềm là hợp lý, không bao giờ
      chìm; súng rải bỏ HÀNG ĐÁY (hố kẹt giữa 2 mảng sàn cột 18-20 map Boong tàu); hazard
      (ống ga/cột điện) cũng thêm chống chìm + dời cặp cột điện map Boong tàu khỏi tháp 24-27
- [x] **🇻🇳 DEATHMATCH → ĐẤU ĐỘI** (tiếng Việt) + menu gom NHÓM: nhóm 🎮 CHẾ ĐỘ CHƠI
      (Sinh tồn / Đấu Đội / 2 Người Qua Mạng) + nhóm 🛠️ TIỆN ÍCH (Market / Cài Đặt / Mẹo);
      bấm ĐẤU ĐỘI mở panel THIẾT LẬP riêng (chọn map · số người/đội · số kill thắng ·
      nút ▶ VÀO TRẬN) — các tuỳ chọn thuộc về đúng chế độ của nó, menu gọn hơn
- [x] **108/108 test logic PASS ×3 lần chạy** (thêm test chống chìm: props ×30 lần rải không
      đè ô đặc · súng không chìm hàng đáy · cột điện né tháp bê tông)

### 🔧 SỬA MENU (góp ý người chơi) — cột phải đỡ dài + Sinh Tồn chọn map được

- [x] **🎨 Menu gọn**: khối 🛠️ TIỆN ÍCH (Market / Cài Đặt / Mẹo Chơi) dời xuống CỘT PHẢI,
      dưới canvas người que động + gợi ý phím — cột trái chỉ còn CHẾ ĐỘ CHƠI, hết tràn màn hình
- [x] **🗺️ SINH TỔN chọn map được như Đấu Đội**: map picker dùng CHUNG cho cả 2 chế độ
      (đặt trên cùng nhóm 🎮 CHẾ ĐỘ CHƠI, có đủ 5 map gồm cả Boong tàu) — chọn 1 phát,
      mode nào cũng xài; map DM giờ là map Sinh Tồn hợp lệ: người chơi spawn tại điểm
      đội A (chân chạm sàn), quái trồi tại các điểm spawn của map (Boong tàu được thêm
      spawns 2 đội); "ĐÁNH LẠI" giữ đúng map; co-op LAN gửi đúng mapId sang máy guest
- [x] **112/112 test logic PASS ×3 lần chạy** (thêm: spawn Sinh Tồn trên map DM +
      **3 test mobile**: input ảo OR Input thật · máy trạng thái ngồi/nằm · joystick ngắm)

### 📱 GĐ 21 — ĐIỀU KHIỂN MOBILE (nút cảm ứng cho điện thoại)

- [x] **⚙️ CÀI ĐẶT → 📱 THIẾT BỊ**: 2 nút 🖥️ MÁY TÍNH / 📱 MOBILE — lưu `ss_device`;
      máy cảm ứng chưa từng chọn → TỰ bật mobile; bàn phím vẫn xài song song (OR input)
- [x] **Cụm TRÁI-DƯỚI**: ◀ đi trái · ▶ đi phải · 🔫 bắn (to, nửa trong suốt)
- [x] **Cụm PHẢI-DƯỚI**: joystick NGẮM kéo MỌI GÓC (độ dài kéo = tầm ngắm 120–300px
      quanh người chơi, núm xoay theo ngón) + vòng ngoài: 🔄 đổi súng (sang khẩu kế) ·
      ⏫ nhảy · ⏬ xuống · 🔫 bắn
- [x] **⏬ máy trạng thái ngồi/nằm**: tap 1 = NGỒI (giữ) · GIỮ ≥0.35s = NẰM (thả = đứng) ·
      NHẤN ĐÔI <0.3s = NẰM KÉO DÀI (tap lần nữa → ngồi)
- [x] **Nút mini TRÊN-PHẢI**: ⏸ dừng · 🛒 cửa hàng · ✋ lụm súng · ⟳ nạp · 💣 lựu đạn · 🏃 dash
- [x] **Kỹ thuật**: module mới `js/ui/mobile.js` — giả lập ĐỦ interface `Input`
      (isDown/wasPressed/mouse/endFrame) → main.js/net.js/wave.js tự dùng input ĐANG
      HOẠT ĐỘNG; gameLoop gọi `Mobile.endFrame()` TRƯỚC `Input.endFrame()` (cạnh thật
      còn nguyên); chạm canvas = tap chuột (bắn + bấm cửa hàng); nút ẩn khi menu/pause;
      nút 🛒 = "bấm phím B ẢO" nên cửa hàng nhận đúng; guest mạng gửi input từ nút ảo
- [x] **112/112 test logic PASS ×3 lần chạy**

### 🔥 GĐ 22 — GATLING: khẩu ĐỘC QUYỀN chợ (theo yêu cầu người chơi)

- [x] **🔥 Gatling 11 nòng** — bắn nhanh nhất game (~36 phát/s, dame 6, tản 0.075),
  giữ bắn phụ = QUAY NÒNG như súng máy; vẽ nòng vàng đồng riêng (4 nòng + hộp đạn đồng)
- [x] **Chỉ bán ở 🏪 MARKET — 8888 💰 vàng tích luỹ** (mua 1 lần sở hữu VĨNH VIỄN, lưu
  `ss_guns`); KHÔNG bán trong cửa hàng trận, KHÔNG rải trên map (cả bot cũng không lụm được);
  ô thanh súng thứ 11 hiển thị ★ (không có phím số — đổi bằng 🔄/lăn chuột)
- [x] **Đạn GIỚI HẠN 100 viên** khi vừa mua/vào trận (khác mọi súng mua trong trận = ∞):
  • **Hộp đạn VÀNG hiếm** trên map: 10%/hộp → +100 viên, thùng vàng bóng + hào quang
  vàng rực + nhãn ✨📦 · • **Mua 100 viên 88💰** ở cửa hàng giữa wave (trần dự trữ 2 băng);
  mục "Nạp đầy đạn mọi khẩu" 50💰 **bỏ qua** Gatling để không phá giá đạn
- [x] **Nâng cấp riêng**: băng 100 → **500 viên ở MAX** (đường mũ ×5^(lv/10)); giá lên cấp =
  **bội số của 8** (304 · 600 · 904... · MAX 3000) và **đắt gấp 2** khẩu đắt nhất (RAIL);
  PERK lv6 "Băng thép" +10% (vẫn nẹp 500)
- [x] **Co-op mạng**: máy guest gửi tin nhắn `guns` → host mở khoá GIỮ HỘ với đúng đạn giới hạn
- [x] **117/117 test logic PASS ×3 lần chạy** (5 test Gatling mới)

### 🚦🎨 GĐ 23 — CHỐNG LAG SÚNG LIÊN THANH + CỬA HÀNG GRID ÔNG GIÀ CHỦ TIỆM (theo playtest)

- [x] **🚦 Hitstop GIỚI HẠN 1 lần/0.18s** (`Time.hitstopCd`): gatling 36 phát/s × 28% trúng đầu
  → hitstop liên tục → thời gian chảy 6% VĨNH VIỄN = game như ĐÓNG BĂNG, "súng tự bắn
  không điều khiển được" — đúng triệu chứng bạn báo; giờ headshot liên tục chỉ khựng nhịp nhàng
- [x] **🚦 Audio throttle**: mỗi loại tiếng chỉ phát lại sau 28ms (súng máy 50ms) — hết
  ~100 node WebAudio/giây gây lag dồn dập; tiếng trúng đạn throttle 30ms; co-op tin nhắn
  tiếng bắn throttle 60ms
- [x] **🚦 Trần đồ hiệu ứng**: vệt đạn `tracers` nẹp 150 (xả vệt cũ nhất); rung camera
  trần 20 → 10 (hết cảnh hình "nhiễu" loá mắt); chữ số damage chỉ vẽ 1 chữ/30ms
  (chữ QUAN TRỌNG — boss phase, cứu đồng đội — có `force=true` không bị bỏ)
- [x] **🎨 Cửa hàng GRID**: mỗi món 1 ô vuông (4 cột, icon súng/thùng đạn/thốc + tên + giá) —
  hết choáng không gian kiểu 1 dòng/món; bấm ô = CHỌN XEM (không mua luôn)
- [x] **🎨 Khung phóng lớn**: món được chọn QUAY CHẦM CHẦM quanh điểm cố định (nhìn mọi
  góc, có bóng đổ sân khấu); bên dưới = tên + GIÁ + chi tiết tác dụng từng dòng +
  TRẠNG THÁI (✅ ĐÃ TRANG BỊ / ❌ CHƯA TRANG BỊ / 🧪 TIÊU HAO + dự trữ Gatling) + nút 🛒 MUA
- [x] **🎨 Ông GIÀ chủ tiệm**: vẽ canvas — nón lá + râu trắng + gậy gỗ + áo choàng cong lưng,
  5 tâm trạng (idle/happy/angry/sad/encourage) đổi lông mày + miệng + hiệu ứng (💢✨💧);
  bong bóng thoại xoay bộ quote: "Khách quan ơi cần mua gì?", "Bổn tiệm có rất nhiều đồ
  quý giá, sịn xò con bò!", MUA → cười "Quý khách thật có con mắt tinh tường!", nghèo →
  cau có "Nghèo mà bày đặt vào tiệm mua đồ!", ế → "Sáng giờ chưa ai mở hàng! Chán ghê!",
  ra về không mua → động viên "Ráng cày đi rùi quay lại ủng hộ bổn tiệm nhé!" (nhớ mặt,
  lần mở sau thể hiện)
- [x] **🤝 co-op giữ nguyên cơ chế mua**: guest bấm ô = xem, bấm MUA = gửi `{t:'buy'}`
  sang host (host tìm lại món MỚI NHẤT theo kind/w rồi mua hộ vào túi người 2)
- [x] **121/121 test logic PASS ×3 lần chạy** (4 test mới: shop grid/MUA/quote ông già ×2,
  hitstop giới hạn, audio/tracers/camera/chữ damage throttle)

### 🔧🎨 GĐ 23b — sửa 3 góp ý playtest: tâm quay · ông già đọc kịp · MARKET = CỬA HÀNG

- [x] **🎯 Quay đúng TÂM ITEM**: súng vẽ 1 lần vào canvas ẨN (sprite cache per khẩu)
  rồi xoay TẤM ẢNH quanh tâm nó — hết cảnh quay lệch quanh điểm xa trông "không phù hợp";
  không còn nhảy mirror khi quay sang nửa trái (sprite bake góc 0 không lật)
- [x] **⏱️ Ông già nói đỡ liên tục**: tìm ra bug — nhánh idle đổi quote mà KHÔNG reset
  timer → ông già nhể câu mới MỖI FRAME, không kịp đọc. Tách bộ máy chung `window.Keeper`:
  vui/cau có/buồn giữ 4s → về idle; idle giữ 8-12s mới đổi câu (cả 2 cửa hàng cùng dùng)
- [x] **🏪 MARKET → CỬA HÀNG canvas**: viết lại Market từ panel DOM thành overlay CANVAS
  GIỐNG HẾT cửa hàng giữa wave — GRID ô vuông + khung phóng lớn món quay quanh tâm +
  chi tiết tác dụng + TRẠNG THÁI + nút MUA + ông già chủ tiệm (bộ máy Keeper dùng chung);
  3 TAB: 🔫 SÚNG ĐỘC QUYỀN (Gatling) · 🔧 NÂNG CẤP SÚNG (11 khẩu × 10 cấp) ·
  🪖 TRANG BỊ (giáp/nón/giày/bao tay/khiên); bấm tab/ô/mua = canvas click; ESC/‹ VỀ MENU
  thoát; đổi tên mọi chỗ user thấy: nút menu "🏪 CỬA HÀNG", panel DOM (dự phòng),
  ô thanh súng "🏪 C.Hàng", help trong game
- [x] **123/123 test logic PASS ×3 lần chạy** (2 test mới: Keeper có giờ nghỉ không đổi
  quote mỗi frame + CỬA HÀNG canvas 3 tab/MUA trừ vàng/ông già cau có khi thiếu vàng)

### 🖱️🎯 GĐ 23c — sửa 3 góp ý playtest: con trỏ chuột · tâm quay trang bị · ESC về menu

- [x] **🖱️ Chuột mất trong cửa hàng**: canvas ẩn cursor CSS (`cursor: none`) mà tiệm
  không vẽ tâm ngắm → không biết chuột ở đâu. Giờ 2 cửa hàng đều tự vẽ 🖱️ CON TRỎ
  MŨI TÊN trắng viền đen ngay trên panel (vẽ CUỐI cùng); tâm ngắm trận ẩn khi tiệm
  mở để khỏi 2 con trỏ chồng nhau
- [x] **🎯 Trang bị quay đúng TRỌNG TÂM**: emoji 🦺🪖👟🥊🛡️ vẽ theo `textBaseline='top'`
  lệch khỏi điểm xoay → quay "tránh các pích". Đổi sang `textBaseline='middle'` +
  vẽ tại (0,0) — trọng tâm glyph = điểm quay, xoay đều đúng tâm item
- [x] **🔙 ESC / ‹ VỀ MENU màn hình trống**: tiệm chỉ tự ẩn mà không mở lại MENU DOM →
  chỉ còn nền map. Giờ main.js tự mở lại menu chính ngay khi tiệm đóng (ESC lẫn nút)
- [x] **123/123 test logic PASS** (không đổi logic test — sửa thuần vẽ/luồng UI)

### 🕳️🎯 GĐ 24 — fix 2 bug Đấu Đội 5v5 + chế độ MỚI "1 vs NHIỀU"

- [x] **🕳️ Rơi hố không chết (5v5)**: nguyên nhân — map ĐẤU ĐỘI chọn được cả map Wave
  "Boong tàu" (có hố sàn cột 18-20); người lẫn bot rơi xuống dưới đáy map thì KẼT
  mà không gục (không ai ăn điểm) → trông như "mọi người biến mất, không phân thắng thua".
  Fix: rơi qua `Level.pxH + 80` → **hp = 0** (gục như bị bắn) — Match.update tự cho
  đội địch +1 điểm + hồi sinh sau 3s; bot tự respawn như thường; quái đã có
  sẵn luật này (monster.js). Người thử thấy "xả đạn được" vì bot còn sống dưới đáy.
- [x] **🎯 Chế độ MỚI "1 vs NHIỀU"** (nút 🎯 ở menu chính): MỘT mình bạn (đội A)
  vs **6 bot đỏ** (Config.SOLO.ENEMIES) — Match.start nhận tham số `solo`
  (luồng mạng guest perTeam=0 KHÔNG bị ảnh hưởng)
- [x] **🏟️ Map MỚI "Đấu Trường Colosseum"**: RỘNG GẤP ĐÔI (120 cột = 3840px),
  sàn LIỀN MẠCH không hố, chướng ngại dày 3 vùng (container 3-5 ô · trụ đá ·
  thùng) + giàn giáo một-chiều vòng quanh map + hành lang cao 2 mép;
  đội B spawn DÃI khắp map (10 điểm từ giữa tới mép phải — bot không dồn góc);
  hazard ống ga ×3 + cặp cột điện phóng tia ngang; **thêm Props** (thùng nổ/gỗ/
  ống ga) chỉ chế độ này — "nhiều chướng ngại hơn" đúng yêu cầu
- [x] Map Đấu Trường cũng chọn được trong ĐẤU ĐỘI 5v5 (menu.maps thêm 'colosseum');
  nút ĐẤU LẠI thông minh: vừa chơi solo → đấu lại solo, vừa chơi mạng → đấu lại mạng
- [x] **127/127 test logic PASS ×3** (4 test mới: người rơi hố gục + điểm + hồi sinh;
  bot rơi hố gục + tự hồi sinh; Match solo đội A 0 bot/đội B đủ 6; map Đấu Trường
  đúng quy tắc — sàn liền, khối ≤5 ô, spawn trên đất, dải map, props/súng rải được)
  + menu_click_test OK (5 đường vào trận: wave/wave-coop/dm/solo/netdm)

### 🤖🎯 GĐ 25 — cài đặt ĐỘ CHÍNH XÁC NPC (DỄ/VỪA/KHÓ/SIÊU KHÓ)

- [x] **Vì sao trước đây bot gần như bách phát bách trúng**: sai số ngắm cũ là
  góc CỐ ĐỊNH `max(0.03, 0.26 − lockT·0.22)` → chỉ cần khoá mục tiêu ~1s là sai số
  ≤0.03 rad, trong khi nửa góc thân người ở 300px chỉ ~0.047 rad → gần như phát nào
  cũng trúng, dồn damage chết ngay khi ló mặt
- [x] **Độ chính xác theo ĐỘ KHÓ** (⚙️ Cài Đặt): 4 mức **DỄ 50% · VỪA 75% ·
  KHÓ 90% · SIÊU KHÓ 100%**, lưu `ss_aiLv`, áp dụng MỌI bot (Đấu Đội · 1 vs Nhiều ·
  bot trận mạng). Sai số ngắm = nửa góc thân mục tiêu ÷ acc → tự co lại khi mục
  tiêu xa nên **tỉ lệ trúng ổn định mọi khoảng cách** (100% = luôn trong thân,
  50% = trượt một nửa, có phát lệch hẳn ra ngoài)
- [x] Nút chọn 4 mức trong Cài Đặt + dòng ghi chú giải thích; mặc định **VỪA 75%**
- [x] **129/129 test logic PASS ×10 lần chạy** (2 test mới: Config 4 mức đúng
  50/75/90/100% + lưu/đọc; ĐO THẬT sai số ngắm bot theo từng mức — DỄ lệch gấp đôi
  SIÊU KHÓ, SIÊU KHÓ không bao giờ ngắm ra ngoài thân) + menu_click_test kiểm tra
  bấm DỄ → LEVEL 0 + ghi chú 50%

### ⚙️🧩 GĐ 26 — gom CÀI ĐẶT thành DANH SÁCH + hộp thoại OK/HUỶ & 🗺️ BẢN ĐỒ CỦA TÔI

- [x] **⚙️ Cài Đặt gọn lại**: bỏ hàng loạt slider/nút rải rác, mỗi mục thành **1 DÒNG**
  (🎯 Đường ngắm bắn · 👕 Trang phục · 🤖 Độ chính xác NPC · 📱 Thiết bị · ⌨️ Phím chức năng).
  Dòng hiện luôn giá trị tóm tắt bên phải (vd `2px · 35%`, `🙂 VỪA · 75%`)
- [x] **Hộp thoại OK / HUỶ thật**: bấm dòng → mở popup chỉnh riêng. Chỉnh thấy hiệu ứng
  ngay nhưng **chưa ghi localStorage**; ✔ OK mới lưu + cập nhật dòng · ✖ HUỶ (hoặc ESC,
  hoặc bấm ra ngoài) **khôi phục nguyên trạng** ảnh chụp lúc mở. ESC chặn ở pha capture
  để không rơi vào pause/menu của main.js
- [x] **🗺️ BẢN ĐỒ CỦA TÔI** (menu chính): ⬇️ tải map mẫu JSON · 📤 xuất map đang chọn ·
  📥 nhập file `.json` → kiểm tra hợp lệ → **lưu vĩnh viễn `ss_maps`** → tự chọn trong
  ô map ở menu, chơi được cả SINH TỒN lẫn ĐẤU ĐỘI; danh sách map tự tạo có nút ▶ CHƠI /
  📤 XUẤT / 🗑 XOÁ
- [x] **Khuôn map**: lưới 24 hàng × 60 cột (ô 32px), `#` tường · `-` bậc 1 chiều · `.` trống,
  sàn đáy liền, spawn `A`/`B`. Chặn file hỏng: JSON sai, thiếu `rows`, ký tự lạ, ngoài
  12-40 hàng / 20-160 cột, file > 300KB; tự bỏ hazard/cây sai, tự thêm spawn mặc định
  nếu thiếu; tên map lọc HTML + gộp khoảng trắng
- [x] **Fix hiển thị chồng khung**: CSS thiếu luật ẩn chung cho class `.hidden` → cả 4 khung
  hộp thoại (đường ngắm + trang phục + NPC + thiết bị) hiện cùng lúc. Thêm
  `.hidden { display:none !important }` — mỗi hộp thoại chỉ hiện đúng khung của mục đang
  chọn; panel DM và nút mạng cũng ẩn/hiện đúng như thiết kế. menu_click_test kiểm tra
  mở Đường ngắm → 3 khung còn lại phải ẩn
- [x] **134/134 test logic PASS ×3** (5 test mới: map mẫu hợp lệ · import lưu/đọc lại/xoá
  · chặn file hỏng + spawn mặc định · map tự tạo nạp Level đúng + sàn đáy đặc + spawn
  từ `spawns.A` · xuất→nhập giữ kích thước + map sinh bằng `build()` vẫn xuất được) +
  menu_click_test kiểm tra mở/OK/HUỶ hộp thoại (HUỶ trả lại độ dày + mức NPC, OK mới lưu)

### 🏭 GĐ 27 — map tự thiết kế "KHO THÉP — ẨN NÚP & BẮN TỈA" (`my_maps/stickstrike1.json`)

- [x] Sửa file map mẫu thành map chơi được: lưới **60×24 ô (1920×768px)**, sàn **liền mạch
  không hố**, 2 bên có **hầm ẩn núp** (mái + vách, cửa mở về giữa), chướng ngại mặt đất
  cao **2-4 ô** (≤128px — vẫn nhảy đơn lên được), lối đi rộng giữa các khối
- [x] **3 điểm ngắm sniper**: trái (hàng 12, cols 5-13) · giữa (hàng 10, cols 27-33,
  cao nhất — nhìn toàn map) · phải (hàng 12, cols 46-54); mỗi điểm có tường che ngang
  ngực (ngồi/nằm là kín) + giàn giáo một chiều nối liền
- [x] **Cầu thang nhảy lên được thật**: mỗi bậc cách bậc trước ≤4 ô (96px < 154px nhảy
  đơn), có bậc nối row18 → row15 → row12 ở 2 bên và row19 → row16 → row13 → row10 ở
  giữa. Test mô phỏng **vật lý Player.update thật** nhảy từ sàn lên điểm ngắm hàng 12
- [x] Tăng **137/137 test logic PASS** (3 test mới: map hợp lệ + sàn liền + obstacle ≤
  4 ô + spawn 2 đội; BFS kiểm tra mọi điểm ngắm có đường nhảy về sàn; mô phỏng nhảy
  thật qua 3 bậc). File JSON nằm ở `my_maps/stickstrike1.json` — Import qua
  🗺️ BẢN ĐỒ CỦA TÔI → 📥 NHẬP MAP (.json) là chơi ngay

### 🗺️ ROADMAP — kế hoạch cải tiến của chuyên gia (còn lại, chọn dần)
1. **Chế độ chơi mới**: ~~modifier giữa wave + quái mới~~ ✅ GĐ 8 · ~~NẰM + Market trang bị~~ ✅ GĐ 9;
       ~~boss nhỏ theo phase~~ ✅ GĐ 19
2. **Map & Level**: thùng phá được + cover cho bot ✅, map modular ghép phòng,
       ~~hazard (rò rỉ khí, tia điện, đèn báo động khi wave cao), parallax đẹp~~ ✅ GĐ 20
3. **Âm thanh**: SFX theo bề mặt trúng đạn (thép/kính/thịt) + layer vỏ đạn rơi
4. **Chế độ khác**: Free-for-all / Gun Game, Team Deathmatch đang có sẵn
5. **Meta**: settings menu (độ rung, particle density, volume riêng), achievement,
   shop preview stats, perk/skill (double jump đã có, dash, overcharge)

### ✅ Giai đoạn 5 — Đánh bóng (HOÀN THÀNH)
- [x] Menu chính DOM đẹp: chọn chế độ, chọn map DM, **đổi màu áo + mũ** có preview
      người que chạy tại chỗ ngay trong menu (hiệu ứng CSS pop, không cần thư viện;
      sau này muốn "xa xỉ" hơn có thể cắm Anime.js v4 cho các panel)
- [x] HUD đầy đủ: thanh máu, tiền, trạng thái wave, tỷ số 2 đội, thanh 10 súng
      (khóa 🔒 hiện giá), đạn từng khẩu, toast thông báo
- [x] Nhạc nền vũ trụ tự sinh: drone trầm + giai điệu ngũ cung ngẫu nhiên (Web Audio)
- [x] Pause (Esc), về menu, đấu lại — đủ vòng đời
- [x] **Bộ test logic 23/23 PASS** (`node`): vật lý, team damage, rail xuyên tường,
      nổ vùng, AI quái/bot, wave, match, hitstop, cửa hàng
- [x] `node --check` sạch toàn bộ file JS
- [ ] (Tuỳ chọn sau này) Leader board, chế độ 2 người cùng máy

## 6. Kỹ thuật cần nắm (bạn học song song, mỗi mục ~30 phút)

1. **Canvas 2D**: `fillRect`, `arc`, `lineTo`, `save/restore`, `translate` — vẽ người que toàn dùng mấy hàm này.
2. **Vòng lặp game**: `requestAnimationFrame` + `deltaTime` (update rồi vẽ).
3. **Va chạm AABB**: hình chữ nhật chạm hình chữ nhật — nền tảng của mọi va chạm trong game.
4. **Tilemap**: mảng 2 chiều số → vẽ + kiểm tra va chạm.
5. **Raycast**: tia từ nòng súng đi thẳng, gặp tường/mục tiêu thì dừng — dùng cho đạn instant (shotgun, rifle) và tầm nhìn của bot.
6. **Web Audio API**: tạo tiếng "pew" bằng sóng âm (oscillator + noise) — không cần file âm thanh.

Không cần học sẵn — mỗi giai đoạn tôi sẽ giải thích đúng phần bạn cần.

## 7. Cách chạy game

- Mở `index.html` bằng trình duyệt (Chrome/Edge) — chơi ngay. 
- Hoặc dùng VS Code + extension **Live Server** để tự tải lại khi sửa code (khuyên dùng).

## 8. Ràng buộc & lưu ý

- ~~**Không làm multiplayer qua mạng** ở giai đoạn này~~ — **ĐÃ LÀM ở GĐ 15-16** (người chơi yêu cầu):
  co-op LAN 2 máy + đối đầu 1v1 mỗi đội có bot, server relay thuần Node (`server.js`),
  host-authoritative.
- Luôn giữ game **chạy được ở cuối mỗi buổi làm** — không code khối lớn rồi mới thử.
- Mọi số liệu (damage, tốc độ, trọng lực...) nằm trong `config.js` — chỉnh cảm giác game sau này không phải mò code.
- Code vẽ người que dùng chung 1 hàm `drawStickman(color, hat, pose)` — thêm màu áo/mũ mới chỉ là thêm 1 dòng config.

---

**Trạng thái: 🎉 HOÀN THÀNH GĐ 0-27 (Cửa hàng canvas · fix rơi hố · 1 vs NHIỀU · độ chính xác NPC · Cài Đặt OK/HUỶ · BẢN ĐỒ CỦA TÔI · map KHO THÉP) — 137/137 test logic PASS.**
Mở `index.html` là chơi. Chơi 2 người LAN: máy chủ chạy `node server.js` → menu 🌐 2 NGƯỜI →
TẠO PHÒNG (máy chủ) / gõ IP + VÀO PHÒNG (máy 2) → máy chủ bấm SINH TỒN (co-op)
hoặc ĐỐI ĐẦU 1v1 (mỗi đội 1 người thật + bot đi kèm, chỉnh số bot ở menu như DM).
Muốn chỉnh cảm giác game (máu, tốc độ, giá súng...): mở `js/config.js` + `js/weapons/weapons.js` — mọi số nằm ở đó.
