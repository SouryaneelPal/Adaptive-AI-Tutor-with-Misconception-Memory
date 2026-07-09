"""
backend/memory/student_profile.py
SQLAlchemy model + helpers for quiz attempt persistence.
Uses SQLite for local dev (file: tutor.db in project root).
"""
from __future__ import annotations

import os
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from collections import defaultdict

from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, DateTime, Float, text
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ── Database setup ───────────────────────────────────────────────────────────
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./tutor.db")
engine = create_engine(
    DB_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DB_URL else {},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Model ────────────────────────────────────────────────────────────────────
class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id            = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id    = Column(String(128), nullable=False, index=True)
    concept       = Column(String(256), nullable=False)
    question_id   = Column(String(128), nullable=False)
    correct       = Column(Boolean, nullable=False, default=False)
    time_taken_ms = Column(Integer, nullable=False, default=0)
    hint_used     = Column(Boolean, nullable=False, default=False)
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)


def create_tables() -> None:
    """Create all tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:  # used as a FastAPI dependency
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Insert ───────────────────────────────────────────────────────────────────
def insert_attempt(
    db: Session,
    *,
    student_id: str,
    concept: str,
    question_id: str,
    correct: bool,
    time_taken_ms: int,
    hint_used: bool,
) -> QuizAttempt:
    attempt = QuizAttempt(
        student_id=student_id,
        concept=concept,
        question_id=question_id,
        correct=correct,
        time_taken_ms=time_taken_ms,
        hint_used=hint_used,
        created_at=datetime.utcnow(),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


# ── Learning curve ────────────────────────────────────────────────────────────
def get_learning_curve(
    db: Session,
    student_id: str,
    bucket: str = "session",
) -> List[Dict[str, Any]]:
    """
    Returns a time-ordered series of { label, accuracy_pct, avg_time_ms, attempts }.
    bucket='day'  → groups by calendar date
    bucket='session' → groups by session number (batches of 5 consecutive attempts)
    """
    rows = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.student_id == student_id)
        .order_by(QuizAttempt.created_at)
        .all()
    )

    if not rows:
        return []

    if bucket == "day":
        groups: Dict[str, list] = defaultdict(list)
        for r in rows:
            key = r.created_at.strftime("%Y-%m-%d")
            groups[key].append(r)
        result = []
        for label, attempts in groups.items():
            n = len(attempts)
            correct_n = sum(1 for a in attempts if a.correct)
            result.append({
                "label": label,
                "accuracy_pct": round(correct_n / n * 100, 1),
                "avg_time_ms": round(sum(a.time_taken_ms for a in attempts) / n),
                "attempts": n,
            })
        return sorted(result, key=lambda x: x["label"])

    # session bucket: every 5 attempts = 1 session
    SESSION_SIZE = 5
    result = []
    for i in range(0, len(rows), SESSION_SIZE):
        chunk = rows[i : i + SESSION_SIZE]
        n = len(chunk)
        correct_n = sum(1 for a in chunk if a.correct)
        sess_num = i // SESSION_SIZE + 1
        result.append({
            "label": f"S{sess_num}",
            "accuracy_pct": round(correct_n / n * 100, 1),
            "avg_time_ms": round(sum(a.time_taken_ms for a in chunk) / n),
            "attempts": n,
        })
    return result


# ── Summary ──────────────────────────────────────────────────────────────────
def get_summary(db: Session, student_id: str) -> Dict[str, Any]:
    """
    Returns rolling accuracy (last 20 attempts), rolling avg time, current streak.
    """
    recent = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.student_id == student_id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(20)
        .all()
    )

    if not recent:
        return {"rolling_accuracy": 0.0, "rolling_avg_time_ms": 0, "streak": 0}

    n = len(recent)
    correct_n = sum(1 for a in recent if a.correct)
    rolling_acc = round(correct_n / n * 100, 1)
    rolling_avg = round(sum(a.time_taken_ms for a in recent) / n)

    # Streak = consecutive correct-answer days (simplified: days with ≥1 attempt)
    all_attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.student_id == student_id)
        .order_by(QuizAttempt.created_at.desc())
        .all()
    )
    days_with_activity = sorted(
        {a.created_at.date() for a in all_attempts}, reverse=True
    )
    streak = 0
    prev = date.today()
    for d in days_with_activity:
        if (prev - d).days <= 1:
            streak += 1
            prev = d
        else:
            break

    return {
        "rolling_accuracy": rolling_acc,
        "rolling_avg_time_ms": rolling_avg,
        "streak": streak,
    }
