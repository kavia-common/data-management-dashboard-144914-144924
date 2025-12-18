import axios from 'axios';
import { getApiBase } from './config';

/**
 * PUBLIC_INTERFACE
 * Axios client for API calls.
 * Ensures baseURL ends with /api and prevents double /api in request paths.
 */
const baseURL = getApiBase(); // resolved via env/origin and normalized to include '/api' once
const client = axios.create({ baseURL });

export default client;
