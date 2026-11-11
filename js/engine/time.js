/* =========================================================
 * TIME — đồng hồ game, có HITSTOP
 * Hitstop = khựng thời gian vài chục mili-giây khi bắn trúng đầu/
 * hạ gục → cú "giật tay" đã đưa như game bắn súng lớn.
 * ========================================================= */
window.Time = {
  hitstopT: 0,

  hitstop(dur) {
    this.hitstopT = Math.max(this.hitstopT, dur);
  },

  // gọi mỗi frame: trả về dt "đã xử lý" cho update
  step(rawDt) {
    if (this.hitstopT > 0) {
      this.hitstopT -= rawDt;
      return rawDt * 0.06; // thời gian chảy chậm 94% trong lúc khựng
    }
    return rawDt;
  },

  reset() { this.hitstopT = 0; },
};
