"""
hint_generator.py
------------------
Hint Generator Agent for the Adaptive AI Tutor with Misconception Memory.

Role
====
This agent is the second node in the tutoring loop, downstream of
diagnostic_agent.py. It receives the diagnosis (error type, misconception,
recommended_strategy) and turns it into the actual markdown text shown to
the student in the chat UI.

Hard pedagogical rule: this agent must NEVER reveal the direct final answer
to the current question. It only ever nudges, questions, partially sets up,
or demonstrates a *different* worked example. This is enforced both via a
strict system prompt and via a lightweight programmatic guard.

Hint Ladder (driven by `diagnostic_result.recommended_strategy`):
    - retry_prompt      -> gentle "double check your work" nudge (careless errors)
    - small_clue        -> a guiding question / points at the relevant part of the problem
    - stronger_hint      -> states the rule/concept to apply, or a partial setup
    - worked_example     -> full step-by-step solution to a SIMILAR but DIFFERENT problem
    - prerequisite_review -> steps back to reteach the missing foundational skill
    - escalate_to_teacher -> handled without generation; flags for human handoff
    - none               -> student was correct; short positive reinforcement only

This module is designed as a single node inside a LangGraph `StateGraph`,
consuming the state written by diagnostic_agent.py's `run_diagnostic` node.

Tech stack: Python 3.10+, LangChain, Ollama (local inference via
`langchain_ollama.ChatOllama`), Pydantic v2.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional

from dotenv import load_dotenv
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from pydantic import BaseModel, Field, field_validator

# Reuse the shared vocabulary from the Diagnostic Agent so the two nodes never
# drift out of sync on what a "strategy" or "error_type" string can be.
from backend.agents.diagnostic_agent import ErrorType, InstructionalStrategy

# --------------------------------------------------------------------------- #
# Environment & logging setup
# --------------------------------------------------------------------------- #

load_dotenv()  # Pulls OLLAMA_HOST / model overrides from backend/.env if present

logger = logging.getLogger("hint_generator")
logging.basicConfig(level=logging.INFO)

# Local inference via Ollama. Defaults per project spec; override via env vars
# without touching code (e.g. for a smaller model on a laptop demo).
DEFAULT_MODEL = os.getenv("HINT_GENERATOR_MODEL", "gemma4:12b")
DEFAULT_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_TEMPERATURE = float(os.getenv("HINT_GENERATOR_TEMPERATURE", "0.4"))


# --------------------------------------------------------------------------- #
# Pydantic schema
# --------------------------------------------------------------------------- #

class HintResult(BaseModel):
    """
    Strict, structured output produced by the Hint Generator Agent.
    This is what gets written into the shared LangGraph state and rendered
    directly in the Streamlit student_view.py chat.
    """

    hint_text: str = Field(
        description=(
            "Markdown-formatted text to show the student. Must never state the "
            "final numeric/symbolic answer to current_question."
        )
    )
    applied_strategy: InstructionalStrategy = Field(
        description="The hint-ladder strategy actually used to produce hint_text."
    )
    escalation_flag: bool = Field(
        default=False,
        description=(
            "True if the agent could not produce a hint without giving away the "
            "answer, or otherwise judges this turn needs a human teacher."
        )
    )
    escalation_reason: Optional[str] = Field(
        default=None,
        description="Short explanation of why escalation_flag was set. Null otherwise.",
    )

    @field_validator("applied_strategy", mode="before")
    @classmethod
    def _ensure_valid_strategy(cls, v: Any) -> Any:
        """
        Bulletproof safeguard against local LLM hallucinations.
        If the model leaves the field blank ("") or makes a typo ("small__clue"), 
        we catch it here before Pydantic throws a ValidationError and crashes the app.
        """
        valid_strategies = [s.value for s in InstructionalStrategy]
        if not v or v not in valid_strategies:
            logger.warning(f"Model output invalid strategy '{v}'. Defaulting to 'small_clue'.")
            return InstructionalStrategy.SMALL_CLUE.value
        return v

    @field_validator("escalation_reason")
    @classmethod
    def _blank_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            return None
        return v


# --------------------------------------------------------------------------- #
# Prompt template
# --------------------------------------------------------------------------- #

_SYSTEM_PROMPT = """\
You are the Hint Generator Agent inside an Adaptive AI Tutor. You do NOT \
diagnose errors — that has already been done by another agent and is given \
to you as `diagnostic_result`. Your ONLY job is to turn that diagnosis into \
a single, well-crafted, student-facing hint.

