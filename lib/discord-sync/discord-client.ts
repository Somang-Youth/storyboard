const DISCORD_API_BASE = 'https://discord.com/api/v10';

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
  };
}

interface DiscordThreadListResponse {
  threads: Array<{ id: string; parent_id?: string }>;
}

export interface DiscordSelectOption {
  label: string;
  value: string;
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
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/threads`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      name: threadName,
      auto_archive_duration: 10080,
      message: { content: message },
    }),
  });

  return parseDiscordResponse<DiscordThreadCreateResponse>(response, 'Failed to create forum thread');
}

export async function sendDropdownMessage(threadId: string, content: string, customId: string, placeholder: string, options: DiscordSelectOption[]) {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${threadId}/messages`, {
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
              options: options.map((option) => ({
                label: option.label,
                value: option.value,
              })),
            },
          ],
        },
      ],
    }),
  });

  return parseDiscordResponse<{ id: string }>(response, 'Failed to send dropdown message');
}

export async function getThreadMessages(threadId: string): Promise<DiscordMessage[]> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${threadId}/messages?limit=100`, {
    method: 'GET',
    headers: getHeaders(),
  });

  return parseDiscordResponse<DiscordMessage[]>(response, 'Failed to fetch thread messages');
}

export async function addMessageReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
    method: 'PUT',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to add message reaction: ${response.status} ${body}`);
  }
}

export async function getActiveThreadIds(guildId: string, parentChannelId: string): Promise<string[]> {
  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/threads/active`, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await parseDiscordResponse<DiscordThreadListResponse>(response, 'Failed to fetch active threads');
  return data.threads.filter((thread) => thread.parent_id === parentChannelId).map((thread) => thread.id);
}
