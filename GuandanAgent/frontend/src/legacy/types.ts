export type Suit = "C" | "D" | "H" | "S" | "J";

export type Rank =
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A"
  | "2"
  | "SJ"
  | "BJ";

export type Card = {
  suit: Suit;
  rank: Rank;
  // Optional fields used by legacy logic
  value?: string; // mapped from rank
  index?: number;
  selected?: boolean;
  groupId?: string;
  _asValue?: string;
  _asSuit?: string;
};

// Helper to convert GuandanAgent card to Legacy card format if needed
// Legacy uses lowercase suits ('c','d','h','s') and 'joker' for suit, and values like '2','3'...'A','small','big'
// But wait, cardValueToIndex in utils.js handles 'BJ', 'SJ'?
// utils.js: if (suit === 'joker') return value === 'BJ' ? 52 : 53;
// So legacy cards: { suit: 'joker', value: 'BJ' }
// GuandanAgent cards: { suit: 'J', rank: 'BJ' }

export function toLegacyCard(card: Card): any {
  let suit = card.suit.toLowerCase();
  let value = card.rank;
  
  if (card.suit === 'J') {
    suit = 'joker';
    // GuandanAgent uses SJ/BJ for rank, legacy might use small/big or SJ/BJ
    // Checked utils.js: it handles 'BJ' and uses 'small_joker.jpeg' etc.
    // cardValueToIndex handles 'BJ'.
    // So value 'BJ' is fine.
  }
  
  return {
    ...card,
    suit,
    value
  };
}

export function fromLegacyCard(card: any): Card {
  let suit: Suit = 'J';
  if (card.suit !== 'joker') {
    suit = card.suit.toUpperCase() as Suit;
  }
  
  let rank = card.value as Rank;
  // If legacy uses 'small'/'big', map to SJ/BJ?
  // utils.js checks 'BJ'.
  
  return {
    suit,
    rank
  };
}
