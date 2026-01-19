from fastapi import APIRouter
from engine.game import new_game, serialize_game_state


router = APIRouter()


@router.post("/deal")
async def deal():
    game = new_game()
    return serialize_game_state(game)
