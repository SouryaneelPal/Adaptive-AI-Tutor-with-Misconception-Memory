"""
retriever.py
-------------
Query interface used by agents to fetch relevant curriculum chunks.

Design decisions
================
- Structured query (concept + error_type + misconception) rather than the raw
  student message: the diagnostic agent already extracted the signal; the student
  message contains noise that degrades retrieval precision.
- Concept metadata filter applied first: guarantees results come from the right
  topic file before semantic ranking. Without this, a query about "adding
  fractions" could return a chunk from the algebra file.
- Silent empty-string fallback on ANY exception: RAG failure must never crash
  the tutoring pipeline. The tutor planner degrades gracefully to LLM-only.
- k=2 default: one section explaining the concept/rule + one worked example is
  typically enough context without overwhelming the prompt.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("rag.retriever")


def get_curriculum_context(
    concept: str,
    error_type: str = "",
    misconception: str = "",
    k: int = 2,
) -> str:
    """
    Returns the top-k most relevant curriculum chunks as a formatted string,
    ready to be inserted into the tutor planner prompt.

    Returns an empty string silently on any error (index not ready, Ollama
    not running, concept not in curriculum, etc.).

    Args:
        concept:       The topic being taught, e.g. "Fractions". Must match a
                       concept name in the curriculum index metadata.
        error_type:    Diagnostic error classification ("Careless", "Conceptual",
                       "Prerequisite", or "None").
        misconception: The specific misconception text from the diagnostic result.
        k:             Number of chunks to retrieve (default 2).
    """
    if not concept:
        return ""

    try:
        from backend.rag.indexer import get_index

        index = get_index()

        # Structured query: use what the diagnostic agent extracted, not raw
        # student text, for precise retrieval.
        parts = [f"topic: {concept}"]
        if error_type and error_type not in ("None", "none", ""):
            parts.append(f"error type: {error_type}")
        if misconception:
            parts.append(f"misconception: {misconception}")
        query = " | ".join(parts)

        # Attempt concept-filtered retrieval first for maximum precision.
        try:
            results = index.similarity_search(
                query,
                k=k,
                filter={"concept": concept},
            )
        except Exception:
            # FAISS filter may not be supported in all configurations; fall back
            # to unfiltered search.
            results = index.similarity_search(query, k=k)

        if not results:
            logger.debug("No RAG results for concept=%r, query=%r", concept, query)
            return ""

        formatted = "\n\n---\n\n".join(
            f"[{r.metadata.get('section', 'General')}]\n{r.page_content}"
            for r in results
        )
        logger.info(
            "RAG retrieved %d chunks for concept=%r (error=%r)", len(results), concept, error_type
        )
        return formatted

    except Exception as exc:
        logger.warning("RAG retrieval failed (non-fatal): %s", exc)
        return ""
