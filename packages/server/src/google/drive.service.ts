import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

export function getOAuthClient(): OAuth2Client {
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not set');
  if (!redirectUri) throw new Error('GOOGLE_REDIRECT_URI is not set');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(state: string, loginHint?: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file'],
    state,
    ...(loginHint && { login_hint: loginHint }),
  });
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry: string | null;
}> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  };
}

export function getAuthedClient(tokens: {
  access_token: string;
  refresh_token?: string | null;
  expiry?: string | null;
}): OAuth2Client {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry ? new Date(tokens.expiry).getTime() : undefined,
  });
  return client;
}

export async function getOrCreateFolder(auth: OAuth2Client, folderName: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth });

  const list = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return folder.data.id!;
}

export async function uploadFile(
  auth: OAuth2Client,
  folderId: string,
  originalname: string,
  mimetype: string,
  buffer: Buffer,
): Promise<{ driveFileId: string; driveViewLink: string }> {
  const drive = google.drive({ version: 'v3', auth });

  const stream = Readable.from(buffer);

  const file = await drive.files.create({
    requestBody: {
      name: originalname,
      parents: [folderId],
    },
    media: {
      mimeType: mimetype,
      body: stream,
    },
    fields: 'id,webViewLink',
  });

  return {
    driveFileId: file.data.id!,
    driveViewLink: file.data.webViewLink ?? '',
  };
}

export async function downloadFile(auth: OAuth2Client, driveFileId: string): Promise<Readable> {
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'stream' },
  );

  return response.data as unknown as Readable;
}

export async function deleteFile(auth: OAuth2Client, driveFileId: string): Promise<void> {
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId: driveFileId });
}

export async function listFilesInFolder(
  auth: OAuth2Client,
  folderId: string,
): Promise<Array<{ id: string; name: string; mimeType: string; size: string; webViewLink: string }>> {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'files(id,name,mimeType,size,webViewLink)',
    spaces: 'drive',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map(f => ({
    id: f.id!,
    name: f.name ?? '',
    mimeType: f.mimeType ?? 'application/octet-stream',
    size: f.size ?? '0',
    webViewLink: f.webViewLink ?? '',
  }));
}
