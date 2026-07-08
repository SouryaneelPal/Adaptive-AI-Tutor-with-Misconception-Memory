"""
evaluator_agent.py
------------------
Evaluator Agent for the Adaptive AI Tutor with Misconception Memory.

Role
====
Runs immediately after the Diagnostic Agent and before the Tutor Planner.
While the Diagnostic Agent classifies the *type* of error, the Evaluator
produces two orthogonal signals that the Tutor Planner needs to calibrate
its response:

    1. answer_quality  — a clean "correct / partially_correct / incorrect"
       verdict with a short reasoning note, independent of error type.

    2. confidence_score — 0.0–1.0, inferred from the student's linguistic
       hedges ("I think", "maybe", "not sure") vs confident assertions.
       A correct answer said with low confidence is still a gap; a wrong
       answer said with high confidence signals a deep misconception.

    3. mastery_signal — True if this response is positive evidence toward
       updating long-term mastery (e.g., correct + high confidence). The
       memory-update node reads this to decide whether to increment mastery.

This module is a single LangGraph node. It reads the shared state written
by diagnostic_agent.py's run_diagnostic node, enriches it, and passes it
forward to tutor_planner.py's run_tutor_planner node.

Tech stack: Python 3.10+, LangChain, Ollama (ChatOllama), Pydantic v2.
"""

from __future__ import annotations

import json
import logging
import os
from enum import Enum
from typing import Any, Optional

from dotenv import load_dotenv
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from pydantic import BaseModel, Field, field_validator

# --------------------------------------------------------------------------- #
# Environment & logging
# --------------------------------------------------------------------------- #

load_dotenv()

logger = logging.getLogger("evaluator_agent")
logging.basicConfig(level=logging.INFO)

DEFAULT_MODEL = os.getenv("EVALUATOR_AGENT_MODEL", "gemma4:e4b")
DEFAULT_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_TEMPERATURE = float(os.getenv("EVALUATOR_AGENT_TEMPERATURE", "0.1"))


# --------------------------------------------------------------------------- #
# Pydantic schema
# --------------------------------------------------------------------------- #

class AnswerQuality(str, Enum):
    CORRECT = "correct"
    PARTIALLY_CORRECT = "partially_correct"
    INCORRECT = "incorrect"


