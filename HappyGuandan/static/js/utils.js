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

  // 1. 当前玩家手牌：54维
  const handVector = Array(54).fill(0);
  for (const card of player.cards) {
    let index = card.index;
    if (typeof index !== 'number') {
      index = window.cardValueToIndex(card);
    }
    if (typeof index === 'number' && index >= 0 && index < 54) {
      handVector[index]++;
    }
  }
  state.push(...handVector);

  // 2. 出牌历史（固定5轮，每轮54维）
  const history = game.history || [];
  const recent = history.slice(-5);
  const historyVecs = [];

  for (const play of recent) {
    const vec = Array(54).fill(0);
    if (play && Array.isArray(play.cards)) {
      for (const card of play.cards) {
        let index = card.index;
        if (typeof index !== 'number') {
          index = window.cardValueToIndex(card);
        }
        if (typeof index === 'number' && index >= 0 && index < 54) {
          vec[index]++;
        }
      }
    }
    historyVecs.push(vec);
  }

  while (historyVecs.length < 5) {
    historyVecs.push(Array(54).fill(0));
  }

  for (const vec of historyVecs) {
    state.push(...vec);
  }

  // 3. 各玩家剩余牌数（3个）
  for (let i = 0; i < 4; i++) {
    if (i !== player.index) {
      const p = game.players[i];
      state.push(p.cards.length);
    }
  }

  // 4. 主牌 one-hot（13维）
  const trumpVec = Array(13).fill(0);
  const oneHotIndexMap = {
    '3': 0, '4': 1, '5': 2, '6': 3, '7': 4,
    '8': 5, '9': 6, '10': 7, 'J': 8, 'Q': 9,
    'K': 10, 'A': 11, '2': 12
  };
  const trump = game.cardRules.trumpValue;
  const index = oneHotIndexMap[trump];
  if (typeof index === 'number') {
    trumpVec[index] = 1;
  } else {
    console.warn('⚠️ trump 值非法:', trump);
  }

  state.push(...trumpVec);

  return state;
};

// ✅ 获取动作向量（用于监督学习）
window.getActionVector = function (cards) {
  const actionVec = Array(54).fill(0);
  if (!Array.isArray(cards)) return actionVec;

  for (const card of cards) {
    let index = card.index;

    // 若没有 index，则尝试通过 suit + value 转换
    if (typeof index !== 'number') {
      index = window.cardValueToIndex(card);
    }

    if (typeof index === 'number' && index >= 0 && index < 54) {
      actionVec[index]++;
    } else {
      console.warn('⚠️ getActionVector: 无法识别的卡片:', card);
    }
  }

  return actionVec;
};

window.cardValueToIndex = function (card) {
  const value = card._asValue || card.value;
  const suit = card.suit;

  const suitOffset = { c: 0, d: 13, h: 26, s: 39 };
  const rankMap = {
    'A': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5,
    '7': 6, '8': 7, '9': 8, '10': 9, 'J': 10, 'Q': 11, 'K': 12
  };

  if (suit === 'joker') {
    return value === 'BJ' ? 52 : 53;
  }

  const rank = rankMap[value];
  const offset = suitOffset[suit];

  if (offset === undefined || rank === undefined) {
    return -1;
  }

  return offset + rank;
};