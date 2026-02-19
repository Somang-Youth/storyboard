const DISCORD_THREAD_PREFIX = 'discord-thread:';

export function sanitizeContiDescription(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith(DISCORD_THREAD_PREFIX)) {
    return null;
  }

  return normalized;
}
