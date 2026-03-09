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
    expected_order = ["cpu", "ram", "gpu", "storage"]
    items = data.get("items", [])
    if items == expected_order:
        return ValidationResponse(success=True, unlocks=["module_ram"])
    return ValidationResponse(success=False, message="Hardware alignment incorrect.")

def validate_elem_6_2(data: dict) -> ValidationResponse:
    # Loop Block Puzzle
    iterations = data.get("iterations", 0)
    commands = data.get("commands", [])
    
    if iterations == 100 and commands == ["A", "B", "C", "D"]:
        return ValidationResponse(success=True)
    return ValidationResponse(success=False, message="The sequence or iteration count is incorrect.")

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
