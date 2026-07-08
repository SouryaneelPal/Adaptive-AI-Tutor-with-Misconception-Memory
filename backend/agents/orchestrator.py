"""
orchestrator.py
----------------
Tutor Orchestrator — wires all 4 agents into a single LangGraph StateGraph.

Graph topology
==============

    START
      │
      ▼
  diagnostic_node          (classifies error type + recommends strategy)
      │
      ▼
  [route_after_diagnosis]
      ├── "escalate_to_teacher" ──► escalator_node ──► END
      │
      └── everything else ──► evaluator_node          (scores quality + confidence)
                                    │
                                    ▼
                              tutor_planner_node       (generates hint / practice Q)
                                    │
                                    ▼
                                   END

Agent responsibilities
======================
  diagnostic_node     — DiagnosticAgent: classifies error (Careless/Conceptual/
                         Prerequisite/None) and sets recommended_strategy.
  evaluator_node      — EvaluatorAgent: scores answer_quality and confidence_score;
                         sets mastery_signal for the memory-update layer.
  tutor_planner_node  — TutorPlannerAgent: uses BOTH diagnostic + evaluator results
                         to generate the student-facing hint and optional practice
                         question. Replaces the old hint_generator node.
  escalator_node      — EscalationAgent: only runs on the escalation branch;
                         produces teacher_summary + student holding message.

Tech stack: Python 3.10+, LangGraph.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from backend.agents.diagnostic_agent import InstructionalStrategy, run_diagnostic
from backend.agents.evaluator_agent import run_evaluator
from backend.agents.tutor_planner import run_tutor_planner
from backend.agents.escalation_agent import run_escalation

# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #

logger = logging.getLogger("orchestrator")
logging.basicConfig(level=logging.INFO)


# --------------------------------------------------------------------------- #
# Shared graph state schema
# --------------------------------------------------------------------------- #

class TutorState(TypedDict, total=False):
    """
    All fields that flow through the tutoring graph for one student turn.
    `total=False` — callers only need to supply the first four; agents fill
    the rest as the graph progresses.
    """

    # --- Provided by caller at turn start ---
    current_question: str           # The problem the student is solving
    current_concept: str            # Topic being taught, e.g. "Probability"
    student_response: str           # Student's latest answer text
    student_memory_profile: dict    # Mastery levels, weak prerequisites, history

    # --- Written by diagnostic_node ---
    diagnostic_result: dict         # Full DiagnosticResult as dict
    error_type: str                 # "None" | "Careless" | "Conceptual" | "Prerequisite"
    recommended_strategy: str       # Drives routing + hint ladder

    # --- Written by evaluator_node ---
    evaluator_result: dict          # Full EvaluatorResult as dict
    answer_quality: str             # "correct" | "partially_correct" | "incorrect"
    confidence_score: float         # 0.0–1.0
    mastery_signal: bool            # True if positive mastery evidence

    # --- Written by tutor_planner_node ---
    tutor_plan_result: dict         # Full TutorPlanResult as dict
    hint_text: str                  # Student-facing tutoring response (markdown)
    practice_question: Optional[str]  # Follow-up practice Q, or None
    escalation_flag: bool           # True if this turn needs a human teacher

    # --- Written by escalator_node ---
    escalation_result: dict         # Full EscalationResult as dict
    teacher_summary: str            # Alert text for teacher_dashboard.py


# --------------------------------------------------------------------------- #
# Node wrappers
# --------------------------------------------------------------------------- #

def diagnostic_node(state: TutorState) -> TutorState:
    """Classifies the student's response and sets recommended_strategy."""
    logger.info(">diagnostic_node")
    return run_diagnostic(dict(state))  # type: ignore[return-value]


def evaluator_node(state: TutorState) -> TutorState:
    """Scores answer quality and student confidence."""
    logger.info(">evaluator_node")
    return run_evaluator(dict(state))  # type: ignore[return-value]


def tutor_planner_node(state: TutorState) -> TutorState:
    """Generates the student-facing hint / practice question."""
    logger.info(">tutor_planner_node")
    return run_tutor_planner(dict(state))  # type: ignore[return-value]


def escalator_node(state: TutorState) -> TutorState:
    """Produces teacher alert summary + student holding message."""
    logger.info(">escalator_node")
    return run_escalation(dict(state))  # type: ignore[return-value]


# --------------------------------------------------------------------------- #
# Conditional routing
# --------------------------------------------------------------------------- #

def route_after_diagnosis(state: TutorState) -> str:
    """
    After diagnostic_node: escalate immediately if the diagnostic says so,
    otherwise continue to evaluator -> tutor_planner.
    """
    strategy = state.get("recommended_strategy")
    if strategy == InstructionalStrategy.ESCALATE_TO_TEACHER.value:
        logger.info("route -> escalator (strategy=escalate_to_teacher)")
        return "escalator"
    logger.info("route -> evaluator (strategy=%s)", strategy)
    return "evaluator"


