
from typing import List, Dict, Any, Optional
from engine.cards import Card, Rank, Suit

def get_rank_value(rank_str: str) -> int:
    """Helper to get comparable value for rank."""
    order = {
        "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
        "J": 11, "Q": 12, "K": 13, "A": 14, "SJ": 20, "BJ": 21
    }
    return order.get(rank_str, 0)

def get_rank_index(rank_str: str) -> int:
    """Helper to get sequential index for checking consecutiveness (3-A)."""
    # Exclude 2, SJ, BJ from straights usually
    order = {
        "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
        "J": 11, "Q": 12, "K": 13, "A": 14
    }
    return order.get(rank_str, -1)

def sort_hand(cards: List[Any]) -> List[Any]:
    """Sort cards by value."""
    return sorted(cards, key=lambda c: (get_rank_value(c.rank), c.suit))

def group_cards(hand: List[Any]) -> Dict[str, List[Any]]:
    """Group cards by rank."""
    groups = {}
    for card in hand:
        rank = card.rank
        if rank not in groups:
            groups[rank] = []
        groups[rank].append(card)
    return groups

def get_rank_from_card(card: Any) -> str:
    """Helper to handle both Card objects and dictionary representations."""
    if isinstance(card, dict):
        return card.get('rank')
    return card.rank

def get_suit_from_card(card: Any) -> str:
    """Helper to handle both Card objects and dictionary representations."""
    if isinstance(card, dict):
        return card.get('suit')
    return card.suit

def find_straight_flushes(hand: List[Any]) -> List[Dict[str, Any]]:
    """Find Straight Flushes (5 consecutive cards of same suit)."""
    candidates = []
    # Group by suit
    suits = {}
    for card in hand:
        if card.suit not in suits:
            suits[card.suit] = []
        suits[card.suit].append(card)
    
    for suit, cards in suits.items():
        # Sort by rank index
        # Filter valid ranks for straights
        valid_cards = [c for c in cards if get_rank_index(c.rank) != -1]
        valid_cards.sort(key=lambda c: get_rank_index(c.rank))
        
        if len(valid_cards) < 5:
            continue
            
        for i in range(len(valid_cards) - 4):
            subset = valid_cards[i:i+5]
            is_consecutive = True
            for j in range(4):
                curr = get_rank_index(subset[j].rank)
                next_r = get_rank_index(subset[j+1].rank)
                if next_r - curr != 1:
                    is_consecutive = False
                    break
            
            if is_consecutive:
                start_rank = subset[0].rank
                end_rank = subset[-1].rank
                candidates.append({
                    "action": "play",
                    "cards": subset,
                    "desc": f"Play Straight Flush {start_rank}-{end_rank} ({suit})",
                    "type": "straight_flush"
                })
    return candidates

def get_bomb_score(cards: List[Any], type_code: str) -> int:
    """
    Calculate score for comparing bombs.
    4 Kings > 6+ Bomb > Straight Flush > 5 Bomb > 4 Bomb
    Score = Base + RankValue
    """
    # 4 Kings (Heavenly King Bomb)
    if len(cards) == 4:
        # Check ranks
        ranks = [get_rank_from_card(c) for c in cards]
        if all(r in ['SJ', 'BJ'] for r in ranks):
            return 2000
        
    first_rank = get_rank_from_card(cards[0])
    rank_val = get_rank_value(first_rank)
    count = len(cards)
    
    if type_code == 'straight_flush':
        # Equivalent to > 5 bomb but < 6 bomb
        return 550 + rank_val
        
    return count * 100 + rank_val

def find_consecutive_groups(groups: List[List[Any]], count: int, width: int) -> List[Dict[str, Any]]:
    """Helper to find consecutive groups like Straights, Plates, Boards."""
    candidates = []
    # Filter valid ranks and sort
    valid_groups = [g for g in groups if get_rank_index(g[0].rank) != -1]
    valid_groups.sort(key=lambda g: get_rank_index(g[0].rank))
    
    if len(valid_groups) < count:
        return []
        
    for i in range(len(valid_groups) - count + 1):
        subset = valid_groups[i : i + count]
        is_consecutive = True
        for j in range(count - 1):
            curr = get_rank_index(subset[j][0].rank)
            next_r = get_rank_index(subset[j+1][0].rank)
            if next_r - curr != 1:
                is_consecutive = False
                break
        
        if is_consecutive:
            cards = []
            for g in subset:
                cards.extend(g[:width])
            
            start_rank = subset[0][0].rank
            end_rank = subset[-1][0].rank
            
            t_name = "straight"
            if width == 3: t_name = "steel_plate"
            elif width == 2: t_name = "wooden_board"
            
            candidates.append({
                "action": "play",
                "cards": cards,
                "desc": f"Play {t_name.replace('_', ' ').title()} {start_rank}-{end_rank}",
                "type": t_name
            })
    return candidates

