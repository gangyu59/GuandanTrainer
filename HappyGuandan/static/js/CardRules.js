function getTrumpByLevel(level) {
  const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return order[(level - 2) % order.length];
}

// 判断是否是百搭：红桃 + 当前主牌值
function isWildcard(card, trump) {
  return card.suit === 'h' && String(card.value) === String(trump);
}

function CardRules() {
  this.trumpValue = '2';

  this.setTrump = function (value) {
    this.trumpValue = value;
  };

  this.getTrump = function () {
    return this.trumpValue;
  };

  this.getCardRanks = function () {
    const base = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    const ranks = { big: 16, small: 15 };
    const trump = this.trumpValue;
    const rest = base.filter(v => v !== trump);
    ranks[trump] = 14;
    let point = 13;
    for (let v of rest) ranks[v] = point--;
    return ranks;
  };

  this.getCardType = function (cards) {
    if (!cards || cards.length === 0) return null;
    const sorted = this.sortCards(cards);
    if (this.isSuperBomb(sorted)) return 'super_bomb';
    if (this.isBigBomb(sorted)) return 'big_bomb';
    if (this.isStraightFlush(sorted)) return 'straight_flush';
    if (this.isBomb(sorted)) return 'bomb';
    if (this.isSteelPlate(sorted)) return 'steel_plate';
    if (this.isWoodenBoard(sorted)) return 'wooden_board';
    if (this.isTripletWithPair(sorted)) return 'triplet_with_pair';
    if (this.isStraight(sorted)) return 'straight';
    if (this.isTriplet(sorted)) return 'triplet';
    if (this.isPair(sorted)) return 'pair';
    if (this.isSingle(sorted)) return 'single';
    return null;
  };

  this.compareCards = function (aCards, bCards) {
    const aType = this.getCardType(aCards);
    const bType = this.getCardType(bCards);

    if (aType === 'super_bomb') return 1;
    if (bType === 'super_bomb') return -1;
    if (aType === 'big_bomb' && bType !== 'super_bomb') return 1;
    if (bType === 'big_bomb' && aType !== 'super_bomb') return -1;
    if (aType === 'straight_flush' && !['super_bomb', 'big_bomb'].includes(bType)) return 1;
    if (bType === 'straight_flush' && !['super_bomb', 'big_bomb'].includes(aType)) return -1;
    if (aType === 'bomb' && !['super_bomb', 'big_bomb', 'straight_flush'].includes(bType)) return 1;
    if (bType === 'bomb' && !['super_bomb', 'big_bomb', 'straight_flush'].includes(aType)) return -1;

    const isBombType = ['super_bomb', 'big_bomb', 'straight_flush', 'bomb'];
    if (aType === bType && isBombType.includes(aType)) {
      if (aCards.length !== bCards.length) {
        return aCards.length > bCards.length ? 1 : -1;
      }
      const aVal = aCards[0].value;
      const bVal = bCards[0].value;
      const ranks = this.getCardRanks();
      return ranks[aVal] > ranks[bVal] ? 1 : -1;
    }

    const isTrumpCard = (card) => card.value === this.trumpValue && card.suit !== 'joker';
    const isAllTrump = (cards) => cards.every(c => isTrumpCard(c));
    const isAllNormal = (cards) => cards.every(c => !isTrumpCard(c) && c.suit !== 'joker');

    if (aType === bType) {
      const aIsTrump = isAllTrump(aCards);
      const bIsTrump = isAllTrump(bCards);
      const aIsNormal = isAllNormal(aCards);
      const bIsNormal = isAllNormal(bCards);

      if (aIsTrump && bIsNormal) return 1;
      if (bIsTrump && aIsNormal) return -1;
    }

    if (aType === bType) {
      if ((aType === 'straight' || aType === 'straight_flush') && aCards.length !== bCards.length) {
        return 0;
      }
      return this.compareSameType(aCards, bCards, aType);
    }

    return 0;
  };

  this.isSingle = function (cards) {
    return cards.length === 1;
  };

  this.isPair = function (cards) {
	  if (cards.length !== 2) return false;
	  const trump = this.getTrump();
	  const wilds = cards.filter(c => isWildcard(c, trump));
	  const normals = cards.filter(c => !isWildcard(c, trump));
	  if (wilds.length === 1 && normals.length === 1) return true;
	  if (normals.length === 2 && normals[0].value === normals[1].value) return true;
	  return false;
	};

  this.isTriplet = function (cards) {
	  if (cards.length !== 3) return false;
	  const trump = this.getTrump();
	  const wilds = cards.filter(c => isWildcard(c, trump));
	  const normals = cards.filter(c => !isWildcard(c, trump));
	  const counts = {};
	  for (const c of normals) counts[c.value] = (counts[c.value] || 0) + 1;
	  for (const [v, count] of Object.entries(counts)) {
	    if (count + wilds.length >= 3) return true;
	  }
	  return wilds.length === 3; // 三个百搭
	};

  this.isTripletWithPair = function (cards) {
	  if (cards.length !== 5) return false;
	  const trump = this.getTrump();
	  const wilds = cards.filter(c => isWildcard(c, trump));
	  const normals = cards.filter(c => !isWildcard(c, trump));
	  const counts = {};
	  for (const c of normals) counts[c.value] = (counts[c.value] || 0) + 1;
	  const values = Object.values(counts).sort((a, b) => b - a);
	  if (!values.length) return wilds.length >= 5;
	  for (let i = 0; i < values.length; i++) {
	    const tripleNeed = Math.max(0, 3 - values[i]);
	    for (let j = 0; j < values.length; j++) {
	      if (i === j) continue;
	      const pairNeed = Math.max(0, 2 - values[j]);
	      if (tripleNeed + pairNeed <= wilds.length) return true;
	    }
	  }
	  return false;
	};

	this.isBomb = function (cards) {
	  if (cards.length < 4 || cards.length > 5) return false;
	  const trump = this.getTrump();
	  const wilds = cards.filter(c => isWildcard(c, trump));
	  const normals = cards.filter(c => !isWildcard(c, trump));
	
	  const counts = {};
	  for (const c of normals) {
	    const key = c._asValue || c.value;
	    counts[key] = (counts[key] || 0) + 1;
	  }
	
	  for (const [v, count] of Object.entries(counts)) {
	    if (count + wilds.length === cards.length) return true;
	  }
	
	  return wilds.length === cards.length; // 全是百搭
	};

  this.isBigBomb = function (cards) {
	  if (cards.length <= 5) return false;
	  const trump = this.getTrump();
	  const wilds = cards.filter(c => isWildcard(c, trump));
	  const normals = cards.filter(c => !isWildcard(c, trump));
	  const counts = {};
	  for (const c of normals) counts[c.value] = (counts[c.value] || 0) + 1;
	  for (const [v, count] of Object.entries(counts)) {
	    if (count + wilds.length === cards.length) return true;
	  }
	  return wilds.length === cards.length;
	};

  this.isSuperBomb = function (cards) {
    return cards.length === 4 && cards.every(c => c.suit === 'joker');
  };

  this.isSteelPlate = function (cards) {
	  if (cards.length !== 6) return false;
	  const trump = this.getTrump();
	  const wilds = cards.filter(c => isWildcard(c, trump));
	  const normals = cards.filter(c => !isWildcard(c, trump));
	  const counts = {};
	  for (const c of normals) counts[c.value] = (counts[c.value] || 0) + 1;
	  const candidates = Object.entries(counts)
	    .map(([v, count]) => ({ v, count }))
	    .sort((a, b) => this.getCardRanks()[b.v] - this.getCardRanks()[a.v]);
	
	  for (let i = 0; i < candidates.length; i++) {
	    for (let j = i + 1; j < candidates.length; j++) {
	      const [a, b] = [candidates[i], candidates[j]];
	      const totalNeed = Math.max(0, 3 - a.count) + Math.max(0, 3 - b.count);
	      const ranks = this.getCardRanks();
	      if (ranks[a.v] - ranks[b.v] === 1 && totalNeed <= wilds.length) return true;
	    }
	  }
	  return false;
	};

  this.isWoodenBoard = function (cards) {
	  if (cards.length !== 6) return false;
	  const trump = this.getTrump();
	  const wilds = cards.filter(c => isWildcard(c, trump));
	  const normals = cards.filter(c => !isWildcard(c, trump));
	  const counts = {};
	  for (const c of normals) counts[c.value] = (counts[c.value] || 0) + 1;
	  const pairs = [];
	  for (const [v, count] of Object.entries(counts)) {
	    if (count >= 2) pairs.push(v);
	    else if (count === 1 && wilds.length >= 1) pairs.push(v);
	  }
	  pairs.sort((a, b) => this.getCardRanks()[b] - this.getCardRanks()[a]);
	  if (pairs.length < 3) return false;
	  return this.isConsecutive(pairs.slice(0, 3), 3);
	};

  this.isStraight = function (cards) {
	  if (cards.length !== 5) return false;
	
	  const trump = this.getTrump();
	  const ranks = this.getCardRanks();
	
	  // 拆分百搭与正常牌，排除大小王
	  const wildcards = cards.filter(c => isWildcard(c, trump));
	  const normals = cards.filter(c =>
	    !isWildcard(c, trump) &&
	    c.suit !== 'joker' &&
	    c.value !== 'w1' &&
	    c.value !== 'w2'
	  );
	
	  // 非法：点数重复
	  const uniqueValues = [...new Set(normals.map(c => c.value))];
	  if (uniqueValues.length !== normals.length) return false;
	
	  // 非法：包含2，除非是 A2345 的特例
	  const has2 = normals.some(c => c.value === '2');
	  if (has2) return false;
	
	  // 获取已知牌的点数rank（升序）
	  const normalRanks = uniqueValues.map(v => ranks[v]).sort((a, b) => a - b);
	
	  // 尝试构造顺子窗口（长度为5），用百搭补足缺失点数
	  const allRanks = Object.values(ranks).filter(r => r < ranks['2']); // 排除2以上
	  const minStart = Math.min(...allRanks);
	  const maxStart = ranks['A'] - 4; // 最大起点为 A-4
	
	  for (let start = minStart; start <= maxStart; start++) {
	    const expected = new Set([start, start + 1, start + 2, start + 3, start + 4]);
	    let remainingWildcards = wildcards.length;
	
	    for (let val of normalRanks) {
	      if (expected.has(val)) {
	        expected.delete(val);
	      } else {
	        break; // 不匹配此窗口
	      }
	    }
	
	    if (expected.size <= remainingWildcards) {
	      return true;
	    }
	  }
	
	  // 特例：A2345
	  const a2345 = ['A', '2', '3', '4', '5'];
	  const values = normals.map(c => c.value);
	  const missing = a2345.filter(v => !values.includes(v));
	  if (missing.length <= wildcards.length) {
	    return true;
	  }
	
	  return false;
	};

  this.isStraightFlush = function (cards) {
	  if (cards.length !== 5) return false;
	  const suits = cards.map(c => c.suit);
	  const dominantSuit = suits.find(s => suits.filter(x => x === s).length >= 5 - 1); // 最多允许1张非该花色（即百搭）
	  if (!dominantSuit) return false;
	
	  const suitValid = cards.every(c => c.suit === dominantSuit || isWildcard(c, this.getTrump()));
	  if (!suitValid) return false;
	
	  return this.isStraight(cards);
	};

  this.sortCards = function (cards) {
    const ranks = this.getCardRanks();
    return [...cards].sort((a, b) =>
      ranks[b.value] - ranks[a.value] || a.suit.localeCompare(b.suit));
  };

  this.isConsecutive = function (values, len) {
    if (values.length !== len) return false;
    for (let i = 0; i < len - 1; i++) {
      if (this.getCardRanks()[values[i]] - this.getCardRanks()[values[i + 1]] !== 1)
        return false;
    }
    return true;
  };

  this.compareSameType = function (aCards, bCards, type) {
	  const aSorted = this.sortCards(aCards);
	  const bSorted = this.sortCards(bCards);
	  const trump = this.getTrump();
	  const ranks = this.getCardRanks();
	
	  const getMainValue = (cards) => {
	    const count = {};
	    cards.forEach(c => {
	      const v = isWildcard(c, trump)
	        ? c._asValue || '__wild__'
	        : c._asValue || c.value;
	      count[v] = (count[v] || 0) + 1;
	    });
	
	    if (type === 'triplet_with_pair' || type === 'triplet') {
	      return Object.keys(count).find(v => count[v] >= 3);
	    }
	    if (type === 'pair') {
	      return Object.keys(count).find(v => count[v] >= 2);
	    }
	
	    return aSorted[0]._asValue || aSorted[0].value;
	  };
	
	  const aRank = ranks[getMainValue(aSorted)];
	  const bRank = ranks[getMainValue(bSorted)];
	
	  return aRank > bRank ? 1 : aRank < bRank ? -1 : 0;
	};
}