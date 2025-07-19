function AIPlayer(cardRules, cardPower) {
  this.cardRules = cardRules;
  this.cardPower = cardPower;

  this.decidePlay = function (player, lastPlay, lastPlayerIndex) {
  const all = player.cards.slice();
  const grouper = new CardGrouper();

  const grouped = (player.index === 0 || player.index === 2)
    ? grouper.groupByMinHands(all)
    : grouper.groupByCardPower(all);

  const sorted = grouped.slice().reverse(); // 从弱到强

  // ✅ 出牌顺序扰动参数
  const baseProb = 0.6; // 最弱牌出牌概率为 60%
  const decay = 0.05;   // 每强一组，概率递减

  // ✅ 炸弹扰动参数：0 = 一定出，1 = 一定保留
  const bombSkipProbability = 0.15;

  for (let i = 0; i < sorted.length; i++) {
    const group = sorted[i];
    const type = cardRules.getCardType(group);
    if (!type) continue;

    const isBombType = ['bomb', 'big_bomb', 'straight_flush'].includes(type);

    // ✅ 有炸弹且对手出牌时，有概率跳过炸弹（保存）
    if (isBombType && lastPlay && Math.random() < bombSkipProbability) {
      continue;
    }

    const valid = window.gameRules.validPlay({
      playerIndex: player.index,
      selected: group,
      type,
      lastPlay,
      lastPlayerIndex,
      cardRules,
      cardPower
    });

    if (!valid) continue;

    const shouldPass = window.PartnerStrategy.shouldPass({
      playerIndex: player.index,
      candidateCards: group,
      candidateType: type,
      lastPlayerIndex,
      lastCards: lastPlay?.cards || [],
      lastType: lastPlay?.type || '',
      cardRules,
      cardPower
    });

    if (shouldPass) {
      // ✅ 有概率违反队友建议（不 pass）
      const passChance = Math.random();
      if (passChance > 0.8) return { type, cards: group };
      else continue;
    }

    // ✅ 出牌扰动：按牌力逐渐降低出牌概率
    const prob = baseProb - i * decay;
    if (Math.random() < Math.max(prob, 0.1)) {
      return { type, cards: group };
    }
  }

  // ✅ 尝试拆牌
  if (lastPlay && lastPlayerIndex !== player.index) {
    const trySplit = trySplitFromGroups(player.cards, grouped, lastPlay, cardRules, cardPower);
    if (trySplit) return trySplit;
  }

  // ✅ 自己是上家：出任意一组
  if (!lastPlay || lastPlayerIndex === player.index) {
    const fallback = sorted[Math.floor(Math.random() * sorted.length)];
    return {
      type: cardRules.getCardType(fallback),
      cards: fallback
    };
  }

  return { type: 'pass' };
};
}

// ✅ 如果该类型剩下的全是主牌/王/大牌，可考虑升级为更强牌型
function shouldUpgradeFromType(cards, type, cardRules) {
  // ✅ 可调节的扰动概率（0 = 总是升级；1 = 总是不升级）
  const upgradeSkipProbability = 0.3;

  const trump = cardRules.trumpValue;
  const ranks = cardRules.getCardRanks();

  const sameTypeCards = cards.filter(c => {
    const t = cardRules.getCardType([c]);
    return t === type;
  });

  if (sameTypeCards.length === 0) return true;

  const isStrong = sameTypeCards.every(c => {
    const val = ranks[c.value];
    const isTrump = c.value === trump || isWildcard(c, trump);
    return isTrump || val >= ranks['K'];
  });

  // ✅ 满足强牌条件后，加入扰动概率
  if (isStrong && Math.random() > upgradeSkipProbability) {
    return false; // 有概率忽略升级建议
  }

  return isStrong;
}

