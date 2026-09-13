export interface Document {
  id: number;
  user_id: number;
  title: string;
  filename: string;
  mimetype: string;
  size: number;
  tags: string; // JSON array string
  uploaded_at: string;
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function getDocuments(token: string, tag?: string): Promise<Document[]> {
  const url = tag ? `/api/documents?tag=${encodeURIComponent(tag)}` : '/api/documents';
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocument(
  token: string,
  file: File,
  title: string,
  tags: string[]
): Promise<Document> {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  form.append('tags', JSON.stringify(tags));
  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: authHeader(token),
    body: form,
  });
  if (!res.ok) throw new Error('Failed to upload document');
  return res.json();
}

export async function downloadDocument(token: string, id: number, title: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}/download`, { headers: authHeader(token) });
  if (!res.ok) throw new Error('Failed to download document');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = title;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteDocument(token: string, id: number): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, { method: 'DELETE', headers: authHeader(token) });
  if (!res.ok) throw new Error('Failed to delete document');
}
