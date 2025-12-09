import { getApiClient } from './baseClient'

/**
 * Default axios-like client instance for the frontend API.
 * PUBLIC_INTERFACE
 * Exports an object with get/post/put/delete methods, each returning { data } like axios.
 * The implementation is based on fetch under the hood (see baseClient.js).
 * Supported options include:
 *  - allowUnauthorized: when true, treat 401 as a soft failure and return { data: null }.
 *  - omitAuth: when true, do not attach Authorization even if a token is present.
 */
const api = getApiClient()

export default api
