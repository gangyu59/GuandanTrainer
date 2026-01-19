import { Card } from "./types";
import { CardRules } from "./CardRules";
import { CardPower } from "./CardPower";

export type LegacyPlay = {
  playerIndex: number;
  cards: Card[];
  type: string;
};

export type LegacyLastPlay = {
  playerIndex: number;
  cards: Card[];
  type: string;
} | null;

export function isBombFamily(cards: Card[], rules: CardRules): boolean {
  const t = rules.getCardType(cards);
  return (
    t === "bomb" ||
    t === "big_bomb" ||
    t === "super_bomb" ||
    t === "straight_flush"
  );
}

export function validPlay(params: {
  playerIndex: number;
  selected: Card[];
  type: string | null;
  lastPlay: LegacyLastPlay;
  cardRules: CardRules;
  cardPower: typeof CardPower;
}): boolean {
  const { playerIndex, selected, type, lastPlay, cardRules, cardPower } =
    params;

  if (!type || !selected || selected.length === 0) return false;

  const isBomb = cardRules.isBomb(selected);
  const isStraightFlush = cardRules.getCardType(selected) === "straight_flush";
  const isSuperBomb = cardRules.getCardType(selected) === "super_bomb";
  const isBigBomb = cardRules.getCardType(selected) === "big_bomb";

  if (!lastPlay || !lastPlay.cards || lastPlay.cards.length === 0) {
    return true;
  }

  const lastPlayer = lastPlay.playerIndex;
  const lastCards = lastPlay.cards;
  const lastType = lastPlay.type;
  const lastIsBomb = cardRules.isBomb(lastCards);
  const lastIsStraightFlush =
    cardRules.getCardType(lastCards) === "straight_flush";
  const lastIsSuperBomb =
    cardRules.getCardType(lastCards) === "super_bomb";
  const lastIsBigBomb =
    cardRules.getCardType(lastCards) === "big_bomb";

  const isBombFamilyLocal = (cards: Card[]) => isBombFamily(cards, cardRules);

  if (lastPlayer === playerIndex) {
    return true;
  }

  if (!isBombFamilyLocal(selected)) {
    if (type !== lastType) return false;
    return (
      cardPower.compareSameType(selected, lastCards, type, cardRules) > 0
    );
  }

  if (!isBombFamilyLocal(lastCards)) {
    return true;
  }

  if (isSuperBomb) return true;

  // 同一炸弹牌型之间，优先用 compareSameType 按点数比较
  if (type && type === lastType && (type === "bomb" || type === "big_bomb" || type === "straight_flush")) {
    const cmp = cardPower.compareSameType(selected, lastCards, type, cardRules);
    return cmp > 0;
  }

  // 其它炸弹家族之间，按牌型等级比较（如同花顺 > 普通炸弹）
  const myRank = cardPower.getTypeRank(type, selected);
  const lastRank = cardPower.getTypeRank(lastType, lastCards);
  return myRank > lastRank;
}
