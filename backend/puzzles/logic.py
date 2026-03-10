from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, Callable

router = APIRouter()

class ValidationRequest(BaseModel):
    campaignId: str
    levelId: str
    data: Dict[str, Any]

class ValidationResponse(BaseModel):
    success: bool
    unlocks: list[str] = []
    message: str = ""

def validate_elem6_1(data: Dict[str, Any]) -> ValidationResponse:
    # Bubble Sort puzzle — validate that the memory blocks are correctly sorted
    sorted_array = data.get("sorted_array", [])
    expected_sorted = [5, 17, 29, 42, 61, 83]

    if sorted_array == expected_sorted:
        return ValidationResponse(success=True, unlocks=["module_ram"])
    return ValidationResponse(success=False, message="Memory blocks are not correctly sorted.")

def validate_elem_6_2(data: dict) -> ValidationResponse:
    # Loop Runner Puzzle — simulate robot on grid
    commands = data.get("commands", [])
    iterations = data.get("iterations", 0)

    GRID = [
        [2, 0, 0, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 0, 0, 0, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 0, 0, 3, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ]
    ROWS, COLS = 5, 10
    EXIT = (3, 8)
    TURN_L = {"UP": "LEFT", "LEFT": "DOWN", "DOWN": "RIGHT", "RIGHT": "UP"}
    TURN_R = {"UP": "RIGHT", "RIGHT": "DOWN", "DOWN": "LEFT", "LEFT": "UP"}
    DELTAS = {"UP": (-1, 0), "DOWN": (1, 0), "LEFT": (0, -1), "RIGHT": (0, 1)}

    row, col, direction = 0, 0, "RIGHT"

    valid_cmds = {"MOVE", "TURN_LEFT", "TURN_RIGHT"}
    if not commands or not all(c in valid_cmds for c in commands):
        return ValidationResponse(success=False, message="Invalid command sequence.")
    if not isinstance(iterations, int) or iterations < 1 or iterations > 20:
        return ValidationResponse(success=False, message="Iteration count must be between 1 and 20.")

    for _ in range(iterations):
        for cmd in commands:
            if cmd == "TURN_LEFT":
                direction = TURN_L[direction]
            elif cmd == "TURN_RIGHT":
                direction = TURN_R[direction]
            else:  # MOVE
                dr, dc = DELTAS[direction]
                nr, nc = row + dr, col + dc
                if nr < 0 or nr >= ROWS or nc < 0 or nc >= COLS or GRID[nr][nc] == 1:
                    return ValidationResponse(success=False, message="Robot hit a wall.")
                row, col = nr, nc
                if (row, col) == EXIT:
                    return ValidationResponse(success=True, unlocks=["module_loop"])

    return ValidationResponse(success=False, message="Robot did not reach the exit.")

# Strategy Mapper Dictionary
VALIDATION_FNS: Dict[tuple[str, str], Callable[[Dict[str, Any]], ValidationResponse]] = {
    ("elem_6", "1"): validate_elem6_1,
    ("elem_6", "2"): validate_elem_6_2,
}

@router.post("/validate", response_model=ValidationResponse)
def validate_puzzle(request: ValidationRequest):
    validator_fn = VALIDATION_FNS.get((request.campaignId, request.levelId))
    if not validator_fn:
         return ValidationResponse(
             success=False, 
             message=f"System Error: Validation protocol missing for Campaign {request.campaignId} Level {request.levelId}."
         )
    
    return validator_fn(request.data)
