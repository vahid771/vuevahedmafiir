import { apiUrl } from './base';

export interface AuthResponse {
  token: string;
  user: { id: number; email: string };
}

async function request(path: string, body: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<AuthResponse>;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request('/api/auth/login', { email, password });
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return request('/api/auth/register', { email, password });
}