function trySplitFromGroups(cards, groups, lastPlay, cardRules, cardPower) {
  // ✅ 可调节随机程度（0 = 固定顺序，1 = 完全打乱）
  const splitRandomness = 0.3; 
	
  const lastType = lastPlay.type;
  const lastCards = lastPlay.cards;
  if (!lastType || lastType === 'pass') return null;

  // ✅ 如果已有同类型组合，就不拆强牌
  const hasSameType = groups.some(g => cardRules.getCardType(g) === lastType);
  if (hasSameType) return null;

  const valid = (group) => window.gameRules.validPlay({
    playerIndex: -1,
    selected: group,
    type: cardRules.getCardType(group),
    lastPlay,
    lastPlayerIndex: -1,
    cardRules,
    cardPower
  });

  // ✅ 百搭优先拆牌顺序
  const splitOrder = [
    'triplet_with_pair',
    'wooden_board',
    'steel_plate',
    'triplet',
    'pair'
  ];

  // ✅ 应用扰动打乱顺序（受控随机性）
  const perturbedOrder = splitOrder.slice().sort(() => Math.random() - splitRandomness);

  for (const sourceType of perturbedOrder) {
    const sourceGroup = groups.find(g => cardRules.getCardType(g) === sourceType);
    if (!sourceGroup) continue;

    const clone = sourceGroup.slice();
    for (let i = 0; i < clone.length; i++) {
      for (let j = i + 1; j <= clone.length; j++) {
        const maybe = clone.slice(i, j);
        if (!maybe.length) continue;

        const type = cardRules.getCardType(maybe);
        if (!type) continue;

        if (valid(maybe)) return { type, cards: maybe };
      }
    }
  }

  return null;
}

AIPlayer.prototype.playTurn = function (game) {
  setTimeout(() => {
    const currentPlayer = game.players[game.currentPlayerIndex];

    // ✅ 根据设置选择决策方式
    let decision;
    if (window.settings.useMLModel && this.decideByML) {
      decision = this.decideByML(currentPlayer, game);
    } else {
      decision = this.decidePlay(currentPlayer, game.lastPlayed, game.lastPlayerIndex);
    }

    // ✅ 记录状态向量与动作向量（用于机器学习训练）
    try {
      if (window.getStateVector && window.getActionVector && window.dataLogger) {
        const stateVec = window.getStateVector(game, currentPlayer);
        const actionVec = window.getActionVector(decision.cards || []);
        window.dataLogger.record(stateVec, actionVec, {
          playerIndex: currentPlayer.index,
          type: decision.type
        });
      }
    } catch (e) {
      console.warn('⚠️ 记录训练数据失败:', e);
    }

    if (decision.type === 'pass') {
      game._updateBoardPlay(currentPlayer.index, [], true);
      game._nextTurn(true);
      return;
    }

    currentPlayer.removeCards(decision.cards);
    game._updateBoardPlay(currentPlayer.index, decision.cards);

    game.lastPlayed = {
      playerIndex: currentPlayer.index,
      type: decision.type,
      cards: decision.cards
    };
    game.lastPlayerIndex = currentPlayer.index;

    if (currentPlayer.cards.length === 0 && !game.finishedPlayers.includes(currentPlayer.index)) {
      game.finishedPlayers.push(currentPlayer.index);
      if (window.overlayRenderer) {
        overlayRenderer.clearPlayerArea(currentPlayer.index);
        const label = ['头游', '二游', '三游', '末游'][game.finishedPlayers.length - 1] || `第${game.finishedPlayers.length}游`;
        overlayRenderer.renderRankLabel(currentPlayer.index, label);
      }
      game.checkGameOver();
    }

    if (currentPlayer.index === 0) {
      game.cardSelector.originalCards = currentPlayer.cards;
      game.cardSelector.selectedCards = [];
      game.cardSelector.render();
      setTimeout(() => game._nextTurn(), 300);
    } else {
      game._nextTurn();
    }
  }, 500);
};

AIPlayer.prototype.decideByML0 = function (player, game) {
  const stateVec = window.getStateVector(game, player);
  const groups = window.cardGrouper.groupByMinHands(player.cards);

  if (!groups || groups.length === 0) return { type: 'pass' };

  let bestScore = -Infinity;
  let bestGroup = null;

  for (let group of groups) {
    const actionVec = window.getActionVector(group.cards || []);
    const combinedVec = stateVec.concat(actionVec);
    const score = this._fakeModelScore(combinedVec);
    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
    }
  }

  if (!bestGroup || bestScore < 0.1) return { type: 'pass' }; // 模拟阈值
  return {
    type: bestGroup.type,
    cards: bestGroup.cards
  };
};

AIPlayer.prototype._fakeModelScore = function (vec) {
  const weights = this.fakeWeights || Array(vec.length).fill(0).map((_, i) => Math.sin(i) * 0.1); // 模拟假权重
  this.fakeWeights = weights; // 缓存
  return vec.reduce((sum, v, i) => sum + v * weights[i], 0);
};

window.PlayCard = AIPlayer;