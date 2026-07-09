"""
backend/api/main.py
FastAPI app — quiz attempt logging + learning curve endpoints.

Run with:
    uvicorn backend.api.main:app --reload --port 8000
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Literal

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.memory.student_profile import (
    create_tables,
    get_db,
    insert_attempt,
    get_learning_curve,
    get_summary,
)

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Adaptive AI Tutor API",
    description="Quiz attempt logging and learning analytics for the Pixel Tutor app.",
    version="1.0.0",
)

# CORS — allow the Vite dev server origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
@app.on_event("startup")
def startup_event() -> None:
    create_tables()


# ── Pydantic schemas ─────────────────────────────────────────────────────────
class AttemptIn(BaseModel):
    student_id: str
    concept: str
    question_id: str
    correct: bool
    time_taken_ms: int
    hint_used: bool = False


class AttemptOut(BaseModel):
    id: int
    student_id: str
    concept: str
    question_id: str
    correct: bool
    time_taken_ms: int
    hint_used: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LearningCurvePoint(BaseModel):
    label: str
    accuracy_pct: float
    avg_time_ms: int
    attempts: int


class StudentSummary(BaseModel):
    rolling_accuracy: float
    rolling_avg_time_ms: int
    streak: int


# ── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    """Simple liveness probe."""
    return {"status": "ok", "service": "pixel-tutor-api"}


@app.post("/api/attempts", response_model=AttemptOut, status_code=201)
def create_attempt(
    body: AttemptIn,
    db: Session = Depends(get_db),
) -> AttemptOut:
    """
    Record a single quiz attempt.

    Body:
        student_id, concept, question_id, correct, time_taken_ms, hint_used
    """
    attempt = insert_attempt(
        db,
        student_id=body.student_id,
        concept=body.concept,
        question_id=body.question_id,
        correct=body.correct,
        time_taken_ms=body.time_taken_ms,
        hint_used=body.hint_used,
    )
    return attempt


@app.get(
    "/api/students/{student_id}/learning-curve",
    response_model=List[LearningCurvePoint],
)
def learning_curve(
    student_id: str,
    bucket: Literal["session", "day"] = Query("session"),
    db: Session = Depends(get_db),
) -> List[LearningCurvePoint]:
    """
    Returns a time-ordered series for plotting accuracy trend.

    Query params:
        bucket = 'session' (every 5 attempts) | 'day' (calendar day)
    """
    data = get_learning_curve(db, student_id=student_id, bucket=bucket)
    return data


@app.get(
    "/api/students/{student_id}/summary",
    response_model=StudentSummary,
)
def student_summary(
    student_id: str,
    db: Session = Depends(get_db),
) -> StudentSummary:
    """
    Returns rolling accuracy, rolling avg time, and day streak.
    Based on the student's last 20 attempts.
    """
    summary = get_summary(db, student_id=student_id)
    return summary
