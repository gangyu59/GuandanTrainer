
import sys
import os
# Add the parent directory (GuandanAgent) to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.logic import Card, Suit, Rank
from engine.simple_strategy import decide_move, CardType

# Helper to convert short strings to card objects
def to_card_dicts(card_strs):
    cards = []
    for s in card_strs:
        suit_char = s[0]
        rank_str = s[1:]
        
        suit_map = {'H': Suit.HEARTS, 'S': Suit.SPADES, 'D': Suit.DIAMONDS, 'C': Suit.CLUBS}
        if s == "LJ":
            cards.append(Card(Suit.JOKER, Rank.SMALL_JOKER))
            continue
        if s == "SJ":
            cards.append(Card(Suit.JOKER, Rank.BIG_JOKER))
            continue
            
        suit = suit_map.get(suit_char, Suit.HEARTS)
        
        rank_map = {
            '2': Rank.R2, '3': Rank.R3, '4': Rank.R4, '5': Rank.R5,
            '6': Rank.R6, '7': Rank.R7, '8': Rank.R8, '9': Rank.R9,
            '10': Rank.R10, 'J': Rank.J, 'Q': Rank.Q, 'K': Rank.K, 'A': Rank.A
        }
        rank = rank_map.get(rank_str, Rank.R2)
        cards.append(Card(suit, rank))
    return cards

# Helper to print colored status
def print_status(passed, message):
    if passed:
        print(f"\033[92m[PASS] {message}\033[0m")
    else:
        print(f"\033[91m[FAIL] {message}\033[0m")

