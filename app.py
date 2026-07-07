import streamlit as st
import pandas as st_pandas
import datetime

# --- Page Configuration ---
st.set_page_config(page_title="Adaptive AI Tutor", layout="wide")
st.title("🧠 Adaptive AI Tutor with Misconception Memory")

# --- Initialize Session State for Chat ---
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Hi! What would you like to learn today?"}
    ]

# --- UI Layout: Tabs mapping to the Flowchart ---
tab_student, tab_teacher = st.tabs(["🎓 Student Workspace", "📊 Teacher Dashboard"])

# ==========================================
# TAB 1: STUDENT WORKSPACE (Flowchart Steps 1-7)
# ==========================================
with tab_student:
    st.header("Active Learning Session")
    
    # Simulating Flowchart Step 3 & 4: Profile Check & Misconception
    with st.sidebar:
        st.subheader("Student Profile (Hidden from student in prod)")
        st.info("**Current Topic:** Fractions\n\n**Known Weakness:** Division logic")
        st.success("**Confidence Score:** Moderate")

    # Chat Interface
    chat_container = st.container(height=400)
    with chat_container:
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

    # Flowchart Step 1: Student Ask
    if prompt := st.chat_input("Ask a question (e.g., Why is 1/2 bigger than 1/3?)"):
        # Display user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        with chat_container:
            with st.chat_message("user"):
                st.markdown(prompt)

        # Flowchart Step 2 & 5: Diagnostic & Tutor Plan (Simulated AI Response)
        # Notice it gives a hint, not a direct answer.
        tutor_response = (
            "That's a great question! Let's think about a pizza. 🍕 \n\n"
            "If you cut a pizza into 2 equal slices, and another identical pizza into 3 equal slices, "
            "which slice would be larger? What happens to the size of the pieces as you make more cuts?"
        )
        st.session_state.messages.append({"role": "assistant", "content": tutor_response})
        with chat_container:
            with st.chat_message("assistant"):
                st.markdown(tutor_response)


# ==========================================
# TAB 2: TEACHER DASHBOARD (Flowchart Steps 8-11)
# ==========================================
with tab_teacher:
    st.header("Classroom Monitoring & Escalations")
    
    # Flowchart Step 11: Teacher View (Progress & Risks)
    col1, col2, col3 = st.columns(3)
    col1.metric("Active Sessions", "24", "3")
    col2.metric("Average Learning Gain", "+18%", "Pre to Post Test")
    col3.metric("Escalations", "2", "-1", delta_color="inverse")

    st.divider()

    # Flowchart Step 8: Escalation (Teacher Handoff)
    st.subheader("🚨 Active Escalations (Requires Intervention)")
    escalation_data = [
        {"Student": "Alex M.", "Topic": "Fractions", "Trigger": "Repeated confusion (Failed 3 hints)", "Confidence": "Low", "Action": "Intervene"},
        {"Student": "Jamie T.", "Topic": "Calculus", "Trigger": "Frustration detected in text", "Confidence": "Low", "Action": "Intervene"}
    ]
    st.table(escalation_data)

    colA, colB = st.columns(2)
    
    with colA:
        # Flowchart Step 4 & 9: Misconception Graph & Memory Update
        st.subheader("🧠 Concept Mastery & Misconceptions")
        st.write("Current mapping of class weaknesses:")
        misconception_data = {
            "Concept": ["Fraction Addition", "Matrix Traces", "Probability Rules"],
            "Mastery Level": ["45%", "82%", "60%"],
            "Missing Prerequisite": ["Common Denominators", "None", "Combinatorics"]
        }
        st.dataframe(misconception_data, use_container_width=True)

    with colB:
        # Flowchart Step 10: Revision Plan
        st.subheader("📅 Recommended Revision Plans")
        st.info(
            "**Group A (Alex, Sam, Taylor):** \n"
            "Schedule adaptive practice on *Common Denominators* before proceeding to *Fraction Addition*."
        )
        st.button("Deploy Revision Quiz to Group A")