class EvaluatorResult(BaseModel):
    """
    Structured output from the Evaluator Agent.
    Written into the shared LangGraph state; consumed by tutor_planner.py
    and (eventually) the memory-update node.
    """

    answer_quality: AnswerQuality = Field(
        description=(
            "Overall verdict on the student's response: "
            "'correct' (right answer, right reasoning), "
            "'partially_correct' (right direction but incomplete or minor error), "
            "'incorrect' (wrong answer or fundamentally flawed reasoning)."
        )
    )
    quality_reasoning: str = Field(
        description=(
            "One sentence explaining the quality verdict — what specifically "
            "was right or wrong about the student's answer."
        )
    )
    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Estimated student confidence in their own answer, 0.0–1.0. "
            "Infer from hedging language ('I think', 'maybe', 'not sure' → low) "
            "vs direct assertions ('The answer is', 'I know that' → high). "
            "Neutral phrasing with no hedges → ~0.6."
        ),
    )
    confidence_reasoning: str = Field(
        description="One sentence explaining the confidence estimate."
    )
    mastery_signal: bool = Field(
        description=(
            "True if this response is positive evidence toward mastery of the "
            "current concept — i.e., answer_quality is 'correct' AND "
            "confidence_score >= 0.6. False otherwise."
        )
    )

    @field_validator("answer_quality", mode="before")
    @classmethod
    def _normalise_quality(cls, v: Any) -> Any:
        valid = [q.value for q in AnswerQuality]
        if not v or v not in valid:
            logger.warning("Evaluator returned invalid answer_quality %r; defaulting to 'incorrect'.", v)
            return AnswerQuality.INCORRECT.value
        return v

    @field_validator("confidence_score", mode="before")
    @classmethod
    def _clamp_confidence(cls, v: Any) -> float:
        try:
            return max(0.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            return 0.5

    @field_validator("mastery_signal", mode="before")
    @classmethod
    def _coerce_bool(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return bool(v)


# --------------------------------------------------------------------------- #
# Prompt template
# --------------------------------------------------------------------------- #

_SYSTEM_PROMPT = """\
You are the Evaluator Agent inside an Adaptive AI Tutor. Your ONLY job is to \
assess the QUALITY and CONFIDENCE of the student's response. You do NOT teach, \
hint, or decide what to do next — a separate Tutor Planner agent handles that.

You receive:
- `current_question`: the problem the student is solving.
- `current_concept`: the concept being taught.
- `student_response`: what the student wrote.
- `diagnostic_result`: how a Diagnostic Agent already classified the error \
  type (use this as additional context, but form your own quality/confidence \
  judgements from the raw student_response).

Your outputs:

1. `answer_quality` — one of:
   - "correct": the answer and reasoning are both right (minor phrasing ok).
   - "partially_correct": the right direction but incomplete, or correct answer
     with wrong/missing reasoning, or a small arithmetic slip on otherwise
     sound method.
   - "incorrect": wrong answer OR fundamentally flawed reasoning.

2. `quality_reasoning` — 1 sentence, specific. Say WHAT was right or wrong.

3. `confidence_score` — 0.0 to 1.0, inferred from linguistic cues:
   - Hedges ("I think", "maybe", "I'm not sure", "is it?", "?") → 0.1–0.4
   - Neutral, factual phrasing with no hedges → 0.5–0.7
   - Strong, direct assertions ("The answer is", "I know") → 0.8–1.0
   A correct answer with lots of hedging scores LOW confidence.

4. `confidence_reasoning` — 1 sentence explaining the confidence estimate.

5. `mastery_signal` — true ONLY when answer_quality == "correct" AND \
   confidence_score >= 0.6. False otherwise.

Respond ONLY with the structured JSON schema. No prose outside JSON.

CRITICAL: Return raw JSON only — no markdown code blocks, no preamble.

{format_instructions}
"""

_HUMAN_PROMPT = """\
Current concept being taught: {current_concept}

Current question the student is solving:
\"\"\"{current_question}\"\"\"

Student's most recent response:
\"\"\"{student_response}\"\"\"

Diagnostic Agent result (for additional context):
{diagnostic_result}

Evaluate the response now.
"""


def _build_prompt(parser: PydanticOutputParser) -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [("system", _SYSTEM_PROMPT), ("human", _HUMAN_PROMPT)]
    ).partial(format_instructions=parser.get_format_instructions())


# --------------------------------------------------------------------------- #
# Core agent logic
# --------------------------------------------------------------------------- #

class EvaluatorAgent:
    """
    Thin wrapper around Ollama LLM + prompt + parser for answer evaluation.
    Instantiate once and reuse across turns.
    """

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_BASE_URL,
        temperature: float = DEFAULT_TEMPERATURE,
    ) -> None:
        self.parser = PydanticOutputParser(pydantic_object=EvaluatorResult)
        self.prompt = _build_prompt(self.parser)
        self.llm = ChatOllama(
            model=model,
            base_url=base_url,
            temperature=temperature,
            format="json",
        )
        self.chain = self.prompt | self.llm | self.parser

    def evaluate(
        self,
        student_response: str,
        current_question: str,
        current_concept: str,
        diagnostic_result: dict[str, Any],
    ) -> EvaluatorResult:
        try:
            result: EvaluatorResult = self.chain.invoke(
                {
                    "student_response": student_response,
                    "current_question": current_question,
                    "current_concept": current_concept,
                    "diagnostic_result": json.dumps(diagnostic_result, indent=2),
                }
            )
            return result
        except Exception as exc:  # noqa: BLE001
            logger.exception("Evaluator agent failed: %s", exc)
            return EvaluatorResult(
                answer_quality=AnswerQuality.INCORRECT,
                quality_reasoning="Evaluation failed due to an internal error; defaulting to incorrect.",
                confidence_score=0.5,
                confidence_reasoning="Could not assess confidence due to evaluation error.",
                mastery_signal=False,
            )