def run_tests():
    print("=== Systematic Strategy Logic Verification ===")
    
    tests = [
        # --- LEAD STRATEGY ---
        {
            "name": "Lead: Smallest Single (Trash)",
            "hand": ["H3", "S4", "D5", "CA", "HA"],
            "level": 2,
            "expected_action": "PLAY",
            "expected_type": "1", # Single
            "expected_card_ranks": ["3"],
            "desc": "Should lead smallest single (3)"
        },
        {
            "name": "Lead: Level Card (2) is Big",
            "hand": ["H2", "S7", "D8", "CK"],
            "level": 2,
            "expected_action": "PLAY",
            "expected_type": "1",
            "expected_card_ranks": ["7"],
            "desc": "Should lead 7, not 2 (Level card is big)"
        },
        {
            "name": "Lead: Avoid Breaking 5-Straight for Lead",
            "hand": ["S3", "H4", "D5", "C6", "S7", "CK"], # Mixed suits
            "level": 2,
            "expected_action": "PLAY",
            "expected_type": "5", # Straight
            "expected_card_ranks": ["3", "4", "5", "6", "7"],
            "desc": "Should lead Straight, not break it for 3"
        },
        {
            "name": "Lead: Don't Break Straight (2-6) even if 2 is small",
            "hand": ["S2", "H3", "D4", "C5", "S6", "D7"], # Mixed suits
            "level": 10, # 2 is not level card
            "expected_action": "PLAY",
            "expected_type": "5", # Straight
            "expected_card_ranks": ["2", "3", "4", "5", "6"],
            "desc": "Should lead Straight (2-6) to clear hand"
        },
        
        # --- FOLLOW STRATEGY (Smallest Beater) ---
        {
            "name": "Follow: Beat Single 3 with 4 (Not K)",
            "hand": ["S4", "SK", "SA"],
            "last_move": {"type": "1", "cards": to_card_dicts(["D3"]), "player_index": 1},
            "level": 2,
            "expected_action": "PLAY",
            "expected_type": "1",
            "expected_card_ranks": ["4"],
            "desc": "Should play 4 to beat 3"
        },
        {
            "name": "Follow: Beat Single 3 with K (No smalls)",
            "hand": ["SK", "SA"],
            "last_move": {"type": "1", "cards": to_card_dicts(["D3"]), "player_index": 1},
            "level": 2,
            "expected_action": "PLAY",
            "expected_type": "1",
            "expected_card_ranks": ["K"],
            "desc": "Should play K to beat 3"
        },
        {
            "name": "Follow: Beat Single 3 with Hidden 4 (in Straight)",
            "hand": ["S4", "H5", "D6", "C7", "S8", "SK"], # Mixed suits
            "last_move": {"type": "1", "cards": to_card_dicts(["D3"]), "player_index": 1},
            "level": 2,
            "expected_action": "PLAY",
            "expected_type": "1",
            "expected_card_ranks": ["4"],
            "desc": "Should break straight to play 4"
        },
        {
            "name": "Follow: Beat Single 3 with Hidden 4 (in Pair - Wait, User hates splitting pairs)",
            "hand": ["S6", "D8", "C8"],
            "last_move": {"type": "1", "cards": to_card_dicts(["D3"]), "player_index": 1},
            "level": 2,
            "expected_action": "PLAY",
            "expected_type": "1",
            "expected_card_ranks": ["6"],
            "desc": "Should play Single 6, not split Pair 8"
        },
        
        # --- PARTNER SYNERGY ---
        {
            "name": "Partner: Pass on Partner's Big Single (K)",
            "hand": ["SA", "S2"],
            "last_move": {"type": "1", "cards": to_card_dicts(["SK"]), "player_index": 2}, # Partner is 2 (relative to 0)
            "partner_played": True,
            "level": 5,
            "expected_action": "PASS",
            "desc": "Should pass on partner's K"
        },
        {
            "name": "Partner: Play on Partner's Small Single (3)",
            "hand": ["S4", "SK"],
            "last_move": {"type": "1", "cards": to_card_dicts(["D3"]), "player_index": 2},
            "partner_played": True,
            "level": 5,
            "expected_action": "PLAY",
            "expected_card_ranks": ["4"],
            "desc": "Should play 4 (Smallest Beater) on partner's 3"
        }
    ]

    passed_count = 0
    for t in tests:
        print(f"\nRunning: {t['name']}")
        hand_cards = to_card_dicts(t['hand'])
        
        last_move = t.get('last_move')
        
        decision = decide_move(hand_cards, last_move, current_level=t['level'], my_player_index=0)
        
        # Check Action
        # Normalize action to uppercase
        action = decision['action'].upper()
        if action != t['expected_action']:
            print_status(False, f"Action mismatch. Expected {t['expected_action']}, Got {decision['action']}")
            continue
            
        if t['expected_action'] == "PASS":
            print_status(True, "Correctly Passed")
            passed_count += 1
            continue
            
        # Check Type
        if t.get('expected_type'):
            # simple_strategy returns 'type' which matches simple_strategy.CardType or logic.py strings?
            # It usually returns logic.py strings like "1", "2", "3+2" etc.
            # But my test cases use "1" (string) or CardType.Single?
            # Let's check what simple_strategy returns.
            # It returns `best_move['type']` which comes from logic.py grouping.
            # logic.py groups have types: "1", "2", "3", "3+2", "straight", "bomb", etc.
            # My test uses "1" for Single, "5" for Straight? No, logic uses "straight".
            
            # MAPPING:
            type_map = {
                "1": "single",
                "2": "pair",
                "3": "triple",
                "5": "straight"
            }
            expected = type_map.get(t['expected_type'], t['expected_type'])
            
            # Simple strategy might return "single" or "1" depending on implementation.
            # Let's inspect what it returns.
            actual = decision.get('type')
            
            # Allow loose matching
            if actual != expected:
                # Try mapping actual
                actual_mapped = actual
                if actual == "single": actual_mapped = "1"
                if actual == "straight": actual_mapped = "5"
                
                if actual_mapped != t['expected_type'] and actual != expected:
                     print_status(False, f"Type mismatch. Expected {expected}, Got {actual}")
                     continue

        # Check Cards (Ranks)
        if t.get('expected_card_ranks'):
            # Helper to normalize rank strings
            def norm(r):
                # If r is an Enum member, get its value
                if hasattr(r, 'value'):
                    return str(r.value)
                # If r is a dict/object with rank, get it
                if isinstance(r, dict):
                    val = r.get('rank')
                    if hasattr(val, 'value'): return str(val.value)
                    return str(val)
                # Fallback
                s = str(r)
                if s.startswith('Rank.'):
                    # Try to map Rank.R3 -> 3
                    s = s.replace('Rank.', '')
                    if s.startswith('R') and s[1:].isdigit():
                        return s[1:]
                return s
            
            played_norm = sorted([norm(c.rank) for c in decision['cards']])
            expected_norm = sorted([norm(r) for r in t['expected_card_ranks']])
            
            if played_norm != expected_norm:
                print_status(False, f"Cards mismatch. Expected {expected_norm}, Got {played_norm}")
                continue
        
        print_status(True, "Test Passed")
        passed_count += 1

    print(f"\nSummary: {passed_count}/{len(tests)} Tests Passed")

if __name__ == "__main__":
    run_tests()
