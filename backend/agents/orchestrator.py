"""
orchestrator.py
----------------
Tutor Orchestrator for the Adaptive AI Tutor with Misconception Memory.

Role
====
This module defines the LangGraph `StateGraph` that wires together the
individual agent nodes into a single tutoring turn:

    START -> diagnostic_node -> [route_after_diagnosis] -> hint_generator_node -> END
                                                         -> escalator_node     -> END

`diagnostic_node` wraps diagnostic_agent.run_diagnostic, which classifies the
student's response (Careless / Conceptual / Prerequisite / None) and decides
a `recommended_strategy`.

The conditional edge `route_after_diagnosis` inspects that strategy:
    - "escalate_to_teacher" -> `escalator` node (human handoff placeholder)
    - anything else         -> `hint_generator_node`, which wraps
                                hint_generator.generate_hint and produces the
                                actual student-facing `hint_text`.

This file only concerns itself with orchestration/routing. All diagnostic
and hint-generation logic lives in their respective agent modules, keeping
this graph definition thin and easy to extend later (e.g., adding
escalation_agent.py's real logic, or a memory-update node after hinting).

Tech stack: Python 3.10+, LangGraph.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from backend.agents.diagnostic_agent import InstructionalStrategy, run_diagnostic
from backend.agents.escalation_agent import run_escalation
from backend.agents.hint_generator import generate_hint

# --------------------------------------------------------------------------- #
# Logging setup
# --------------------------------------------------------------------------- #

logger = logging.getLogger("orchestrator")
logging.basicConfig(level=logging.INFO)


# --------------------------------------------------------------------------- #
# Graph state schema
# --------------------------------------------------------------------------- #

class TutorState(TypedDict, total=False):
    """
    Shared state passed between nodes in the tutoring graph.

    `total=False` because most fields (everything past student_memory_profile)
    is only populated as the graph progresses — the caller only needs to
    supply the first four fields when kicking off a turn; the rest are filled
    in by diagnostic_node and hint_generator_node as they run.
    """

    # --- Provided by the caller (frontend / session manager) at turn start ---
    current_question: str            # The problem the student is solving
    current_concept: str             # Topic being taught, e.g. "Fraction Addition"
    student_response: str            # Student's latest answer text
    student_memory_profile: dict     # Mastery levels, weak prerequisites, history

    # --- Populated by diagnostic_node (backend.agents.diagnostic_agent) ---
    diagnostic_result: dict          # Full DiagnosticResult, as a dict
    error_type: str                  # Convenience copy: "None" | "Careless" | "Conceptual" | "Prerequisite"
    recommended_strategy: str        # Convenience copy: drives routing + hint ladder

    # --- Populated by hint_generator_node (backend.agents.hint_generator) ---
    hint_result: dict                # Full HintResult, as a dict
    hint_text: str                   # Markdown text to render in the student chat
    escalation_flag: bool            # True if this turn needs a human teacher

    # --- Populated by escalator_node (backend.agents.escalation_agent) ---
    escalation_result: dict          # Full EscalationResult, as a dict
    teacher_summary: str             # Alert text rendered in teacher_dashboard.py


# --------------------------------------------------------------------------- #
# Node wrappers
# --------------------------------------------------------------------------- #
#
# LangGraph nodes are plain `state -> state` (or `state -> partial state
# update`) callables. diagnostic_agent.run_diagnostic and
# hint_generator.generate_hint already match this signature exactly, so we
# could register them directly. We still wrap them in thin named functions
# here so that:
#   1. Each node has a distinct, readable name in graph visualizations/traces.
#   2. We have a single place to add cross-cutting concerns later (timing,
#      tracing via Phoenix, retries) without touching the agent modules.
# --------------------------------------------------------------------------- #

def diagnostic_node(state: TutorState) -> TutorState:
    """Runs the Diagnostic Agent to classify the student's response."""
    logger.info("Entering diagnostic_node")
    updated_state = run_diagnostic(dict(state))
    return updated_state  # type: ignore[return-value]


def hint_generator_node(state: TutorState) -> TutorState:
    """Runs the Hint Generator Agent to produce the student-facing hint."""
    logger.info("Entering hint_generator_node")
    updated_state = generate_hint(dict(state))
    return updated_state  # type: ignore[return-value]


def escalator_node(state: TutorState) -> TutorState:
    """
    Runs the Escalation Agent (backend.agents.escalation_agent.run_escalation)
    to produce a teacher-facing alert summary and a student-facing holding
    message. Replaces the earlier placeholder that only printed a generic
    alert.

    Deliberately does NOT call the LLM-backed hint generator: once the
    Diagnostic Agent has decided a turn needs a teacher, we don't want an
    improvised hint risking an answer leak or a tone-deaf response.
    """
    logger.info("Entering escalator_node")
    updated_state = run_escalation(dict(state))
    return updated_state  # type: ignore[return-value]


# --------------------------------------------------------------------------- #
# Conditional routing
# --------------------------------------------------------------------------- #

