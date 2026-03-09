from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.state_validation import router as state_router
from puzzles.logic import router as puzzle_router

app = FastAPI(title="Escape Room API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(state_router, prefix="/api/state", tags=["state"])
app.include_router(puzzle_router, prefix="/api/puzzles", tags=["puzzles"])

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Escape Room Engine Backend Running"}
