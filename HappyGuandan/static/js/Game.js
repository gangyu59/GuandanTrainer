//game.js

function Game(playerCount, firstPlayerIndex = 0) {
    this.players = [];
		this.currentPlayerIndex = firstPlayerIndex; // ✅ 用传入的参数初始化先手
    this.deck = new Deck();
    this.canvasManager = new CanvasManager();
    this.cardSelector = null;
    this.playerCount = playerCount || 4;

		this.cardRules = window.cardRules;
		this.cardPower = window.cardPower;

    this.lastPlayed = null; // 记录上一手牌 { cards: [...], playerIndex, type }
    this.passCount = 0;
    this.finishedPlayers = [];
		this.gameOver = false;
		
		// 清除上一盘结果展示
		const resultLabels = document.querySelectorAll('.result-label');
		resultLabels.forEach(label => label.textContent = '');
		
		window.overlayRenderer = new OverlayRenderer('overlay-canvas');

		this.initPlayers = function () {
		  for (let i = 0; i < this.playerCount; i++) {
		    const isHuman = (i === 0) && !window.settings.autoPlay;
		    this.players.push(new Player(i, isHuman));
		  }
		};

		this.dealCards = function() {
		    this.deck.shuffle(); // 洗牌
		    const allCards = this.deck.cards.slice(); // 不用 splice，拷贝原牌堆
		    const perPlayer = 27;
		
		    if (allCards.length !== this.players.length * perPlayer) {
		        console.error(`❌ 牌数不对：共 ${allCards.length} 张，应为 ${this.players.length * perPlayer}`);
		        return;
		    }
		
		    for (let i = 0; i < this.players.length; i++) {
		        const start = i * perPlayer;
		        const end = start + perPlayer;
		        const chunk = allCards.slice(start, end);
		        this.players[i].cards = chunk;
		    }
		
		    // ✅ 控制台输出检查
		    for (let i = 0; i < this.players.length; i++) {
		        const str = this.players[i].cards.map(c => c.suit + c.value).join(' ');
	//	        console.log(`玩家 ${i} 手牌共 ${this.players[i].cards.length} 张:\n${str}`);
		    }
		};

    this.start = function () {
		  this.initPlayers();
		  this.dealCards();
		  this.gameOver = false;
		
		  const southPlayer = this.players[0];
		
		  this.cardSelector = new CardSelector(this.canvasManager);
		  this.cardSelector.init(southPlayer.cards);      // ✅ 无论人还是 AI 都初始化
		  this.canvasManager.renderHand(southPlayer.cards); // ✅ 始终展示南家手牌
		
		  this.updatePlayerIcons(this.currentPlayerIndex);
		  this.handlePlayTurn();
		
		  if (southPlayer.isHuman) {
		    window.bindHumanPlayEvents(); // ✅ 仅人类才绑定按钮事件
		  }
		};

		this.handleHumanPlay = function () {
		  const currentPlayer = this.players[this.currentPlayerIndex];
		  if (!currentPlayer.isHuman) return;
		
		  const selected = this.cardSelector.selectedCards.slice();
		  const type = window.cardRules.getCardType(selected);
		  if (!type) {
		    alert("你选择的牌不构成有效牌型！");
		    return;
		  }
		
		  const valid = window.gameRules.validPlay({
		    playerIndex: currentPlayer.index,
		    selected,
		    type,
		    lastPlay: this.lastPlayed,
		    lastPlayerIndex: this.lastPlayerIndex,
		    cardRules: window.cardRules,
		    cardPower: window.cardPower
		  });
		
		  if (!valid) {
		    alert("你的牌不能压过上一手牌！");
		    return;
		  }
		
		  // ✅ 出牌逻辑
		  currentPlayer.removeCards(selected);
		  this.cardSelector.originalCards = currentPlayer.cards;
		  this.cardSelector.selectedCards = [];
		  this.cardSelector.render();
		
		  this._updateBoardPlay(currentPlayer.index, selected);
		
		  this.lastPlayed = {
		    playerIndex: currentPlayer.index,
		    type,
		    cards: selected
		  };
		  this.lastPlayerIndex = currentPlayer.index;
		
		  if (currentPlayer.cards.length === 0 && !this.finishedPlayers.includes(currentPlayer.index)) {
		    this.finishedPlayers.push(currentPlayer.index);
		
		    // ✅ 立即在 overlayCanvas 上标记几游
		    const labels = ['头游', '二游', '三游', '末游'];
		    const label = labels[this.finishedPlayers.length - 1] || `第${this.finishedPlayers.length}游`;
		    window.overlayRenderer.renderRankLabel(currentPlayer.index, label);
		
		    this.checkGameOver(); // ✅ 游戏是否已结束
		  }
		
		  this._nextTurn(false);
		};
		
		this.handleHumanPass = function () {
		    const currentPlayer = this.players[this.currentPlayerIndex];
		    if (!currentPlayer.isHuman) return;
			this._updateBoardPlay(currentPlayer.index, [], true);
		    this._nextTurn(true);
		};

    this.promptCurrentPlayer = function() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer.isHuman) {
   //         console.log(`🧍 玩家 ${currentPlayer.index + 1} 出牌`);
        } else {
            setTimeout(() => {
                const move = window.playCard(currentPlayer, this.lastPlayed);
                this.handlePlay(move);
            }, 500);
        }
    };

    this.handlePlay = function(move) {
		  const player = this.players[this.currentPlayerIndex];
		
		  if (move.type === 'pass') {
	//	    console.log(`🚫 玩家 ${player.index + 1} 选择 PASS`);
		    this._updateBoardPlay(player.index, [], true);
		    this.passCount++;
		
		    if (this.passCount >= this.players.length - 1) {
//		      console.log("🧹 所有人都 PASS，清除出牌区");
		      this.overlayRenderer.clearAll();
		      this.lastPlayed = null;
		      this.lastPlayerIndex = null;
		      this.passCount = 0;
		    }
		
		    this._nextTurn(true);
		    return;
		  }
		
		  // ✅ 有人出了牌，重置 PASS
		  this.passCount = 0;
		
		  player.removeCards(move.cards);
		  this._updateBoardPlay(player.index, move.cards);
		
		  this.lastPlayed = {
		    cards: move.cards,
		    playerIndex: player.index,
		    type: move.type
		  };
		  this.lastPlayerIndex = player.index;
		
			if (player.index === 0) {
			  this.cardSelector.originalCards = player.cards;
			  this.cardSelector.selectedCards = [];
			  this.cardSelector.render(); // ✅ 让我们看到 AI 出完牌后剩下什么
			}

		  if (player.cards.length === 0 && !this.finishedPlayers.includes(player.index)) {
		    this.finishedPlayers.push(player.index);
		
		    // ✅ AI 玩家出完立即标记几游
		    const labels = ['头游', '二游', '三游', '末游'];
		    const label = labels[this.finishedPlayers.length - 1] || `第${this.finishedPlayers.length}游`;
		    window.overlayRenderer.renderRankLabel(player.index, label);
		
		    console.log(`🏁 玩家 ${player.index + 1} 出完牌了！`);
		    this.checkGameOver();
		  }
		
		  this._nextTurn(false);
		};

    this.getNextActivePlayer = function() {
        let next = (this.currentPlayerIndex + 1) % this.players.length;
        while (this.finishedPlayers.includes(next)) {
            next = (next + 1) % this.players.length;
        }
        return next;
    };
		
		this.handlePlayTurn = function () {
		  const currentPlayer = this.players[this.currentPlayerIndex];
		  this.updatePlayerIcons(this.currentPlayerIndex);
		
		  if (currentPlayer.isHuman) {
//		    console.log(`🧍 玩家 ${currentPlayer.index + 1} 出牌`);
		
		    // ✅ 只控制按钮是否可用，事件由 bindHumanPlayEvents 控制
		    const playBtn = document.getElementById('play-btn');
		    const passBtn = document.getElementById('pass-btn');
		    playBtn.disabled = false;
		    passBtn.disabled = false;
		
		  } else {
	//	    console.log(`🤖 AI 玩家 ${currentPlayer.index + 1} 正在思考...`);
		
		    // ✅ AI 玩家出牌逻辑
		    const ai = new PlayCard(window.cardRules, window.cardPower);
				ai.playTurn(this);
		  }
		};
				
		// 设置当前玩家高亮，其它人半灰
				this.updatePlayerIcons = function(currentPlayerIndex) {
		    for (let i = 0; i < this.players.length; i++) {
		        const icon = document.getElementById(`player-${i}-icon`);
		        if (i === currentPlayerIndex) {
		            icon.classList.remove('dimmed');
		            icon.classList.add('active');
		        } else {
		            icon.classList.remove('active');
		            icon.classList.add('dimmed');
		        }
		    }
		
		    // ✅ 控制按钮启用/禁用（仅南家是人类）
		    const isMyTurn = currentPlayerIndex === 0;
		    document.getElementById('play-btn').disabled = !isMyTurn;
		    document.getElementById('pass-btn').disabled = !isMyTurn;
		
		    // ✅ 控制理牌、最少手数按钮（可选）
		    document.getElementById('organize-btn').disabled = !isMyTurn;
		    document.getElementById('min-hand-btn').disabled = !isMyTurn;
		};

    this.checkGameOver = function () {
  if (this.gameOver) return; // ⛔️ 避免重复

  const totalPlayers = this.players.length;

  if (this.finishedPlayers.length >= totalPlayers - 1) {
    this.gameOver = true;
    window.gameEnded = true;  // ✅ 允许再次点击下一盘按钮

    // ✅ 恢复 start-btn 按钮可点击
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = '下一盘';
    }

    const remaining = this.players
      .map((p, i) => i)
      .filter(i => !this.finishedPlayers.includes(i));

    const finalOrder = [...this.finishedPlayers, ...remaining];

    if (window.overlayRenderer) {
      const labels = ['头游', '二游', '三游', '末游'];
      for (let i = 0; i < finalOrder.length; i++) {
        const playerIndex = finalOrder[i];
        const label = labels[i] || `第${i + 1}游`;
        overlayRenderer.renderRankLabel(playerIndex, label);
      }
    }

    // 记录下一盘的出牌者
    window.firstPlayerIndex = finalOrder[0];  // 第一个是头游

    // 计算升级
    window.scoreSystem.calculateLevelUp(finalOrder);

    // 检查整局是否胜出
    const winner = window.scoreSystem.checkGlobalWin();
    const startBtnFinal = document.getElementById('start-btn');

    if (winner && window.showVictoryOverlay) {
      const winnerText = winner === 'self' ? '南北队' : '东西队';
      window.showVictoryOverlay(winnerText);

	    // 通知自动学习系统
	  if (window.notifyGameEnd) {
		window.notifyGameEnd({
		  winner: game.winner,
		  round: game.roundCount
		});
	  }

      // ✅ 整局结束，等待玩家点击“再来一局”
      if (startBtnFinal) {
        startBtnFinal.disabled = false;
        startBtnFinal.textContent = '再来一局';
      }

    } else {
      // ✅ 非整局结束，准备下一盘
      if (startBtnFinal) {
        startBtnFinal.disabled = false;
        startBtnFinal.textContent = '下一盘';
      }

      // ✅ 若启用“自动出牌”，模拟点击“下一盘”
      const autoModeEnabled = document.getElementById('auto-play')?.checked;
      if (autoModeEnabled && startBtnFinal) {
        setTimeout(() => {
          startBtnFinal.click();
        }, 1200); // 稍等一下，保留末游提示时间
      }
    }
  }
};
		
		this._updateBoardPlay = function (playerIndex, cards, isPass = false) {
		  // 主画布展示（可选保留）
			// this.canvasManager.displayPlayedCards(playerIndex, cards, isPass);
		
		  // 覆盖层显示
		  if (window.overlayRenderer) {
		    if (isPass) {
		      overlayRenderer.renderPass(playerIndex);
		    } else {
		      overlayRenderer.renderPlay(playerIndex, cards);
		    }
		  }
		};
		
		this._nextTurn = function (isPass = false) {
		  if (isPass) {
		    this.passCount++;
		
		    const activeCount = this.players.length - this.finishedPlayers.length;
		    if (this.passCount >= activeCount - 1) {
//		      console.log("🌀 所有人都 PASS，轮转重启");

      const lastPlayer = this.players[this.lastPlayerIndex];
      const teamMate = (lastPlayer.index + 2) % this.players.length;

      // ✅ 若上一手是刚出完牌的玩家，则让其队友接风
      if (this.finishedPlayers.includes(lastPlayer.index) &&
          !this.finishedPlayers.includes(teamMate)) {
//        console.log(`🌬 接风！玩家 ${teamMate + 1} 替队友出牌`);
        this.lastPlayed = null;
        this.lastPlayerIndex = null;
        this.passCount = 0;
        this.currentPlayerIndex = teamMate;

        this.updatePlayerIcons(teamMate);
        this.handlePlayTurn();
        return;
      }

      // 🟡 否则常规清理出牌区
      window.overlayRenderer.clearAll(); // ✅ 修正了这里
      this.lastPlayed = null;
      this.lastPlayerIndex = null;
      this.passCount = 0;
    }
  } else {
    this.passCount = 0;
  }

  // ✅ 检查游戏是否结束
  this.checkGameOver();
	
	  // ✅ 若已结束，则不再轮转
  if (this.gameOver) {
//    console.log('⛔ 游戏已结束，不再轮转');
    return;
  }


  // ✅ 轮转到下一个未结束的玩家
  const nextIndex = this.getNextActivePlayer();
  this.currentPlayerIndex = nextIndex;

  this.updatePlayerIcons(nextIndex);
  this.handlePlayTurn();
};
}

