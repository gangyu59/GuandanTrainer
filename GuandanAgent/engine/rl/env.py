
import random
import copy
from typing import List, Dict, Any, Optional
from engine.cards import Card, standard_deck, Rank, Suit
from engine.logic import get_legal_moves, sort_hand, get_rank_value

def state_to_vector(state: 'GuandanEnv') -> List[float]:
    """
    Convert Game State to Feature Vector for Neural Network.
    Dimension: 120 (approx)
    """
    vec = [0.0] * 120
    
    # 1. My Hand Rank Counts (15 features)
    # Ranks: 2, 3, ..., A, LJ, BJ. 
    # We map them to indices 0-14.
    if state.my_hand:
        for card in state.my_hand:
            # card.rank.value is an enum string (e.g., "2", "3", "J").
            r_str = card.rank.value if hasattr(card.rank, 'value') else card.rank
            val = get_rank_value(r_str)
            
            # Map val to 0-14 index
            # get_rank_value returns: 2->2 ... A->14, SJ->20, BJ->21
            idx = 0
            if 2 <= val <= 14:
                idx = val - 2
            elif val == 20: # Small Joker
                idx = 13
            elif val == 21: # Big Joker
                idx = 14
            
            if 0 <= idx < 15:
                vec[idx] += 1.0/4.0 # Normalize by max count 4 (approx)
                
    # 2. Last Play Info
    # Type (one-hot 10), Rank (1), Size (1)
    if state.last_play:
        # Simplified: just put last play rank
        # ...
        pass
        
    return vec

class GuandanEnv:
    def __init__(self, my_hand: List[Card], last_play: Optional[Dict[str, Any]] = None, 
                 all_hands: Optional[List[List[Card]]] = None, current_player: int = 0, pass_count: int = 0):
        """
        Initialize the environment.
        :param my_hand: List of cards for the current player (God View or Player View)
        :param last_play: Dictionary of last play info
        :param all_hands: (Optional) For God View / Self Play - exact hands of all players
        :param current_player: Index of current player (0-3)
        :param pass_count: Current number of consecutive passes
        """
        self.num_players = 4
        self.current_player = current_player
        
        if all_hands:
            self.hands = [sort_hand(h) for h in all_hands]
        else:
            # 1. Setup Hands
            self.hands = [[] for _ in range(self.num_players)]
            self.hands[self.current_player] = sort_hand(my_hand)
            
            # Calculate remaining cards
            # Guandan uses 2 decks (108 cards)
            full_deck = standard_deck() * 2
            
            # Remove my cards
            my_hand_counts = self._count_cards(my_hand)
            remaining_deck = []
            
            # Filter full deck
            temp_deck_counts = self._count_cards(full_deck)
            for k, v in my_hand_counts.items():
                temp_deck_counts[k] -= v
                
            for k, v in temp_deck_counts.items():
                rank, suit = k
                for _ in range(v):
                    remaining_deck.append(Card(suit=Suit(suit), rank=Rank(rank)))
                    
            random.shuffle(remaining_deck)
            
            # Distribute to other 3 players
            # We have 3 opponents.
            opponents = [i for i in range(4) if i != self.current_player]
            
            # Split remaining_deck into 3 parts
            # Note: total cards might not be perfectly divisible if my_hand is partial?
            # Standard game is 27 cards each.
            # If my_hand has < 27, we assume others have balanced amounts or just split rest.
            # For simplicity, just split evenly.
            
            n_rem = len(remaining_deck)
            chunk_size = n_rem // 3
            
            self.hands[opponents[0]] = sort_hand(remaining_deck[:chunk_size])
            self.hands[opponents[1]] = sort_hand(remaining_deck[chunk_size:chunk_size*2])
            self.hands[opponents[2]] = sort_hand(remaining_deck[chunk_size*2:])
        
        # 2. Setup Game State
        self.last_play = last_play  # {cards: [], type: str}
        self.pass_count = pass_count
        
        # If there was a last play, we need to know who played it.
        # But we don't. We assume it was the previous player (Index 3) for simplicity,
        # unless it's a free turn.
        if last_play and last_play.get('cards'):
            # If current_player is known, last player is (current - 1) % 4
            # But wait, if we pass current_player, we should calculate relative to it?
            # Existing logic assumed current_player=0.
            # If we are in "God View" (all_hands provided), we usually start from a clean state or pass correct current_player.
            # If last_play is provided, usually pass_count is 0.
            
            # Correct logic: Last player is the one before current, UNLESS last_play explicitly says who played it.
            # But last_play dict usually doesn't have 'player_index' in our simplified structure here?
            # Actually frontend sends {cards:..., type:...}
            # Let's assume it was (current-1) for now if not specified.
            self.last_player_idx = (self.current_player - 1) % 4
        else:
            self.last_player_idx = -1 # No one
            self.pass_count = 3 # Treat as free play

    @property
    def my_hand(self):
        return self.hands[self.current_player]
        
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
