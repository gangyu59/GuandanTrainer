import { Card, Rank, Suit } from "./types";

export function isWildcard(card: Card, trumpRank: Rank): boolean {
  return card.suit === "H" && card.rank === trumpRank;
}

export class CardRules {
  trumpRank: Rank = "2";

  setTrump(rank: Rank) {
    this.trumpRank = rank;
  }

  getTrump(): Rank {
    return this.trumpRank;
  }

  getCardRanks(): Record<string, number> {
    const base: Rank[] = [
      "A",
      "K",
      "Q",
      "J",
      "10",
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
    ];
    // GuandanAgent uses SJ/BJ
    const ranks: Record<string, number> = { BJ: 16, SJ: 15 };
    const trump = this.trumpRank;
    const rest = base.filter((v) => v !== trump);
    
    ranks[trump] = 14;
    let point = 13;
    for (const v of rest) {
      ranks[v] = point--;
    }
    return ranks;
  }

  getCardType(cards: Card[]): string | null {
    if (!cards || cards.length === 0) return null;
    const sorted = this.sortCards(cards);
    if (this.isSuperBomb(sorted)) return "super_bomb";
    if (this.isBigBomb(sorted)) return "big_bomb";
    if (this.isStraightFlush(sorted)) return "straight_flush";
    if (this.isBomb(sorted)) return "bomb";
    if (this.isSteelPlate(sorted)) return "steel_plate";
    if (this.isWoodenBoard(sorted)) return "wooden_board";
    if (this.isTripletWithPair(sorted)) return "triplet_with_pair";
    if (this.isStraight(sorted)) return "straight";
    if (this.isTriplet(sorted)) return "triplet";
    if (this.isPair(sorted)) return "pair";
    if (this.isSingle(sorted)) return "single";
    return null;
  }

  sortCards(cards: Card[]): Card[] {
    const ranks = this.getCardRanks();
    return [...cards].sort((a, b) => {
      const diff = (ranks[b.rank] || 0) - (ranks[a.rank] || 0);
      if (diff !== 0) return diff;
      return a.suit.localeCompare(b.suit);
    });
  }

  // --- Helper Predicates ---

  isSingle(cards: Card[]): boolean {
    return cards.length === 1;
  }

  isPair(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    const trump = this.getTrump();
    const wilds = cards.filter((c) => isWildcard(c, trump));
    const normals = cards.filter((c) => !isWildcard(c, trump));
    if (wilds.length === 1 && normals.length === 1) return true;
    if (normals.length === 2 && normals[0].rank === normals[1].rank) return true;
    return false;
  }

  isTriplet(cards: Card[]): boolean {
    if (cards.length !== 3) return false;
    const trump = this.getTrump();
    const wilds = cards.filter((c) => isWildcard(c, trump));
    const normals = cards.filter((c) => !isWildcard(c, trump));
    const counts: Record<string, number> = {};
    for (const c of normals) counts[c.rank] = (counts[c.rank] || 0) + 1;
    for (const count of Object.values(counts)) {
      if (count + wilds.length >= 3) return true;
    }
    return wilds.length === 3;
  }

  isTripletWithPair(cards: Card[]): boolean {
    if (cards.length !== 5) return false;
    const trump = this.getTrump();
    const wilds = cards.filter((c) => isWildcard(c, trump));
    const normals = cards.filter((c) => !isWildcard(c, trump));
    const counts: Record<string, number> = {};
    for (const c of normals) counts[c.rank] = (counts[c.rank] || 0) + 1;
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
  }

  isBomb(cards: Card[]): boolean {
    if (cards.length < 4 || cards.length > 5) return false;
    const trump = this.getTrump();
    const wilds = cards.filter((c) => isWildcard(c, trump));
    const normals = cards.filter((c) => !isWildcard(c, trump));

    const counts: Record<string, number> = {};
    for (const c of normals) {
      // Use _asValue if available (for reconstructed bombs), else rank
      const key = c._asValue || c.rank;
      counts[key] = (counts[key] || 0) + 1;
    }

    for (const count of Object.values(counts)) {
      if (count + wilds.length === cards.length) return true;
    }

    return wilds.length === cards.length;
  }

  isBigBomb(cards: Card[]): boolean {
    if (cards.length <= 5) return false;
    const trump = this.getTrump();
    const wilds = cards.filter((c) => isWildcard(c, trump));
    const normals = cards.filter((c) => !isWildcard(c, trump));
    const counts: Record<string, number> = {};
    for (const c of normals) counts[c.rank] = (counts[c.rank] || 0) + 1;
    for (const count of Object.values(counts)) {
      if (count + wilds.length === cards.length) return true;
    }
    return wilds.length === cards.length;
  }

  isSuperBomb(cards: Card[]): boolean {
    return cards.length === 4 && cards.every((c) => c.suit === "J");
  }

