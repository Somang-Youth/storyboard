export interface DiscordParserMessage {
  id: string;
  content: string;
  timestamp?: string;
  author?: {
    id?: string;
    username?: string;
    globalName?: string;
  };
}

export interface ParsedWorshipData {
  title?: string;
  scripture?: string;
  songs?: string[];
}

export interface ParsedDiscordMessage {
  messageId: string;
  authorId?: string;
  authorName?: string;
  content: string;
  timestamp?: string;
  parsedData?: ParsedWorshipData;
}
