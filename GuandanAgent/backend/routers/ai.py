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
    type: Optional[str] = None # "1", "2", "3", "bomb", etc.
    message: Optional[str] = None
    reasoning: Optional[str] = None
    algorithm: Optional[str] = None # "MCTS", "LLM", "Greedy"

@router.post("/suggest_move", response_model=MoveResponse)
async def suggest_move(state: GameStateModel):
    """
    Endpoint to get the best move for a player.
    Uses AlphaGo-style MCTS by default, but also logs LLM suggestion for comparison.
    """
    try:
        from engine.ai_strategy import llm_strategy, mcts_strategy
        
        # 1. Run MCTS (Primary Strategy)
        # This is the "AlphaGo" direction the user requested.
        mcts_decision = mcts_strategy(state)
        
        # 2. Run LLM (Secondary/Comparison)
        # Kept as requested for comparison.
        # We catch errors here so LLM failure doesn't block the game.
        llm_decision = None
        try:
             llm_decision = llm_strategy(state)
        except Exception as e:
             print(f"LLM Strategy Failed: {e}")
        
        # Combine reasoning for display
        final_decision = mcts_decision
        final_decision['algorithm'] = "MCTS"
        
        comparison_text = ""
        if llm_decision:
            llm_desc = llm_decision.get('desc', llm_decision.get('action'))
            comparison_text = f"\n\n[Comparison] LLM suggested: {llm_desc}\nLLM Reasoning: {llm_decision.get('reasoning', 'None')}"
            
        final_decision['reasoning'] = (final_decision.get('reasoning', '') or '') + comparison_text
        
        return final_decision

    except Exception as e:
        print(f"Error in suggest_move: {e}")
        raise HTTPException(status_code=500, detail=str(e))
