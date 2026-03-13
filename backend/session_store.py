import json
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints


router = APIRouter()

SESSION_STORE_PATH = Path(__file__).with_name(".session_store.json")
SESSION_STORE_LOCK = Lock()


CampaignIdentifier = StringConstraints(pattern=r"^[a-zA-Z0-9_-]{1,50}$")
SessionStatus = Literal["active", "failed", "completed"]


class CampaignSessionSnapshot(BaseModel):
    campaignId: str = Field(
        ..., min_length=1, max_length=50, pattern=r"^[a-zA-Z0-9_-]{1,50}$"
    )
    sessionId: str = Field(..., min_length=1, max_length=120)
    levelIndex: int = Field(..., ge=0)
    inventoryItems: list[str] = Field(default_factory=list)
    timeLeftSeconds: int = Field(..., ge=0)
    notes: str = ""
    roomInteractions: dict[str, list[str]] = Field(default_factory=dict)
    decisionOutcomes: dict[str, str] = Field(default_factory=dict)
    status: SessionStatus = "active"
    updatedAt: str = Field(..., min_length=1)


class TimerUpdateRequest(BaseModel):
    sessionId: str = Field(..., min_length=1, max_length=120)
    timeLeftSeconds: int = Field(..., ge=0)


def load_session_store() -> dict[str, CampaignSessionSnapshot]:
    if not SESSION_STORE_PATH.exists():
        return {}

    with SESSION_STORE_LOCK:
        with SESSION_STORE_PATH.open("r", encoding="utf-8") as store_file:
            raw_store = json.load(store_file)

    if not isinstance(raw_store, dict):
        return {}

    snapshots: dict[str, CampaignSessionSnapshot] = {}
    for campaign_id, raw_snapshot in raw_store.items():
        if not isinstance(raw_snapshot, dict):
            continue

        try:
            snapshot = CampaignSessionSnapshot.model_validate(raw_snapshot)
        except Exception:
            continue

        snapshots[campaign_id] = snapshot

    return snapshots


def save_session_store(store: dict[str, CampaignSessionSnapshot]) -> None:
    SESSION_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        campaign_id: snapshot.model_dump(mode="json")
        for campaign_id, snapshot in store.items()
    }

    with SESSION_STORE_LOCK:
        with SESSION_STORE_PATH.open("w", encoding="utf-8") as store_file:
            json.dump(payload, store_file, ensure_ascii=True, indent=2)


@router.get("", response_model=dict[str, CampaignSessionSnapshot])
def list_sessions() -> dict[str, CampaignSessionSnapshot]:
    return load_session_store()


@router.get("/{campaign_id}", response_model=CampaignSessionSnapshot)
def get_session(campaign_id: str) -> CampaignSessionSnapshot:
    store = load_session_store()
    snapshot = store.get(campaign_id)
    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"No stored session found for campaign {campaign_id}.",
                "error_code": "SESSION_NOT_FOUND",
            },
        )

    return snapshot


@router.put("/{campaign_id}", response_model=CampaignSessionSnapshot)
def put_session(
    campaign_id: str, snapshot: CampaignSessionSnapshot
) -> CampaignSessionSnapshot:
    if snapshot.campaignId != campaign_id:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Campaign id in the request path does not match the snapshot payload.",
                "error_code": "SESSION_CAMPAIGN_MISMATCH",
            },
        )

    store = load_session_store()
    store[campaign_id] = snapshot
    save_session_store(store)
    return snapshot


@router.patch("/{campaign_id}/timer", response_model=CampaignSessionSnapshot)
def patch_session_timer(
    campaign_id: str, timer_update: TimerUpdateRequest
) -> CampaignSessionSnapshot:
    store = load_session_store()
    snapshot = store.get(campaign_id)
    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"No stored session found for campaign {campaign_id}.",
                "error_code": "SESSION_NOT_FOUND",
            },
        )

    if snapshot.sessionId != timer_update.sessionId:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Timer update does not match the active stored session.",
                "error_code": "SESSION_CONFLICT",
            },
        )

    updated_snapshot = snapshot.model_copy(
        update={
            "timeLeftSeconds": timer_update.timeLeftSeconds,
        }
    )
    store[campaign_id] = updated_snapshot
    save_session_store(store)
    return updated_snapshot


@router.delete("/{campaign_id}")
def delete_session(campaign_id: str) -> dict[str, bool]:
    store = load_session_store()
    if campaign_id in store:
        del store[campaign_id]
        save_session_store(store)

    return {"deleted": True}
