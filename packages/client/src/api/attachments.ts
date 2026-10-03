import { apiUrl, authHeaders } from './base';

export type EntityType = 'task' | 'date' | 'bill' | 'subscription' | 'loan' | 'habit' | 'reminder';

export interface AttachedDocument {
  id: number;
  title: string;
  filename: string;
  mimetype: string;
  drive_file_id: string | null;
  drive_view_link: string | null;
}

export async function getAttachments(
  token: string,
  entityType: EntityType,
  entityId: number
): Promise<AttachedDocument[]> {
  const url = `/api/attachments?entity_type=${encodeURIComponent(entityType)}&entity_id=${entityId}`;
  const res = await fetch(apiUrl(url), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch attachments');
  return res.json() as Promise<AttachedDocument[]>;
}

export async function addAttachment(
  token: string,
  entityType: EntityType,
  entityId: number,
  documentId: number
): Promise<void> {
  const res = await fetch(apiUrl('/api/attachments'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ entity_type: entityType, entity_id: entityId, document_id: documentId }),
  });
  if (!res.ok) throw new Error('Failed to add attachment');
}

export async function removeAttachment(
  token: string,
  entityType: EntityType,
  entityId: number,
  documentId: number
): Promise<void> {
  const res = await fetch(apiUrl('/api/attachments'), {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ entity_type: entityType, entity_id: entityId, document_id: documentId }),
  });
  if (!res.ok) throw new Error('Failed to remove attachment');
}