def route_after_diagnosis(state: TutorState) -> str:
    """
    Conditional edge function evaluated right after diagnostic_node.

    Returns the name of the next node to visit:
        - "escalator"      if the diagnosis recommends escalating to a teacher
        - "hint_generator"  otherwise (the normal hint-ladder path)
    """
    strategy = state.get("recommended_strategy")
    if strategy == InstructionalStrategy.ESCALATE_TO_TEACHER.value:
        return "escalator"
    return "hint_generator"


# --------------------------------------------------------------------------- #
# Graph construction
# --------------------------------------------------------------------------- #

def build_tutor_graph() -> StateGraph:
    """
    Builds (but does not compile) the tutoring StateGraph. Exposed as its own
    function so tests or the eval harness (backend/evals) can inspect/extend
    the graph before compilation if needed.
    """
    graph = StateGraph(TutorState)

    # Register nodes
    graph.add_node("diagnostic_node", diagnostic_node)
    graph.add_node("hint_generator", hint_generator_node)
    graph.add_node("escalator", escalator_node)

    # Entry point
    graph.add_edge(START, "diagnostic_node")

    # Conditional branch out of diagnosis
    graph.add_conditional_edges(
        "diagnostic_node",
        route_after_diagnosis,
        {
            "escalator": "escalator",
            "hint_generator": "hint_generator",
        },
    )

    # Both branches terminate the turn
    graph.add_edge("hint_generator", END)
    graph.add_edge("escalator", END)

    return graph


def compile_tutor_app():
    """Builds and compiles the graph into an executable LangGraph app."""
    return build_tutor_graph().compile()


# Module-level compiled app, ready to import elsewhere (e.g., frontend/app.py
# or backend/evals for scripted test runs):
#
#   from backend.agents.orchestrator import tutor_app
#   result_state = tutor_app.invoke(initial_state)
#
tutor_app = compile_tutor_app()


# --------------------------------------------------------------------------- #
# Mock execution block for standalone testing
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    """
    Run this file directly to test the full diagnostic -> hint (or escalate)
    loop end-to-end:

        $ python backend/agents/orchestrator.py

    Requires:
        - OPENAI_API_KEY set (diagnostic_agent.py uses ChatOpenAI)
        - Ollama running locally with the configured model pulled
          (hint_generator.py uses ChatOllama)
    """

    mock_memory_profile = {
        "student_id": "stu_1024",
        "concept_mastery": {
            "Fraction Addition": {"mastery": 0.42, "consecutive_misses": 1},
            "Comparing Unit Fractions": {"mastery": 0.31, "consecutive_misses": 2},
        },
        "weak_prerequisites": ["Comparing Unit Fractions", "Common Denominators"],
        "recent_attempts": [
            {"concept": "Fraction Addition", "correct": False},
        ],
    }

    def run_turn(label: str, initial_state: TutorState) -> None:
        """Invokes the compiled graph once and pretty-prints the outcome."""
        print("=" * 80)
        print(f"TEST CASE: {label}")
        print(f"Question: {initial_state['current_question']}")
        print(f"Student response: {initial_state['student_response']!r}")
        print("=" * 80)

        # `invoke` runs the graph to completion and returns the final state.
        # Use `tutor_app.stream(initial_state)` instead if you want to watch
        # each node's output as it happens (useful for debugging routing).
        final_state = tutor_app.invoke(initial_state)

        print("\n--- Diagnostic Result ---")
        print(json.dumps(final_state.get("diagnostic_result", {}), indent=2))

        if "escalation_result" in final_state:
            print("\n--- Escalation Path Taken ---")
            print(json.dumps(final_state["escalation_result"], indent=2))
        else:
            print("\n--- Hint Result ---")
            print(json.dumps(final_state.get("hint_result", {}), indent=2))

        print("\n--- Final hint_text shown to student ---")
        print(final_state.get("hint_text", "<no hint generated>"))

        print("\n--- escalation_flag ---")
        print(final_state.get("escalation_flag", False))
        print()

    # Scenario 1: routine conceptual error -> should take the hint_generator path
    run_turn(
        "Conceptual error, normal hint-ladder path",
        {
            "current_question": "What is 1/2 + 1/3?",
            "current_concept": "Fraction Addition",
            "student_response": "1/2 + 1/3 = 2/5 because you just add the tops and add the bottoms.",
            "student_memory_profile": mock_memory_profile,
        },
    )

    # Scenario 2: persistent failure + distress -> should route to escalator_node
    escalation_memory_profile = {
        "student_id": "stu_1024",
        "concept_mastery": {
            "Fraction Addition": {"mastery": 0.22, "consecutive_misses": 4},
        },
        "weak_prerequisites": ["Comparing Unit Fractions", "Common Denominators"],
        "recent_attempts": [
            {"concept": "Fraction Addition", "correct": False},
            {"concept": "Fraction Addition", "correct": False},
            {"concept": "Fraction Addition", "correct": False},
            {"concept": "Fraction Addition", "correct": False},
        ],
    }
    run_turn(
        "Persistent failure + distress, escalation path",
        {
            "current_question": "What is 1/2 + 1/3?",
            "current_concept": "Fraction Addition",
            "student_response": "I give up, this makes no sense.",
            "student_memory_profile": escalation_memory_profile,
        },
    )