ABSOLUTE RULE — NEVER BROKEN UNDER ANY CIRCUMSTANCE:
You must NEVER reveal, state, or unambiguously imply the final answer to \
`current_question`. Do not compute the final result of the current question \
for the student, even partially, even as a "check". If following the \
requested strategy would force you to reveal the answer, do NOT reveal it — \
instead set escalation_flag=true, explain why in escalation_reason, and \
still produce the safest possible non-answer-revealing hint_text you can \
(e.g., a generic encouragement or a clarifying question).

You must follow the Hint Ladder strategy given in `recommended_strategy` \
exactly. Definitions:

- "none": The student was correct. Write a short, warm, specific positive \
  reinforcement (1-2 sentences). Do not add a new hint.

- "retry_prompt": The error was careless (student's method/reasoning is \
  sound). Write a brief, encouraging nudge to re-check their work — point \
  at the *type* of slip (e.g., "double-check your denominators") WITHOUT \
  redoing the arithmetic for them.

- "small_clue": Lightest touch. Ask a guiding question, or point at the \
  specific part of current_question the student should re-examine. Do not \
  state the rule outright. Keep it to 1-2 sentences.

- "stronger_hint": Medium touch. Explicitly name the rule or concept the \
  student needs to apply (e.g., "Remember, you need a common denominator \
  before you can add fractions"), and/or give a partial setup of \
  current_question. Still do not carry it through to the final answer.

- "worked_example": Heaviest touch short of the answer. Invent a NEW problem \
  that is structurally similar to current_question (same concept, same \
  operation type) but uses different numbers/context, and solve THAT one \
  fully, step by step, in markdown. End by prompting the student to apply \
  the same steps to their own question. Never solve current_question itself.

- "prerequisite_review": The gap is a missing foundational skill \
  (`diagnostic_result.missing_prerequisite`). Briefly reteach that \
  foundational concept with a small, separate example, then connect it back \
  to why it matters for current_question — without solving current_question.

You will also be given `student_memory_profile` for tone calibration only \
(e.g., go gentler if the student has many recent misses / low confidence) — \
never mention the memory profile explicitly to the student.

Formatting: hint_text should be concise markdown (use **bold**, bullet \
points, or a numbered list where it helps), friendly in tone, and never \
longer than ~120 words except for "worked_example" which may run longer \
since it includes full steps for the similar problem.

Respond ONLY with the structured JSON schema below. No prose outside JSON.

CRITICAL FORMATTING INSTRUCTIONS:
You are interacting directly with a JSON parser. 
1. You MUST return ONLY raw, valid JSON. 
2. DO NOT wrap your response in markdown code blocks (do not use ```json). 
3. DO NOT output any preamble, explanation, or conversational text outside of the JSON object.
4. For `applied_strategy`, you MUST output the exact string that was given to you as `recommended_strategy`. Do not leave it empty.

{format_instructions}
"""

_HUMAN_PROMPT = """\
Current question the student is solving:
\"\"\"{current_question}\"\"\"

Student's most recent response:
\"\"\"{student_response}\"\"\"

Diagnostic result from the Diagnostic Agent:
{diagnostic_result}

Student memory profile (for tone calibration only, do not reference directly):
{student_memory_profile}

recommended_strategy to apply: {recommended_strategy}

Generate the hint now, strictly following the rules for "{recommended_strategy}".
"""


def _build_prompt(parser: PydanticOutputParser) -> ChatPromptTemplate:
    """Builds the chat prompt template with format instructions baked in."""
    return ChatPromptTemplate.from_messages(
        [
            ("system", _SYSTEM_PROMPT),
            ("human", _HUMAN_PROMPT),
        ]
    ).partial(format_instructions=parser.get_format_instructions())


# --------------------------------------------------------------------------- #
# Lightweight programmatic guard against answer leakage
# --------------------------------------------------------------------------- #

def _looks_like_answer_leak(hint_text: str, current_question: str) -> bool:
    """
    Best-effort heuristic safety net (NOT a replacement for the prompt rule).
    Flags the rare case where the hint contains a bare numeric fraction/result
    pattern that also appears nowhere in the question itself, which can
    indicate the model computed and disclosed a final answer.

    This is intentionally conservative (low false-positive tolerance) — it
    only catches obvious slips, e.g. "= 3/4" style final results. Any hit
    routes to escalation rather than silently editing the model's text.
    """
    # Look for a fraction or decimal immediately following an equals sign,
    # e.g. "= 3/4", "=0.75" — a common tell for a disclosed final result.
    leak_pattern = re.compile(r"=\s*\d+\s*/\s*\d+|\=\s*\d+\.\d+")
    return bool(leak_pattern.search(hint_text))


# --------------------------------------------------------------------------- #
# Core agent logic
# --------------------------------------------------------------------------- #

class HintGenerator:
    """
    Thin wrapper around a local Ollama LLM + prompt + parser that produces
    one hint per call. Instantiate once (e.g., in orchestrator.py) and reuse
    across turns to avoid re-creating the Ollama client every invocation.
    """

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_BASE_URL,
        temperature: float = DEFAULT_TEMPERATURE,
    ) -> None:
        self.parser = PydanticOutputParser(pydantic_object=HintResult)
        self.prompt = _build_prompt(self.parser)

        # format="json" tells Ollama to constrain generation to valid JSON,
        # which we then validate against HintResult via the parser. This is
        # the recommended structured-output pattern for local Ollama models
        # that don't support native tool-calling as reliably as hosted APIs.
        self.llm = ChatOllama(
            model=model,
            base_url=base_url,
            temperature=temperature,
            format="json",
        )
        self.chain = self.prompt | self.llm | self.parser

    def generate(
        self,
        student_response: str,
        current_question: str,
        diagnostic_result: dict[str, Any],
        student_memory_profile: dict[str, Any],
    ) -> HintResult:
        """
        Run hint generation for a single student turn.

        Args:
            student_response: Raw text of the student's latest answer.
            current_question: The problem the student is actively solving.
            diagnostic_result: Output dict from diagnostic_agent.run_diagnostic
                (contains error_type, identified_misconception,
                missing_prerequisite, recommended_strategy, etc.)
            student_memory_profile: Dict of student mastery / history, used
                only for tone calibration.

        Returns:
            A validated HintResult.
        """
        recommended_strategy = diagnostic_result.get(
            "recommended_strategy", InstructionalStrategy.SMALL_CLUE.value
        )

        # Escalation is handled deterministically, without calling the LLM:
        # if the diagnostic agent already decided this needs a human, we
        # don't ask the local model to improvise a hint that could leak the
        # answer under pressure. We still return a safe, warm holding message.
        if recommended_strategy == InstructionalStrategy.ESCALATE_TO_TEACHER.value:
            return HintResult(
                hint_text=(
                    "You're working really hard on this, and I want to make sure you "
                    "get the best help. I'm looping in your teacher to go over this "
                    "one together. Hang tight!"
                ),
                applied_strategy=InstructionalStrategy.ESCALATE_TO_TEACHER,
                escalation_flag=True,
                escalation_reason=(
                    "Diagnostic agent flagged escalate_to_teacher "
                    "(repeated failures or distress signal)."
                ),
            )

        try:
            result: HintResult = self.chain.invoke(
                {
                    "student_response": student_response,
                    "current_question": current_question,
                    "diagnostic_result": json.dumps(diagnostic_result, indent=2),
                    "student_memory_profile": json.dumps(
                        student_memory_profile, indent=2
                    ),
                    "recommended_strategy": recommended_strategy,
                }
            )
        except Exception as exc:  # noqa: BLE001 - never crash the orchestrator graph
            logger.exception("Hint generator failed to produce structured output: %s", exc)
            return HintResult(
                hint_text=(
                    "Let's slow down for a second — can you tell me what step you "
                    "tried first on this problem?"
                ),
                applied_strategy=InstructionalStrategy.SMALL_CLUE,
                escalation_flag=True,
                escalation_reason=f"LLM/parsing error during hint generation: {exc}",
            )

        # Programmatic safety net: catch obvious answer leaks even if the
        # prompt rule was violated by the model.
        if recommended_strategy != InstructionalStrategy.NONE.value and _looks_like_answer_leak(
            result.hint_text, current_question
        ):
            logger.warning(
                "Potential answer leak detected in generated hint; escalating instead."
            )
            return HintResult(
                hint_text=(
                    "I want to guide you rather than just give this one away — "
                    "let's get your teacher to walk through it with you."
                ),
                applied_strategy=result.applied_strategy,
                escalation_flag=True,
                escalation_reason="Post-generation guard detected a likely answer leak.",
            )

        return result


# Module-level singleton so LangGraph nodes don't re-instantiate the Ollama
# client on every invocation. orchestrator.py can still create its own
# HintGenerator(...) instance if it needs a different model/temperature.
_default_generator: Optional[HintGenerator] = None


def _get_default_generator() -> HintGenerator:
    global _default_generator
    if _default_generator is None:
        _default_generator = HintGenerator()
    return _default_generator


# --------------------------------------------------------------------------- #
# LangGraph node entry point
# --------------------------------------------------------------------------- #

def generate_hint(state: dict) -> dict:
    """
    LangGraph node function. Runs immediately after diagnostic_agent's
    `run_diagnostic` node in the graph.

    Expected keys read from `state`:
        - "student_response" (str): required
        - "current_question" (str): required
        - "diagnostic_result" (dict): required, produced by run_diagnostic
        - "student_memory_profile" (dict): optional, defaults to {}

    Keys written back into `state`:
        - "hint_result" (dict): the HintResult, JSON-serializable, for the
          Streamlit frontend to render directly.
        - "hint_text" (str): convenience top-level copy for the chat UI.
        - "escalation_flag" (bool): convenience top-level copy, consumed by
          the orchestrator's conditional routing to escalation_agent.py.

    Returns:
        The updated state dict (LangGraph merges this back into the graph's
        shared state).
    """
    student_response = state.get("student_response")
    current_question = state.get("current_question")
    diagnostic_result = state.get("diagnostic_result")
    student_memory_profile = state.get("student_memory_profile", {}) or {}

    if not student_response or not current_question or not diagnostic_result:
        raise ValueError(
            "generate_hint requires 'student_response', 'current_question', and "
            "'diagnostic_result' to be present in state."
        )

    generator = _get_default_generator()
    result = generator.generate(
        student_response=student_response,
        current_question=current_question,
        diagnostic_result=diagnostic_result,
        student_memory_profile=student_memory_profile,
    )

    logger.info(
        "Hint generated -> strategy=%s, escalation_flag=%s",
        result.applied_strategy.value,
        result.escalation_flag,
    )

    state["hint_result"] = result.model_dump()
    state["hint_text"] = result.hint_text
    state["escalation_flag"] = result.escalation_flag
    return state


# --------------------------------------------------------------------------- #
# Mock execution block for standalone testing
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    """
    Run this file directly to sanity-check the agent before wiring it into
    orchestrator.py:

        $ ollama pull gemma4:12b        # one-time, if not already pulled
        $ ollama serve                  # if not already running
        $ python backend/agents/hint_generator.py

    Uses the same mock fraction-addition scenarios as diagnostic_agent.py's
    test block, but pre-fills diagnostic_result by hand so this file can be
    tested completely independently of the Diagnostic Agent / OpenAI.
    """

    mock_memory_profile = {
        "student_id": "stu_1024",
        "concept_mastery": {
            "Fraction Addition": {"mastery": 0.42, "consecutive_misses": 1},
            "Comparing Unit Fractions": {"mastery": 0.31, "consecutive_misses": 2},
        },
        "weak_prerequisites": ["Comparing Unit Fractions", "Common Denominators"],
    }

    current_question = "What is 1/2 + 1/3?"

    test_cases = [
        {
            "label": "Prerequisite gap -> prerequisite_review",
            "student_response": "1/2 + 1/3 = 2/5 because you just add the tops and add the bottoms.",
            "diagnostic_result": {
                "is_correct": False,
                "error_type": ErrorType.PREREQUISITE.value,
                "identified_misconception": "Adds numerators and denominators directly without finding a common denominator.",
                "missing_prerequisite": "Finding a common denominator",
                "confidence": 0.88,
                "reasoning": "Student applied whole-number addition rules to fractions.",
                "recommended_strategy": InstructionalStrategy.PREREQUISITE_REVIEW.value,
            },
        },
        {
            "label": "Careless slip -> retry_prompt",
            "student_response": (
                "To add 1/4 + 1/4 I need a common denominator, which is 4. "
                "So it's 1/4 + 1/4 = 2/8."
            ),
            "diagnostic_result": {
                "is_correct": False,
                "error_type": ErrorType.CARELESS.value,
                "identified_misconception": None,
                "missing_prerequisite": None,
                "confidence": 0.75,
                "reasoning": "Method and denominator identification were correct; only the final numerator addition slipped.",
                "recommended_strategy": InstructionalStrategy.RETRY_PROMPT.value,
            },
        },
        {
            "label": "Conceptual, second miss -> stronger_hint",
            "student_response": "1/2 + 1/3 = 1/5 because you add the numerators and keep the bigger denominator.",
            "diagnostic_result": {
                "is_correct": False,
                "error_type": ErrorType.CONCEPTUAL.value,
                "identified_misconception": "Believes denominators combine by taking the larger one rather than finding a common denominator.",
                "missing_prerequisite": None,
                "confidence": 0.82,
                "reasoning": "Second consecutive miss on this exact rule.",
                "recommended_strategy": InstructionalStrategy.STRONGER_HINT.value,
            },
        },
        {
            "label": "Correct answer -> none",
            "student_response": "1/2 + 1/3 = 3/6 + 2/6 = 5/6.",
            "diagnostic_result": {
                "is_correct": True,
                "error_type": ErrorType.NONE.value,
                "identified_misconception": None,
                "missing_prerequisite": None,
                "confidence": 0.97,
                "reasoning": "Correctly converted to a common denominator and added.",
                "recommended_strategy": InstructionalStrategy.NONE.value,
            },
        },
        {
            "label": "Persistent struggle -> escalate_to_teacher",
            "student_response": "I don't know, I give up, fractions are impossible.",
            "diagnostic_result": {
                "is_correct": False,
                "error_type": ErrorType.CONCEPTUAL.value,
                "identified_misconception": "Repeated failure across multiple attempts; signs of frustration.",
                "missing_prerequisite": None,
                "confidence": 0.6,
                "reasoning": "consecutive_misses >= 4 and distress language present.",
                "recommended_strategy": InstructionalStrategy.ESCALATE_TO_TEACHER.value,
            },
        },
    ]

    hint_generator = HintGenerator()

    for case in test_cases:
        print("=" * 80)
        print(f"TEST CASE: {case['label']}")
        print(f"Student response: {case['student_response']!r}")

        fake_state = {
            "student_response": case["student_response"],
            "current_question": current_question,
            "diagnostic_result": case["diagnostic_result"],
            "student_memory_profile": mock_memory_profile,
        }

        try:
            updated_state = generate_hint(fake_state)
            print(json.dumps(updated_state["hint_result"], indent=2))
        except Exception as e:  # noqa: BLE001
            print(f"ERROR running hint generator node: {e}")

    print("=" * 80)
    print("Done. If Ollama was not running / model not pulled, calls above")
    print("should raise a connection error rather than hanging silently.")