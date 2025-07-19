function OverlayRenderer(canvasId) {
  this.canvas = document.getElementById(canvasId);
  this.ctx = this.canvas.getContext("2d");

	this.lastPlays = {}; // 每位玩家的出牌状态：cards 数量 + playerIndex => 清理时用
	
  this.config = {
    cardWidth: 60,
    cardHeight: 66,
    overlap: 18,
    font: 'bold 24px Arial',
    passColor: 'yellow',
    labelColor: 'gold',
    labelFont: 'bold 28px Arial',
  };

  this.renderPlay = function (playerIndex, cards) {
	  // ✅ 用上次记录的精确区域清除
	  const last = this.lastPlays[playerIndex];
	  if (last) {
	    this.ctx.clearRect(last.x, last.y, last.width, last.height);
	    delete this.lastPlays[playerIndex];
	  }
	
	  // ✅ 判断是否过牌
	  if (!cards || cards.length === 0) {
	    this.renderPass(playerIndex);
	    const { x, y } = this.getPlayerCoords(playerIndex, 100, 40);
	    this.lastPlays[playerIndex] = {
	      x: x - 20,
	      y: y - 20,
	      width: 140,
	      height: 80,
	      type: 'pass'
	    };
	    return;
	  }
	
	  // ✅ 渲染出牌
	  const ctx = this.ctx;
	  const { cardWidth, cardHeight, overlap } = this.config;
	  const totalWidth = cardWidth + (cards.length - 1) * overlap;
	  const { x, y } = this.getPlayerCoords(playerIndex, totalWidth, cardHeight);
	
	  for (let i = 0; i < cards.length; i++) {
	    const card = cards[i];
	    const key = card.suit + "_" + card.value;
	    const img = window.cardImages[key];
	
	    if (img && img.complete) {
	      ctx.drawImage(img, x + i * overlap, y, cardWidth, cardHeight);
	    } else {
	      ctx.fillStyle = "#ccc";
	      ctx.fillRect(x + i * overlap, y, cardWidth, cardHeight);
	      ctx.strokeRect(x + i * overlap, y, cardWidth, cardHeight);
	    }
	  }
	
	  // ✅ 精确记录本次出牌区域
	  this.lastPlays[playerIndex] = {
	    x: x - 10,
	    y: y - 20,
	    width: totalWidth + 20,
	    height: cardHeight + 40
	  };
	};

  this.renderPass = function (playerIndex) {
	  const ctx = this.ctx;
	
	  // ✅ 清理旧的出牌或过牌内容（防止叠加）
	  const last = this.lastPlays[playerIndex];
	  if (last) {
	    ctx.clearRect(last.x, last.y, last.width, last.height);
	    delete this.lastPlays[playerIndex];
	  }
	
	  // 🟡 渲染“过牌”文字
	  const { x, y } = this.getPlayerCoords(playerIndex, 100, 40);
	  ctx.fillStyle = this.config.passColor;
	  ctx.font = this.config.font;
	  ctx.textAlign = 'center';
	  ctx.fillText('过牌', x + 50, y + 30);
	
	  // ✅ 记录当前“过牌”提示的位置，便于后续清除
	  this.lastPlays[playerIndex] = {
	    x: x - 20,
	    y: y - 20,
	    width: 140,
	    height: 80,
	    type: 'pass'
	  };
	};

  this.renderRankLabel = function (playerIndex, rankLabel) {
	  const ctx = this.ctx;
	
	  // ✅ 清除上一次出牌或“过牌”显示
	  const last = this.lastPlays[playerIndex];
	  if (last) {
	    if (last.type === 'pass') {
	      const { x, y } = this.getPlayerCoords(playerIndex, 100, 40);
	      ctx.clearRect(x - 20, y - 20, 140, 80);
	    } else {
	      ctx.clearRect(last.x - 5, last.y - 5, last.width + 10, last.height + 20);
	    }
	    delete this.lastPlays[playerIndex];
	  }
	
	  // ✅ 渲染几游标签
	  const { x, y } = this.getPlayerCoords(playerIndex, 100, 40);
	  ctx.fillStyle = this.config.labelColor;
	  ctx.font = this.config.labelFont;
	  ctx.textAlign = 'center';
	  ctx.fillText(rankLabel, x + 50, y + 30);
	
	  // ✅ 补充记录该标签区域，便于后续清除
	  this.lastPlays[playerIndex] = {
	    x: x - 20,   // x + 50 - 50,假设 label 宽约 100px
	    y: y - 20,        // y-20，上移一点清除范围大些
	    width: 140,   //100
	    height: 80,   //50
	    type: 'rank'
	  };
	};

  this.clearPlayerArea = function (playerIndex) {
	  const { cardWidth, cardHeight, overlap } = this.config;
	  const maxCards = 8;
	  const totalWidth = cardWidth + (maxCards - 1) * overlap;
	
	  const { x, y } = this.getPlayerCoords(playerIndex, totalWidth, cardHeight);
	  const margin = 40;
	
	  // ✅ 加大上下边距，确保“过牌”和“头游”文本也一并清除
	  this.ctx.clearRect(x - 10, y - margin, totalWidth + 20, cardHeight + 2 * margin);
	};

  this.clearAll = function () {
	  const ctx = this.ctx;
	
	  for (let i = 0; i < 4; i++) {
	    const info = this.lastPlays[i];
	    if (!info) continue;
	
	    if (info.type === 'pass') {
	      // 清理“过牌”提示
	      const { x, y } = this.getPlayerCoords(i, 100, 40);
	      ctx.clearRect(x - 20, y - 20, 140, 80);
	    } else if (info.type === 'rank') {
	      // 清理“头游”等 rankLabel 提示
	      ctx.clearRect(info.x, info.y, info.width, info.height);
	    } else {
	      // 清理普通出牌区域
	      ctx.clearRect(info.x - 5, info.y - 5, info.width + 10, info.height + 20);
	    }
	
	    delete this.lastPlays[i];
	  }
	
//	  console.log("🧹 OverlayCanvas 全部清理完成 ✅");
	};

  this.getPlayerCoords = function (playerIndex, width, height) {
    const canvas = this.canvas;

    switch (playerIndex) {
      case 0: return { x: (canvas.width - width) / 2 - 30, y: canvas.height - height - 300 }; // 南
      case 1: return { x: 120, y: (canvas.height - height) / 2 - 150 }; // 西
      case 2: return { x: (canvas.width - width) / 2 - 30, y: 80 }; // 北
      case 3: return { x: canvas.width - width - 150, y: (canvas.height - height) / 2 - 150 }; // 东
      default: return { x: 0, y: 0 };
    }
  };
}