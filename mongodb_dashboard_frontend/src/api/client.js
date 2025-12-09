import { getApiClient } from './baseClient'

/**
 * Default axios-like client instance for the frontend API.
 * PUBLIC_INTERFACE
 * Exports an object with get/post/put/delete methods, each returning { data } like axios.
 * The implementation is based on fetch under the hood (see baseClient.js).
 */
const api = getApiClient()

export default api
