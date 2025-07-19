//main.js

// 全局游戏实例
var game;
window.gameEnded = true;

// 创建全局 cardRules 实例
window.cardRules = new CardRules();

window.firstPlayerIndex = null; // 当前局的出牌者（初始化为空）

if (!window.cardGrouper) {
  window.cardGrouper = new CardGrouper();
}

// 创建全局计分板实例（只执行一次）
if (!window.scoreSystem) {
  window.scoreSystem = new ScoreSystem();
}

// 挂载工具函数与日志器
window.getStateVector = getStateVector;
window.getActionVector = getActionVector;
window.dataLogger = new DataLogger();

// 主牌等级函数应放在外部
function getTrumpByLevel(level) {
  const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return order[(level - 2) % order.length];
}

let originalHandBackup = null; // 保存初始牌

window.showVictoryOverlay = function(winnerText) {
  const overlay = document.getElementById('victory-overlay');
  const message = document.getElementById('victory-message');
  const restartBtn = document.getElementById('restart-match-btn');

  message.textContent = `🎉 恭喜${winnerText}获胜！`;
  overlay.style.display = 'block';

  restartBtn.onclick = () => {
    overlay.style.display = 'none';
    resetMatch();
  };
};

window.resetMatch = function () {
  // 重置双方等级
  if (window.scoreSystem && window.scoreSystem.reset) {
    window.scoreSystem.reset(); // ⚠️ 确保 reset() 内部将等级恢复为打2
  }

  // 重置出牌者
  window.firstPlayerIndex = null;

  // 重置游戏结束标志
  window.gameEnded = true;

  // 重置按钮文字
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = '发牌';
  }

  // 清除 overlay 层内容
  if (window.overlayRenderer && window.overlayRenderer.clearAll) {
    window.overlayRenderer.clearAll();
  }

  // 隐藏胜利浮层（冗余安全处理）
  const overlay = document.getElementById('victory-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }

  console.log('🔁 整局游戏状态已重置，等待重新开始');
};

// 启动游戏函数（每盘都会重新调用）
function startGame() {
  // 清除上一盘的出牌展示
  if (window.overlayRenderer && window.overlayRenderer.clearAll) {
    window.overlayRenderer.clearAll();
  }

  // 正确根据上一盘胜方等级设置主牌
	const trumpInfo = window.scoreSystem.getTrumpInfo();
	const trumpLevel = trumpInfo.level;
	const trump = getTrumpByLevel(trumpLevel);
	window.cardRules.setTrump(trump);
	
	console.log(`🎴 当前主牌是 ${trump}（由${trumpInfo.team === 'self' ? '己方' : '对方'}打）`);
	
	// 设置当前先手出牌者（由上一盘头游决定）
	if (window.firstPlayerIndex === null) {
	  window.firstPlayerIndex = Math.floor(Math.random() * 4); // 第一盘随机选一个
	  console.log('🎲 第一盘随机由玩家', window.firstPlayerIndex + 1, '先出牌');
	} else {
	  console.log('🧭 本局由玩家', window.firstPlayerIndex + 1, '先出牌');
	}

  // 初始化游戏实例
  window.game = new Game(4, window.firstPlayerIndex);
  window.preloadCardImages();

  // 启动游戏逻辑
  document.getElementById('organize-btn').disabled = false;
  window.game.start();

  // 保存初始牌
  window.originalHandBackup = window.game.players[0].cards.map(c => ({
    ...c,
    selected: false,
    groupId: null
  }));

  // 理牌同步回调
  game.cardSelector.onUpdate = function (updatedCards) {
    game.players[0].cards = updatedCards;
  };

  // ✅ 设置按钮文字为“下一盘”
	const startBtn = document.getElementById('start-btn');
	startBtn.disabled = true;
	setTimeout(() => {
	  startBtn.disabled = false;
	  startBtn.textContent = '下一盘';
	}, 1000);
	
}

window.settings = {
  tributeMode: false,
  autoPlay: false,
  useMLModel: false 
};

