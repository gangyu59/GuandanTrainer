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
    current_level: int = 2 # Current game level (Rank of Wild Card)

class MoveResponse(BaseModel):
    action: str # "play" or "pass"
    cards: List[CardModel]
    type: Optional[str] = None # "1", "2", "3", "bomb", etc.
    message: Optional[str] = None
    reasoning: Optional[str] = None
    algorithm: Optional[str] = None # "MCTS", "LLM", "Greedy"
    win_rate: Optional[float] = None
    visits: Optional[int] = None
    llm_recommendation: Optional[Dict[str, Any]] = None # Structured LLM advice

@router.post("/suggest_move", response_model=MoveResponse)
async def suggest_move(state: GameStateModel):
    """
    Endpoint to get the best move for a player.
    Uses AlphaGo-style MCTS by default, but also logs LLM suggestion for comparison.
    """
    try:
        from engine.ai_strategy import llm_strategy, mcts_strategy
        
        # 1. Run MCTS (Primary Strategy)
        mcts_decision = mcts_strategy(state)
        
        # 2. Run LLM (Secondary/Comparison)
        llm_decision = None
        try:
            # We run LLM only for comparison, not for actual play
            llm_decision = llm_strategy(state)
        except Exception as e:
            print(f"LLM Strategy Failed: {e}")
        
        # 3. Construct Final Response
        final_decision = mcts_decision
        final_decision['algorithm'] = "MCTS"
        
        # Add LLM comparison data if available
        if llm_decision:
            final_decision['llm_recommendation'] = {
                "action": llm_decision.get('action'),
                "cards": llm_decision.get('cards'),
                "desc": llm_decision.get('desc', llm_decision.get('message')),
                "reasoning": llm_decision.get('reasoning')
            }
            
        return final_decision

    except Exception as e:
        print(f"Error in suggest_move: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_stats():
    """Get training stats for dashboard."""
    from backend.stats import get_dashboard_data
    return get_dashboard_data()
