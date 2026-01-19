import { Card, Rank, Suit } from "./types";
import { CardRules, isWildcard } from "./CardRules";
import { CardPower } from "./CardPower";

function removeCards(hand: Card[], toRemove: Card[]): Card[] {
  const remaining = [...hand];
  for (const remove of toRemove) {
    const idx = remaining.findIndex(
      (c) => c.suit === remove.suit && c.rank === remove.rank
    );
    if (idx !== -1) {
      remaining.splice(idx, 1);
    }
  }
  return remaining;
}

function groupByValue(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const c of cards) {
    const key = c.rank;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return groups;
}

function groupBySuit(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const c of cards) {
    const key = c.suit;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return groups;
}

export class HandOptimizer {
  cardRules: CardRules;
  cardPower: typeof CardPower;

  constructor(cardRules: CardRules, cardPower: typeof CardPower) {
    this.cardRules = cardRules;
    this.cardPower = cardPower;
  }

  groupByCardPower(cards: Card[]): Card[][] {
    let hand = [...cards];
    const result: Card[][] = [];

    // Sort hand by rank desc
    const ranks = this.cardRules.getCardRanks();
    hand.sort((a, b) => (ranks[b.rank] || 0) - (ranks[a.rank] || 0));

    const extractors = [
      this.extractSuperBomb.bind(this),
      this.extractStraightFlush.bind(this),
      this.extractBomb.bind(this),
      this.extractBigBomb.bind(this),
      this.extractSteelPlate.bind(this),
      this.extractWoodenBoard.bind(this),
      this.extractTripletWithPair.bind(this),
      this.extractStraight.bind(this),
      this.extractTriplet.bind(this),
      this.extractPair.bind(this),
      this.extractSingle.bind(this),
    ];

    for (const extractor of extractors) {
      let found = false;
      do {
        const { group, rest } = extractor(hand);
        found = group.length > 0;
        if (found) {
          result.push(group);
          hand = rest;
        }
      } while (found);
    }

    return this.cardPower.sortGroups(result, this.cardRules);
  }
  
  // Minimal implementation for now, aliasing to groupByCardPower
  // The DFS implementation is very complex to port in one go.
  // This will at least provide functional grouping for AI and Organize.
  groupByMinHands(cards: Card[]): Card[][] {
      return this.groupByCardPower(cards);
  }

  splitWildcards(cards: Card[]) {
    const trump = this.cardRules.getTrump();
    const wildcards = cards.filter((c) => isWildcard(c, trump));
    const others = cards.filter((c) => !isWildcard(c, trump));
    return { wildcards, others };
  }

  extractSuperBomb(hand: Card[]) {
    const jokers = hand.filter((c) => c.suit === "J");
    if (jokers.length >= 4) {
      const group = jokers.slice(0, 4);
      return { group, rest: removeCards(hand, group) };
    }
    return { group: [], rest: hand };
  }

  extractBigBomb(hand: Card[]) {
    const { wildcards, others } = this.splitWildcards(hand);
    const counts = groupByValue(others);

    for (const val in counts) {
      const group = counts[val];
      if (group.length >= 6) {
        return { group, rest: removeCards(hand, group) };
      }
      const need = 6 - group.length;
      if (need > 0 && wildcards.length >= need) {
        const fullGroup = [...group, ...wildcards.slice(0, need)];
        // Assign _asValue
        fullGroup.forEach(c => {
             if (isWildcard(c, this.cardRules.getTrump())) c._asValue = val;
        });
        return { group: fullGroup, rest: removeCards(hand, fullGroup) };
      }
    }
    // All wildcards case
    if (wildcards.length >= 6) {
        // Just pick any rank? Or keep as wildcards?
        // Usually big bomb of wildcards is not typical unless mapped.
        // But 6 jokers is impossible (only 4).
        // 6 hearts? 2 decks -> 2 hearts of trump rank.
        // So this case is rare/impossible for pure wildcards unless we consider heart trump.
        // 2 decks -> 2 heart trumps.
        // So wildcards.length max is 4 (jokers) + 2 (heart trumps) = 6.
        // So it IS possible to have 6 wildcards!
        const fullGroup = wildcards.slice(0, 6);
        return { group: fullGroup, rest: removeCards(hand, fullGroup) };
    }

    return { group: [], rest: hand };
  }

