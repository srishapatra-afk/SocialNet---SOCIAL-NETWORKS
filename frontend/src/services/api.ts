import axios from 'axios';

/**
 * Pre-configured Axios instance for SocialNet API.
 * Uses withCredentials: true to send and receive HttpOnly session cookies automatically.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 10000,
});