# --------------------------------------------------------------------------- #
# Graph construction
# --------------------------------------------------------------------------- #

def build_tutor_graph() -> StateGraph:
    """
    Builds (but does not compile) the 4-agent tutoring StateGraph.
    Exposed separately so tests/evals can inspect the graph before compilation.
    """
    graph = StateGraph(TutorState)

    # Register all nodes
    graph.add_node("diagnostic_node", diagnostic_node)
    graph.add_node("evaluator", evaluator_node)
    graph.add_node("tutor_planner", tutor_planner_node)
    graph.add_node("escalator", escalator_node)

    # Entry point
    graph.add_edge(START, "diagnostic_node")

    # Branch after diagnosis
    graph.add_conditional_edges(
        "diagnostic_node",
        route_after_diagnosis,
        {
            "escalator": "escalator",
            "evaluator": "evaluator",
        },
    )

    # Normal path: evaluator -> tutor_planner -> end
    graph.add_edge("evaluator", "tutor_planner")
    graph.add_edge("tutor_planner", END)

    # Escalation path ends immediately after alert
    graph.add_edge("escalator", END)

    return graph


def compile_tutor_app():
    """Builds and compiles the graph into an executable LangGraph app."""
    return build_tutor_graph().compile()


# Module-level compiled app — import this elsewhere:
#   from backend.agents.orchestrator import tutor_app
#   result_state = tutor_app.invoke(initial_state)
tutor_app = compile_tutor_app()


# --------------------------------------------------------------------------- #
# End-to-end test block
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    """
    Run all four scenarios end-to-end:

        $ ollama serve                        # Ollama must be running
        $ python backend/agents/orchestrator.py

    Requires gemma4:12b (or whatever DIAGNOSTIC_AGENT_MODEL etc. are set to)
    to be pulled in Ollama.
    """

    base_memory = {
        "student_id": "stu_1024",
        "concept_mastery": {
            "Fraction Addition": {"mastery": 0.42, "consecutive_misses": 1},
            "Comparing Unit Fractions": {"mastery": 0.31, "consecutive_misses": 2},
        },
        "weak_prerequisites": ["Comparing Unit Fractions", "Common Denominators"],
        "recent_attempts": [{"concept": "Fraction Addition", "correct": False}],
    }

    escalation_memory = {
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

    scenarios = [
        {
            "label": "Scenario 1 — Conceptual error, normal path (diagnostic -> evaluator -> tutor_planner)",
            "state": {
                "current_question": "What is 1/2 + 1/3?",
                "current_concept": "Fraction Addition",
                "student_response": "1/2 + 1/3 = 2/5 because you add the tops and bottoms.",
                "student_memory_profile": base_memory,
            },
        },
        {
            "label": "Scenario 2 — Correct but low confidence (evaluator should flag; planner should strengthen)",
            "state": {
                "current_question": "What is 1/2 + 1/3?",
                "current_concept": "Fraction Addition",
                "student_response": "Maybe 5/6? I think I need a common denominator but I'm not sure.",
                "student_memory_profile": base_memory,
            },
        },
        {
            "label": "Scenario 3 — Careless slip",
            "state": {
                "current_question": "What is 1/4 + 1/4?",
                "current_concept": "Fraction Addition",
                "student_response": "1/4 + 1/4 = 2/8.",
                "student_memory_profile": base_memory,
            },
        },
        {
            "label": "Scenario 4 — Persistent failure + distress -> escalation path",
            "state": {
                "current_question": "What is 1/2 + 1/3?",
                "current_concept": "Fraction Addition",
                "student_response": "I give up, I hate fractions, this is impossible.",
                "student_memory_profile": escalation_memory,
            },
        },
    ]

    def _run(label: str, initial_state: dict) -> None:
        print("\n" + "=" * 80)
        print(f"  {label}")
        print(f"  Student: {initial_state['student_response']!r}")
        print("=" * 80)

        final = tutor_app.invoke(initial_state)

        print(f"\n[diagnostic]  error_type={final.get('error_type')}  "
              f"strategy={final.get('recommended_strategy')}")

        if "evaluator_result" in final:
            ev = final["evaluator_result"]
            print(f"[evaluator]   quality={ev.get('answer_quality')}  "
                  f"confidence={ev.get('confidence_score'):.2f}  "
                  f"mastery_signal={ev.get('mastery_signal')}")

        if "escalation_result" in final:
            print("\n[ESCALATION]")
            print(f"  teacher_summary : {final.get('teacher_summary')}")
        else:
            print(f"\n[tutor_planner] strategy={final.get('tutor_plan_result', {}).get('applied_strategy')}")
            if final.get("practice_question"):
                print(f"  practice_question: {final['practice_question']}")

        print(f"\n[hint_text shown to student]\n{final.get('hint_text', '<none>')}")

    for scenario in scenarios:
        try:
            _run(scenario["label"], scenario["state"])
        except Exception as exc:
            print(f"\nERROR in {scenario['label']}: {exc}")

    print("\n" + "=" * 80)
    print("Done.")
