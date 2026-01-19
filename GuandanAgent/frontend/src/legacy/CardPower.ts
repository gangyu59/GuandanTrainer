import { Card, Rank, Suit } from "./types";
import { CardRules } from "./CardRules";

export const CardPower = {
  typeRank: {
    super_bomb: 110,
    big_bomb: 100,
    straight_flush: 90,
    bomb: 80,
    steel_plate: 70,
    wooden_board: 60,
    triplet_with_pair: 50,
    straight: 40,
    triplet: 30,
    pair: 20,
    single: 10,
  } as Record<string, number>,

  getTypeRank(cardType: string, cards: Card[]): number {
    switch (cardType) {
      case "super_bomb":
        return this.typeRank["super_bomb"];
      case "big_bomb":
        return this.typeRank["big_bomb"];
      case "bomb":
        return cards.length > 5
          ? this.typeRank["big_bomb"]
          : this.typeRank["bomb"];
      case "straight_flush":
        return this.typeRank["straight_flush"];
      case "steel_plate":
        return this.typeRank["steel_plate"];
      case "wooden_board":
        return this.typeRank["wooden_board"];
      case "triplet_with_pair":
        return this.typeRank["triplet_with_pair"];
      case "straight":
        return this.typeRank["straight"];
      case "triplet":
        return this.typeRank["triplet"];
      case "pair":
        return this.typeRank["pair"];
      case "single":
        return this.typeRank["single"];
      default:
        return 0;
    }
  },

  compareSameType(
    aCards: Card[],
    bCards: Card[],
    type: string,
    cardRules: CardRules
  ): number {
    // Note: In original JS, sortCards was called.
    // Here we assume input might not be sorted, so we sort if needed?
    // CardRules has sortCards.
    const aSorted = cardRules.sortCards(aCards);
    const bSorted = cardRules.sortCards(bCards);
    const ranks = cardRules.getCardRanks();
    const trump = cardRules.getTrump();

    const getMainValue = (cards: Card[], type: string): string | null => {
      const countMap: Record<string, number> = {};
      for (const card of cards) {
        // Use rank as value key
        countMap[card.rank] = (countMap[card.rank] || 0) + 1;
      }

      if (type === "triplet_with_pair" || type === "triplet") {
        return Object.keys(countMap).find((v) => countMap[v] === 3) || null;
      }
      if (type === "pair") {
        return Object.keys(countMap).find((v) => countMap[v] === 2) || null;
      }
      if (type === "single") {
        return cards[0].rank;
      }
      if (type === "steel_plate") {
        const triplets = Object.keys(countMap).filter((v) => countMap[v] === 3);
        return triplets.length
          ? triplets.sort((a, b) => ranks[b] - ranks[a])[0]
          : null;
      }
      if (type === "wooden_board") {
        const pairs = Object.keys(countMap).filter((v) => countMap[v] === 2);
        return pairs.length
          ? pairs.sort((a, b) => ranks[b] - ranks[a])[0]
          : null;
      }
      if (type === "straight" || type === "straight_flush") {
        return cards[0].rank; // 顺子首位最大 (Sorted descending)
      }

      return cards[0].rank;
    };

    const compareValues = (aVal: string, bVal: string): number => {
      const isATrump = aVal === trump;
      const isBTrump = bVal === trump;
      // In JS: 'big' | 'small'. In TS: 'BJ' | 'SJ'
      const isAKing = aVal === "BJ" || aVal === "SJ";
      const isBKing = bVal === "BJ" || bVal === "SJ";

      // 王永远最大
      if (isAKing && !isBKing) return 1;
      if (!isAKing && isBKing) return -1;
      // If both kings, check ranks (BJ > SJ)
      if (isAKing && isBKing) {
         return ranks[aVal] > ranks[bVal] ? 1 : -1;
      }

      // 主牌优先（不能压王，已经处理完）
      if (isATrump && !isBTrump) return 1;
      if (!isATrump && isBTrump) return -1;

      // 普通 rank 比较
      return ranks[aVal] > ranks[bVal] ? 1 : -1;
    };

    // === 特殊牌型：炸弹优先级 ===
    if (type === "super_bomb") return 0;

    if (type === "big_bomb" || type === "bomb") {
      if (aCards.length !== bCards.length)
        return aCards.length > bCards.length ? 1 : -1;
      const aVal = getMainValue(aSorted, type);
      const bVal = getMainValue(bSorted, type);
      if (!aVal || !bVal) return 0;
      return compareValues(aVal, bVal);
    }

    // === 顺子/同花顺必须长度相等 ===
    if (
      (type === "straight" || type === "straight_flush") &&
      aCards.length !== bCards.length
    )
      return 0;

    // 其它牌型统一主值比较
    const aVal = getMainValue(aSorted, type);
    const bVal = getMainValue(bSorted, type);
    if (!aVal || !bVal) return 0;

    return compareValues(aVal, bVal);
  },

  sortGroups(groups: Card[][], cardRules: CardRules): Card[][] {
    return groups.sort((a, b) => {
      const typeA = cardRules.getCardType(a);
      const typeB = cardRules.getCardType(b);
      if (!typeA) return 1;
      if (!typeB) return -1;
      
      const rankA = this.getTypeRank(typeA, a);
      const rankB = this.getTypeRank(typeB, b);
      
      if (rankA !== rankB) {
        return rankB - rankA;
      }
      
      return this.compareSameType(b, a, typeA, cardRules);
    });
  },

  canBeat(
    aCards: Card[],
    bCards: Card[],
    cardRules: CardRules
  ): boolean {
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
    if (aType === "super_bomb") return true;

    // ✅ straight_flush 能压任意非炸弹，以及张数 ≤ 5 的炸弹
    if (aType === "straight_flush") {
      if (bRank < this.typeRank["bomb"]) return true; // 非炸弹
      if (["bomb", "big_bomb"].includes(bType) && bCards.length <= 5)
        return true;
      return false; // 大炸弹不能压
    }

    // ✅ 高级炸弹可以压低级炸弹
    if (aRank >= this.typeRank["bomb"] && bRank >= this.typeRank["bomb"]) {
      return aRank > bRank;
    }

    // ✅ 炸弹压非炸弹
    if (aRank >= this.typeRank["bomb"] && bRank < this.typeRank["bomb"]) {
      return true;
    }

    return false;
  },
};
