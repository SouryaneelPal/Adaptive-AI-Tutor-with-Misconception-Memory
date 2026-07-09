import streamlit as st
import datetime

from backend.agents.orchestrator import tutor_app
from backend.agents.tutor_planner import run_explain
from backend.memory.student_graph_store import load_student_profile
from backend.memory.conversation_store import save_message, get_recent_messages

# --- Page Configuration ---
st.set_page_config(
    page_title="Adaptive AI Tutor",
    page_icon="🧠",
    layout="wide",
)

# Stable identity key used for both the Neo4j mastery graph and the SQL
# conversation transcript. A future multi-user version would derive this
# from an actual login; for now every session is "demo_student".
STUDENT_ID = "demo_student"

# --- Lightweight styling ---
st.markdown(
    """
    <style>
        .block-container { padding-top: 2rem; }
        .stChatMessage { border-radius: 12px; }
        div[data-testid="stMetric"] {
            background: #f7f9fc;
            border: 1px solid #e6eaf0;
            padding: 14px 16px;
            border-radius: 12px;
        }
        .pill {
            display: inline-block; padding: 2px 10px; border-radius: 999px;
            font-size: 0.75rem; font-weight: 600; margin-left: 6px;
        }
        .pill-ok   { background:#e5f6ea; color:#1a7f37; }
        .pill-warn { background:#fdecea; color:#b42318; }
        .pill-info { background:#e8f0fe; color:#1a56db; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("🧠 Adaptive AI Tutor with Misconception Memory")

DEFAULT_GREETING = [{"role": "assistant", "content": "Hi! What would you like to learn today?"}]

# --- Session State: chat — hydrate from the SQL conversation store if this
# student has prior history; otherwise fall back to the default greeting. ---
if "messages" not in st.session_state:
    history = get_recent_messages(STUDENT_ID)
    st.session_state.messages = (
        [{"role": m["role"], "content": m["content"]} for m in history]
        if history
        else DEFAULT_GREETING
    )

# --- Session State: student memory profile — loaded from the Neo4j mastery
# graph (falls back to a fresh empty-shaped profile if Neo4j is unreachable
# or this student has no data yet). ---
if "memory_profile" not in st.session_state:
    st.session_state.memory_profile = load_student_profile(STUDENT_ID)

# --- Session State: the specific problem currently being worked on. None
# means the student's next message is a fresh question, not an answer to
# anything — see the explain-mode branch below. ---
if "active_question" not in st.session_state:
    st.session_state.active_question = None

# --- Session State: last turn's raw result (for internals + teacher view) ---
if "last_final_state" not in st.session_state:
    st.session_state.last_final_state = {}

# --- Session State: running log of escalations this session ---
if "escalation_log" not in st.session_state:
    st.session_state.escalation_log = []


# =====================================================================
# SIDEBAR — session controls + internals toggle
# =====================================================================
with st.sidebar:
    st.subheader("⚙️ Session")
    current_concept = st.text_input(
        "Current Topic",
        value="Fractions",
        placeholder="e.g. Probability, Fractions, Algebra...",
        help="Set the concept the student is currently studying.",
    )

    show_internals = st.toggle(
        "🔬 Show tutor internals",
        value=False,
        help="Reveal memory profile, diagnostics, and which agent handled the last turn.",
    )

    if st.button("🔄 Reset session"):
        # Resets this browser session's view only — does not delete the
        # student's persisted mastery graph (Neo4j) or conversation history
        # (SQL); reloading the page will bring both back.
        st.session_state.messages = DEFAULT_GREETING
        st.session_state.memory_profile = {
            "student_id": STUDENT_ID,
            "concept_mastery": {},
            "weak_prerequisites": [],
            "recent_attempts": [],
        }
        st.session_state.last_final_state = {}
        st.session_state.escalation_log = []
        st.session_state.active_question = None
        st.rerun()

    if show_internals:
        st.divider()
        st.caption("🧠 Live memory profile")
        st.json(st.session_state.memory_profile)

        last = st.session_state.last_final_state
        if last:
            if last.get("explain_mode"):
                st.caption("💬 Last explanation")
                st.json(last.get("tutor_plan_result", {}))
                path = "explain mode (open question, no grading)"
            else:
                st.caption("🩺 Last evaluation")
                st.json(last.get("evaluator_result", {}))
                if "diagnostic_result" in last:
                    st.caption("🔍 Last diagnostic")
                    st.json(last.get("diagnostic_result", {}))

                # Which path ran last turn?
                if "escalation_result" in last:
                    path = "evaluator → diagnostic → escalator"
                elif "diagnostic_result" in last:
                    path = "evaluator → diagnostic → tutor_planner (hint)"
                else:
                    path = "evaluator → tutor_planner (praise)"
            st.caption("🧭 Agent path (last turn)")
            st.code(path, language=None)


# =====================================================================
# TABS
# =====================================================================
tab_student, tab_teacher = st.tabs(["🎓 Student Workspace", "📊 Teacher Dashboard"])


# ---------------------------------------------------------------------
# Helper: pull the graph's memory-update result into session state
# ---------------------------------------------------------------------
def update_memory_from_turn(final_state: dict, concept: str, student_msg: str) -> None:
    # The graph's memory_update node (backend/memory/student_profile.py) has
    # already folded this turn's outcome into student_memory_profile — just
    # adopt it. Profile mutation itself lives in the graph now, not here.
    updated_profile = final_state.get("student_memory_profile")
    if updated_profile:
        st.session_state.memory_profile = updated_profile

    # Escalation-log table is a session-scoped UI concern, not part of the
    # durable profile, so it's still built here.
    if "escalation_result" in final_state:
        concept_entry = st.session_state.memory_profile.get("concept_mastery", {}).get(
            concept, {}
        )
        st.session_state.escalation_log.append(
            {
                "Time": datetime.datetime.now().strftime("%H:%M:%S"),
                "Topic": concept,
                "Trigger": final_state.get("teacher_summary", "Escalation triggered")[:80],
                "Misses": concept_entry.get("consecutive_misses", 0),
            }
        )


# =====================================================================
# TAB 1 — STUDENT WORKSPACE
# =====================================================================
with tab_student:
    st.header("Active Learning Session")

    chat_container = st.container(height=440)
    with chat_container:
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

    if prompt := st.chat_input("Ask a question (e.g., Why is 1/2 bigger than 1/3?)"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with chat_container:
            with st.chat_message("user"):
                st.markdown(prompt)

        save_message(STUDENT_ID, "user", prompt, concept=current_concept)

        with st.spinner("Thinking..."):
            try:
                if st.session_state.active_question is None:
                    # Nothing posed yet — this is an open question, not an
                    # answer to grade. Explain mode skips Evaluator/Diagnostic
                    # entirely and poses the next problem itself.
                    result = run_explain(
                        current_concept=current_concept,
                        student_question=prompt,
                        student_memory_profile=st.session_state.memory_profile,
                    )
                    final_state = {"explain_mode": True, **result}
                    st.session_state.last_final_state = final_state

                    tutor_response = result["hint_text"]
                    if result.get("practice_question"):
                        tutor_response += f"\n\n**Try this:** {result['practice_question']}"
                        st.session_state.active_question = result["practice_question"]

                else:
                    # Answering a posed problem — run the full
                    # evaluator -> diagnostic -> hint-ladder pipeline.
                    initial_state = {
                        "student_id": STUDENT_ID,
                        "current_question": st.session_state.active_question,
                        "current_concept": current_concept,
                        "student_response": prompt,
                        "student_memory_profile": st.session_state.memory_profile,
                    }
                    final_state = tutor_app.invoke(initial_state)
                    st.session_state.last_final_state = final_state

                    tutor_response = (
                        final_state.get("hint_text")
                        or final_state.get("teacher_summary")
                        or "I'm not sure how to respond to that — could you rephrase?"
                    )
                    if final_state.get("practice_question"):
                        tutor_response += f"\n\n**Try this:** {final_state['practice_question']}"
                        st.session_state.active_question = final_state["practice_question"]
                    # else: no new question was generated (retry_prompt / small_clue /
                    # stronger_hint / escalation) — keep active_question as-is, so the
                    # student's next reply is still evaluated against the SAME
                    # problem and the hint ladder can escalate.

                    update_memory_from_turn(final_state, current_concept, prompt)

            except Exception as exc:
                tutor_response = f"⚠️ Tutor error: {exc}"

        save_message(STUDENT_ID, "assistant", tutor_response, concept=current_concept)

        st.session_state.messages.append({"role": "assistant", "content": tutor_response})
        with chat_container:
            with st.chat_message("assistant"):
                st.markdown(tutor_response)

        # If internals are on, surface the agent path inline too
        if show_internals and st.session_state.last_final_state:
            last = st.session_state.last_final_state
            if last.get("explain_mode"):
                st.markdown('<span class="pill pill-info">Explained · new question posed</span>', unsafe_allow_html=True)
            elif "escalation_result" in last:
                st.markdown('<span class="pill pill-warn">Escalated to teacher</span>', unsafe_allow_html=True)
            elif "diagnostic_result" in last:
                q = last.get("evaluator_result", {}).get("answer_quality", "?")
                st.markdown(f'<span class="pill pill-info">Tutored · answer: {q}</span>', unsafe_allow_html=True)
            else:
                st.markdown('<span class="pill pill-ok">Correct · praised + next question</span>', unsafe_allow_html=True)


# =====================================================================
# TAB 2 — TEACHER DASHBOARD (live session data)
# =====================================================================
with tab_teacher:
    st.header("Classroom Monitoring & Escalations")

    profile = st.session_state.memory_profile
    concept_mastery = profile.get("concept_mastery", {})
    attempts = profile.get("recent_attempts", [])

    # --- Top metrics, derived from the live session ---
    total_attempts = len(attempts)
    correct_attempts = sum(1 for a in attempts if a.get("correct"))
    accuracy = f"{(correct_attempts / total_attempts * 100):.0f}%" if total_attempts else "—"
    num_escalations = len(st.session_state.escalation_log)

    col1, col2, col3 = st.columns(3)
    col1.metric("Attempts this session", total_attempts)
    col2.metric("Answer accuracy", accuracy)
    col3.metric("Escalations", num_escalations)

    st.divider()

    # --- Active escalations from THIS session ---
    st.subheader("🚨 Active Escalations (Requires Intervention)")
    if st.session_state.escalation_log:
        st.table(st.session_state.escalation_log)
    else:
        st.success("No escalations yet this session. ✅")

    colA, colB = st.columns(2)

    with colA:
        st.subheader("🧠 Concept Mastery & Misconceptions")
        if concept_mastery:
            rows = []
            for concept, data in concept_mastery.items():
                rows.append({
                    "Concept": concept,
                    "Mastery": f"{data.get('mastery', 0) * 100:.0f}%",
                    "Consecutive Misses": data.get("consecutive_misses", 0),
                })
            st.dataframe(rows, use_container_width=True)
        else:
            st.info("No concepts tracked yet — start a session in the Student tab.")

    with colB:
        st.subheader("📅 Weak Prerequisites Detected")
        weak = profile.get("weak_prerequisites", [])
        if weak:
            for wp in weak:
                st.markdown(f"- {wp}")
            st.info(
                "Recommended: schedule targeted revision on the prerequisites above "
                "before advancing the current topic."
            )
        else:
            st.info("No missing prerequisites detected yet.")