def get_legal_moves(my_hand: List[Any], last_play: Any) -> List[Dict[str, Any]]:
    """
    Generate legal moves based on current hand and last play.
    Supports: Single, Pair, Triple, Full House, Straight, Plate, Wooden Board, Bomb, Straight Flush
    """
    moves = []
    sorted_hand = sort_hand(my_hand)
    grouped_hand = group_cards(sorted_hand)
    
    # Pre-calculate groups
    singles = sorted_hand
    # Group singles by rank for straight detection (need unique ranks)
    unique_singles_map = group_cards(singles)
    unique_singles = [cards for cards in unique_singles_map.values()] # List of lists
    
    pairs = [cards for cards in grouped_hand.values() if len(cards) >= 2]
    triples = [cards for cards in grouped_hand.values() if len(cards) >= 3]
    bombs = [cards for cards in grouped_hand.values() if len(cards) >= 4] # Basic bombs
    
    # Generate Advanced Types
    straights = find_consecutive_groups(unique_singles, 5, 1)
    plates = find_consecutive_groups(triples, 2, 3)
    boards = find_consecutive_groups(pairs, 3, 2)
    straight_flushes = find_straight_flushes(singles)
    
    # Check for 4 Kings
    kings = [c for c in singles if c.rank in ['SJ', 'BJ']]
    king_bomb = None
    if len(kings) == 4:
        king_bomb = {
            "action": "play",
            "cards": kings,
            "desc": "Play Heavenly King Bomb",
            "type": "bomb"
        }

    # Helper to add bombs to moves list
    all_bombs = []
    for b in bombs:
        all_bombs.append({
            "action": "play",
            "cards": b,
            "desc": f"Play Bomb {b[0].rank} ({len(b)} cards)",
            "type": "bomb"
        })
    for sf in straight_flushes:
        all_bombs.append(sf)
    if king_bomb:
        all_bombs.append(king_bomb)
    
    # Always allow PASS if it's not a free turn
    if last_play and last_play.get("cards") and len(last_play.get("cards")) > 0:
        moves.append({"action": "pass", "cards": [], "desc": "Pass", "type": "pass"})
    
    # 1. Free Play (Leader)
    if not last_play or not last_play.get("cards") or len(last_play.get("cards")) == 0:
        # Suggest Singles (Top 3 smallest)
        seen_ranks = set()
        count = 0
        for card in singles:
            if card.rank not in seen_ranks:
                moves.append({
                    "action": "play",
                    "cards": [card],
                    "desc": f"Play Single {card.rank}",
                    "type": "1"
                })
                seen_ranks.add(card.rank)
                count += 1
                if count >= 3: break
        
        # Suggest Pairs (Top 2 smallest)
        pairs.sort(key=lambda x: get_rank_value(x[0].rank))
        for p in pairs[:2]:
            moves.append({
                "action": "play",
                "cards": p[:2],
                "desc": f"Play Pair {p[0].rank}",
                "type": "2"
            })
            
        # Suggest Triples (Top 1 smallest)
        triples.sort(key=lambda x: get_rank_value(x[0].rank))
        for t in triples[:1]:
            moves.append({
                "action": "play",
                "cards": t[:3],
                "desc": f"Play Triple {t[0].rank}",
                "type": "3"
            })
            # Try to form a Full House (3+2) if possible
            if len(pairs) > 0:
                # Find smallest pair not overlapping with triple (ranks are different)
                for p in pairs:
                    if p[0].rank != t[0].rank:
                         moves.append({
                            "action": "play",
                            "cards": t[:3] + p[:2],
                            "desc": f"Play Full House {t[0].rank} with {p[0].rank}",
                            "type": "3+2"
                        })
                         break # Just one suggestion is enough
        
        # Suggest Straights
        for s in straights[:1]: # Suggest smallest straight
             moves.append(s)
             
        # Suggest Plates
        for p in plates[:1]:
            moves.append(p)
            
        # Suggest Wooden Boards
        for b in boards[:1]:
            moves.append(b)
            
        # Suggest Bombs (Just smallest normal bomb, and Straight Flush if any)
        # Sort all bombs by score
        all_bombs.sort(key=lambda x: get_bomb_score(x['cards'], x['type']))
        if all_bombs:
            moves.append(all_bombs[0])

    # 2. Follow Play
    else:
        target_cards = last_play.get("cards", [])
        target_type = last_play.get("type", "unknown")
        
        if not target_type or target_type == "unknown":
            # Infer type from card count if missing (frontend should send it though)
            if len(target_cards) == 1: target_type = "1"
            elif len(target_cards) == 2: target_type = "2"
            elif len(target_cards) == 3: target_type = "3"
            elif len(target_cards) == 5: 
                # Could be Straight or 3+2 or Straight Flush
                # Check for Straight Flush (Same Suit)
                suits = set(get_suit_from_card(c) for c in target_cards)
                if len(suits) == 1:
                     target_type = "straight_flush"
                else:
                     target_type = "straight"
            elif len(target_cards) == 6: target_type = "steel_plate" 
            elif len(target_cards) >= 4: target_type = "bomb" 
        
        target_val = get_rank_value(get_rank_from_card(target_cards[0])) if target_cards else 0
        
        # If target is NOT a bomb, we can beat with same type OR any bomb
        if target_type not in ["bomb", "straight_flush"]:
            # Same Type Logic
            if target_type == "1":
                seen_ranks = set()
                count = 0
                for card in singles:
                    if get_rank_value(card.rank) > target_val:
                        if card.rank not in seen_ranks:
                            moves.append({
                                "action": "play",
                                "cards": [card],
                                "desc": f"Play Single {card.rank}",
                                "type": "1"
                            })
                            seen_ranks.add(card.rank)
                            count += 1
                            if count >= 3: break
                            
            elif target_type == "2":
                pairs.sort(key=lambda x: get_rank_value(x[0].rank))
                for p in pairs:
                    if get_rank_value(p[0].rank) > target_val:
                        moves.append({
                            "action": "play",
                            "cards": p[:2],
                            "desc": f"Play Pair {p[0].rank}",
                            "type": "2"
                        })
                        if len(moves) > 3: break
            
            elif target_type == "3":
                triples.sort(key=lambda x: get_rank_value(x[0].rank))
                for t in triples:
                    if get_rank_value(t[0].rank) > target_val:
                        moves.append({
                            "action": "play",
                            "cards": t[:3],
                            "desc": f"Play Triple {t[0].rank}",
                            "type": "3"
                        })
                        if len(moves) > 2: break

            elif target_type == "straight":
                 for s in straights:
                     if get_rank_value(s['cards'][0].rank) > target_val:
                         moves.append(s)
                         if len(moves) > 1: break
            
            elif target_type == "steel_plate":
                 for p in plates:
                     if get_rank_value(p['cards'][0].rank) > target_val:
                         moves.append(p)
                         if len(moves) > 1: break
                         
            elif target_type == "wooden_board":
                 for b in boards:
                     if get_rank_value(b['cards'][0].rank) > target_val:
                         moves.append(b)
                         if len(moves) > 1: break
            
            # Also add Bombs (Any bomb beats non-bomb)
            # Suggest smallest bomb
            all_bombs.sort(key=lambda x: get_bomb_score(x['cards'], x['type']))
            if all_bombs:
                moves.append(all_bombs[0]) # Smallest bomb
                
        else:
            # Target IS a Bomb (or Straight Flush)
            target_score = get_bomb_score(target_cards, target_type)
            
            # Find bombs with higher score
            winning_bombs = []
            for b in all_bombs:
                if get_bomb_score(b['cards'], b['type']) > target_score:
                    winning_bombs.append(b)
            
            winning_bombs.sort(key=lambda x: get_bomb_score(x['cards'], x['type']))
            
            # Suggest smallest winning bomb
            if winning_bombs:
                moves.append(winning_bombs[0])

    return moves
