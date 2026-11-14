/* =========================================================
 * SERVER.JS — máy CHỦ PHÒNG chạy file này để 2 máy nối mạng LAN
 *   > node server.js
 * Server chỉ là BỘ CHUYẾN TIẾP (relay): máy host chạy game thật,
 * máy guest gửi phím + nhận "ảnh chụp" thế giới. Không cần cài gì thêm.
 * ========================================================= */
'use strict';
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const PORT = 7331;

/* ── in ra các IP LAN để máy 2 gõ vào ô "VÀO PHÒNG" ── */
function lanIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name in nets) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

/* ── HTTP nhỏ để kiểm tra server sống + nhận nâng cấp WebSocket ── */
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('StickStrike relay đang chạy — mở game ở máy 2 và gõ IP này vào ô VÀO PHÒNG.');
});
server.on('upgrade', onUpgrade);

/* ── PHÒNG: chỉ 2 slot — người nối đầu tiên = HOST, thứ hai = GUEST ── */
let host = null;   // { sock }
let guest = null;
const roomFull = [];

function onUpgrade(req, sock) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  // RFC 6455: trả lời bắt tay WebSocket
  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  sock.setNoDelay(true);

  /* chặn phòng quá đông (2 người là tối đa) */
  if (host && guest) {
    wsSend(sock, JSON.stringify({ t: 'full' }));
    sock.end();
    return;
  }
  const role = host ? 'guest' : 'host';
  const me = { sock, role, buf: Buffer.alloc(0) };
  if (role === 'host') host = me; else guest = me;

  wsSend(sock, JSON.stringify({ t: 'role', role }));
  console.log('[' + new Date().toLocaleTimeString() + '] ' + role.toUpperCase() + ' đã kết nối (' + sock.remoteAddress + ')');
  if (host && guest && guest.sock) {
    wsSend(host.sock, JSON.stringify({ t: 'peer' })); // báo host: bạn 2 đã vào
    console.log('→ ĐỦ 2 NGƯỜI! Host bấm SINH TỔN để bắt đầu.');
  }

  sock.on('data', (chunk) => {
    me.buf = Buffer.concat([me.buf, chunk]);
    /* gỡ frame WebSocket và CHUYỂN TIẾP nguyên văn tin nhắn sang máy kia */
    let msg;
    while ((msg = readFrame(me)) !== null) {
      const other = me.role === 'host' ? guest : host;
      if (other && other.sock && other.sock.writable) {
        try { wsSend(other.sock, msg); } catch (e) { /* đứt dây → onclose xử lý */ }
      }
    }
  });

  sock.on('close', () => {
    const other = me.role === 'host' ? guest : host;
    if (me.role === 'host') host = null; else guest = null;
    console.log('[' + new Date().toLocaleTimeString() + '] ' + me.role.toUpperCase() + ' đã ngắt kết nối');
    if (other && other.sock && other.sock.writable) {
      wsSend(other.sock, JSON.stringify({ t: 'bye' }));
    }
  });
  sock.on('error', () => { /* im lặng — onclose lo phần dọn dẹp */ });
}

/* ── đọc 1 frame TEXT từ buffer (trả về chuỗi hoặc null nếu chưa đủ) ── */
function readFrame(me) {
  const buf = me.buf;
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  if (buf.length < off + (masked ? 4 : 0) + len) return null;

  let payload;
  if (masked) {
    const mask = buf.slice(off, off + 4);
    payload = buf.slice(off + 4, off + 4 + len);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    off += 4 + len;
  } else {
    payload = buf.slice(off, off + len);
    off += len;
  }
  me.buf = buf.slice(off); // phần còn lại cho frame sau

  if (opcode === 0x8) { me.sock.end(); return null; }  // close frame
  if (opcode === 0x9) { wsSend(me.sock, '', 0xA); return null; } // ping → pong
  if (opcode !== 0x1) return null; // chỉ nhận TEXT
  if (!fin) return null; // frame rời mảnh — bỏ qua (tin nhắn của ta luôn gọn)
  return payload.toString('utf8');
}

/* ── đóng gói 1 frame TEXT gửi đi ── */
function wsSend(sock, str, opcode) {
  const op = opcode || 0x1;
  const data = Buffer.from(str, 'utf8');
  let head;
  if (data.length < 126) {
    head = Buffer.from([0x80 | op, data.length]);
  } else if (data.length < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(data.length, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2);
  }
  sock.write(Buffer.concat([head, data]));
}

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   STICKSTRIKE — MÁY CHỦ LAN (relay 2 người)       ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log('  ║  Máy 2 mở game → 🌐 2 NGƯỜI → VÀO PHÒNG, gõ IP:  ║');
  for (const ip of lanIPs()) console.log('  ║    ▸ ' + ip.padEnd(42, ' ') + ' ║');
  console.log('  ║  (không tắt cửa sổ này trong lúc chơi!)          ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});
