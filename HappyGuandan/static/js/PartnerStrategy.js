window.PartnerStrategy = {
  shouldPass: function ({
    playerIndex,
    candidateCards,
    candidateType,
    lastPlayerIndex,
    lastCards,
    lastType,
    cardRules,
    cardPower
  }) {
    const passProbability = 0.1; // ✅ 有 10% 的概率选择 PASS（即使本应不该 pass）

    if (lastPlayerIndex == null) return false;

    const isSameTeam = (playerIndex % 2 === lastPlayerIndex % 2);
    if (!isSameTeam) {
      const teammateIndex = (playerIndex + 2) % 4;
      const teammateHasPassed = window.game.hasPassed?.(teammateIndex);

      const strongTypes = ['bomb', 'big_bomb', 'straight_flush', 'steel_plate', 'wooden_board'];

      if (teammateHasPassed && strongTypes.includes(lastType)) {
        const beat = cardRules.compareSameType(candidateCards, lastCards, lastType) > 0;
        if (beat) {
          // ✅ 有小概率故意选择不压（模拟真实不确定性）
          if (Math.random() < passProbability) return true;
          return false;
        }
      }

      // ✅ 敌方出牌，随机扰动是否压（只扰动中等牌型）
      const midTypes = ['pair', 'triplet', 'triplet_with_pair', 'straight'];
      if (midTypes.includes(lastType) && Math.random() < passProbability) {
        return true; // ⛔️ 有 10% 概率选择不压中等敌人牌
      }

      return false;
    }

    if (playerIndex === lastPlayerIndex) return false;

    const ranks = cardRules.getCardRanks();
    const sortedLast = cardRules.sortCards(lastCards);
    const sortedMine = cardRules.sortCards(candidateCards);

    const lastMax = ranks[sortedLast[0].value];
    const myMax = ranks[sortedMine[0].value];

    const lowTypeThresholds = {
      single: ranks['Q'],
      pair: ranks['10'],
      triplet: ranks['9'],
      straight: ranks['10'],
      triplet_with_pair: ranks['9']
    };

    if (lowTypeThresholds[lastType]) {
      const threshold = lowTypeThresholds[lastType];
      if (lastMax <= threshold && myMax <= threshold) {
        if (Math.random() < passProbability) return true; // ⛔️ 偶尔不顺队友
        return false; // ✅ 顺队友的小牌
      }
    }

    // 其它情况（包括大牌型、小牌型中大牌）默认 pass（也可扰动）
    if (Math.random() < passProbability) return false; // ⛔️ 偶尔不 pass
    return true;
  }
};