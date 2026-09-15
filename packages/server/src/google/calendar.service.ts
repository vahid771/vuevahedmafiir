import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

function getCalendarOAuthClient(): OAuth2Client {
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not set');
  if (!redirectUri) throw new Error('GOOGLE_CALENDAR_REDIRECT_URI is not set');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getCalendarAuthUrl(state: string): string {
  const client = getCalendarOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state,
  });
}

export async function exchangeCalendarCode(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry: string | null;
}> {
  const client = getCalendarOAuthClient();
  const { tokens } = await client.getToken(code);
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  };
}

export function getAuthedCalendarClient(tokens: {
  access_token: string;
  refresh_token?: string | null;
  expiry?: string | null;
}): OAuth2Client {
  const client = getCalendarOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry ? new Date(tokens.expiry).getTime() : undefined,
  });
  return client;
}

export function getPrimaryCalendarId(): string {
  return 'primary';
}

type CalendarEventInput = {
  summary: string;
  description?: string;
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
};

export async function createCalendarEvent(
  auth: OAuth2Client,
  calendarId: string,
  event: CalendarEventInput,
): Promise<{ id: string }> {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });
  return { id: res.data.id! };
}

export async function updateCalendarEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventId: string,
  event: CalendarEventInput,
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: event,
  });
}

export async function deleteCalendarEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId, eventId });
}

export async function listCalendarEvents(
  auth: OAuth2Client,
  calendarId: string,
): Promise<
  Array<{
    id: string;
    summary: string;
    description?: string;
    start: { date?: string; dateTime?: string };
    end: { date?: string; dateTime?: string };
  }>
> {
  const calendar = google.calendar({ version: 'v3', auth });
  const timeMin = new Date();
  timeMin.setFullYear(timeMin.getFullYear() - 1);
  const res = await calendar.events.list({
    calendarId,
    singleEvents: true,
    timeMin: timeMin.toISOString(),
  });
  return (res.data.items ?? [])
    .filter((item) => !!item.id)
    .map((item) => ({
      id: item.id!,
      summary: item.summary ?? '',
      description: item.description ?? undefined,
      start: {
        date: item.start?.date ?? undefined,
        dateTime: item.start?.dateTime ?? undefined,
      },
      end: {
        date: item.end?.date ?? undefined,
        dateTime: item.end?.dateTime ?? undefined,
      },
    }));
}
