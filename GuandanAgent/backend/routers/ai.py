from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter()

# Data models for request/response
class CardModel(BaseModel):
    suit: str
    rank: str

class GameStateModel(BaseModel):
    player_index: int  # Who is asking for a move
    my_hand: List[CardModel]
    current_hand: List[List[CardModel]] # Grouped hand (optional)
    last_play: Optional[Dict[str, Any]] = None # Who played what last
    played_cards: Optional[Dict[int, List[CardModel]]] = None # History of played cards
    
class MoveResponse(BaseModel):
    action: str # "play" or "pass"
    cards: List[CardModel]
    message: Optional[str] = None

@router.post("/suggest_move", response_model=MoveResponse)
async def suggest_move(state: GameStateModel):
    """
    Endpoint to get the best move for a player.
    Currently implements a simple rule-based fallback, 
    but designed to be replaced/augmented by AI/LLM.
    """
    try:
        # Placeholder logic: just echo back the first card if any, or pass
        # This is just to test connectivity.
        # We will implement the actual logic in engine/ai_strategy.py
        
        # Temporary logic:
        # If I have cards, play the first one as a single. 
        # If I have no cards, pass (shouldn't happen if game logic is right).
        
        from engine.ai_strategy import simple_greedy_strategy
        
        decision = simple_greedy_strategy(state)
        return decision

    except Exception as e:
        print(f"Error in suggest_move: {e}")
        raise HTTPException(status_code=500, detail=str(e))
