function CardGrouper() {
    const rules = window.cardRules;
    const power = window.cardPower;

    // 最少手数组牌
		this.groupByMinHands = function(cards) {
  const rules = window.cardRules;
  const power = window.cardPower;
  const trump = rules.trumpValue;

  const isW = (c) => isWildcard(c, trump);
  const parts = splitWildcards(cards); // ✅ 你自定义的，无需传 trump
  const normalCards = parts.others;
  const wildcards = parts.wildcards;

  const extractors = [
    extractSuperBomb,
    extractStraightFlush,
    extractBomb,
    extractBigBomb,
    extractSteelPlate,
    extractWoodenBoard,
    extractTripletWithPair,
    extractStraight,
    extractTriplet,
    extractPair,
    extractSingle
  ];

  const hashGroup = (group) =>
    group.map(c => `${c.suit}${c.value}`).sort().join(',');

  let bestResult = null;

  function dfs(remaining, wildPool, path, seen) {
    if (remaining.length === 0 && wildPool.length === 0) {
      if (!bestResult || path.length < bestResult.length) {
        bestResult = [...path];
      }
      return;
    }

    if (bestResult && path.length >= bestResult.length) return;

    const combined = remaining.concat(wildPool);

    for (const extractor of extractors) {
      const { group, rest } = extractor(combined);
      if (!group || group.length === 0) continue;

      const hash = hashGroup(group);
      if (seen.has(hash)) continue;
      seen.add(hash);

      const usedNormal = group.filter(c => !isW(c));
      const usedWild = group.filter(isW);

      // ❗如果是4张炸弹，不允许拆（保留）
      const type = rules.getCardType(group);
      if (type === 'bomb' && group.length === 4) continue;

      // ❗其余牌型允许尝试拆牌
      const nextRemaining = remaining.filter(c => !usedNormal.includes(c));
      const nextWild = [...wildPool];
      nextWild.splice(0, usedWild.length);

      dfs(nextRemaining, nextWild, [...path, group], new Set(seen));
    }
  }

  dfs(normalCards, wildcards, [], new Set());

  return power.sortGroups(bestResult || [], rules);
};

		// 最大牌力排序组牌
    this.groupByCardPower = function(cards) {
        let hand = cards.slice(); // 拷贝
        const result = [];

        // 排序从大到小，减少组合爆炸
        hand.sort((a, b) => rules.getCardRanks()[b.value] - rules.getCardRanks()[a.value]);

        // 顺序必须从强牌型到弱牌型
        const extractors = [
            extractSuperBomb,
            extractStraightFlush,
            extractBomb,
						extractBigBomb,
            extractSteelPlate,
            extractWoodenBoard,
            extractTripletWithPair,
						extractStraight,
            extractTriplet,
            extractPair,
            extractSingle
        ];

        for (const extractor of extractors) {
            let found;
            do {
                const { group, rest } = extractor(hand);
                found = group.length > 0;
                if (found) result.push(group);
                hand = rest;
            } while (found);
        }

        return power.sortGroups(result, rules);
    };

		// 🔁 判断某张牌是否是百搭牌（红桃 + 主牌值）
		function isWildcard(card, trump) {
		  const is =
		    card &&
		    card.suit === 'h' &&
		    String(card.value) === String(trump);
		
		  if (is) {
		 //   console.log(`[识别百搭] ✅ 匹配百搭牌: ${card.suit}${card.value} 等于主牌 ${trump}`);
		  }
		  return is;
		}
		window.isWildcard = isWildcard; // 确保全局可用
		
		// 🔁 将牌按是否为百搭分成两组
		function splitWildcards(cards) {
		  const trump = window.cardRules.getTrump();
		//  console.log('[DEBUG] 主牌值:', trump, typeof trump);
		
		  const wildcards = cards.filter(c => {
		    const is = isWildcard(c, trump);
		//    if (is) console.log('[识别百搭] ✅:', `${c.suit}${c.value}`);
		    return is;
		  });
		
		  const others = cards.filter(c => !isWildcard(c, trump));
		//  console.log('[提取炸弹] 百搭牌:', wildcards.map(c => `${c.suit}${c.value}`));
		//  console.log('[提取炸弹] 非百搭牌:', others.map(c => `${c.suit}${c.value}`));
		  return { wildcards, others };
		}

    // 每类牌型的提取逻辑，返回 { group, rest }
    function extractSuperBomb(hand) {
        const jokers = hand.filter(c => c.suit === 'joker');
        if (jokers.length >= 4) {
            const group = jokers.slice(0, 4);
            return { group, rest: removeCards(hand, group) };
        }
        return { group: [], rest: hand };
    }

		function extractBigBomb(hand) {
		    const trump = window.cardRules.getTrump(); // 获取当前主牌值
		  const { wildcards, others } = splitWildcards(hand, trump); // ✅ 传入 trump
				    const counts = groupByValue(others);
				
				    for (let val in counts) {
				        const group = counts[val];
				        // 找出所有 ≥6 张同点数的牌
				        if (group.length >= 6) {
				            return { group, rest: removeCards(hand, group) };
				        }
				
				        // 尝试用百搭凑到 ≥6 张
				        const need = 6 - group.length;
				        if (need > 0 && wildcards.length >= need) {
				            const fullGroup = [...group, ...wildcards.slice(0, need)];
				            return { group: fullGroup, rest: removeCards(hand, fullGroup) };
				        }
				    }
				
				    // 也要考虑用全百搭组成大炸弹（极端情况）
				    const allValues = Object.keys(window.cardRules.getCardRanks());
				    for (let val of allValues) {
				        if (!counts[val] && wildcards.length >= 6) {
				            const fullGroup = wildcards.slice(0, 6);
				            return { group: fullGroup, rest: removeCards(hand, fullGroup) };
				        }
				    }
				
				    return { group: [], rest: hand };
				}

    function extractStraightFlush(hand) {
		  const trump = window.cardRules.getTrump(); // 获取当前主牌值
		  const { wildcards, others } = splitWildcards(hand, trump); // ✅ 传入 trump
		  const suitGroups = groupBySuit(others);
		  const ranks = window.cardRules.getCardRanks();
		
		  // 只使用非主牌点数，顺子不允许2和王
		  const allValues = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3'];
		
		  for (let suit of ['s', 'h', 'd', 'c']) {
		    const cardsOfSuit = suitGroups[suit] || [];
		    const valueMap = {};
		    for (let card of cardsOfSuit) {
		      valueMap[card.value] = card;
		    }
		
		    for (let i = 0; i <= allValues.length - 5; i++) {
		      const valuesNeeded = allValues.slice(i, i + 5);
		      const group = [];
		      const usedWildcards = [];
		
		      for (let val of valuesNeeded) {
		        if (valueMap[val]) {
		          group.push(valueMap[val]);
		        } else if (usedWildcards.length < wildcards.length) {
		          const wild = wildcards[usedWildcards.length];
		          const fake = { ...wild, _asValue: val, _asSuit: suit };
		          group.push(fake);
		          usedWildcards.push(wild);
		        } else {
		          break; // 无法构成五连
		        }
		      }
		
		      if (group.length === 5) {
		        // ✅ 找到一个合法同花顺组合
		        const usedCards = [...group];
		        return {
		          group,
		          rest: removeCards(hand, usedCards)
		        };
		      }
		    }
		  }
		
		  return { group: [], rest: hand };
		}

    function extractBomb(hand) {
		  const trump = window.cardRules.getTrump(); // 确保获取主牌点数
		  const wildcards = hand.filter(c => isWildcard(c, trump));
		  const others = hand.filter(c => !isWildcard(c, trump));
		  const counts = groupByValue(others);
		
		  let bestGroup = [];
		  let bestValue = null;
		
		  for (let val in counts) {
		    const group = counts[val];
		
		    // 原生炸弹
		    if (group.length >= 4 && group.length <= 5) {
		      return { group, rest: removeCards(hand, group) };
		    }
		
		    // 尝试百搭补炸弹（必须至少有1张非百搭）
		    for (let need = 4; need <= 5; need++) {
		      const missing = need - group.length;
		      if (missing > 0 && wildcards.length >= missing) {
		        const usedWilds = wildcards.slice(0, missing).map(w => ({
		          ...w,
		          _asValue: val
		        }));
		
		        const combined = [...group, ...usedWilds];
		
		  //      console.log(`[提取炸弹] 尝试用百搭补组炸弹: 目标值 ${val}, 百搭数 ${missing}, 组合结果:`, combined.map(c => `${c.suit}${c._asValue || c.value}`));
		
		        if (combined.length === need && need > bestGroup.length) {
		          bestGroup = combined;
		          bestValue = val;
		        }
		      }
		    }
		  }
		
		  if (bestGroup.length >= 4) {
		//    console.log(`[提取炸弹] 使用百搭成功组成炸弹: 值 ${bestValue}, 数量 ${bestGroup.length}`);
		    return { group: bestGroup, rest: removeCards(hand, bestGroup) };
		  }
		
		//  console.log('[提取炸弹] ❌ 没有找到炸弹');
		  return { group: [], rest: hand };
		}

    function extractSteelPlate(hand) {
		    const trump = window.cardRules.getTrump(); // 获取当前主牌值   
				const { wildcards, others } = splitWildcards(hand, trump); // ✅ 传入 trump
		    const counts = groupByValue(others);
		    const tripletCandidates = [];
		
		    // 找出所有可补足到 3 张的点数
		    for (let val in counts) {
		        const group = counts[val];
		        if (group.length >= 3) {
		            tripletCandidates.push({ value: val, cards: group.slice(0, 3), need: 0 });
		        } else if (group.length === 2 && wildcards.length >= 1) {
		            tripletCandidates.push({ value: val, cards: [...group, wildcards[0]], need: 1 });
		        } else if (group.length === 1 && wildcards.length >= 2) {
		            tripletCandidates.push({ value: val, cards: [...group, ...wildcards.slice(0, 2)], need: 2 });
		        }
		    }
		
		    // 尝试用百搭组成独立三张（缺少原始牌也行）
		    const allValues = Object.keys(window.cardRules.getCardRanks());
		    for (let val of allValues) {
		        if (!counts[val] && wildcards.length >= 3) {
		            tripletCandidates.push({ value: val, cards: wildcards.slice(0, 3), need: 3 });
		        }
		    }
		
		    // 按点数大小排序
		    tripletCandidates.sort((a, b) => {
		        return window.cardRules.getCardRanks()[b.value] - window.cardRules.getCardRanks()[a.value];
		    });
		
		    // 依次尝试找相邻的两组三张
		    for (let i = 0; i < tripletCandidates.length - 1; i++) {
		        const t1 = tripletCandidates[i];
		        const t2 = tripletCandidates[i + 1];
		        const r1 = window.cardRules.getCardRanks()[t1.value];
		        const r2 = window.cardRules.getCardRanks()[t2.value];
		
		        if (r1 > window.cardRules.getCardRanks()['A']) continue; // 不能超 A
		        if (r1 - r2 !== 1) continue;
		
		        const totalNeeded = t1.need + t2.need;
		        if (totalNeeded <= wildcards.length) {
		            // 使用新百搭分配（防止重复）
		            const usedWilds = wildcards.slice(0, totalNeeded);
		            const group = [...t1.cards, ...t2.cards];
		
		            return { group, rest: removeCards(hand, group.concat(usedWilds)) };
		        }
		    }
		
		    return { group: [], rest: hand };
		}
		
		function extractWoodenBoard(hand) {
		    const trump = window.cardRules.getTrump(); // 获取当前主牌值   
				const { wildcards, others } = splitWildcards(hand, trump); // ✅ 传入 trump
		    const counts = groupByValue(others);
		    const pairCandidates = [];
		
		    // 找出可补足成对子的所有点数
		    for (let val in counts) {
		        const group = counts[val];
		        if (group.length >= 2) {
		            pairCandidates.push({ value: val, cards: group.slice(0, 2), need: 0 });
		        } else if (group.length === 1 && wildcards.length >= 1) {
		            pairCandidates.push({ value: val, cards: [group[0], wildcards[0]], need: 1 });
		        }
		    }
		
		    // 允许纯百搭作为对子
		    const allValues = Object.keys(window.cardRules.getCardRanks());
		    for (let val of allValues) {
		        if (!counts[val] && wildcards.length >= 2) {
		            pairCandidates.push({ value: val, cards: wildcards.slice(0, 2), need: 2 });
		        }
		    }
		
		    // 按点数大小排序
		    pairCandidates.sort((a, b) => {
		        return window.cardRules.getCardRanks()[b.value] - window.cardRules.getCardRanks()[a.value];
		    });
		
		    // 尝试从中找出三组连续点数的对子
		    for (let i = 0; i < pairCandidates.length - 2; i++) {
		        const p1 = pairCandidates[i];
		        const p2 = pairCandidates[i + 1];
		        const p3 = pairCandidates[i + 2];
		
		        const r1 = window.cardRules.getCardRanks()[p1.value];
		        const r2 = window.cardRules.getCardRanks()[p2.value];
		        const r3 = window.cardRules.getCardRanks()[p3.value];
		
		        if (r1 > window.cardRules.getCardRanks()['A']) continue;
		
		        if (r1 - r2 === 1 && r2 - r3 === 1) {
		            const totalNeed = p1.need + p2.need + p3.need;
		            if (totalNeed <= wildcards.length) {
		                const usedWilds = wildcards.slice(0, totalNeed);
		                const group = [...p1.cards, ...p2.cards, ...p3.cards];
		
		                return { group, rest: removeCards(hand, group.concat(usedWilds)) };
		            }
		        }
		    }
		
		    return { group: [], rest: hand };
		}

    function extractTripletWithPair(hand) {
	    const trump = window.cardRules.getTrump(); // 获取当前主牌值   
			const { wildcards, others } = splitWildcards(hand, trump); // ✅ 传入 trump
	    const counts = groupByValue(others);
	    const tripletOptions = [];
	    const pairOptions = [];
	
	    // 先构造所有三张组合
	    for (let val in counts) {
	        const group = counts[val];
	        if (group.length >= 3) {
	            tripletOptions.push({ value: val, cards: group.slice(0, 3), need: 0 });
	        } else if (group.length === 2 && wildcards.length >= 1) {
	            tripletOptions.push({ value: val, cards: [...group, wildcards[0]], need: 1 });
	        } else if (group.length === 1 && wildcards.length >= 2) {
	            tripletOptions.push({ value: val, cards: [...group, ...wildcards.slice(0, 2)], need: 2 });
	        }
	    }

		    // 构造对子候选
		    for (let val in counts) {
		        const group = counts[val];
		        if (group.length >= 2) {
		            pairOptions.push({ value: val, cards: group.slice(0, 2), need: 0 });
		        } else if (group.length === 1 && wildcards.length >= 1) {
		            pairOptions.push({ value: val, cards: [...group, wildcards[0]], need: 1 });
		        }
		    }
		
		    // 添加全百搭三张/对子组合
		    const allValues = Object.keys(window.cardRules.getCardRanks());
		    for (let val of allValues) {
		        if (!counts[val]) {
		            if (wildcards.length >= 3) {
		                tripletOptions.push({ value: val, cards: wildcards.slice(0, 3), need: 3 });
		            }
		            if (wildcards.length >= 2) {
		                pairOptions.push({ value: val, cards: wildcards.slice(0, 2), need: 2 });
		            }
		        }
		    }
		
		    // 避免同值 triplet + pair
		    for (let t of tripletOptions) {
		        for (let p of pairOptions) {
		            if (t.value === p.value) continue;
		            const totalNeed = t.need + p.need;
		            if (totalNeed <= wildcards.length) {
		                const usedWilds = wildcards.slice(0, totalNeed);
		                const group = [...t.cards, ...p.cards];
		                return { group, rest: removeCards(hand, group.concat(usedWilds)) };
		            }
		        }
		    }
		
		    return { group: [], rest: hand };
		}
		
    // extractStraight 中构造含百搭的牌组
		function extractStraight(cards) {
		  const rules = window.cardRules;
		  const trump = rules.getTrump();
		
		  // 1. 分离百搭和普通牌
		  const wildcards = [];
		  const normal = [];
		  for (let card of cards) {
		    if (isWildcard(card, trump)) wildcards.push(card);
		    else normal.push(card);
		  }
		
		  if (normal.length + wildcards.length < 5) {
		    return { group: [], rest: cards };
		  }
		
		  const ranks = rules.getCardRanks();
		  const seen = new Set();
		  const sorted = normal
		    .filter(c => {
		      const v = String(c.value);
		      if (v === '2' || v === 'big' || v === 'small') return false;
		      if (seen.has(v)) return false;
		      seen.add(v);
		      return true;
		    })
		    .sort((a, b) => ranks[a.value] - ranks[b.value]);
		
		  // 2. 枚举所有长度为 n 的组合，并尝试用百搭补足成为连续5张
		  for (let i = 0; i <= sorted.length; i++) {
		    for (let len = 1; len <= 5; len++) {
		      const base = sorted.slice(i, i + len);
		      if (base.length + wildcards.length < 5) continue;
		
		      const baseRanks = base.map(c => ranks[c.value]).sort((a, b) => a - b);
		      const minRank = baseRanks[0];
		      const maxRank = baseRanks[baseRanks.length - 1];
		
		      for (let start = minRank - wildcards.length; start <= minRank; start++) {
		        const neededRanks = [];
		        for (let j = 0; j < 5; j++) {
		          neededRanks.push(start + j);
		        }
		
		        const usedRanks = new Set(baseRanks);
		        const missing = neededRanks.filter(r => !usedRanks.has(r));
		
		        // 如果百搭数量够补
		        if (missing.length <= wildcards.length) {
		          const mappedWilds = missing.map((r, idx) => {
		            const val = Object.keys(ranks).find(k => ranks[k] === r);
		            return { ...wildcards[idx], value: val }; // 用真实百搭替换
		          });
		
		          const group = [...base, ...mappedWilds];
		          if (rules.isStraight(group)) {
		            const usedCards = [...base, ...wildcards.slice(0, mappedWilds.length)];
		            return {
		              group,
		              rest: cards.filter(c => !usedCards.includes(c))
		            };
		          }
		        }
		      }
		    }
		  }
		
		  // 3. 无百搭也能成顺子的情况
		  for (let i = 0; i <= sorted.length - 5; i++) {
		    const slice = sorted.slice(i, i + 5);
		    if (rules.isStraight(slice)) {
		      return {
		        group: slice,
		        rest: cards.filter(c => !slice.includes(c))
		      };
		    }
		  }
		
		  return { group: [], rest: cards };
		}

    function extractTriplet(hand) {
		    const trump = window.cardRules.getTrump(); // 获取当前主牌值   
				const { wildcards, others } = splitWildcards(hand, trump); // ✅ 传入 trump
		    const counts = groupByValue(others);
		
		    // 1️⃣ 优先提取自然三张
		    for (let val in counts) {
		        const group = counts[val];
		        if (group.length >= 3) {
		            const triplet = group.slice(0, 3);
		            return { group: triplet, rest: removeCards(hand, triplet) };
		        }
		    }
		
		    // 2️⃣ 尝试 2 原牌 + 1 百搭
		    for (let val in counts) {
		        const group = counts[val];
		        if (group.length === 2 && wildcards.length >= 1) {
		            const triplet = [...group, wildcards[0]];
		            return { group: triplet, rest: removeCards(hand, triplet) };
		        }
		    }
		
		    // 3️⃣ 尝试 1 原牌 + 2 百搭
		    for (let val in counts) {
		        const group = counts[val];
		        if (group.length === 1 && wildcards.length >= 2) {
		            const triplet = [group[0], ...wildcards.slice(0, 2)];
		            return { group: triplet, rest: removeCards(hand, triplet) };
		        }
		    }
		
		    // 4️⃣ 纯百搭三张
		    const allValues = Object.keys(window.cardRules.getCardRanks());
		    if (wildcards.length >= 3) {
		        const triplet = wildcards.slice(0, 3);
		        return { group: triplet, rest: removeCards(hand, triplet) };
		    }
		
		    return { group: [], rest: hand };
		}
		
    function extractPair(hand) {
		    const trump = window.cardRules.getTrump(); // 获取当前主牌值   
				const { wildcards, others } = splitWildcards(hand, trump); // ✅ 传入 trump
		    const counts = groupByValue(others);
		
		    // 1️⃣ 优先查找自然对子
		    for (let val in counts) {
		        const group = counts[val];
		        if (group.length >= 2) {
		            const pair = group.slice(0, 2);
		            return { group: pair, rest: removeCards(hand, pair) };
		        }
		    }
		
		    // 2️⃣ 尝试用 1 原牌 + 1 百搭
		    for (let val in counts) {
		        const group = counts[val];
		        if (group.length === 1 && wildcards.length >= 1) {
		            const pair = [group[0], wildcards[0]];
		            return { group: pair, rest: removeCards(hand, pair) };
		        }
		    }
		
		    // 3️⃣ 纯百搭组一对
		    const allValues = Object.keys(window.cardRules.getCardRanks());
		    for (let val of allValues) {
		        if (wildcards.length >= 2) {
		            const pair = wildcards.slice(0, 2);
		            return { group: pair, rest: removeCards(hand, pair) };
		        }
		    }
		
		    return { group: [], rest: hand };
		}

    function extractSingle(hand) {
        if (hand.length > 0) {
            const card = hand[0];
            return { group: [card], rest: removeCards(hand, [card]) };
        }
        return { group: [], rest: hand };
    }

    // 工具函数
    function groupByValue(cards) {
        const map = {};
        cards.forEach(c => {
            if (!map[c.value]) map[c.value] = [];
            map[c.value].push(c);
        });
        return map;
    }

    function groupBySuit(cards) {
        const map = {};
        cards.forEach(c => {
            if (!map[c.suit]) map[c.suit] = [];
            map[c.suit].push(c);
        });
        return map;
    }

    function extractMultipleSets(hand, count) {
        const counts = groupByValue(hand);
        const sets = [];
        for (let val in counts) {
            if (counts[val].length >= count) {
                sets.push(counts[val].slice(0, count));
            }
        }
        return sets.sort((a, b) => rules.getCardRanks()[b[0].value] - rules.getCardRanks()[a[0].value]);
    }

    function removeCards(from, subset) {
		  const result = from.slice();
		  const usedIndices = new Set(); // 防止重复删同一张
		
		  subset.forEach(card => {
		    // 先找真实牌
		    let index = result.findIndex((c, i) =>
		      !usedIndices.has(i) &&
		      c.suit === card.suit &&
		      c.value === card.value
		    );
		
		    // 找不到就找百搭（且是伪装牌）
		    if (index === -1 && card._asValue) {
		      index = result.findIndex((c, i) =>
		        !usedIndices.has(i) && isWildcard(c)
		      );
		    }
		
		    if (index !== -1) {
		      usedIndices.add(index);
		    }
		  });
		
		  // 按索引倒序删除（防止 splice 后影响顺序）
		  const indices = Array.from(usedIndices).sort((a, b) => b - a);
		  for (const i of indices) {
		    result.splice(i, 1);
		  }
		
		  return result;
		}

    function removeJokers(cards) {
        return cards.filter(c => c.suit !== 'joker');
    }

    function sortCards(cards) {
        return cards.slice().sort((a, b) => rules.getCardRanks()[b.value] - rules.getCardRanks()[a.value]);
    }
}