from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter()

class GameState(BaseModel):
    items: List[str]
    unlocked_doors: List[str]
    puzzle_states: Dict[str, Any]

class Event(BaseModel):
    type: str # 'ITEM_FOUND', 'DOOR_UNLOCKED', etc.
    payload: Any

@router.post("/validate")
def validate_state(state: GameState, event: Event):
    # This will validate if a move/event is legal based on current state
    return {"valid": True, "message": "State transition validated"}
