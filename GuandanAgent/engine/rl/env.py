
import random
import copy
from typing import List, Dict, Any, Optional
from engine.cards import Card, standard_deck, Rank, Suit
from engine.ai_strategy import get_legal_moves, sort_hand

class GuandanEnv:
    def __init__(self, my_hand: List[Card], last_play: Optional[Dict[str, Any]] = None):
        """
        Initialize the environment.
        Since we don't know other players' hands, we generate random hands for them.
        """
        self.num_players = 4
        self.current_player = 0  # We are always player 0 in this view
        
        # 1. Setup Hands
        self.hands = [[] for _ in range(self.num_players)]
        self.hands[0] = sort_hand(my_hand)
        
        # Calculate remaining cards
        # Guandan uses 2 decks (108 cards)
        full_deck = standard_deck() * 2
        
        # Remove my cards
        # We need a robust way to remove specific card instances or just by rank/suit
        # Simple removal by counting
        my_hand_counts = self._count_cards(my_hand)
        remaining_deck = []
        
        # Filter full deck
        temp_deck_counts = self._count_cards(full_deck)
        
        # Subtract my hand
        for k, v in my_hand_counts.items():
            temp_deck_counts[k] -= v
            
        # Also subtract visible played cards (if we tracked history, but we don't yet)
        # For now, just distribute the rest
        for k, v in temp_deck_counts.items():
            rank, suit = k
            for _ in range(v):
                remaining_deck.append(Card(suit=Suit(suit), rank=Rank(rank)))
                
        random.shuffle(remaining_deck)
        
        # Distribute to other 3 players (approximate equal split)
        # Total cards = 108. My hand = N. Remaining = 108 - N.
        # Each opponent gets roughly (108-N)/3
        avg_cards = len(remaining_deck) // 3
        
        self.hands[1] = remaining_deck[:avg_cards]
        self.hands[2] = remaining_deck[avg_cards:avg_cards*2]
        self.hands[3] = remaining_deck[avg_cards*2:]
        
        # Sort their hands for logic consistency
        self.hands[1] = sort_hand(self.hands[1])
        self.hands[2] = sort_hand(self.hands[2])
        self.hands[3] = sort_hand(self.hands[3])
        
        # 2. Setup Game State
        self.last_play = last_play  # {cards: [], type: str}
        self.pass_count = 0
        
        # If there was a last play, we need to know who played it.
        # But we don't. We assume it was the previous player (Index 3) for simplicity,
        # unless it's a free turn.
        if last_play and last_play.get('cards'):
            self.last_player_idx = 3 # The person before me
        else:
            self.last_player_idx = -1 # No one
            self.pass_count = 3 # Treat as free play

    def _count_cards(self, cards: List[Card]):
        counts = {}
        for c in cards:
            r = c.rank.value if hasattr(c.rank, 'value') else c.rank
            s = c.suit.value if hasattr(c.suit, 'value') else c.suit
            key = (r, s)
            counts[key] = counts.get(key, 0) + 1
        return counts

    def get_legal_actions(self) -> List[Dict[str, Any]]:
        """Get legal moves for current player."""
        hand = self.hands[self.current_player]
        
        # Determine if it's a free play
        effective_last_play = self.last_play
        
        # If everyone else passed, or start of game
        if self.pass_count >= 3:
            effective_last_play = None
        # If I am the one who played the last hand (round trip), it's free play
        elif self.last_player_idx == self.current_player:
            effective_last_play = None
            
        return get_legal_moves(hand, effective_last_play)

    def step(self, action: Dict[str, Any]):
        """
        Apply action and advance state.
        Returns: (observation, reward, done, info)
        """
        player = self.current_player
        
        is_pass = action['action'] == 'pass'
        
        if not is_pass:
            # Remove cards from hand
            cards_to_play = action['cards']
            # We need to remove matching cards from hand
            # Naive removal: find first match
            new_hand = []
            to_remove = self._count_cards(cards_to_play)
            
            for c in self.hands[player]:
                r = c.rank.value if hasattr(c.rank, 'value') else c.rank
                s = c.suit.value if hasattr(c.suit, 'value') else c.suit
                key = (r, s)
                if to_remove.get(key, 0) > 0:
                    to_remove[key] -= 1
                else:
                    new_hand.append(c)
            
            self.hands[player] = new_hand
            
            # Update global state
            self.last_play = action
            self.last_player_idx = player
            self.pass_count = 0
        else:
            self.pass_count += 1
            
        # Check Winner
        if len(self.hands[player]) == 0:
            return self, 1 if player == 0 else -1, True, {}
            
        # Next player
        # If 3 consecutive passes (pass_count == 3), the round is over.
        # But we handle "next turn logic" inside get_legal_actions (it sees pass_count).
        # However, we must ensure if someone finished, "Jie Feng" (Passing the Wind) logic applies.
        
        # Standard Next
        next_player = (self.current_player + 1) % 4
        
        # Jie Feng Logic:
        # If the round is ending (pass_count == 3) and the last player who played cards (last_player_idx)
        # has finished their hand, then the lead passes to their PARTNER.
        if self.pass_count == 3:
            winner_idx = self.last_player_idx
            if winner_idx != -1 and len(self.hands[winner_idx]) == 0:
                # Winner finished. Pass control to partner.
                partner_idx = (winner_idx + 2) % 4
                next_player = partner_idx
                
        self.current_player = next_player
        
        return self, 0, False, {}

    def is_done(self) -> bool:
        """Check if game is over (any player has empty hand)."""
        return any(len(h) == 0 for h in self.hands)

    def clone(self):
        """Deep copy for MCTS simulation."""
        # manual copy might be faster but deepcopy is safer for now
        return copy.deepcopy(self)
