import { apiUrl, authHeaders } from './base';

export async function getGoogleDriveStatus(token: string): Promise<{ connected: boolean }> {
  const res = await fetch(apiUrl('/api/google/status'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch Google Drive status');
  return res.json();
}

export async function disconnectGoogleDrive(token: string): Promise<void> {
  const res = await fetch(apiUrl('/api/google/disconnect'), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to disconnect Google Drive');
}

/** Returns the URL to navigate the browser to for the OAuth connect flow. */
export function getGoogleConnectUrl(token: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}/api/google/connect?token=${encodeURIComponent(token)}`;
}
