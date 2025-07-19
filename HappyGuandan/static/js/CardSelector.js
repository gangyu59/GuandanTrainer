function CardSelector(canvasManager) {
  this.canvasManager = canvasManager;
  this.originalCards = [];
  this.initialCards = [];
  this.selectedCards = [];
  this._handleClick = null;

  this.init = function (playerCards) {
    this.originalCards = playerCards.map((card) => ({
      suit: card.suit,
      value: card.value,
      selected: false,
    }));
    this.initialCards = this.originalCards.map((card) => ({ ...card }));
    this.selectedCards = [];
    this._bindEvents();
    this.render();
  };

  this.reset = function () {
    this.originalCards = this.initialCards.map((card) => ({ ...card, selected: false }));
    this.selectedCards = [];
    this.render();

    if (this.onUpdate) {
      this.onUpdate(this.originalCards.slice());
    }

    console.log("🌀 已还原到初始发牌状态");
  };

  this._bindEvents = function () {
    if (this._handleClick) {
      document.getElementById("game-container").removeEventListener("click", this._handleClick);
    }

    this._handleClick = function (e) {
      if (e.target.classList.contains("card-hit-area")) {
        const suit = e.target.dataset.suit;
        const value = e.target.dataset.value;
        this._toggleCardSelection(suit, value);
        this.render();
      }
    }.bind(this);

    document.getElementById("game-container").addEventListener("click", this._handleClick);
  };

  this._toggleCardSelection = function (suit, value) {
    for (let i = 0; i < this.originalCards.length; i++) {
      const card = this.originalCards[i];
      if (card.suit === suit && card.value === value) {
        card.selected = !card.selected;
        break;
      }
    }
    this.selectedCards = this.originalCards.filter((card) => card.selected);
  };

  this.onUpdate = null;

  this.organizeCards = function () {
    if (this.selectedCards.length === 0) {
      alert("请先选择要组合的牌！");
      return false;
    }

    const unGrouped = this.originalCards.filter((card) => !card.groupId);
    const selected = this.selectedCards;

    const selectedInUngrouped = selected.every((sel) =>
      unGrouped.some((c) => c.suit === sel.suit && c.value === sel.value)
    );

    if (!selectedInUngrouped) {
      alert("请只选择未理过的牌进行组合！");
      return false;
    }

    const trump = window.cardRules.getTrump();
		console.log('🎴 当前主牌是：', trump);
		
		selected.forEach(card => {
		  const isWild = isWildcard(card, trump);
	//	  console.log(`🧪 检查卡牌 ${card.suit}${card.value} 是否是百搭：`, isWild);
		});
		
		const wildcards = selected.filter((card) => isWildcard(card, trump));
		if (wildcards.length > 0) {
		  const wildDesc = wildcards.map(c => `${c.suit}${c.value}`).join(', ');
		  console.log(`🃏 理牌中包含百搭，共 ${wildcards.length} 张：${wildDesc}`);
		} else {
	//	  console.log('❌ 未检测到百搭牌');
		}

    const cardType = window.cardRules.getCardType(selected);
    if (!cardType) {
      alert("无效的牌型组合！");
      console.warn("🧨 理牌失败，卡牌为：", selected);
      return false;
    }

    const groupId = "group_" + Date.now();
    const organizedCards = this._sortForDisplay(selected, cardType).map((card) => ({
      ...card,
      selected: false,
      groupId: groupId,
    }));

    const remaining = this.originalCards.filter(
      (card) => !selected.some((sel) => sel.suit === card.suit && sel.value === card.value)
    );
    this.originalCards = remaining.concat(organizedCards);

    this.selectedCards = [];
    this.render();

    if (this.onUpdate) {
      this.onUpdate(this.originalCards.slice());
    }

    console.log("✅ 理牌成功，类型为:", cardType);
    return true;
  };

  this._sortForDisplay = function (cards, cardType) {
    const sorted = cards.slice().sort((a, b) =>
      window.cardRules.getCardRanks()[a.value] - window.cardRules.getCardRanks()[b.value]
    );

    switch (cardType) {
      case "straight":
      case "straight_flush":
        return sorted;
      case "triplet_with_pair": {
        const valueCounts = {};
        sorted.forEach((card) => {
          valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const tripletValue = Object.keys(valueCounts).find((val) => valueCounts[val] === 3);
        const triplet = sorted.filter((c) => c.value === tripletValue);
        const pair = sorted.filter((c) => c.value !== tripletValue);
        return pair.concat(triplet);
      }
      case "triplet":
      case "pair":
      case "bomb":
      case "big_bomb":
      case "steel_plate":
        return sorted.reverse();
      case "wooden_board": {
        const groups = this._groupCards(sorted);
        return groups.reverse().flat();
      }
      case "single":
        return sorted.reverse();
      case "super_bomb":
        return sorted;
      default:
        return sorted.reverse();
    }
  };

  this._groupCards = function (cards) {
    const sorted = cards
      .slice()
      .sort((a, b) => window.cardRules.getCardRanks()[b.value] - window.cardRules.getCardRanks()[a.value]);
    const groups = [];
    let currentGroup = [];

    for (let i = 0; i < sorted.length; i++) {
      const card = sorted[i];
      if (currentGroup.length === 0 || currentGroup[0].value === card.value) {
        currentGroup.push(card);
      } else {
        groups.push(currentGroup);
        currentGroup = [card];
      }
    }

    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups;
  };

  this.render = function () {
    this.canvasManager.renderHand(this.originalCards);
  };
}