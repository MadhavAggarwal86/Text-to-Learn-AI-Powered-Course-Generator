import axios from 'axios';

// Empty in local dev (Vite proxies /api); the Render URL in production.
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  // Render's free tier can take ~50s to wake from sleep.
  timeout: 60_000,
});

/** Turns an axios error into a message that is safe to show in the UI. */
export function getErrorMessage(error) {
  if (error.response?.data?.error?.message) return error.response.data.error.message;
  if (error.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (error.request) return 'Could not reach the server. Is it running?';
  return error.message ?? 'Something went wrong.';
}

export async function fetchHealth() {
  const { data } = await api.get('/health');
  return data;
}
