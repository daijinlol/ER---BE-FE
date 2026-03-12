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


class ProgressResponse(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class ClueResponse(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


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


def get_signal_panel_progress(
    schema: dict[str, Any], data: dict[str, Any]
) -> dict[str, Any]:
    channels = data.get("channels", {})
    targets = schema.get("targets", {})

    if not isinstance(channels, dict):
        return {
            "matchedPanels": {panel_id: False for panel_id in targets.keys()},
            "beaconUnlocked": False,
        }

    matched_panels = {
        panel_id: channels.get(panel_id) == target_bits
        for panel_id, target_bits in targets.items()
    }

    return {
        "matchedPanels": matched_panels,
        "beaconUnlocked": bool(
            matched_panels.get("buffer") and matched_panels.get("pulse")
        ),
    }


def get_signal_panel_clue(
    schema: dict[str, Any], data: dict[str, Any]
) -> dict[str, Any]:
    panel_id = data.get("panelId")
    targets = schema.get("targets", {})
    if not isinstance(panel_id, str) or panel_id not in targets:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Requested signal panel clue is invalid.",
                "error_code": "SIGNAL_PANEL_CLUE_INVALID",
            },
        )

    return {
        "pattern": targets[panel_id],
    }


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


DECISION_PACKETS = [
    {
        "id": "iris",
        "checksum": "stable",
        "priority": "high",
        "tag": "amber",
        "target": "bay_a",
    },
    {
        "id": "quill",
        "checksum": "stable",
        "priority": "low",
        "tag": "cyan",
        "target": "bay_b",
    },
    {
        "id": "mako",
        "checksum": "warning",
        "priority": "high",
        "tag": "amber",
        "target": "bay_c",
    },
    {
        "id": "lyra",
        "checksum": "warning",
        "priority": "low",
        "tag": "cyan",
        "target": "bay_d",
    },
]


def evaluate_decision_rule(packet: dict[str, str], rule_id: str | None) -> bool:
    if rule_id == "stable":
        return packet["checksum"] == "stable"
    if rule_id == "high_priority":
        return packet["priority"] == "high"
    if rule_id == "low_priority":
        return packet["priority"] == "low"
    if rule_id in {"amber_tag", "archive_tag"}:
        return packet["tag"] == "amber"
    if rule_id == "cyan_tag":
        return packet["tag"] == "cyan"
    return False


def simulate_decision_packet(packet: dict[str, str], rules: dict[str, str]) -> str:
    alpha = (
        "beta"
        if evaluate_decision_rule(packet, rules.get("junction_alpha"))
        else "gamma"
    )
    if alpha == "beta":
        return (
            "bay_a"
            if evaluate_decision_rule(packet, rules.get("junction_beta"))
            else "bay_b"
        )

    return (
        "bay_c"
        if evaluate_decision_rule(packet, rules.get("junction_gamma"))
        else "bay_d"
    )


def get_decision_rule_progress(
    schema: dict[str, Any], data: dict[str, Any]
) -> dict[str, Any]:
    rules = data.get("rules", {})
    if not isinstance(rules, dict):
        return {"correctPacketIds": []}

    correct_packet_ids = [
        packet["id"]
        for packet in DECISION_PACKETS
        if simulate_decision_packet(packet, rules) == packet["target"]
    ]
    return {"correctPacketIds": correct_packet_ids}


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


def validate_system_model(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    edges = data.get("edges", [])
    modes = data.get("modes", {})
    expected_edges = sorted(schema.get("expectedEdges", []))
    expected_modes = schema.get("expectedModes", {})
    messages = schema.get("messages", {})

    if not isinstance(edges, list) or not all(isinstance(edge, str) for edge in edges):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Digital twin payload is malformed."),
        )

    if not isinstance(modes, dict) or not all(
        isinstance(key, str) and isinstance(value, str) for key, value in modes.items()
    ):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Digital twin payload is malformed."),
        )

    normalized_edges = sorted(set(edges))
    if len(normalized_edges) < len(expected_edges) or any(
        hub_id not in modes or not modes[hub_id] for hub_id in expected_modes
    ):
        return ValidationResponse(
            success=False,
            message=messages.get(
                "incomplete",
                "Some sensor lines or subsystem modes are still unset.",
            ),
        )

    if normalized_edges != expected_edges or any(
        modes.get(hub_id) != expected_mode
        for hub_id, expected_mode in expected_modes.items()
    ):
        return ValidationResponse(
            success=False,
            message=messages.get(
                "failure",
                "The facility model still predicts an unsafe evacuation state.",
            ),
        )

    return ValidationResponse(success=True, unlocks=schema.get("unlocks", []))


