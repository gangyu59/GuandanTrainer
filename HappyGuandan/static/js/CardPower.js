// CardPower.js - 统一的牌力排序与比较模块

const CardPower = {
    // 牌型强度从高到低（数值越大越强）
		typeRank: {
		    'super_bomb': 110,            // 四王
		    'big_bomb': 100,              // 张数 > 5 的炸弹
		    'straight_flush': 90,    // 同花顺炸弹（强于普通炸弹）
		    'bomb': 80,                   // 普通炸弹
		    'steel_plate': 70,            // 双三同张
		    'wooden_board': 60,           // 三连对
		    'triplet_with_pair': 50,      // 三带二
		    'straight': 40,               // 顺子
		    'triplet': 30,
		    'pair': 20,
		    'single': 10
		},

    getTypeRank(cardType, cards) {
		    switch (cardType) {
		        case 'super_bomb':
		            return this.typeRank['super_bomb'];
		        case 'big_bomb':
		            return this.typeRank['big_bomb'];
		        case 'bomb':
		            return cards.length > 5 ? this.typeRank['big_bomb'] : this.typeRank['bomb'];
		        case 'straight_flush':
		            return this.typeRank['straight_flush'];
		        case 'steel_plate':
		            return this.typeRank['steel_plate'];
		        case 'wooden_board':
		            return this.typeRank['wooden_board'];
		        case 'triplet_with_pair':
		            return this.typeRank['triplet_with_pair'];
		        case 'straight':
		            return this.typeRank['straight'];
		        case 'triplet':
		            return this.typeRank['triplet'];
		        case 'pair':
		            return this.typeRank['pair'];
		        case 'single':
		            return this.typeRank['single'];
		        default:
		            return 0;
		    }
		},

    compareSameType(aCards, bCards, type, cardRules) {
	  const aSorted = cardRules.sortCards(aCards);
	  const bSorted = cardRules.sortCards(bCards);
	  const ranks = cardRules.getCardRanks();
	  const trump = cardRules.getTrump();
	
	  const getMainValue = (cards, type) => {
	    const countMap = {};
	    for (let card of cards) {
	      countMap[card.value] = (countMap[card.value] || 0) + 1;
	    }

    if (type === 'triplet_with_pair' || type === 'triplet') {
      return Object.keys(countMap).find(v => countMap[v] === 3);
    }
    if (type === 'pair') {
      return Object.keys(countMap).find(v => countMap[v] === 2);
    }
    if (type === 'single') {
      return cards[0].value;
    }
    if (type === 'steel_plate') {
      const triplets = Object.keys(countMap).filter(v => countMap[v] === 3);
      return triplets.length ? triplets.sort((a, b) => ranks[b] - ranks[a])[0] : null;
    }
    if (type === 'wooden_board') {
      const pairs = Object.keys(countMap).filter(v => countMap[v] === 2);
      return pairs.length ? pairs.sort((a, b) => ranks[b] - ranks[a])[0] : null;
    }
    if (type === 'straight' || type === 'straight_flush') {
      return cards[0].value; // 顺子首位最大
    }

    return cards[0].value;
  };

  const compareValues = (aVal, bVal) => {
	    const isATrump = aVal === trump;
	    const isBTrump = bVal === trump;
	    const isAKing = aVal === 'big' || aVal === 'small';
	    const isBKing = bVal === 'big' || bVal === 'small';
	
	    // 王永远最大
	    if (isAKing && !isBKing) return 1;
	    if (!isAKing && isBKing) return -1;
	
	    // 主牌优先（不能压王，已经处理完）
	    if (isATrump && !isBTrump) return 1;
	    if (!isATrump && isBTrump) return -1;
	
	    // 普通 rank 比较
	    return ranks[aVal] > ranks[bVal] ? 1 : -1;
	  };
	
	  // === 特殊牌型：炸弹优先级 ===
	  if (type === 'super_bomb') return 0;
	
	  if (type === 'big_bomb' || type === 'bomb') {
	    if (aCards.length !== bCards.length) return aCards.length > bCards.length ? 1 : -1;
	    const aVal = getMainValue(aCards, type);
	    const bVal = getMainValue(bCards, type);
	    return compareValues(aVal, bVal);
	  }
	
	  // === 顺子/同花顺必须长度相等 ===
	  if ((type === 'straight' || type === 'straight_flush') &&
	      aCards.length !== bCards.length) return 0;
	
	  // 其它牌型统一主值比较
	  const aVal = getMainValue(aCards, type);
	  const bVal = getMainValue(bCards, type);
	  if (!aVal || !bVal) return 0;
	
	  return compareValues(aVal, bVal);
	},

		_getTripletValues(cards) {
		    const count = {};
		    cards.forEach(c => {
		        count[c.value] = (count[c.value] || 0) + 1;
		    });
		    return Object.keys(count).filter(v => count[v] === 3);
		},
		
		_getPairValues(cards) {
		    const count = {};
		    cards.forEach(c => {
		        count[c.value] = (count[c.value] || 0) + 1;
		    });
		    return Object.keys(count).filter(v => count[v] === 2);
		},

    canBeat(aCards, bCards, cardRules) {
		  const aType = cardRules.getCardType(aCards);
		  const bType = cardRules.getCardType(bCards);
		
		  if (!aType || !bType) return false;
		
		  const aRank = this.getTypeRank(aType, aCards);
		  const bRank = this.getTypeRank(bType, bCards);
		
		  // ✅ 同类型时判断大小
		  if (aType === bType) {
		    return this.compareSameType(aCards, bCards, aType, cardRules) > 0;
		  }
		
		  // ✅ super_bomb 能压一切
		  if (aType === 'super_bomb') return true;
		
		  // ✅ straight_flush 能压任意非炸弹，以及张数 ≤ 5 的炸弹
		  if (aType === 'straight_flush') {
		    if (bRank < this.typeRank['bomb']) return true; // 非炸弹
		    if (['bomb', 'big_bomb'].includes(bType) && bCards.length <= 5) return true;
		    return false; // 大炸弹不能压
		  }
		
		  // ✅ 高级炸弹可以压低级炸弹
		  if (aRank >= this.typeRank['bomb'] && bRank >= this.typeRank['bomb']) {
		    return aRank > bRank;
		  }
		
		  // ✅ 炸弹压非炸弹
		  if (aRank >= this.typeRank['bomb'] && bRank < this.typeRank['bomb']) {
		    return true;
		  }
		
		  return false;
		},

    _getTripletValue(cards) {
        const count = {};
        cards.forEach(c => {
            count[c.value] = (count[c.value] || 0) + 1;
        });
        return Object.keys(count).find(v => count[v] === 3);
    },

    // ✅ 排序所有牌组，按照牌型强度 + 同类牌大小
    sortGroups(groups, rules) {
		  const typePriority = {
		    super_bomb: 100,
		    big_bomb: 90,
		    straight_flush: 80,
		    bomb: 70,
		    steel_plate: 60,
		    wooden_board: 50,
		    triplet_with_pair: 40,
		    straight: 30,
		    triplet: 20,
		    pair: 10,
		    single: 0
		  };
		
		  const ranks = rules.getCardRanks();
		
		  function getGroupScore(group) {
		    const type = rules.getCardType(group) || 'unknown';
		    const base = typePriority[type] ?? -1;
		
		    // ✅ 使用 ._asValue
		    const values = group.map(c => c._asValue || c.value);
		
		    // 主牌值（最多的那个）
		    const count = {};
		    values.forEach(v => count[v] = (count[v] || 0) + 1);
		    const mainValue = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
		
		    return base * 100 + (ranks[mainValue] || 0);
		  }
		
		  // 最终排序
		  return groups.sort((a, b) => getGroupScore(b) - getGroupScore(a));
		}
};

// ✅ 改为小写，全项目统一用这个变量名
window.cardPower = CardPower;