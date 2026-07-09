# ─────────────────────────────────────────────────────────────────────────────
# Adaptive AI Tutor – Streamlit Application
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build keeps the final image lean:
#   stage 1 (builder) – install dependencies into a venv
#   stage 2 (runtime) – copy only the venv + source code
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# System deps needed to compile some Python packages (psycopg2-binary, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create and activate a virtualenv so we can copy it cleanly in stage 2
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt


# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Runtime system libraries (psycopg2-binary needs libpq at runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy the pre-built venv from the builder stage
COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

WORKDIR /app

# Copy application source
COPY . .

# Ensure the SQLite data directory exists (used when DATABASE_URL is sqlite)
RUN mkdir -p backend/data

# Streamlit default port
EXPOSE 8501

# Health-check so docker compose knows when the app is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8501/_stcore/health')" || exit 1

# Non-root user for security
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

ENTRYPOINT ["streamlit", "run", "app.py", \
            "--server.port=8501", \
            "--server.address=0.0.0.0", \
            "--server.headless=true"]
