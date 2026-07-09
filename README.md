# Adaptive AI Tutor with Misconception Memory

An adaptive tutoring system built on LangGraph: an Evaluator Agent scores each
student response, a Diagnostic Agent classifies *why* wrong answers are
wrong, a Tutor Planner generates hints/explanations (grounded by RAG over a
curriculum knowledge base and a Neo4j prerequisite graph), and an Escalation
Agent loops in a teacher when a student is stuck or distressed. Conversation
history and student mastery persist across sessions.

## Architecture at a glance

```
START -> evaluator -> [correct + confident?] -> tutor_planner (praise + next Q)
                    -> [not confident/incorrect] -> diagnostic -> [escalate?]
                                                        -> escalator (teacher handoff)
                                                        -> tutor_planner (hint ladder, RAG-grounded)
                                                                -> memory_update -> END
```

Data stores:
- **Neo4j** — student mastery graph + concept prerequisite graph (`backend/memory/`)
- **SQL (SQLite by default, Postgres-compatible)** — conversation transcript (`backend/memory/conversation_store.py`)
- **FAISS (in-memory, built on startup)** — curriculum RAG index over `backend/curriculum/*.md`

## Prerequisites

Install these before doing anything else:

| Tool | Version | Why |
|---|---|---|
| Python | 3.10+ (3.12 used in dev) | Runs the app and all agents |
| Java | 17+ | Required by Neo4j Community Server |
| [Ollama](https://ollama.com) | any recent | Runs the LLMs locally (or on a shared host) |
| Git | any | Clone the repo |

Docker is **not** required — everything here runs as plain local processes.

## 1. Clone and set up a virtual environment

```bash
git clone <repo-url>
cd Adaptive-AI-Tutor-with-Misconception-Memory

python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

`.env` is git-ignored on purpose — every teammate's Ollama/Neo4j/DB setup is
local to their own machine. Open `.env` and fill in the sections below as you
set each piece up.

## 3. Set up Ollama (LLM backend)

**Option A — run it locally:**
```bash
ollama serve
ollama pull gemma4:31b          # or any chat-capable model you prefer
ollama pull nomic-embed-text  # required for the RAG curriculum retriever
```
Leave `.env`'s `OLLAMA_BASE_URL=http://localhost:11434` as-is, and set every
`*_MODEL` variable to whatever chat model you pulled (e.g. `gemma4:31b`).

**Option B — use a shared host** (e.g. a team GPU box): the server there
**must** be started with `OLLAMA_HOST=0.0.0.0:11434` (Ollama binds to
`127.0.0.1` only by default, which refuses connections from other machines —
this bit us once already). On that host:
```bash
OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve > ~/ollama.log 2>&1 &
ollama pull <model>
```
Then in your local `.env`, set `OLLAMA_BASE_URL=http://<that-host-ip>:11434`.

**Verify it's reachable** before moving on:
```bash
curl http://<OLLAMA_BASE_URL host:port>/api/tags
```
You should get back a JSON list of models, not a connection error.

## 4. Set up Neo4j (student mastery / misconception graph)

No Docker needed — Community Server runs directly on Java.

1. Download Community Server from the [Neo4j Deployment Center](https://neo4j.com/deployment-center/) (pick "Community", the ZIP/TAR package — not the `.exe`/Desktop installer).
2. Extract it anywhere, e.g. `~/neo4j/` or `C:\neo4j\`.
3. Set the initial password **before** first start:
   ```bash
   ./bin/neo4j-admin dbms set-initial-password <your-password>
   ```
4. Start it:
   ```bash
   ./bin/neo4j console
   ```
   Leave this running in its own terminal/background process. You should see
   `Bolt enabled on localhost:7687` and `Started.` in the log.
5. In `.env`, set `NEO4J_URI=bolt://localhost:7687`, `NEO4J_USER=neo4j`, and
   `NEO4J_PASSWORD=<the password you set>`.
6. Seed the curriculum prerequisite graph (one-time, safe to re-run):
   ```bash
   python -m backend.memory.misconception_graph --seed
   ```

You can browse the graph visually at http://localhost:7474 (login with the
same user/password).

**If Neo4j isn't running or reachable, the app still works** — every
Neo4j-backed function degrades gracefully (logs a warning, falls back to an
empty/no-op result) rather than crashing. You just won't get persisted
mastery tracking or grounded prerequisite names until it's up.

## 5. Conversation history database

Nothing to do — defaults to a local SQLite file
(`backend/data/conversations.db`, created automatically on first run).

To use real Postgres instead, just change `DATABASE_URL` in `.env` to a
`postgresql+psycopg2://user:pass@host:port/dbname` DSN. No code changes
needed either way.

## 6. Curriculum RAG index

Nothing to do — built automatically in-memory from `backend/curriculum/*.md`
the first time the Tutor Planner needs it. Requires the `nomic-embed-text`
model to be pulled on your Ollama instance (see step 3).

## 7. Run the app

```bash
streamlit run app.py
```

Open the URL Streamlit prints (typically http://localhost:8501). Use the
sidebar to pick a topic and toggle "Show tutor internals" to see the
diagnostic/evaluator output and which path each turn took.

## Verifying your setup works end-to-end

Each backend module has a standalone test block — useful for isolating
problems without going through the full UI:

```bash
python -m backend.memory.neo4j_client        # Neo4j connectivity check
python -m backend.memory.conversation_store  # SQLite round-trip (no external deps)
python -m backend.memory.misconception_graph # prerequisite graph lookups
python -m backend.agents.orchestrator        # full multi-scenario run through the graph (needs Ollama)
```

## Troubleshooting

- **"Connection refused" talking to Ollama**: if it's a remote host, confirm
  it was started with `OLLAMA_HOST=0.0.0.0:11434` (see step 3, Option B) —
  `ollama list` working *on that machine* only proves the local CLI works,
  not that the port is open to your machine. Test with
  `curl http://<host>:11434/api/tags` from your own machine.
- **Neo4j warnings in the logs**: expected and harmless if you haven't set
  it up yet — every read/write degrades to a safe fallback instead of
  crashing. Follow step 4 to get real persistence.
- **A model response takes 60+ seconds**: you're likely running a large
  model on CPU only. Try a smaller model (e.g. `gemma4:31b` over `mistral`) or
  point at a GPU-backed Ollama host.
- **Windows note**: running a file directly as `python backend/agents/x.py`
  can fail with `ModuleNotFoundError: No module named 'backend'` because the
  script's own directory gets put on `sys.path` instead of the project root.
  Use the `python -m backend.agents.x` module form instead (as shown above).