document.addEventListener('DOMContentLoaded', () => {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const tributeCheckbox = document.getElementById('tribute-mode');
  const autoPlayCheckbox = document.getElementById('auto-play');
  const mlModelCheckbox = document.getElementById('ml-model'); 

  // 显示/隐藏设置面板
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 防止点按钮自身也触发关闭
    settingsPanel.classList.toggle('hidden');
  });

  // 设置变更同步到全局
  tributeCheckbox.addEventListener('change', (e) => {
    window.settings.tributeMode = e.target.checked;
    console.log("🎴 进贡模式：", window.settings.tributeMode ? "开启" : "关闭");
  });

  autoPlayCheckbox.addEventListener('change', (e) => {
    window.settings.autoPlay = e.target.checked;
    console.log("🤖 自动出牌：", window.settings.autoPlay ? "AI 模式" : "手动模式");
  });

  mlModelCheckbox.addEventListener('change', (e) => {
    window.settings.useMLModel = e.target.checked;
    console.log("🧠 机器学习：", window.settings.useMLModel ? "启用" : "禁用");
  });

  // ✅ 点击页面其他位置关闭设置面板
  document.addEventListener('click', (e) => {
    if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
      settingsPanel.classList.add('hidden');
    }
  });
});

	// 初始化按钮与点击事件（页面加载完成时触发）
	window.onload = function () {
	  const startBtn = document.getElementById('start-btn');
	  startBtn.textContent = '发牌';
	
	  startBtn.addEventListener('click', () => {
	    // 防止中途误点
	    if (!window.gameEnded) {
	      console.log('❌ 游戏还没结束，不能重新发牌');
	      return;
	    }
	
	    // ✅ 标记“游戏未结束”，禁止再次点击直到结束
			console.log('✅ 游戏已结束，准备开始下一盘');
	    window.gameEnded = false;
	    startGame();
	  });

  document.getElementById('organize-btn').addEventListener('click', () => {
    if (window.game && window.game.cardSelector) {
      const success = window.game.cardSelector.organizeCards();
      console.log(success ? "✅ 理牌成功" : "❌ 理牌失败");
    }
  });

  window.bindHumanPlayEvents = function () {
	  const playBtn = document.getElementById('play-btn');
	  const passBtn = document.getElementById('pass-btn');
	
	  if (!playBtn.dataset.bound) {
	    playBtn.addEventListener('click', () => {
	      if (!window.game) return;
	      window.game.handleHumanPlay();
	    });
	    playBtn.dataset.bound = 'true';
	  }
	
	  if (!passBtn.dataset.bound) {
	    passBtn.addEventListener('click', () => {
	      if (!window.game) return;
	      window.game.handleHumanPass();
	    });
	    passBtn.dataset.bound = 'true';
	  }
	};

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (window.game && window.game.cardSelector && window.originalHandBackup) {
      const restored = window.originalHandBackup.map(c => ({
        ...c,
        selected: false,
        groupId: null
      }));
      window.game.cardSelector.originalCards = restored;
      window.game.players[0].cards = restored;
      window.game.cardSelector.render();
    }
  });

  document.getElementById('min-hand-btn').addEventListener('click', () => {
    if (!window.game || !window.game.cardSelector) return;

    const hourglass = document.getElementById('hourglass');
    hourglass.style.display = 'block';

    setTimeout(() => {
      const grouper = new CardGrouper();
      const grouped = grouper.groupByCardPower(window.game.players[0].cards);

      const groupedWithId = grouped.map((group, i) =>
        group.map(card => ({
          ...card,
          groupId: 'auto_' + (i + 1),
          selected: false
        }))
      );

      const flat = groupedWithId.flat();
      window.game.players[0].cards = flat;
      window.game.cardSelector.originalCards = flat;

      if (window.game.canvasManager?.renderGroupedHand) {
        window.game.canvasManager.renderGroupedHand(groupedWithId);
      }

      hourglass.style.display = 'none';
      console.log("✅ 自动组牌成功，共", grouped.length, "组");
    }, 50);
  });
	
	document.getElementById('upload-btn').addEventListener('click', async () => {
	  const btn = document.getElementById('upload-btn');
	  const hourglass = document.getElementById('hourglass');
	  
	  btn.disabled = true;
	  hourglass.style.display = 'block';
	
	  try {
	    if (window.dataLogger) {
	      await window.dataLogger.uploadToFirebase(); // ✅ 可选：你也可以改为 localStorage 输出等
	      alert('✅ 数据上传成功！');
	    } else {
	      alert('⚠️ 当前 dataLogger 未初始化');
	    }
	  } catch (e) {
	    console.error('上传数据失败:', e);
	    alert('❌ 上传失败');
	  }
	
	  btn.disabled = false;
	  hourglass.style.display = 'none';
	});

  // canvas 选牌监听
  const canvas = document.getElementById('game-canvas');
  canvas.addEventListener('click', (e) => {
    if (!window.game || !window.game.players) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const hand = window.game.players[0].cards;
    const canvasManager = window.game.canvasManager;
    const groups = canvasManager._groupCards(hand);
    let hit = false;

    for (let groupIndex = groups.length - 1; groupIndex >= 0; groupIndex--) {
      const group = groups[groupIndex];
      for (let i = 0; i < group.length; i++) {
        const card = group[i];
        if (
          clickX >= card.x && clickX <= card.x + card.width &&
          clickY >= card.y && clickY <= card.y + card.height
        ) {
          card.selected = !card.selected;
          hit = true;

          const selector = window.game.cardSelector;
          if (selector) {
            for (let j = 0; j < selector.originalCards.length; j++) {
              const c = selector.originalCards[j];
              if (c.suit === card.suit && c.value === card.value) {
                c.selected = card.selected;
                break;
              }
            }
            selector.selectedCards = selector.originalCards.filter(c => c.selected);
          }

          break;
        }
      }
      if (hit) break;
    }

    canvasManager.renderHand(hand);
  });
};