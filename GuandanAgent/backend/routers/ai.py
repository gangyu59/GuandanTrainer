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
    Uses HappyGuandan Strategy (ported from JS) as primary.
    """
    import logging
    import traceback
    
    # Configure logging to file
    logging.basicConfig(
        filename='backend_ai_debug.log', 
        level=logging.ERROR,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    try:
        try:
            from engine.simple_strategy import decide_move
            from engine.cards import Card, Suit, Rank
        except ImportError:
            # Try absolute imports if engine is not in path
            from GuandanAgent.engine.simple_strategy import decide_move
            from GuandanAgent.engine.cards import Card, Suit, Rank
        
        # Convert CardModel to Engine Cards
        engine_hand = []
        
        # Helper to handle Frontend Suit names ("HEARTS" -> "H")
        def normalize_suit(s):
            s = s.upper()
            if s == "HEARTS": return "H"
            if s == "DIAMONDS": return "D"
            if s == "SPADES": return "S"
            if s == "CLUBS": return "C"
            if s == "JOKER": return "J"
            return s

        try:
            for c in state.my_hand:
                s_str = normalize_suit(c.suit)
                r_str = c.rank
                engine_hand.append(Card(suit=Suit(s_str), rank=Rank(r_str)))
        except Exception as e:
            logging.error(f"Card Conversion Error: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid card format: {e}")

        # Convert Last Play Cards if present
        last_play_dict = state.last_play
        if last_play_dict and 'cards' in last_play_dict:
             # Ensure cards are converted
             converted_cards = []
             for c in last_play_dict['cards']:
                if isinstance(c, dict):
                    s_str = normalize_suit(c.get('suit'))
                    converted_cards.append(Card(suit=Suit(s_str), rank=Rank(c.get('rank'))))
                else:
                    converted_cards.append(c) # Assume already Card objects if internal call, but HTTP usually dicts
             last_play_dict = last_play_dict.copy()
             last_play_dict['cards'] = converted_cards

        # 1. Run HappyGuandan Strategy
        decision = decide_move(
            hand=engine_hand,
            last_play=last_play_dict,
            current_level=state.current_level,
            my_player_index=state.player_index
        )
        
        # 3. Construct Final Response
        final_decision = {
            "action": decision.get("action"),
            "cards": [CardModel(suit=c.suit.value, rank=c.rank.value) for c in decision.get("cards", [])],
            "type": decision.get("type"),
            "message": decision.get("desc"),
            "reasoning": "HappyGuandan Strategy (Reverse Iter + Partner Logic)",
            "algorithm": "HappyGuandan"
        }
            
        return final_decision

    except Exception as e:
        error_msg = f"Error in suggest_move: {e}\n{traceback.format_exc()}"
        logging.error(error_msg)
        print(error_msg)
        
        # SUPER ROBUST FALLBACK
        # If anything crashed, DO NOT FAIL. Return a safe move.
        try:
            # If Leading, play smallest single.
            if not state.last_play:
                if state.my_hand:
                    # ... (existing lead logic)
                    if 'engine_hand' in locals() and engine_hand:
                        try:
                            from engine.logic import get_rank_value
                        except ImportError:
                            from GuandanAgent.engine.logic import get_rank_value

                        engine_hand.sort(key=lambda x: get_rank_value(x.rank.value))
                        best = engine_hand[0]
                        return {
                            "action": "play",
                            "cards": [CardModel(suit=best.suit.value, rank=best.rank.value)],
                            "type": "single",
                            "message": "Critical Failure Fallback: Smallest Single",
                            "algorithm": "FallbackSafetyNet"
                        }
            
            # If Following, try to beat last play with simple logic.
            if state.last_play and 'engine_hand' in locals() and engine_hand:
                lp_type = str(state.last_play.get('type')).lower()
                
                # Try to import get_rank_value again if needed
                try:
                    from engine.logic import get_rank_value
                except ImportError:
                    try:
                        from GuandanAgent.engine.logic import get_rank_value
                    except:
                        pass # Give up if no logic

                if lp_type == 'single' and 'get_rank_value' in locals():
                    # Extract target rank
                    cards_data = state.last_play.get('cards', [])
                    if cards_data:
                        # cards_data might be list of dicts or CardModels (if pydantic parsed it?)
                        # state.last_play is Dict, so likely list of dicts.
                        c0 = cards_data[0]
                        rank_val = 0
                        if isinstance(c0, dict):
                            rank_val = get_rank_value(c0.get('rank'))
                        elif hasattr(c0, 'rank'):
                            rank_val = get_rank_value(c0.rank)
                        
                        # Find beater
                        candidates = [c for c in engine_hand if get_rank_value(c.rank.value) > rank_val]
                        if candidates:
                            candidates.sort(key=lambda x: get_rank_value(x.rank.value))
                            best = candidates[0]
                            return {
                                "action": "play",
                                "cards": [CardModel(suit=best.suit.value, rank=best.rank.value)],
                                "type": "single",
                                "message": "Critical Failure Fallback: Follow Single",
                                "algorithm": "FallbackSafetyNet"
                            }

            # Just PASS to avoid blocking the game loop, but return 200 OK.
            return {
                "action": "pass",
                "cards": [],
                "message": f"Backend Error (Fallback Pass): {str(e)}",
                "algorithm": "FallbackSafetyNet"
            }
            
        except Exception as fallback_error:
            # If even fallback fails (e.g. imports failed), return empty pass.
            return {
                "action": "pass",
                "cards": [],
                "message": "Critical Backend Failure (Total Collapse)",
                "algorithm": "TotalCollapse"
            }

@router.get("/stats")
async def get_stats():
    """Get training stats for dashboard."""
    from backend.stats import get_dashboard_data
    return get_dashboard_data()