  extractBomb(hand: Card[]) {
    const { wildcards, others } = this.splitWildcards(hand);
    const counts = groupByValue(others);
    let bestGroup: Card[] = [];
    let bestValue: string | null = null;

    for (const val in counts) {
      const group = counts[val];
      // Native bomb
      if (group.length >= 4 && group.length <= 5) {
        return { group, rest: removeCards(hand, group) };
      }
      // With wildcards
      for (let need = 4; need <= 5; need++) {
        const missing = need - group.length;
        if (missing > 0 && wildcards.length >= missing) {
          const usedWilds = wildcards.slice(0, missing).map(w => ({ ...w, _asValue: val }));
          const combined = [...group, ...usedWilds];
          if (combined.length === need && combined.length > bestGroup.length) {
            bestGroup = combined;
            bestValue = val;
          }
        }
      }
    }

    if (bestGroup.length >= 4) {
      return { group: bestGroup, rest: removeCards(hand, bestGroup) };
    }
    return { group: [], rest: hand };
  }

  extractStraightFlush(hand: Card[]) {
    const { wildcards, others } = this.splitWildcards(hand);
    const suitGroups = groupBySuit(others);
    const allValues: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3']; // No 2

    const suits: Suit[] = ['S', 'H', 'D', 'C'];
    for (const suit of suits) {
      const cardsOfSuit = suitGroups[suit] || [];
      const valueMap: Record<string, Card> = {};
      for (const c of cardsOfSuit) valueMap[c.rank] = c;

      for (let i = 0; i <= allValues.length - 5; i++) {
        const valuesNeeded = allValues.slice(i, i + 5);
        const group: Card[] = [];
        const usedWildcards: Card[] = [];
        let possible = true;

        for (const val of valuesNeeded) {
          if (valueMap[val]) {
            group.push(valueMap[val]);
          } else if (usedWildcards.length < wildcards.length) {
            const wild = wildcards[usedWildcards.length];
            const fake = { ...wild, _asValue: val, _asSuit: suit };
            group.push(fake);
            usedWildcards.push(wild);
          } else {
            possible = false;
            break;
          }
        }

        if (possible && group.length === 5) {
          const usedCards = [...group];
          // Need to remove original wildcards from hand, not the fake ones
          // The fake ones have same suit/rank as original wildcards, so removeCards should work if we use originals.
          // Reconstruct originals list
          const originals = group.map(c => {
             // If it has _asValue, it was a wildcard (or we added property to existing card? No we spread)
             // wait, wildcards array has objects. { ...wild } creates new object.
             // removeCards uses suit/rank matching.
             return c;
          });
          return { group, rest: removeCards(hand, originals) };
        }
      }
    }
    return { group: [], rest: hand };
  }

  extractSteelPlate(hand: Card[]) {
    // Pure steel plate only for now
    const { others } = this.splitWildcards(hand);
    const counts = groupByValue(others);
    const ranks = this.cardRules.getCardRanks();
    
    const pureTriplets = Object.values(counts).filter(g => g.length >= 3);
    pureTriplets.sort((a, b) => (ranks[b[0].rank] || 0) - (ranks[a[0].rank] || 0));
    
    for (let i = 0; i < pureTriplets.length - 1; i++) {
        const t1 = pureTriplets[i];
        const t2 = pureTriplets[i+1];
        if ((ranks[t1[0].rank] || 0) - (ranks[t2[0].rank] || 0) === 1) {
            const group = [...t1.slice(0,3), ...t2.slice(0,3)];
            return { group, rest: removeCards(hand, group) };
        }
    }

    return { group: [], rest: hand };
  }

