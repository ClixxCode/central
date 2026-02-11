const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  hangoutLink?: string;
  htmlLink?: string;
  attendees?: { email: string; responseStatus: string }[];
  status: string;
}

export interface BusyBlock {
  start: string;
  end: string;
}

export interface FreeBusyResult {
  calendars: Record<string, { busy: BusyBlock[]; errors?: { domain: string; reason: string }[] }>;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { email: string }[];
}

export interface CreatedEvent {
  id: string;
  htmlLink: string;
}

export async function fetchTodaysEvents(
  accessToken: string,
  timeZone: string
): Promise<CalendarEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now.toLocaleDateString('en-US', { timeZone }));
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    timeZone,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Calendar API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return (data.items ?? []).filter(
    (event: CalendarEvent) => event.status !== 'cancelled'
  );
}

export async function fetchFreeBusy(
  accessToken: string,
  emails: string[],
  timeMin: string,
  timeMax: string,
  timeZone: string
): Promise<FreeBusyResult> {
  const response = await fetch(`${CALENDAR_API_BASE}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone,
      items: emails.map((email) => ({ id: email })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Calendar freeBusy error: ${response.status} ${error}`);
  }

  return response.json();
}

export async function createEvent(
  accessToken: string,
  event: CreateEventInput
): Promise<CreatedEvent> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events?sendUpdates=none`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Calendar createEvent error: ${response.status} ${error}`);
  }

  return response.json();
}
