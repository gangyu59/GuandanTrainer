window.gameRules = {
  validPlay: function({ playerIndex, selected, type, lastPlay, cardRules, cardPower }) {
    if (!type || !selected || selected.length === 0) return false;

    const isBomb = cardRules.isBomb(selected);
    const isStraightFlush = cardRules.getCardType(selected) === 'straight_flush';
    const isSuperBomb = cardRules.getCardType(selected) === 'super_bomb';
    const isBigBomb = cardRules.getCardType(selected) === 'big_bomb';

    if (!lastPlay || !lastPlay.cards || lastPlay.cards.length === 0) {
      return true;
    }

    const lastPlayer = lastPlay.player;
    const lastCards = lastPlay.cards;
    const lastType = lastPlay.type;
    const lastIsBomb = cardRules.isBomb(lastCards);
    const lastIsStraightFlush = cardRules.getCardType(lastCards) === 'straight_flush';
    const lastIsSuperBomb = cardRules.getCardType(lastCards) === 'super_bomb';
    const lastIsBigBomb = cardRules.getCardType(lastCards) === 'big_bomb';

    // ✅ 桌面上的炸弹家族类型判断函数
    const isBombFamily = (cards) => {
      const t = cardRules.getCardType(cards);
      return ['bomb', 'big_bomb', 'super_bomb', 'straight_flush'].includes(t);
    };

    // ✅ 轮到自己继续出牌（前一轮所有人pass）
    if (lastPlayer === playerIndex) {
      return true;
    }

    // ✅ 非炸弹牌型，必须类型相同才能比
    if (!isBombFamily(selected)) {
      if (type !== lastType) return false;
      return cardPower.compareSameType(selected, lastCards, type, cardRules) > 0;
    }

    // ✅ 炸弹家族牌，可以压非炸弹
    if (!isBombFamily(lastCards)) {
      return true;
    }

    // ✅ 超级炸弹可以压任何牌
    if (isSuperBomb) return true;

    // ✅ 炸弹家族之间（不同类型也可以）比较 rank
    const myRank = cardPower.getTypeRank(type, selected);
    const lastRank = cardPower.getTypeRank(lastType, lastCards);
    return myRank > lastRank;
  }
};