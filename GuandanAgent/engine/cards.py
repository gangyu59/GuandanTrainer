from dataclasses import dataclass
from enum import Enum
from typing import List


class Suit(str, Enum):
    CLUBS = "C"
    DIAMONDS = "D"
    HEARTS = "H"
    SPADES = "S"
    JOKER = "J"


class Rank(str, Enum):
    R3 = "3"
    R4 = "4"
    R5 = "5"
    R6 = "6"
    R7 = "7"
    R8 = "8"
    R9 = "9"
    R10 = "10"
    J = "J"
    Q = "Q"
    K = "K"
    A = "A"
    R2 = "2"
    SMALL_JOKER = "SJ"
    BIG_JOKER = "BJ"


@dataclass(frozen=True)
class Card:
    suit: Suit
    rank: Rank


def standard_deck() -> List[Card]:
    deck: List[Card] = []
    suits = [Suit.CLUBS, Suit.DIAMONDS, Suit.HEARTS, Suit.SPADES]
    ranks = [
        Rank.R3,
        Rank.R4,
        Rank.R5,
        Rank.R6,
        Rank.R7,
        Rank.R8,
        Rank.R9,
        Rank.R10,
        Rank.J,
        Rank.Q,
        Rank.K,
        Rank.A,
        Rank.R2,
    ]
    for suit in suits:
        for rank in ranks:
            deck.append(Card(suit=suit, rank=rank))
    deck.append(Card(suit=Suit.JOKER, rank=Rank.SMALL_JOKER))
    deck.append(Card(suit=Suit.JOKER, rank=Rank.BIG_JOKER))
    return deck
