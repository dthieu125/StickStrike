/* =========================================================
 * TIME — đồng hồ game, có HITSTOP
 * Hitstop = khựng thời gian vài chục mili-giây khi bắn trúng đầu/
 * hạ gục → cú "giật tay" đã đưa như game bắn súng lớn.
 * ========================================================= */
window.Time = {
  hitstopT: 0,
  hitstopCd: 0,
  /* 🚦 CHỐNG LAG GĐ 23: súng liên thanh trúng đầu liên tục (36 phát/s × 28% trúng đầu)
   * → hitstop được gọi suốt → thời gian chảy 6% VĨNH VIỄN → game như đóng băng,
   * súng cứ bắn mà không điều khiển được. Giới hạn: hitstop chỉ hiệu lực 1 lần mỗi 0.18s */
  HITSTOP_GAP: 0.18,

  hitstop(dur) {
    if (this.hitstopCd > 0) return; // 🚦 đang trong thời gian hồi — bỏ qua cú khựng này
    this.hitstopT = Math.max(this.hitstopT, dur);
    this.hitstopCd = this.HITSTOP_GAP;
  },

  // gọi mỗi frame: trả về dt "đã xử lý" cho update
  step(rawDt) {
    if (this.hitstopCd > 0) this.hitstopCd -= rawDt;
    if (this.hitstopT > 0) {
      this.hitstopT -= rawDt;
      return rawDt * 0.06; // thời gian chảy chậm 94% trong lúc khựng
    }
    return rawDt;
  },

  reset() { this.hitstopT = 0; this.hitstopCd = 0; },
};
