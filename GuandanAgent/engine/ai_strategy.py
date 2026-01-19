import os
import requests
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from engine.cards import Rank, Suit, Card

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../backend/.env'))

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

def get_legal_moves(my_hand: List[Any], last_play: Any) -> List[Dict[str, Any]]:
    """
    Generate legal moves based on current hand and last play.
    Currently supports: PASS, Single
    TODO: Add support for Pairs, Triples, Plates, Straights, etc.
    """
    moves = []
    sorted_hand = sort_hand(my_hand)
    
    # Always allow PASS if it's not a free turn
    if last_play and last_play.get("cards") and len(last_play.get("cards")) > 0:
        moves.append({"action": "pass", "cards": [], "desc": "Pass"})
    
    # 1. Free Play (Leader)
    if not last_play or not last_play.get("cards") or len(last_play.get("cards")) == 0:
        # Suggest top 3 smallest singles
        seen_ranks = set()
        count = 0
        for card in sorted_hand:
            if card.rank not in seen_ranks:
                moves.append({
                    "action": "play",
                    "cards": [card],
                    "desc": f"Play Single {card.rank}"
                })
                seen_ranks.add(card.rank)
                count += 1
                if count >= 3: break
    
    # 2. Follow Play
    else:
        target_cards = last_play.get("cards", [])
        target_type = last_play.get("type", "unknown")
        
        # Only support Singles for now
        if len(target_cards) == 1:
            target_val = get_rank_value(target_cards[0]['rank'])
            # Find all singles that beat it
            seen_ranks = set()
            count = 0
            for card in sorted_hand:
                if get_rank_value(card.rank) > target_val:
                    if card.rank not in seen_ranks:
                        moves.append({
                            "action": "play",
                            "cards": [card],
                            "desc": f"Play Single {card.rank} (Beats {target_cards[0]['rank']})"
                        })
                        seen_ranks.add(card.rank)
                        count += 1
                        if count >= 3: break
    
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
Briefly explain your reasoning, then return the JSON.

Format:
Reasoning: [Your reasoning here]
```json
{{ "index": 0 }}
```
"""
    
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a strategic Guandan card game AI."},
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
