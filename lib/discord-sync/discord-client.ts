import { fetchWithTimeout } from '@/lib/http/fetch-with-timeout';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Every call is bounded so one stalled Discord request cannot burn the whole
// serverless budget and take the rest of the cron down with it. Reads retry
// once; writes never do, so a retry cannot post a duplicate thread or message.
const DISCORD_READ_TIMEOUT_MS = 8000;
const DISCORD_WRITE_TIMEOUT_MS = 10000;

interface DiscordThreadCreateResponse {
  id: string;
  message?: {
    id: string;
  };
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
  timestamp: string;
  author: {
    id: string;
    username: string;
    global_name?: string;
    bot?: boolean;
  };
  reactions?: Array<{
    count: number;
    me?: boolean;
    emoji?: {
      name?: string | null;
    };
  }>;
}

interface DiscordThreadListResponse {
  threads: DiscordForumThread[];
}

export interface DiscordForumThread {
  id: string;
  name: string;
  parent_id?: string;
}

export interface DiscordChannel {
  id: string;
  name?: string;
  parent_id?: string;
  guild_id?: string;
}

export interface DiscordSelectOption {
  label: string;
  value: string;
}

// Discord rejects a string select carrying more than 25 options, or a label or
// value longer than 100 characters. The DB_Options roster only ever grows, so
// clamp here rather than letting the 26th name start failing every dropdown.
export const MAX_SELECT_OPTIONS = 25;
export const MAX_SELECT_FIELD_LENGTH = 100;

export function toSelectOptions(options: DiscordSelectOption[]): DiscordSelectOption[] {
  if (options.length > MAX_SELECT_OPTIONS) {
    console.warn(
      `[discord] ${options.length} select options exceed Discord's limit of ${MAX_SELECT_OPTIONS}; dropping the rest`,
    );
  }

  return options.slice(0, MAX_SELECT_OPTIONS).map((option) => ({
    label: option.label.slice(0, MAX_SELECT_FIELD_LENGTH),
    value: option.value.slice(0, MAX_SELECT_FIELD_LENGTH),
  }));
}

function getBotToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not set');
  }
  return token;
}

function getHeaders(): HeadersInit {
  return {
    Authorization: `Bot ${getBotToken()}`,
    'Content-Type': 'application/json',
  };
}

async function parseDiscordResponse<T>(response: Response, errorPrefix: string): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${errorPrefix}: ${response.status} ${body}`);
  }
  return response.json() as Promise<T>;
}

export async function createForumThread(channelId: string, threadName: string, message: string): Promise<DiscordThreadCreateResponse> {
  const response = await fetchWithTimeout(
    `${DISCORD_API_BASE}/channels/${channelId}/threads`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: threadName,
        auto_archive_duration: 10080,
        message: { content: message },
      }),
    },
    { timeoutMs: DISCORD_WRITE_TIMEOUT_MS, label: 'Create forum thread' },
  );

  return parseDiscordResponse<DiscordThreadCreateResponse>(response, 'Failed to create forum thread');
}

export async function sendDropdownMessage(threadId: string, content: string, customId: string, placeholder: string, options: DiscordSelectOption[]) {
  const response = await fetchWithTimeout(
    `${DISCORD_API_BASE}/channels/${threadId}/messages`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        content,
        components: [
          {
            type: 1,
            components: [
              {
                type: 3,
                custom_id: customId,
                placeholder: placeholder,
                options: toSelectOptions(options),
              },
            ],
          },
        ],
      }),
    },
    { timeoutMs: DISCORD_WRITE_TIMEOUT_MS, label: 'Send dropdown message' },
  );

  return parseDiscordResponse<{ id: string }>(response, 'Failed to send dropdown message');
}

export async function sendThreadMessage(threadId: string, content: string): Promise<{ id: string }> {
  const response = await fetchWithTimeout(
    `${DISCORD_API_BASE}/channels/${threadId}/messages`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    },
    { timeoutMs: DISCORD_WRITE_TIMEOUT_MS, label: 'Send thread message' },
  );

  return parseDiscordResponse<{ id: string }>(response, 'Failed to send thread message');
}

export async function archiveThread(threadId: string): Promise<void> {
  const response = await fetchWithTimeout(
    `${DISCORD_API_BASE}/channels/${threadId}`,
    {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ archived: true }),
    },
    { timeoutMs: DISCORD_WRITE_TIMEOUT_MS, label: 'Archive thread' },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to archive thread: ${response.status} ${body}`);
  }
}

export async function getThreadMessages(threadId: string): Promise<DiscordMessage[]> {
  const response = await fetchWithTimeout(
    `${DISCORD_API_BASE}/channels/${threadId}/messages?limit=100`,
    { method: 'GET', headers: getHeaders() },
    { timeoutMs: DISCORD_READ_TIMEOUT_MS, retries: 1, label: 'Fetch thread messages' },
  );

  return parseDiscordResponse<DiscordMessage[]>(response, 'Failed to fetch thread messages');
}

export async function addMessageReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  const response = await fetchWithTimeout(
    `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: 'PUT', headers: getHeaders() },
    { timeoutMs: DISCORD_WRITE_TIMEOUT_MS, label: 'Add message reaction' },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to add message reaction: ${response.status} ${body}`);
  }
}

export async function getChannel(channelId: string): Promise<DiscordChannel> {
  const response = await fetchWithTimeout(
    `${DISCORD_API_BASE}/channels/${channelId}`,
    { method: 'GET', headers: getHeaders() },
    { timeoutMs: DISCORD_READ_TIMEOUT_MS, retries: 1, label: 'Fetch channel' },
  );

  return parseDiscordResponse<DiscordChannel>(response, 'Failed to fetch channel');
}

export async function getActiveForumThreads(guildId: string, parentChannelId: string): Promise<DiscordForumThread[]> {
  const response = await fetchWithTimeout(
    `${DISCORD_API_BASE}/guilds/${guildId}/threads/active`,
    { method: 'GET', headers: getHeaders() },
    { timeoutMs: DISCORD_READ_TIMEOUT_MS, retries: 1, label: 'Fetch active threads' },
  );

  const data = await parseDiscordResponse<DiscordThreadListResponse>(response, 'Failed to fetch active threads');
  return data.threads.filter((thread) => thread.parent_id === parentChannelId);
}
