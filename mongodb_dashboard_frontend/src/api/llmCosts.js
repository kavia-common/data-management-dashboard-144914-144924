/**
 * NOTICE: Frontend LLM costs API deprecated.
 * The backend /api/llm-costs endpoint has been removed. This module remains to prevent import errors.
 * Any calls will return an empty envelope to preserve pagination flows where expected.
 */

// PUBLIC_INTERFACE
export async function fetchLlmCosts() {
  return { success: true, data: [], meta: { page: 1, limit: 0, total: 0 } }
}

export default { fetchLlmCosts }
