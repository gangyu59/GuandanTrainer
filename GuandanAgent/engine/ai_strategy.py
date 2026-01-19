import os
import requests
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from engine.cards import Rank, Suit, Card

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../backend/.env'))

from collections import Counter

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

def get_rank_from_card(card: Any) -> str:
    """Helper to handle both Card objects and dictionary representations."""
    if isinstance(card, dict):
        return card.get('rank')
    return card.rank

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
        moves.append({"action": "pass", "cards": [], "desc": "Pass"})
    
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
                suits = set(c.get('suit') for c in target_cards)
                if len(suits) == 1:
                     target_type = "straight_flush"
                else:
                     target_type = "straight"
            elif len(target_cards) == 6: target_type = "steel_plate" 
            elif len(target_cards) >= 4: target_type = "bomb" 
        
        target_val = get_rank_value(target_cards[0]['rank']) if target_cards else 0
        
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

def query_llm(context: str, options: List[str]) -> tuple[int, str]:
    """
    Call LLM to select the best move index.
    Returns (selected_index, raw_response_content)
    """
    api_key = os.getenv("ARK_API_KEY")
    api_url = os.getenv("ARK_API_URL")
    model = os.getenv("ARK_API_MODEL")
    
    if not api_key or not api_url:
        print("Missing LLM Config")
        return 0, "Missing LLM Config"
        
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    prompt = f"""
You are a professional Guandan (Egg throwing) player. 
Your goal is to win the game by playing your cards wisely.
    
Current Game State:
{context}

Available Moves:
{json.dumps(options, indent=2)}

Please select the best move from the available options.
Briefly explain your reasoning IN CHINESE (中文), then return the JSON.
Keep your reasoning concise (1-2 sentences).

Format:
Reasoning: [你的中文思考过程]
```json
{{ "index": 0 }}
```
"""
    
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a strategic Guandan card game AI. You must output your reasoning in Chinese."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        res_json = response.json()
        content = res_json['choices'][0]['message']['content']
        
        # Extract JSON
        start = content.find('{')
        end = content.rfind('}') + 1
        index = 0
        if start >= 0 and end > start:
            try:
                json_str = content[start:end]
                result = json.loads(json_str)
                index = int(result.get("index", 0))
            except:
                pass
                
        return index, content
    except Exception as e:
        print(f"LLM Call Failed: {e}")
        return 0, f"LLM Call Failed: {str(e)}"

def llm_strategy(state: Any) -> Dict[str, Any]:
    """
    Hybrid Strategy:
    1. Python generates legal moves.
    2. LLM selects the best move.
    """
    my_hand = state.my_hand
    last_play = state.last_play
    
    if not my_hand:
        return {"action": "pass", "cards": [], "message": "No cards left", "reasoning": "No cards"}
        
    # 1. Generate Legal Moves
    moves = get_legal_moves(my_hand, last_play)
    
    if not moves:
        return {"action": "pass", "cards": [], "message": "No legal moves (Backend)", "reasoning": "No legal moves found by rule engine"}
        
    if len(moves) == 1:
        return {**moves[0], "message": "Backend: Only one legal move", "reasoning": "Only one legal move available (forced)"}
    
    # 2. Construct Context for LLM
    context = f"""
    My Hand: {[c.rank for c in sort_hand(my_hand)]}
    Last Play: {last_play.get('cards', []) if last_play else 'None'}
    My Role: {'Leader' if not last_play else 'Follower'}
    """
    
    options = [m['desc'] for m in moves]
    
    # 3. Ask LLM
    selected_index, reasoning = query_llm(context, options)
    
    # Validate index
    if selected_index < 0 or selected_index >= len(moves):
        selected_index = 0
        
    choice = moves[selected_index]
    
    return {
        **choice,
        "message": f"LLM Selected: {choice['desc']}",
        "reasoning": reasoning
    }

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
