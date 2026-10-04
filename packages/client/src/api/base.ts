// In production set VITE_API_URL to your backend URL, e.g. https://your-app.railway.app
// In development the Vite proxy forwards /api → localhost:3001, so BASE stays empty.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const apiUrl = (path: string) => `${BASE}${path}`;

export function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface Resource<T, C = Partial<T>> {
  getAll(token: string, params?: URLSearchParams): Promise<T[]>;
  getById(token: string, id: number): Promise<T>;
  create(token: string, data: C): Promise<T>;
  update(token: string, id: number, data: Partial<T>): Promise<T>;
  remove(token: string, id: number): Promise<void>;
}

export function createResource<T, C = Partial<T>>(basePath: string): Resource<T, C> {
  return {
    async getAll(token, params?) {
      const url = params?.toString() ? `${basePath}?${params}` : basePath;
      const res = await fetch(apiUrl(url), { headers: authHeaders(token) });
      if (!res.ok) throw new Error(`Failed to fetch ${basePath}`);
      return res.json() as Promise<T[]>;
    },
    async getById(token, id) {
      const res = await fetch(apiUrl(`${basePath}/${id}`), { headers: authHeaders(token) });
      if (!res.ok) throw new Error(`Failed to fetch ${basePath}/${id}`);
      return res.json() as Promise<T>;
    },
    async create(token, data) {
      const res = await fetch(apiUrl(basePath), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to create ${basePath}`);
      return res.json() as Promise<T>;
    },
    async update(token, id, data) {
      const res = await fetch(apiUrl(`${basePath}/${id}`), {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update ${basePath}/${id}`);
      return res.json() as Promise<T>;
    },
    async remove(token, id) {
      const res = await fetch(apiUrl(`${basePath}/${id}`), {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error(`Failed to delete ${basePath}/${id}`);
    },
  };
}