  isSteelPlate(cards: Card[]): boolean {
    if (cards.length !== 6) return false;
    const trump = this.getTrump();
    const wilds = cards.filter((c) => isWildcard(c, trump));
    const normals = cards.filter((c) => !isWildcard(c, trump));
    const counts: Record<string, number> = {};
    for (const c of normals) counts[c.rank] = (counts[c.rank] || 0) + 1;
    
    const candidates = Object.entries(counts)
      .map(([v, count]) => ({ v, count }))
      .sort((a, b) => (this.getCardRanks()[b.v] || 0) - (this.getCardRanks()[a.v] || 0));

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const [a, b] = [candidates[i], candidates[j]];
        const totalNeed = Math.max(0, 3 - a.count) + Math.max(0, 3 - b.count);
        const ranks = this.getCardRanks();
        if ((ranks[a.v] || 0) - (ranks[b.v] || 0) === 1 && totalNeed <= wilds.length) return true;
      }
    }
    return false;
  }

  isWoodenBoard(cards: Card[]): boolean {
    if (cards.length !== 6) return false;
    const trump = this.getTrump();
    const wilds = cards.filter((c) => isWildcard(c, trump));
    const normals = cards.filter((c) => !isWildcard(c, trump));
    const counts: Record<string, number> = {};
    for (const c of normals) counts[c.rank] = (counts[c.rank] || 0) + 1;
    const pairs: string[] = [];
    for (const [v, count] of Object.entries(counts)) {
      if (count >= 2) pairs.push(v);
      else if (count === 1 && wilds.length >= 1) pairs.push(v);
    }
    pairs.sort((a, b) => (this.getCardRanks()[b] || 0) - (this.getCardRanks()[a] || 0));
    if (pairs.length < 3) return false;
    return this.isConsecutive(pairs.slice(0, 3), 3);
  }

  isStraight(cards: Card[]): boolean {
    if (cards.length !== 5) return false;
    const trump = this.getTrump();
    const ranks = this.getCardRanks();

    const wildcards = cards.filter((c) => isWildcard(c, trump));
    const normals = cards.filter(
      (c) =>
        !isWildcard(c, trump) &&
        c.suit !== "J"
    );

    const uniqueValues = [...new Set(normals.map((c) => c.rank))];
    if (uniqueValues.length !== normals.length) return false;

    const has2 = normals.some((c) => c.rank === "2");
    if (has2) return false;

    const normalRanks = uniqueValues.map((v) => ranks[v] || 0).sort((a, b) => a - b);
    const allRanks = Object.values(ranks).filter((r) => r < (ranks["2"] || 999));
    const minStart = Math.min(...allRanks);
    const maxStart = (ranks["A"] || 14) - 4;

    for (let start = minStart; start <= maxStart; start++) {
      const expected = new Set([start, start + 1, start + 2, start + 3, start + 4]);
      let remainingWildcards = wildcards.length;

      for (const val of normalRanks) {
        if (expected.has(val)) {
          expected.delete(val);
        } else {
          break;
        }
      }

      if (expected.size <= remainingWildcards) {
        return true;
      }
    }

    // A2345 special case
    const a2345 = ["A", "2", "3", "4", "5"];
    const values = normals.map((c) => c.rank);
    // This part in legacy code handled A2345 specially. 
    // But '2' is excluded above?
    // Legacy: const has2 = normals.some(c => c.value === '2'); if (has2) return false;
    // Wait, A2345 contains 2. So the legacy code returns false if it has 2, BUT then checks A2345?
    // Actually legacy code says:
    // const has2 = normals.some(c => c.value === '2');
    // if (has2) return false;
    // ...
    // // Special case A2345
    // const a2345 = ['A', '2', '3', '4', '5'];
    // ...
    // If '2' is present, `has2` is true, so it returns false immediately.
    // So A2345 is IMPOSSIBLE if '2' is treated as normal card?
    // Ah, '2' is a high card in Guandan.
    // Maybe A2345 is only valid if 2 is NOT the trump?
    // In legacy code: `if (has2) return false;`
    // This seems to imply 2 cannot be part of a straight unless it's the special A2345 case?
    // But it returns false BEFORE checking A2345.
    // Wait, looking at legacy code again:
    /*
      // 非法：包含2，除非是 A2345 的特例
      const has2 = normals.some(c => c.value === '2');
      if (has2) return false;
    */
    // This looks like a bug in legacy code or I misread it?
    // If `has2` is true, it returns. So A2345 check is unreachable if 2 is present in normals.
    // Unless 2 is wildcard? If 2 is trump, it's in wildcards (if H) or just trump (if not H).
    // Wildcards are filtered out.
    // If 2 is trump (e.g. playing 2), then 2 is a trump card, not normal.
    // `isWildcard` checks H + TrumpValue.
    // `normals` filters out `isWildcard`.
    // But `normals` does NOT filter out non-H trumps!
    // Legacy: `const normals = cards.filter(c => !isWildcard(c, trump) && c.suit !== 'joker' ...)`
    // So if 2 is trump (and not H), it is in `normals`.
    // So if I have a Spade 2 (trump), it is in `normals`. `has2` is true. Returns false.
    // So straights cannot contain trumps?
    // In Guandan, straights CANNOT contain trumps (level card).
    // So if 2 is the level card, it cannot be in straight.
    // But what if 2 is NOT the level card? Then 2 is just a small card (after A)?
    // No, 2 is always high.
    // A2345 is a special straight in some variations.
    // If the legacy code disables it, I should too.

    return false;
  }

  isStraightFlush(cards: Card[]): boolean {
    if (cards.length !== 5) return false;
    const suits = cards.map((c) => c.suit);
    const dominantSuit = suits.find((s) => suits.filter((x) => x === s).length >= 5 - 1);
    if (!dominantSuit) return false;
    const suitValid = cards.every((c) => c.suit === dominantSuit || isWildcard(c, this.getTrump()));
    if (!suitValid) return false;
    return this.isStraight(cards);
  }

  isConsecutive(values: string[], len: number): boolean {
    if (values.length !== len) return false;
    const ranks = this.getCardRanks();
    for (let i = 0; i < len - 1; i++) {
      if ((ranks[values[i]] || 0) - (ranks[values[i + 1]] || 0) !== 1) return false;
    }
    return true;
  }
}
