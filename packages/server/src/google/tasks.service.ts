import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

function getTasksOAuthClient(): OAuth2Client {
  const redirectUri = process.env.GOOGLE_TASKS_REDIRECT_URI;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not set');
  if (!redirectUri) throw new Error('GOOGLE_TASKS_REDIRECT_URI is not set');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getTasksAuthUrl(state: string): string {
  const client = getTasksOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/tasks'],
    state,
  });
}

export async function exchangeTasksCode(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry: string | null;
}> {
  const client = getTasksOAuthClient();
  const { tokens } = await client.getToken(code);
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  };
}

export function getAuthedTasksClient(tokens: {
  access_token: string;
  refresh_token?: string | null;
  expiry?: string | null;
}): OAuth2Client {
  const client = getTasksOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry ? new Date(tokens.expiry).getTime() : undefined,
  });
  return client;
}

export async function listTaskLists(
  auth: OAuth2Client,
): Promise<{ id: string; title: string }[]> {
  const tasks = google.tasks({ version: 'v1', auth });
  const res = await tasks.tasklists.list();
  return (res.data.items ?? []).map((item) => ({
    id: item.id!,
    title: item.title ?? '',
  }));
}

export async function createGoogleTask(
  auth: OAuth2Client,
  taskListId: string,
  task: { title: string; notes?: string; due?: string; status: 'open' | 'done' },
): Promise<{ id: string }> {
  const tasks = google.tasks({ version: 'v1', auth });
  const res = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: {
      title: task.title,
      notes: task.notes,
      due: task.due,
      status: task.status === 'done' ? 'completed' : 'needsAction',
    },
  });
  return { id: res.data.id! };
}

export async function updateGoogleTask(
  auth: OAuth2Client,
  taskListId: string,
  googleTaskId: string,
  task: { title?: string; notes?: string; due?: string | null; status?: 'open' | 'done' },
): Promise<void> {
  const tasks = google.tasks({ version: 'v1', auth });
  await tasks.tasks.patch({
    tasklist: taskListId,
    task: googleTaskId,
    requestBody: {
      title: task.title,
      notes: task.notes,
      due: task.due ?? undefined,
      ...(task.status !== undefined && {
        status: task.status === 'done' ? 'completed' : 'needsAction',
      }),
    },
  });
}

export async function deleteGoogleTask(
  auth: OAuth2Client,
  taskListId: string,
  googleTaskId: string,
): Promise<void> {
  const tasks = google.tasks({ version: 'v1', auth });
  await tasks.tasks.delete({ tasklist: taskListId, task: googleTaskId });
}

export async function listGoogleTasks(
  auth: OAuth2Client,
  taskListId: string,
): Promise<Array<{ id: string; title: string; notes?: string; due?: string; status: string }>> {
  const tasks = google.tasks({ version: 'v1', auth });
  const res = await tasks.tasks.list({ tasklist: taskListId, showHidden: false });
  return (res.data.items ?? [])
    .filter((item) => !!item.id)
    .map((item) => ({
      id: item.id!,
      title: item.title ?? '',
      notes: item.notes ?? undefined,
      due: item.due ?? undefined,
      status: item.status ?? 'needsAction',
    }));
}
