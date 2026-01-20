
import sys
import os

# Ensure we can import modules from current directory
sys.path.append(os.path.join(os.getcwd(), 'GuandanAgent'))

from engine.logic import optimize_hand_partition, get_rank_from_card, get_suit_from_card
from engine.cards import Card, Suit, Rank

def make_card(rank_str, suit_str):
    """Helper to create Card objects for testing."""
    # Map rank string to enum
    r_map = {
        '2': Rank.R2, '3': Rank.R3, '4': Rank.R4, '5': Rank.R5, '6': Rank.R6, '7': Rank.R7,
        '8': Rank.R8, '9': Rank.R9, '10': Rank.R10, 'J': Rank.J, 'Q': Rank.Q, 'K': Rank.K, 'A': Rank.A,
        'BJ': Rank.BIG_JOKER, 'SJ': Rank.SMALL_JOKER
    }
    s_map = {'H': Suit.HEARTS, 'D': Suit.DIAMONDS, 'C': Suit.CLUBS, 'S': Suit.SPADES, 'J': Suit.JOKER}
    return Card(suit=s_map[suit_str], rank=r_map[rank_str])

def test_hand(name, hand, level=2):
    print(f"\n--- Test: {name} (Level {level}) ---")
    card_strs = [f"{c.suit}.{c.rank}" for c in hand]
    print(f"Cards: {card_strs}")
    
    result = optimize_hand_partition(hand, current_level=level)
    print(f"Total Score: {result['score']}")
    
    bombs = [g for g in result['groups'] if g['type'] == 'bomb']
    sfs = [g for g in result['groups'] if g['type'] == 'straight_flush']
    print(f"Bombs Count: {len(bombs)}")
    print(f"SFs Count: {len(sfs)}")
    
    print("Grouping:")
    for g in result['groups']:
        c_str = [f"{c.suit}.{c.rank}" for c in g['cards']]
        print(f"  - {g['type'].upper()} (Power {g['power']}): {c_str}")

# 1. Test Bomb vs Straight Flush (Should pick SF)
# Hand: 2H (Wild), 2S, 2C, 2D (Bomb?) No, Level 2.
# Hand: 2, 3, 4, 5, 6 Spades (SF). 
# And 2, 2, 2 (Triple).
hand1 = [
    make_card('2', 'S'), make_card('3', 'S'), make_card('4', 'S'), make_card('5', 'S'), make_card('6', 'S'),
    make_card('2', 'H'), make_card('2', 'C'), make_card('2', 'D')
]
# Note: 2H is wild at Level 2. 
# If 2H is wild, it can be part of SF or Bomb.
# Here we have 2S, 3S, 4S, 5S, 6S is ALREADY a SF.
# 2H, 2C, 2D. 2H is wild. 2C, 2D is pair.
# If 2H joins 2C, 2D -> Triple (Power 3).
# SF (8) + Triple (3) = 11.
# If 2H makes Bomb with 2C, 2D? Needs 4 cards. 
# Actually 2S is also a 2.
# If we break SF: 2S, 2H, 2C, 2D -> Bomb (Power 6).
# Remaining: 3S, 4S, 5S, 6S -> Singles? Or Straight? Straight needs 5 cards. 3,4,5,6 is 4 cards.
# So SF+Triple is better.
test_hand("Bomb vs Straight Flush (Should pick SF)", hand1)

# 2. Test Bomb vs Normal Straight (Should pick Bomb)
# Hand: 2, 2, 2, 2 (Bomb). And 3, 4, 5, 6 mixed.
# If we break Bomb to make Straight 2,3,4,5,6.
# Straight (4) + 3 Singles (3) = 7.
# Bomb (6) + 4 Singles (4) = 10.
# Should pick Bomb.
hand2 = [
    make_card('2', 'S'), make_card('2', 'H'), make_card('2', 'C'), make_card('2', 'D'),
    make_card('3', 'S'), make_card('4', 'H'), make_card('5', 'C'), make_card('6', 'D')
]
test_hand("Bomb vs Normal Straight (Should pick Bomb)", hand2)

# 3. Test Straight Flush with Wild (End)
# Hand: 3S, 4S, 5S, 6S + 2H (Wild).
# Should form SF 3-7 or 2-6.
hand3 = [
    make_card('3', 'S'), make_card('4', 'S'), make_card('5', 'S'), make_card('6', 'S'),
    make_card('2', 'H')
]
test_hand("Straight Flush with Wild (End)", hand3)

# 4. Test Straight Flush with Wild (Middle Gap)
# Hand: 3S, 4S, 6S, 7S + 2H (Wild).
# Should form SF 3-7.
hand4 = [
    make_card('3', 'S'), make_card('4', 'S'), make_card('6', 'S'), make_card('7', 'S'),
    make_card('2', 'H')
]
test_hand("Straight Flush with Wild (Middle Gap)", hand4)

