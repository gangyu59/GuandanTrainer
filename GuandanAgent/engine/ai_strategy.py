import os
import requests
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from engine.cards import Rank, Suit, Card
from engine.logic import (
    sort_hand, group_cards, get_legal_moves, get_rank_value, 
    get_bomb_score, get_rank_from_card, calculate_hand_strength
)
from engine.rl.env import GuandanEnv
from engine.rl.mcts import MCTSNode, MCTS

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../backend/.env'))

# Removed duplicated logic (moved to logic.py)


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

def mcts_strategy(state: Any) -> Dict[str, Any]:
    """
    AlphaGo-style MCTS Strategy.
    """
    my_hand = state.my_hand
    last_play = state.last_play
    
    if not my_hand:
        return {"action": "pass", "cards": [], "message": "No cards left", "reasoning": "No cards"}

    # Initialize Environment
    # GuandanEnv expects my_hand (List[Card]) and last_play (Dict)
    env = GuandanEnv(my_hand, last_play)
    
    # Run MCTS
    mcts = MCTS(time_limit_ms=2000) # 2 seconds thinking time
    
    try:
        best_action = mcts.search(env)
    except Exception as e:
        print(f"MCTS Error: {e}")
        best_action = None
    
    if not best_action:
        # Fallback to legal moves
        moves = get_legal_moves(my_hand, last_play)
        if moves:
            best_action = moves[0]
            hand_eval = calculate_hand_strength(my_hand)
            return {
                **best_action,
                "message": f"Fallback: First Legal Move (Hand Score: {hand_eval['score']})",
                "reasoning": f"MCTS failed. Hand Strength: {hand_eval['desc']}"
            }
        return {"action": "pass", "cards": [], "message": "No legal moves (MCTS Fallback)"}
        
    # Add Hand Strength Info
    hand_eval = calculate_hand_strength(my_hand)
    win_rate_pct = best_action.get('win_rate', 0.5) * 100
    visits = best_action.get('visits', 0)
    
    # Save Stats
    try:
        from backend.stats import save_stat
        save_stat(best_action.get('win_rate', 0.5), hand_eval['score'], visits)
    except:
        pass # Don't block game logic
    
    return {
        **best_action,
        "message": f"MCTS: {best_action.get('desc', 'Unknown')} (WinRate: {win_rate_pct:.1f}%)",
        "reasoning": (
            f"Selected via MCTS ({visits} visits). "
            f"Estimated Win Rate: {win_rate_pct:.1f}%. "
            f"Current Hand Strength: {hand_eval['score']} (Bombs: {hand_eval['num_bombs']}). "
            f"Strategy prefers playing small cards to gain tempo."
        )
    }

