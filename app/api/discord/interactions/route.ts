import { NextRequest, NextResponse } from 'next/server';
import {
  hasInteractionReceipt,
  saveInteractionReceipt,
  saveRoleSelection,
  verifyDiscordInteraction,
} from '@/lib/discord-sync';

const DISCORD_PING = 1;
const MESSAGE_COMPONENT = 3;
const PONG = 1;
const UPDATE_MESSAGE = 7;

interface DiscordInteractionData {
  custom_id?: string;
  values?: string[];
}

interface DiscordInteraction {
  id: string;
  type: number;
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

  if (await hasInteractionReceipt(interaction.id)) {
    return NextResponse.json({
      type: UPDATE_MESSAGE,
      data: { content: '이미 처리된 요청입니다.', components: [] },
    });
  }

  await saveInteractionReceipt(interaction.id, interaction.type);

  if (interaction.type === MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id;
    const selectedValue = interaction.data?.values?.[0];

    if (customId && selectedValue) {
      await saveRoleSelection(customId, selectedValue);
      return NextResponse.json({
        type: UPDATE_MESSAGE,
        data: {
          content: `선택 완료: ${selectedValue}`,
          components: [],
        },
      });
    }
  }

  return NextResponse.json({
    type: UPDATE_MESSAGE,
    data: {
      content: '처리할 수 없는 인터랙션입니다.',
      components: [],
    },
  });
}
