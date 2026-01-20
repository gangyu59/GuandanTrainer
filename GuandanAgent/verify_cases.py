
import sys
import os

# Add current directory to path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from engine.logic import optimize_hand_partition, get_rank_index, get_rank_from_card, get_rank_label_from_index
from engine.cards import Card, Suit, Rank

def make_card(rank_str, suit_str):
    return {'rank': rank_str, 'suit': suit_str}

def print_partition(result, name):
    print(f"\n--- {name} ---")
    print(f"Total Score: {result['score']}")
    groups = result['groups']
    groups.sort(key=lambda x: x.get('type', ''))
    
    hand_count = len(groups)
    print(f"Hand Count: {hand_count}")
    
    for g in groups:
        cards_str = ",".join([f"{get_rank_from_card(c)}{c.get('suit','')}" for c in g['cards']])
        print(f"  {g['type']}: {cards_str} (Power: {g.get('power', 0)})")

def verify():
    # Case 1: 2 Bombs vs Straight Flush
    hand1 = [
        make_card('4', 'H'), make_card('4', 'D'), make_card('4', 'C'), make_card('4', 'S'),
        make_card('5', 'H'), make_card('5', 'D'), make_card('5', 'C'), make_card('5', 'S'),
        make_card('6', 'H'), make_card('7', 'H'), make_card('8', 'H')
    ]
    
    # Case 2: Full Houses vs Wooden Board
    hand2 = [
        make_card('6', 'H'), make_card('6', 'D'), make_card('6', 'C'),
        make_card('7', 'H'), make_card('7', 'D'),
        make_card('8', 'H'), make_card('8', 'D'), make_card('8', 'C'),
        make_card('J', 'H'), make_card('J', 'D')
    ]
    
    # Case 3: KKAA22
    hand3 = [
        make_card('K', 'H'), make_card('K', 'D'),
        make_card('A', 'H'), make_card('A', 'D'),
        make_card('2', 'H'), make_card('2', 'D')
    ]
    
    print("Running Verification...")
    res1 = optimize_hand_partition(hand1)
    print_partition(res1, "Hand 1 (2 Bombs vs SF)")
    
    res2 = optimize_hand_partition(hand2)
    print_partition(res2, "Hand 2 (FH vs WB)")
    
    res3 = optimize_hand_partition(hand3)
    print_partition(res3, "Hand 3 (KKAA22)")

if __name__ == "__main__":
    verify()
