import { NextRequest, NextResponse } from 'next/server';
import {
  addMessageReaction,
  getActiveThread,
  saveRoleSelection,
  verifyDiscordInteraction,
} from '@/lib/discord-sync';

const DISCORD_PING = 1;
const MESSAGE_COMPONENT = 3;
const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
const UPDATE_MESSAGE = 7;

function roleLabel(customId: string): string {
  if (customId === 'preacher-select') return '설교자';
  if (customId === 'leader-select') return '인도자';
  if (customId === 'worship-leader-select') return '찬양 인도자';
  return '선택';
}

interface DiscordInteractionData {
  custom_id?: string;
  values?: string[];
}

interface DiscordInteraction {
  id: string;
  type: number;
  channel_id?: string;
  message?: {
    id?: string;
    channel_id?: string;
  };
  data?: DiscordInteractionData;
}

function invalidRequestResponse() {
  return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return invalidRequestResponse();
  }

  const body = await request.text();
  const isValid = await verifyDiscordInteraction(body, signature, timestamp);
  if (!isValid) {
    return invalidRequestResponse();
  }

  const interaction = JSON.parse(body) as DiscordInteraction;

  if (interaction.type === DISCORD_PING) {
    return NextResponse.json({ type: PONG });
  }

  if (interaction.type === MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id;
    const selectedValue = interaction.data?.values?.[0];

    if (customId && selectedValue) {
      const active = await getActiveThread();
      if (!active) {
        return NextResponse.json({
          type: CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '현재 스레드 정보를 찾을 수 없습니다.',
            flags: 64,
          },
        });
      }

      await saveRoleSelection(customId, selectedValue);

      const channelId = interaction.channel_id ?? interaction.message?.channel_id;
      const messageId = interaction.message?.id;
      if (channelId && messageId) {
        try {
          await addMessageReaction(channelId, messageId, '✅');
        } catch {}
      }

      return NextResponse.json({
        type: UPDATE_MESSAGE,
        data: {
          content: `${roleLabel(customId)}: ${selectedValue}`,
        },
      });
    }

    return NextResponse.json({
      type: CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '처리할 수 없는 요청입니다.',
        flags: 64,
      },
    });
  }

  return NextResponse.json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '지원하지 않는 요청입니다.',
      flags: 64,
    },
  });
}