_default_evaluator: Optional[EvaluatorAgent] = None


def _get_default_evaluator() -> EvaluatorAgent:
    global _default_evaluator
    if _default_evaluator is None:
        _default_evaluator = EvaluatorAgent()
    return _default_evaluator


# --------------------------------------------------------------------------- #
# LangGraph node entry point
# --------------------------------------------------------------------------- #

def run_evaluator(state: dict) -> dict:
    """
    LangGraph node function. Runs after diagnostic_node, before tutor_planner_node.

    Reads from state:
        - "student_response" (str): required
        - "current_question" (str): required
        - "current_concept" (str): required
        - "diagnostic_result" (dict): required (from run_diagnostic)

    Writes to state:
        - "evaluator_result" (dict): full EvaluatorResult as JSON-serializable dict
        - "answer_quality" (str): "correct" | "partially_correct" | "incorrect"
        - "confidence_score" (float): 0.0–1.0
        - "mastery_signal" (bool): positive mastery evidence flag
    """
    student_response = state.get("student_response")
    current_question = state.get("current_question")
    current_concept = state.get("current_concept")
    diagnostic_result = state.get("diagnostic_result", {}) or {}

    if not student_response or not current_question or not current_concept:
        raise ValueError(
            "run_evaluator requires 'student_response', 'current_question', "
            "and 'current_concept' in state."
        )

    evaluator = _get_default_evaluator()
    result = evaluator.evaluate(
        student_response=student_response,
        current_question=current_question,
        current_concept=current_concept,
        diagnostic_result=diagnostic_result,
    )

    logger.info(
        "Evaluation -> quality=%s, confidence=%.2f, mastery_signal=%s",
        result.answer_quality.value,
        result.confidence_score,
        result.mastery_signal,
    )

    state["evaluator_result"] = result.model_dump()
    state["answer_quality"] = result.answer_quality.value
    state["confidence_score"] = result.confidence_score
    state["mastery_signal"] = result.mastery_signal
    return state


# --------------------------------------------------------------------------- #
# Standalone test
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    """
    $ ollama serve
    $ python backend/agents/evaluator_agent.py
    """

    mock_diagnostic = {
        "is_correct": False,
        "error_type": "Conceptual",
        "identified_misconception": "Adds numerators and denominators directly.",
        "missing_prerequisite": None,
        "confidence": 0.85,
        "reasoning": "Student applied whole-number addition rules to fractions.",
        "recommended_strategy": "small_clue",
    }

    test_cases = [
        {
            "label": "Incorrect + low confidence",
            "student_response": "I think it's 2/5? I'm not really sure.",
            "current_question": "What is 1/2 + 1/3?",
            "current_concept": "Fraction Addition",
        },
        {
            "label": "Correct + high confidence",
            "student_response": "1/2 + 1/3 = 3/6 + 2/6 = 5/6.",
            "current_question": "What is 1/2 + 1/3?",
            "current_concept": "Fraction Addition",
        },
        {
            "label": "Partially correct + medium confidence",
            "student_response": "You need a common denominator. I think it's 5/6 but I'm not positive.",
            "current_question": "What is 1/2 + 1/3?",
            "current_concept": "Fraction Addition",
        },
        {
            "label": "Correct + low confidence (mastery_signal should be False)",
            "student_response": "Maybe 5/6? I kind of guessed.",
            "current_question": "What is 1/2 + 1/3?",
            "current_concept": "Fraction Addition",
        },
    ]

    agent = EvaluatorAgent()

    for case in test_cases:
        print("=" * 80)
        print(f"TEST: {case['label']}")
        print(f"Response: {case['student_response']!r}")

        fake_state = {
            "student_response": case["student_response"],
            "current_question": case["current_question"],
            "current_concept": case["current_concept"],
            "diagnostic_result": mock_diagnostic,
        }

        try:
            updated = run_evaluator(fake_state)
            print(json.dumps(updated["evaluator_result"], indent=2))
        except Exception as e:  # noqa: BLE001
            print(f"ERROR: {e}")

    print("=" * 80)