  extractWoodenBoard(hand: Card[]) {
      // 3 consecutive pairs
      const { others } = this.splitWildcards(hand);
      const counts = groupByValue(others);
      const pairs = Object.values(counts).filter(g => g.length >= 2);
      const ranks = this.cardRules.getCardRanks();
      pairs.sort((a, b) => (ranks[b[0].rank] || 0) - (ranks[a[0].rank] || 0));
      
      for (let i = 0; i < pairs.length - 2; i++) {
          const p1 = pairs[i];
          const p2 = pairs[i+1];
          const p3 = pairs[i+2];
          const r1 = ranks[p1[0].rank] || 0;
          const r2 = ranks[p2[0].rank] || 0;
          const r3 = ranks[p3[0].rank] || 0;
          
          if (r1 - r2 === 1 && r2 - r3 === 1) {
              const group = [...p1.slice(0,2), ...p2.slice(0,2), ...p3.slice(0,2)];
              return { group, rest: removeCards(hand, group) };
          }
      }
      return { group: [], rest: hand };
  }

  extractTripletWithPair(hand: Card[]) {
      const { wildcards, others } = this.splitWildcards(hand);
      const counts = groupByValue(others);
      
      // Pure only for now
      const triplets = Object.values(counts).filter(g => g.length >= 3);
      const pairs = Object.values(counts).filter(g => g.length >= 2);
      
      for (const t of triplets) {
          for (const p of pairs) {
              if (t[0].rank === p[0].rank) {
                  // If same rank, need 5 cards
                  if (t.length >= 5) {
                       const group = t.slice(0, 5);
                       return { group, rest: removeCards(hand, group) };
                  }
                  continue;
              }
              const group = [...t.slice(0,3), ...p.slice(0,2)];
              return { group, rest: removeCards(hand, group) };
          }
      }
      return { group: [], rest: hand };
  }

  extractStraight(hand: Card[]) {
    // Pure straights
    const { others } = this.splitWildcards(hand);
    const sorted = [...others].sort((a, b) => {
         const ranks = this.cardRules.getCardRanks();
         return (ranks[a.rank] || 0) - (ranks[b.rank] || 0);
    });
    // Remove duplicates and 2s
    const unique: Card[] = [];
    const seen = new Set<string>();
    for (const c of sorted) {
        if (c.rank === '2') continue;
        if (!seen.has(c.rank)) {
            unique.push(c);
            seen.add(c.rank);
        }
    }
    
    if (unique.length < 5) return { group: [], rest: hand };
    
    const ranks = this.cardRules.getCardRanks();
    for (let i = 0; i <= unique.length - 5; i++) {
        const slice = unique.slice(i, i + 5);
        const first = slice[0];
        const last = slice[4];
        if ((ranks[last.rank] || 0) - (ranks[first.rank] || 0) === 4) { // sorted asc? No, HandOptimizer sort desc?
            // Wait, I sorted unique asc?
            // "sorted = [...others].sort((a, b) => (ranks[a.rank] || 0) - (ranks[b.rank] || 0));" -> ASC
            // So last - first = 4.
            // But wait, ranks values are descending?
            // CardRules: A=14, K=13...
            // If I sort by a-b, I get smallest rank first.
            // e.g. 3 (value 1) ... A (value 12)
            // if slice is 3,4,5,6,7.
            // ranks[7] - ranks[3] = 5 - 1 = 4. Correct.
            
            // Check consecutive
            let isConsecutive = true;
            for (let j=0; j<4; j++) {
                if ((ranks[slice[j+1].rank] || 0) - (ranks[slice[j].rank] || 0) !== 1) {
                    isConsecutive = false;
                    break;
                }
            }
            if (isConsecutive) {
                 return { group: slice.reverse(), rest: removeCards(hand, slice) };
            }
        }
    }
    return { group: [], rest: hand };
  }

  extractTriplet(hand: Card[]) {
      const { others } = this.splitWildcards(hand);
      const counts = groupByValue(others);
      for (const val in counts) {
          if (counts[val].length >= 3) {
              const group = counts[val].slice(0, 3);
              return { group, rest: removeCards(hand, group) };
          }
      }
      return { group: [], rest: hand };
  }

  extractPair(hand: Card[]) {
      const { others } = this.splitWildcards(hand);
      const counts = groupByValue(others);
      for (const val in counts) {
          if (counts[val].length >= 2) {
              const group = counts[val].slice(0, 2);
              return { group, rest: removeCards(hand, group) };
          }
      }
      return { group: [], rest: hand };
  }

  extractSingle(hand: Card[]) {
      if (hand.length > 0) {
          return { group: [hand[0]], rest: hand.slice(1) };
      }
      return { group: [], rest: hand };
  }
}
