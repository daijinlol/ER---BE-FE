import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from puzzles.logic import router as puzzle_router


def get_allowed_origins() -> list[str]:
    configured_origins = os.getenv("ALLOWED_ORIGINS")
    if configured_origins:
        return [
            origin.strip() for origin in configured_origins.split(",") if origin.strip()
        ]

    return [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]


app = FastAPI(title="Escape Room API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(puzzle_router, prefix="/api/puzzles", tags=["puzzles"])


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Escape Room Engine Backend Running"}
