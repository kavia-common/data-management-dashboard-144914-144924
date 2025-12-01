# LLM Costs Users - Debugging

To enable console.debug of the first payload returned from /api/llm-costs/users, set the following env variable when running the frontend:

- REACT_APP_DEBUG_LLM_COSTS=true

Example (npm start):
REACT_APP_DEBUG_LLM_COSTS=true npm start

This flag only logs in non-production environments and helps verify payload shape during integration.
