function getServiceAccountCredentials(): { clientEmail: string; privateKey: string } {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        };
      }
    } catch {}
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return {
      clientEmail,
      privateKey,
    };
  }

  throw new Error('Google service account credentials are not configured');
}

function getGoogleSheetId(): string {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error('GOOGLE_SHEET_ID is not set');
  }
  return sheetId;
}

function normalizePrivateKey(value: string): string {
  let normalized = value.trim();
  while (normalized.startsWith('"') && normalized.endsWith('"') && normalized.length >= 2) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized.replace(/\\n/g, '\n').trim();
}

function toBase64Url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const stripped = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const bytes = Uint8Array.from(atob(stripped), (char) => char.charCodeAt(0));
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function getGoogleAccessToken(): Promise<string> {
  const { clientEmail, privateKey } = getServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${toBase64Url(header)}.${toBase64Url(payload)}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(normalizePrivateKey(privateKey)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken));
  const sigBytes = new Uint8Array(signature);
  const sig = btoa(String.fromCharCode(...sigBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${unsignedToken}.${sig}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token as string;
}

export async function readRoleOptionsFromSheet(sheetName = 'DB_Options'): Promise<string[]> {
  const sheetId = getGoogleSheetId();
  const accessToken = await getGoogleAccessToken();
  const range = encodeURIComponent(`${sheetName}!A:A`);

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to read sheet options: ${JSON.stringify(data)}`);
  }

  const values = (data.values ?? []) as string[][];
  return values
    .map((row) => row[0]?.trim() ?? '')
    .filter(Boolean);
}

export interface SheetWorshipData {
  preacher?: string;
  leader?: string;
  worshipLeader?: string;
  title?: string;
  scripture?: string;
  songs?: string[];
}

export async function readRoleOptionsWithFallback(sheetName = 'DB_Options'): Promise<string[]> {
  try {
    const fromSheet = await readRoleOptionsFromSheet(sheetName);
    if (fromSheet.length > 0) {
      return fromSheet;
    }
  } catch {}

  const raw = process.env.DISCORD_ROLE_OPTIONS || '';
  const fromEnv = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (fromEnv.length === 0) {
    throw new Error('Role options are empty. Configure DB_Options sheet or DISCORD_ROLE_OPTIONS env.');
  }

  return fromEnv;
}

function formatYYMMDDToSheetDate(sundayDate: string): string {
  const yy = sundayDate.slice(0, 2);
  const mm = sundayDate.slice(2, 4);
  const dd = sundayDate.slice(4, 6);
  return `20${yy}.${mm}.${dd}`;
}

export async function findRowByDate(sheetName: string, formattedDate: string): Promise<number | null> {
  const sheetId = getGoogleSheetId();
  const accessToken = await getGoogleAccessToken();
  const range = encodeURIComponent(`${sheetName}!B:B`);

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to read date column: ${JSON.stringify(data)}`);
  }

  const values = (data.values ?? []) as string[][];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]?.[0]?.trim();
    if (value === formattedDate) {
      return i + 1;
    }
  }

  return null;
}

function roleColumnByCustomId(customId: string): string {
  if (customId === 'preacher-select') return 'C';
  if (customId === 'leader-select') return 'D';
  if (customId === 'worship-leader-select') return 'E';
  throw new Error(`Unsupported customId: ${customId}`);
}

export async function updateRoleSelectionInSheet(customId: string, selectedValue: string, sundayDate: string): Promise<void> {
  const sheetName = 'DB';
  const formattedDate = formatYYMMDDToSheetDate(sundayDate);
  const row = await findRowByDate(sheetName, formattedDate);

  if (!row) {
    throw new Error(`No matching date row for ${formattedDate}`);
  }

  const sheetId = getGoogleSheetId();
  const accessToken = await getGoogleAccessToken();
  const column = roleColumnByCustomId(customId);
  const range = encodeURIComponent(`${sheetName}!${column}${row}`);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${sheetName}!${column}${row}`,
        majorDimension: 'ROWS',
        values: [[selectedValue]],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to update role selection: ${JSON.stringify(data)}`);
  }
}

export async function updateWorshipData(sheetName: string, row: number, data: SheetWorshipData): Promise<void> {
  const updates: Array<{ range: string; values: string[][] }> = [];

  if (data.preacher) {
    updates.push({ range: `${sheetName}!C${row}`, values: [[data.preacher]] });
  }
  if (data.leader) {
    updates.push({ range: `${sheetName}!D${row}`, values: [[data.leader]] });
  }
  if (data.worshipLeader) {
    updates.push({ range: `${sheetName}!E${row}`, values: [[data.worshipLeader]] });
  }
  if (data.title) {
    updates.push({ range: `${sheetName}!J${row}`, values: [[data.title]] });
  }
  if (data.scripture) {
    updates.push({ range: `${sheetName}!K${row}`, values: [[data.scripture]] });
  }
  if (data.songs && data.songs.length > 0) {
    const songColumns = ['L', 'M', 'N', 'O'];
    data.songs.slice(0, songColumns.length).forEach((song, index) => {
      updates.push({ range: `${sheetName}!${songColumns[index]}${row}`, values: [[song]] });
    });
  }

  if (updates.length === 0) {
    return;
  }

  const sheetId = getGoogleSheetId();
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updates,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to update worship data: ${JSON.stringify(result)}`);
  }
}
