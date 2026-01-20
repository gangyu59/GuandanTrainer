
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from engine.logic import optimize_hand_partition, POWER_RANK
from engine.cards import Card, Suit, Rank

def make_card(rank_str, suit_str):
    r_map = {
        '2': Rank.R2, '3': Rank.R3, '4': Rank.R4, '5': Rank.R5, '6': Rank.R6, '7': Rank.R7,
        '8': Rank.R8, '9': Rank.R9, '10': Rank.R10, 'J': Rank.J, 'Q': Rank.Q, 'K': Rank.K, 'A': Rank.A,
        'BJ': Rank.BIG_JOKER, 'SJ': Rank.SMALL_JOKER
    }
    s_map = {'H': Suit.HEARTS, 'D': Suit.DIAMONDS, 'C': Suit.CLUBS, 'S': Suit.SPADES, 'J': Suit.JOKER}
    return Card(suit=s_map[suit_str], rank=r_map[rank_str])

def run_test_cases():
    print("=== Running User Feedback Test Cases ===")
    
    # Case 1: Straight Flush with Wild
    # Hand: 4H, 5H, 6H, 8H + 2H (Wild) + 8S, 9D, 10C, JS, QD (Mixed suits for second group)
    print("\n--- Case 1: Straight Flush with Wild ---")
    hand1 = [
        make_card('4', 'H'), make_card('5', 'H'), make_card('6', 'H'), make_card('8', 'H'),
        make_card('2', 'H'), # Wild
        make_card('8', 'S'), make_card('9', 'D'), make_card('10', 'C'), make_card('J', 'S'), make_card('Q', 'D')
    ]
    # Current level 2, so 2H is wild.
    res1 = optimize_hand_partition(hand1, current_level=2)
    
    found_sf = False
    found_straight = False
    for g in res1['groups']:
        print(f"Group: {g['type']} Cards: {[str(c.rank.value) for c in g['cards']]}")
        if g['type'] == 'straight_flush': found_sf = True
        if g['type'] == 'straight': found_straight = True
        
    if found_sf and found_straight:
        print("SUCCESS: Found Straight Flush + Straight")
    else:
        print("FAILURE: Did not find optimal partition")

    # Case 2: Straight + Full House + Single
    # Hand: 2, 3, 4, 4, 5, 6, 7, 7, K, K, K (Mixed suits for Straight)
    print("\n--- Case 2: Straight + Full House + Single ---")
    hand2 = [
        make_card('2', 'S'), make_card('3', 'H'), make_card('4', 'D'), make_card('4', 'S'),
        make_card('5', 'C'), make_card('6', 'D'), 
        make_card('7', 'S'), make_card('7', 'H'),
        make_card('K', 'S'), make_card('K', 'H'), make_card('K', 'D')
    ]
    # Level 3 to avoid 2 being wild
    res2 = optimize_hand_partition(hand2, current_level=3)
    
    found_straight2 = False
    found_fh = False
    for g in res2['groups']:
        print(f"Group: {g['type']} Cards: {[str(c.rank.value) for c in g['cards']]}")
        if g['type'] == 'straight': found_straight2 = True
        if g['type'] == 'full_house': found_fh = True
        
    if found_straight2 and found_fh:
        print("SUCCESS: Found Straight + Full House")
    else:
        print("FAILURE: Did not find optimal partition")

    # Case 3: Triple Integrity (Don't split 666)
    # Hand: 44 55 666
    # Check if it splits into Board (445566) + Single (6) or keeps Pairs + Triple
    print("\n--- Case 3: Triple Integrity ---")
    hand3 = [
        make_card('4', 'S'), make_card('4', 'H'),
        make_card('5', 'S'), make_card('5', 'H'),
        make_card('6', 'S'), make_card('6', 'H'), make_card('6', 'D')
    ]
    res3 = optimize_hand_partition(hand3, current_level=3)
    
    found_board = False
    found_triple = False
    found_fh = False
    for g in res3['groups']:
        print(f"Group: {g['type']} Cards: {[str(c.rank.value) for c in g['cards']]}")
        if g['type'] == 'wooden_board': found_board = True
        if g['type'] == 'triple': found_triple = True
        if g['type'] == 'full_house': found_fh = True
        
    if found_triple or found_fh:
        print("SUCCESS: Kept Triple (Preferred) or formed Full House (Triple Preserved)")
    elif found_board:
        print("INFO: Formed Wooden Board (Split Triple)")
    else:
        print("OTHER partition")

if __name__ == "__main__":
    run_test_cases()
