//utils.js

window.cardImages = {}; // ✅ 挂在 window 上
window.isCardImagesReady = false;
window.onCardImagesLoaded = null;

window.preloadCardImages = function () {
    const suits = ['c', 'd', 'h', 's'];
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const jokers = ['small', 'big'];
    const totalImages = suits.length * values.length + jokers.length;
    let loadedCount = 0;

    function checkLoad() {
        if (++loadedCount === totalImages) {
            window.isCardImagesReady = true;
            if (typeof window.onCardImagesLoaded === 'function') {
                window.onCardImagesLoaded();
            }
        }
    }

    suits.forEach(suit => {
        values.forEach(value => {
            const img = new Image();
            img.onload = checkLoad;
            img.onerror = checkLoad;
            img.src = `assets/cards/${suit}_${value}.jpeg`;
            window.cardImages[`${suit}_${value}`] = img;
        });
    });

    jokers.forEach(joker => {
        const img = new Image();
        img.onload = checkLoad;
        img.onerror = checkLoad;
        img.src = `assets/cards/${joker}_joker.jpeg`;
        window.cardImages[`joker_${joker}`] = img;
    });
};

// ✅ 获取当前状态向量（用于训练）
window.getStateVector = function (game, player) {
  const state = [];

  // 1. 当前玩家手牌：每张牌的数量（54维）
  const handVector = Array(54).fill(0);
  for (const card of player.cards) {
    handVector[card.index] += 1; // 假设 card.index 唯一标识
  }
  state.push(...handVector);

  // 2. 出牌历史（最多记录最近 N 次）
  const history = game.history || [];
  const recent = history.slice(-5); // 最多5轮
  for (let i = 0; i < 5; i++) {
    const play = recent[i];
    const vec = Array(54).fill(0);
    if (play && play.cards) {
      for (const card of play.cards) {
        vec[card.index]++;
      }
    }
    state.push(...vec);
  }

  // 3. 各玩家剩余牌数（除自己外）
  for (let i = 0; i < 4; i++) {
    if (i === player.index) continue;
    const p = game.players[i];
    state.push(p.cards.length);
  }

  // 4. 主牌值（one-hot 13维）
  const trumpVec = Array(13).fill(0);
  const trump = game.cardRules.trumpValue; // '2', '3', ..., 'A'
  const ranks = game.cardRules.getCardRanks();
  trumpVec[ranks[trump]] = 1;
  state.push(...trumpVec);

  return state;
};

// ✅ 获取动作向量（用于监督学习）
window.getActionVector = function (cards) {
  const actionVec = Array(54).fill(0);
  for (const card of cards) {
    actionVec[card.index]++;
  }
  return actionVec;
};