// In production set VITE_API_URL to your backend URL, e.g. https://your-app.railway.app
// In development the Vite proxy forwards /api → localhost:3001, so BASE stays empty.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const apiUrl = (path: string) => `${BASE}${path}`;

export function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}
