/**
 * frontend/react-app/src/api.ts
 * Typed fetch wrappers for the Pixel Tutor FastAPI backend.
 *
 * Set VITE_API_BASE_URL in your .env to override the default.
 * All functions degrade gracefully on network error (return empty data).
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:8000';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AttemptPayload {
  student_id: string;
  concept: string;
  question_id: string;
  correct: boolean;
  time_taken_ms: number;
  hint_used: boolean;
}

export interface LearningCurvePoint {
  label: string;
  accuracy_pct: number;
  avg_time_ms: number;
  attempts: number;
}

export interface StudentSummary {
  rolling_accuracy: number;
  rolling_avg_time_ms: number;
  streak: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  fallback?: T,
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn('[api]', err);
    return fallback as T;
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * POST /api/attempts — record a single quiz answer.
 * Fails silently so a network hiccup never blocks the quiz UI.
 */
export async function postAttempt(payload: AttemptPayload): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[api] postAttempt failed (offline?):', err);
  }
}

/**
 * GET /api/students/{id}/learning-curve?bucket=session|day
 * Returns [] on error so the chart just shows empty state.
 */
export async function fetchLearningCurve(
  studentId: string,
  bucket: 'session' | 'day' = 'session',
): Promise<LearningCurvePoint[]> {
  return safeFetch<LearningCurvePoint[]>(
    `${API_BASE}/api/students/${encodeURIComponent(studentId)}/learning-curve?bucket=${bucket}`,
    undefined,
    [],
  );
}

/**
 * GET /api/students/{id}/summary
 * Returns zeros on error so stat cards still render.
 */
export async function fetchSummary(studentId: string): Promise<StudentSummary> {
  return safeFetch<StudentSummary>(
    `${API_BASE}/api/students/${encodeURIComponent(studentId)}/summary`,
    undefined,
    { rolling_accuracy: 0, rolling_avg_time_ms: 0, streak: 0 },
  );
}

/** Simple health check — returns true if API is reachable. */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
