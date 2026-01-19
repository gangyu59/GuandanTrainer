from typing import List, Dict, Any, Optional
from engine.cards import Rank, Suit, Card

def get_rank_value(rank_str: str) -> int:
    """Helper to get comparable value for rank."""
    order = {
        "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
        "J": 11, "Q": 12, "K": 13, "A": 14, "SJ": 20, "BJ": 21
    }
    return order.get(rank_str, 0)

def sort_hand(cards: List[Any]) -> List[Any]:
    """Sort cards by value."""
    return sorted(cards, key=lambda c: (get_rank_value(c.rank), c.suit))

def find_greater_single(my_hand: List[Any], target_card: Any) -> Optional[Any]:
    """Find the smallest single card that is greater than target."""
    target_val = get_rank_value(target_card['rank'])
    sorted_hand = sort_hand(my_hand)
    
    for card in sorted_hand:
        if get_rank_value(card.rank) > target_val:
            return card
    return None

def simple_greedy_strategy(state: Any) -> Dict[str, Any]:
    """
    A temporary simple strategy to verify backend connection.
    It replicates the simplest possible logic:
    1. If free play (last_play is None), play smallest single.
    2. If must follow, try to beat. If can't, pass.
    """
    
    my_hand = state.my_hand
    last_play = state.last_play
    
    if not my_hand:
        return {"action": "pass", "cards": [], "message": "No cards left"}
        
    sorted_hand = sort_hand(my_hand)

    # 1. Free Play (I am leader)
    if not last_play or not last_play.get("cards") or len(last_play.get("cards")) == 0:
        # Play the smallest single
        card = sorted_hand[0]
        return {
            "action": "play", 
            "cards": [card], 
            "message": "Backend: Starting with smallest single"
        }
        
    # 2. Follow Play (Someone played)
    target_cards = last_play.get("cards", [])
    target_type = last_play.get("type", "unknown")
    
    # Simple logic for Singles only for now
    if len(target_cards) == 1:
        target_card = target_cards[0]
        beat_card = find_greater_single(my_hand, target_card)
        if beat_card:
            return {
                "action": "play",
                "cards": [beat_card],
                "message": f"Backend: Beating {target_card['rank']} with {beat_card.rank}"
            }
    
    # For all other cases (Pairs, Triples, etc.), PASS for now to be safe
    # until we implement full grouping logic in backend.
    
    return {
        "action": "pass", 
        "cards": [], 
        "message": "Backend: Passing (Complex types not implemented yet)"
    }
