import json
from pathlib import Path
from typing import Any, Annotated, Callable

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints

router = APIRouter()


CampaignIdentifier = Annotated[
    str,
    StringConstraints(pattern=r"^[a-zA-Z0-9_-]{1,50}$"),
]


class ValidationRequest(BaseModel):
    campaignId: CampaignIdentifier
    levelId: CampaignIdentifier
    data: dict[str, Any] = Field(default_factory=dict)


class ValidationResponse(BaseModel):
    success: bool
    unlocks: list[str] = Field(default_factory=list)
    message: str = ""


SCHEMA_PATH = Path(__file__).with_name("validation_schema.json")


def load_validation_schema() -> dict[str, dict[str, dict[str, Any]]]:
    with SCHEMA_PATH.open("r", encoding="utf-8") as schema_file:
        return json.load(schema_file)


def validate_sorted_sequence(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    sorted_array = data.get("sorted_array", [])
    expected_sorted = schema.get("expectedSorted", [])

    if sorted_array == expected_sorted:
        return ValidationResponse(success=True, unlocks=schema.get("unlocks", []))

    return ValidationResponse(
        success=False,
        message=schema.get("messages", {}).get(
            "failure", "Memory blocks are not correctly sorted."
        ),
    )


def validate_grid_path(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    commands = data.get("commands", [])
    iterations = data.get("iterations", 0)

    grid = schema.get("grid", [])
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0
    start = schema.get("start", [0, 0])
    exit_cell = tuple(schema.get("exit", [0, 0]))
    iteration_constraints = schema.get("iterations", {"min": 1, "max": 20})
    messages = schema.get("messages", {})

    TURN_L = {"UP": "LEFT", "LEFT": "DOWN", "DOWN": "RIGHT", "RIGHT": "UP"}
    TURN_R = {"UP": "RIGHT", "RIGHT": "DOWN", "DOWN": "LEFT", "LEFT": "UP"}
    DELTAS = {"UP": (-1, 0), "DOWN": (1, 0), "LEFT": (0, -1), "RIGHT": (0, 1)}

    row, col = start
    direction = schema.get("startDirection", "RIGHT")

    valid_cmds = set(schema.get("validCommands", ["MOVE", "TURN_LEFT", "TURN_RIGHT"]))
    if not commands or not all(c in valid_cmds for c in commands):
        return ValidationResponse(
            success=False,
            message=messages.get("invalidCommands", "Invalid command sequence."),
        )
    if (
        not isinstance(iterations, int)
        or iterations < iteration_constraints.get("min", 1)
        or iterations > iteration_constraints.get("max", 20)
    ):
        return ValidationResponse(
            success=False,
            message=messages.get(
                "invalidIterations", "Iteration count must be between 1 and 20."
            ),
        )

    for _ in range(iterations):
        for cmd in commands:
            if cmd == "TURN_LEFT":
                direction = TURN_L[direction]
            elif cmd == "TURN_RIGHT":
                direction = TURN_R[direction]
            else:  # MOVE
                dr, dc = DELTAS[direction]
                nr, nc = row + dr, col + dc
                if nr < 0 or nr >= rows or nc < 0 or nc >= cols or grid[nr][nc] == 1:
                    return ValidationResponse(
                        success=False, message=messages.get("wall", "Robot hit a wall.")
                    )
                row, col = nr, nc
                if (row, col) == exit_cell:
                    return ValidationResponse(
                        success=True, unlocks=schema.get("unlocks", [])
                    )

    return ValidationResponse(
        success=False, message=messages.get("failure", "Robot did not reach the exit.")
    )


def validate_signal_panels(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    channels = data.get("channels", {})
    targets = schema.get("targets", {})
    messages = schema.get("messages", {})

    if not isinstance(channels, dict):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Signal packet is malformed."),
        )

    for channel_name, expected in targets.items():
        received = channels.get(channel_name)
        if not isinstance(received, list) or len(received) != len(expected):
            return ValidationResponse(
                success=False,
                message=messages.get("invalid", "Signal packet is malformed."),
            )

        if any(bit not in (0, 1) for bit in received):
            return ValidationResponse(
                success=False,
                message=messages.get("invalid", "Signal packet is malformed."),
            )

        if received != expected:
            return ValidationResponse(
                success=False,
                message=messages.get(
                    "failure", "Beacon packet does not match the relay target."
                ),
            )

    return ValidationResponse(success=True, unlocks=schema.get("unlocks", []))


def validate_archive_records(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    rows = data.get("rows", [])
    expected_rows = schema.get("expectedRows", [])
    required_fields = schema.get(
        "requiredFields", ["person", "sector", "time", "shuttle"]
    )
    messages = schema.get("messages", {})

    if not isinstance(rows, list) or len(rows) != len(expected_rows):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Archive record set is incomplete."),
        )

    for row in rows:
        if not isinstance(row, dict):
            return ValidationResponse(
                success=False,
                message=messages.get("invalid", "Archive record set is incomplete."),
            )
        for field_name in required_fields:
            value = row.get(field_name)
            if not isinstance(value, str) or not value:
                return ValidationResponse(
                    success=False,
                    message=messages.get(
                        "incomplete", "Archive record set is incomplete."
                    ),
                )

    if rows != expected_rows:
        return ValidationResponse(
            success=False,
            message=messages.get(
                "failure", "Archive routing records are inconsistent."
            ),
        )

    return ValidationResponse(success=True, unlocks=schema.get("unlocks", []))


def validate_network_path(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    route = data.get("route", [])
    expected_route = schema.get("expectedRoute", [])
    messages = schema.get("messages", {})

    if not isinstance(route, list) or not all(isinstance(node, str) for node in route):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Relay route data is malformed."),
        )

    if route != expected_route:
        return ValidationResponse(
            success=False,
            message=messages.get(
                "failure", "Relay packet is still taking the wrong corridor."
            ),
        )

    return ValidationResponse(success=True, unlocks=schema.get("unlocks", []))


def validate_decision_rules(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    rules = data.get("rules", {})
    expected_rules = schema.get("expectedRules", {})
    messages = schema.get("messages", {})

    if not isinstance(rules, dict):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Decision matrix is malformed."),
        )

    for junction_id, expected_rule in expected_rules.items():
        received_rule = rules.get(junction_id)
        if not isinstance(received_rule, str):
            return ValidationResponse(
                success=False,
                message=messages.get(
                    "incomplete", "Some switch conditions are still unset."
                ),
            )
        if received_rule != expected_rule:
            return ValidationResponse(
                success=False,
                message=messages.get(
                    "failure", "The sorter logic still sends crates to the wrong exits."
                ),
            )

    return ValidationResponse(success=True, unlocks=schema.get("unlocks", []))


def validate_ordered_sequence(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    sequence = data.get("sequence", [])
    expected_sequence = schema.get("expectedSequence", [])
    messages = schema.get("messages", {})

    if not isinstance(sequence, list) or not all(
        isinstance(entry, str) for entry in sequence
    ):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Sequence data is malformed."),
        )

    if len(sequence) != len(expected_sequence):
        return ValidationResponse(
            success=False,
            message=messages.get("incomplete", "Sequence is incomplete."),
        )

    if sequence != expected_sequence:
        return ValidationResponse(
            success=False,
            message=messages.get("failure", "Sequence order is incorrect."),
        )

    return ValidationResponse(success=True, unlocks=schema.get("unlocks", []))


def validate_value_map(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    values = data.get("values", {})
    expected_values = schema.get("expectedValues", {})
    messages = schema.get("messages", {})

    if not isinstance(values, dict):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Mapping data is malformed."),
        )

    for key, expected_value in expected_values.items():
        received_value = values.get(key)
        if received_value is None:
            return ValidationResponse(
                success=False,
                message=messages.get("incomplete", "Some values are still unset."),
            )
        if received_value != expected_value:
            return ValidationResponse(
                success=False,
                message=messages.get("failure", "Mapped values are incorrect."),
            )

    return ValidationResponse(success=True, unlocks=schema.get("unlocks", []))


VALIDATION_HANDLERS: dict[
    str, Callable[[dict[str, Any], dict[str, Any]], ValidationResponse]
] = {
    "sorted_sequence": validate_sorted_sequence,
    "grid_path": validate_grid_path,
    "signal_panels": validate_signal_panels,
    "archive_records": validate_archive_records,
    "network_path": validate_network_path,
    "decision_rules": validate_decision_rules,
    "ordered_sequence": validate_ordered_sequence,
    "value_map": validate_value_map,
}


@router.post("/validate", response_model=ValidationResponse)
def validate_puzzle(request: ValidationRequest):
    try:
        validation_schema = load_validation_schema()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Validation schema file is missing: {SCHEMA_PATH.name}.",
                "error_code": "VALIDATION_SCHEMA_MISSING",
            },
        ) from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Validation schema is malformed near line {exc.lineno}, column {exc.colno}.",
                "error_code": "VALIDATION_SCHEMA_INVALID",
            },
        ) from exc

    campaign_rules = validation_schema.get(request.campaignId)
    if not campaign_rules:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Validation protocol missing for campaign {request.campaignId}.",
                "error_code": "CAMPAIGN_NOT_FOUND",
            },
        )

    rule = campaign_rules.get(request.levelId)
    if not rule:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Validation protocol missing for campaign {request.campaignId} level {request.levelId}.",
                "error_code": "LEVEL_NOT_FOUND",
            },
        )

    validator_type = rule.get("type")
    validator = VALIDATION_HANDLERS.get(validator_type)
    if not validator:
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Unsupported validation type {validator_type}.",
                "error_code": "VALIDATOR_TYPE_UNSUPPORTED",
            },
        )

    return validator(rule, request.data)
