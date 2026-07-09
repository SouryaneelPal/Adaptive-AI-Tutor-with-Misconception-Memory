"""
indexer.py
-----------
Builds and caches a FAISS vector index from the curriculum markdown files in
backend/curriculum/.

Design decisions
================
- FAISS (in-memory): no database or Docker required; perfect for a single-process
  app where the index fits easily in RAM (5 files, ~2-5 MB total).
- nomic-embed-text via OllamaEmbeddings: stays fully local, no API key, strong
  quality on educational/factual text.
- MarkdownHeaderTextSplitter on "##" headers: splits at semantic section
  boundaries (Definition, Worked Example, Common Misconceptions...) instead of
  arbitrary token windows, so each chunk is a meaningful, self-contained unit.
- Metadata tags (concept + section) on every chunk: lets the retriever do a
  hard concept-filter before semantic ranking, preventing cross-topic confusion.
- Singleton pattern: index is built once on first access and reused across all
  agent calls in the session.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from langchain_core.documents import Document
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import MarkdownHeaderTextSplitter

logger = logging.getLogger("rag.indexer")

CURRICULUM_DIR  = Path(__file__).parent.parent / "curriculum"
EMBED_MODEL     = os.getenv("EMBED_MODEL", "nomic-embed-text")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Maps filename stem → display concept name used as metadata filter key
_CONCEPT_MAP: dict[str, str] = {
    "fractions":                "Fractions",
    "probability":              "Probability",
    "algebra":                  "Algebra",
    "geometry":                 "Geometry",
    "decimals_and_percentages": "Decimals and Percentages",
}

_HEADER_SPLITS = [("##", "section")]


def _load_curriculum_docs() -> list[Document]:
    """
    Reads every .md file in the curriculum directory, splits by ## headers,
    and attaches concept + section metadata to each chunk.
    """
    docs: list[Document] = []
    splitter = MarkdownHeaderTextSplitter(headers_to_split_on=_HEADER_SPLITS)

    for md_file in sorted(CURRICULUM_DIR.glob("*.md")):
        stem    = md_file.stem.lower()
        concept = _CONCEPT_MAP.get(stem, stem.replace("_", " ").title())
        text    = md_file.read_text(encoding="utf-8")

        chunks = splitter.split_text(text)
        for chunk in chunks:
            chunk.metadata["concept"] = concept
            chunk.metadata.setdefault("section", "General")
        docs.extend(chunks)
        logger.info("Loaded %d chunks from %s (concept=%r)", len(chunks), md_file.name, concept)

    return docs


_index = None   # FAISS singleton, built once per process


def get_index():
    """
    Returns the singleton FAISS index, building it on first call.
    Raises RuntimeError with a clear message if dependencies are missing.
    """
    global _index
    if _index is not None:
        return _index

    try:
        from langchain_community.vectorstores import FAISS
    except ImportError as exc:
        raise RuntimeError(
            "langchain-community is not installed. "
            "Run: pip install langchain-community faiss-cpu"
        ) from exc

    logger.info("Building curriculum index with embed model=%r ...", EMBED_MODEL)
    docs = _load_curriculum_docs()

    if not docs:
        raise RuntimeError(
            f"No curriculum documents found in {CURRICULUM_DIR}. "
            "Add .md files to backend/curriculum/ and restart."
        )

    embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
    _index = FAISS.from_documents(docs, embeddings)
    logger.info("Curriculum index ready: %d chunks.", len(docs))
    return _index


def available_concepts() -> list[str]:
    """Sorted list of concept names the curriculum covers."""
    return sorted(_CONCEPT_MAP.values())
