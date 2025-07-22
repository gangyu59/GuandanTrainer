function CanvasManager() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
		this.isReady = window.cardImagesReady === true;

    if (!this.isReady) {
        window.onCardImagesLoaded = () => {
            this.isReady = true;
        };
    }
    
    this.config = {
        cardWidth: 100,
        cardHeight: 110,
        overlapOffset: 30,
        groupSpacing: 50,
        bottomMargin: 60
    };

    // 不做高分屏适配，保持原始宽高
    this.resize = function() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    };

    // 同步背景图
    this.bgImage = new Image();
    this.bgImage.src = 'assets/table.jpeg';

    this.renderHand = function(cards) {
        if (!this.isReady) {
            setTimeout(() => this.renderHand(cards), 100);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.bgImage.complete) {
            this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
        }

        this._drawCards(cards || []);
    };

		this.renderGroupedHand = function(groups) {
		    if (!this.isReady) {
		        setTimeout(() => this.renderGroupedHand(groups), 100);
		        return;
		    }
		
		    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		    if (this.bgImage.complete) {
		        this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
		    }
		
		    this._drawCards(groups);  // 直接传入二维数组
		};

    this._drawCards = function(cards) {
		    const config = this.config;
		    // ✅ 支持二维分组结构，否则兼容旧版
		    const grouped = Array.isArray(cards[0]) ? cards : this._groupCards(cards);
		
		    const totalWidth = grouped.length * config.cardWidth + (grouped.length - 1) * config.groupSpacing;
		    const startX = Math.max(20, (this.canvas.width - totalWidth) / 2);
		    const startY = this.canvas.height - config.cardHeight - config.bottomMargin;
		
		    for (let groupIndex = 0; groupIndex < grouped.length; groupIndex++) {
		        const group = grouped[groupIndex];
		        const x = startX + groupIndex * (config.cardWidth - config.groupSpacing);
		
		        for (let i = group.length - 1; i >= 0; i--) {
		            const card = group[i];
		            const y = startY - i * config.overlapOffset;
		
		            card.x = x;
		            card.y = y;
		            card.width = config.cardWidth;
		            card.height = config.cardHeight;
		
		            const imgKey = card.suit + '_' + card.value;
		            const img = window.cardImages[imgKey];
		            if (img && img.complete) {
		                this.ctx.drawImage(img, x, y, config.cardWidth, config.cardHeight);
		
		                if (card.selected) {
		                    this.ctx.save();
		                    this.ctx.globalAlpha = 0.5;
		                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		                    this.ctx.fillRect(x, y, config.cardWidth, config.cardHeight);
		                    this.ctx.restore();
		                }
		            }
		        }
		    }
		};

    this._groupCards = function(cards) {
		    // 按照 groupId 分组，未分组的牌作为一个临时组
		    const grouped = {};
		    cards.forEach(card => {
		        const gid = card.groupId || 'unGrouped';
		        if (!grouped[gid]) grouped[gid] = [];
		        grouped[gid].push(card);
		    });
		
		    const result = [];
		
		    // 先处理未分组的（从大到小排序，并按 value 分成多个小组）
		    if (grouped['unGrouped']) {
		        const sorted = grouped['unGrouped'].slice().sort((a, b) => {
		            return window.cardRules.getCardRanks()[b.value] - window.cardRules.getCardRanks()[a.value];
		        });
		
		        let currentGroup = [];
		        for (let i = 0; i < sorted.length; i++) {
		            const card = sorted[i];
		            if (currentGroup.length === 0 || currentGroup[0].value === card.value) {
		                currentGroup.push(card);
		            } else {
		                result.push(currentGroup);
		                currentGroup = [card];
		            }
		        }
		        if (currentGroup.length > 0) result.push(currentGroup);
		    }
		
		    // 再将理牌组放到后面（按 groupId 时间顺序排列）
		    Object.keys(grouped)
		        .filter(gid => gid !== 'unGrouped')
		        .sort()
		        .forEach(gid => {
		            result.push(grouped[gid]);
		        });
		
		    return result;
		};
		
		this.displayPlayedCards = function (playerIndex, cards, isPass = false) {
		    const ctx = this.ctx;
		    const config = this.config;
		
		    console.log(`📤 调用 displayPlayedCards(playerIndex=${playerIndex}, cards=${cards.length}, isPass=${isPass})`);
		
		    const cardWidth = config.cardWidth * 0.7;
		    const cardHeight = config.cardHeight * 0.7;
		    const overlap = config.overlapOffset * 0.7;
		
		    const totalWidth = Math.max(
		        cards.length * cardWidth + Math.max(0, cards.length - 1) * overlap,
		        cardWidth
		    );
		
		    let startX, startY;
		
		    switch (playerIndex) {
		        case 0:
		            startX = (this.canvas.width - totalWidth) / 2;
		            startY = this.canvas.height - cardHeight - config.bottomMargin - 100;
		            break;
		        case 1:
		            startX = 80;
		            startY = -50 + (this.canvas.height - cardHeight) / 2;
		            break;
		        case 2:
		            startX = (this.canvas.width - totalWidth) / 2;
		            startY = 80;
		            break;
		        case 3:
		            startX = this.canvas.width - 80 - totalWidth;
		            startY = -50 + (this.canvas.height - cardHeight) / 2;
		            break;
		        default:
		            console.warn(`❌ 未知的玩家索引: ${playerIndex}`);
		            return;
		    }
		
		    console.log(`📍 渲染位置 startX=${startX}, startY=${startY}, totalWidth=${totalWidth}`);
		
		    // ✅ 清理绘图区
		    ctx.clearRect(startX, startY, totalWidth, cardHeight + 20);
		
		    if (isPass) {
		        console.log(`⚠️ 玩家选择过牌，显示 “过牌” 提示`);
		        ctx.fillStyle = '#ffcc00'; // 明亮黄色
		        ctx.font = 'bold 28px Arial';
		        ctx.textAlign = 'center';
		        ctx.fillText('过牌', startX + totalWidth / 2, startY + cardHeight / 2 + 12);
		        return;
		    }
		
		    if (!cards || cards.length === 0) {
		        console.log(`⚠️ 没有牌可绘制`);
		        return;
		    }
		
		    for (let i = 0; i < cards.length; i++) {
		        const card = cards[i];
		        const x = startX + i * overlap;
		        const y = startY;
		
		        const imgKey = card.suit + '_' + card.value;
		        const img = window.cardImages[imgKey];
		
		        console.log(`🃏 准备绘制第 ${i + 1} 张: ${imgKey} at (${x}, ${y})`);
		
		        if (!img) {
		            console.warn(`❌ 未找到图像对象: ${imgKey}`);
		            continue;
		        }
		
		        if (!img.complete) {
		            console.warn(`⏳ 图像未加载完成: ${imgKey}`);
		            continue;
		        }
		
		        ctx.drawImage(img, x, y, cardWidth, cardHeight);
		        console.log(`✅ 已绘制: ${imgKey}`);
		    }
		
		    console.log(`✅ 出牌渲染完成 ✅`);
		};

    this._getValueOrder = function(value) {
        const order = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','small','big'];
        return order.indexOf(value);
    };

    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
    
}