def validate_drone_program(
    schema: dict[str, Any], data: dict[str, Any]
) -> ValidationResponse:
    commands = data.get("commands", [])
    iterations = data.get("iterations", 0)
    grid = schema.get("grid", [])
    panels = {tuple(panel) for panel in schema.get("panels", [])}
    exit_cell = tuple(schema.get("exit", [0, 0]))
    row, col = schema.get("start", [0, 0])
    direction = schema.get("startDirection", "RIGHT")
    valid_commands = set(schema.get("validCommands", []))
    iteration_constraints = schema.get("iterations", {"min": 1, "max": 20})
    messages = schema.get("messages", {})

    if not isinstance(commands, list) or not all(
        isinstance(command, str) and command in valid_commands for command in commands
    ):
        return ValidationResponse(
            success=False,
            message=messages.get("invalid", "Autopilot routine is malformed."),
        )

    if (
        not isinstance(iterations, int)
        or iterations < iteration_constraints.get("min", 1)
        or iterations > iteration_constraints.get("max", 20)
    ):
        return ValidationResponse(
            success=False,
            message=messages.get(
                "incomplete",
                "The service drone is still missing commands or loop cycles.",
            ),
        )

    repaired_panels: set[tuple[int, int]] = set()
    turn_left = {"UP": "LEFT", "LEFT": "DOWN", "DOWN": "RIGHT", "RIGHT": "UP"}
    turn_right = {"UP": "RIGHT", "RIGHT": "DOWN", "DOWN": "LEFT", "LEFT": "UP"}
    deltas = {"UP": (-1, 0), "DOWN": (1, 0), "LEFT": (0, -1), "RIGHT": (0, 1)}
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0

    def is_blocked(next_row: int, next_col: int) -> bool:
        return (
            next_row < 0
            or next_row >= rows
            or next_col < 0
            or next_col >= cols
            or grid[next_row][next_col] == 1
        )

    for _ in range(iterations):
        for command in commands:
            if command == "TURN_LEFT":
                direction = turn_left[direction]
            elif command == "TURN_RIGHT":
                direction = turn_right[direction]
            elif command == "IF_BLOCKED_TURN_LEFT":
                delta_row, delta_col = deltas[direction]
                if is_blocked(row + delta_row, col + delta_col):
                    direction = turn_left[direction]
            elif command == "IF_BLOCKED_TURN_RIGHT":
                delta_row, delta_col = deltas[direction]
                if is_blocked(row + delta_row, col + delta_col):
                    direction = turn_right[direction]
            elif command == "REPAIR_IF_PANEL":
                if (row, col) in panels:
                    repaired_panels.add((row, col))
            elif command == "MOVE":
                delta_row, delta_col = deltas[direction]
                next_row, next_col = row + delta_row, col + delta_col
                if is_blocked(next_row, next_col):
                    return ValidationResponse(
                        success=False,
                        message=messages.get(
                            "wall",
                            "The drone collided with a sealed corridor bulkhead.",
                        ),
                    )
                row, col = next_row, next_col

            if (row, col) == exit_cell and repaired_panels == panels:
                return ValidationResponse(
                    success=True,
                    unlocks=schema.get("unlocks", []),
                )

    if repaired_panels != panels:
        return ValidationResponse(
            success=False,
            message=messages.get(
                "panels",
                "The drone reached the sector, but at least one repair panel is still offline.",
            ),
        )

    return ValidationResponse(
        success=False,
        message=messages.get(
            "failure",
            "The drone still fails to stabilize the merged corridor.",
        ),
    )


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
    "system_model": validate_system_model,
    "drone_program": validate_drone_program,
}

PROGRESS_HANDLERS: dict[
    str, Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]
] = {
    "signal_panels": get_signal_panel_progress,
    "decision_rules": get_decision_rule_progress,
}

CLUE_HANDLERS: dict[str, Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]] = {
    "signal_panels": get_signal_panel_clue,
}


def get_rule(
    validation_schema: dict[str, dict[str, dict[str, Any]]], request: ValidationRequest
) -> dict[str, Any]:
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

    return rule


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

    rule = get_rule(validation_schema, request)

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


@router.post("/progress", response_model=ProgressResponse)
def get_puzzle_progress(request: ValidationRequest):
    validation_schema = load_validation_schema()
    rule = get_rule(validation_schema, request)

    handler = PROGRESS_HANDLERS.get(rule.get("type"))
    if not handler:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"No progress handler is defined for level {request.levelId}.",
                "error_code": "PROGRESS_HANDLER_NOT_FOUND",
            },
        )

    return ProgressResponse(data=handler(rule, request.data))


@router.post("/clue", response_model=ClueResponse)
def get_puzzle_clue(request: ValidationRequest):
    validation_schema = load_validation_schema()
    rule = get_rule(validation_schema, request)

    handler = CLUE_HANDLERS.get(rule.get("type"))
    if not handler:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"No clue handler is defined for level {request.levelId}.",
                "error_code": "CLUE_HANDLER_NOT_FOUND",
            },
        )

    return ClueResponse(data=handler(rule, request.data))
