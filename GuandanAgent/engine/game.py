from dataclasses import dataclass
from typing import List, Dict
from uuid import uuid4
import random
from .cards import Card, standard_deck


@dataclass
class GameState:
    id: str
    players: List[str]
    hands: Dict[str, List[Card]]


def new_game() -> GameState:
    players = ["P0", "P1", "P2", "P3"]
    deck: List[Card] = standard_deck() * 2
    random.shuffle(deck)
    hand_size = 27
    hands: Dict[str, List[Card]] = {}
    for i, p in enumerate(players):
        start = i * hand_size
        end = start + hand_size
        hands[p] = deck[start:end]
    game_id = str(uuid4())
    return GameState(id=game_id, players=players, hands=hands)


def serialize_card(card: Card) -> Dict[str, str]:
    return {"suit": card.suit.value, "rank": card.rank.value}


def serialize_game_state(game: GameState) -> Dict:
    return {
        "id": game.id,
        "players": game.players,
        "hands": {
            p: [serialize_card(c) for c in cards]
            for p, cards in game.hands.items()
        },
    }
