'use server';

import type {
  ActionResult,
  PptxDriveFile,
  PptxExportResult,
  PptxExportSongData,
  PptxTemplateStructure,
} from '@/lib/types';
import { put } from '@vercel/blob';

function getPptxApiUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/pptx`;
  }
  return 'http://localhost:3000/api/pptx';
}

function getPptxHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${process.env.AUTH_SECRET}`,
    ...extra,
  };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  return headers;
}

/**
 * List .pptx files from Google Drive folder.
 * Uses Google Drive REST API directly (no Python dependency needed).
 */
export async function listPptxFiles(): Promise<ActionResult<{ files: PptxDriveFile[] }>> {
  try {
    const folderId = process.env.GOOGLE_DRIVE_TEMPLATE_FOLDER_ID;
    if (!folderId) {
      return { success: false, error: 'GOOGLE_DRIVE_TEMPLATE_FOLDER_ID가 설정되지 않았습니다' };
    }

    const accessToken = await getGoogleAccessToken();

    const query = encodeURIComponent(
      `'${folderId}' in parents and trashed=false and mimeType='application/vnd.openxmlformats-officedocument.presentationml.presentation'`
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&pageSize=100`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[listPptxFiles] Drive API error:', err);
      return { success: false, error: '파일 목록을 가져오지 못했습니다' };
    }

    const data = await response.json();
    const files: PptxDriveFile[] = (data.files || [])
      .map((f: { id: string; name: string; modifiedTime?: string }) => ({
        file_id: f.id,
        name: f.name,
        modified_time: f.modifiedTime || '',
      }))
      .sort((a: PptxDriveFile, b: PptxDriveFile) => b.name.localeCompare(a.name));

    return { success: true, data: { files } };
  } catch (error) {
    console.error('[listPptxFiles]', error);
    return { success: false, error: '파일 목록을 가져오는 중 오류가 발생했습니다' };
  }
}

/**
 * Get Google API access token from service account credentials.
 * Creates a self-signed JWT and exchanges it for an access token.
 * Uses Web Crypto API (Edge Runtime compatible).
 */
async function getGoogleAccessToken(): Promise<string> {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const toBase64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const unsignedToken = `${toBase64Url(header)}.${toBase64Url(payload)}`;

  // Import RSA private key for signing
  const pemKey = creds.private_key.replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '');
  const keyBuffer = Uint8Array.from(atob(pemKey), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${unsignedToken}.${sig}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

export async function exportContiToPptx(options: {
  fileId: string;
  overwrite: boolean;
  outputFileName?: string;
  songs: PptxExportSongData[];
  outputFolderId?: string;
}): Promise<ActionResult<PptxExportResult>> {
  try {
    const response = await fetch(getPptxApiUrl(), {
      method: 'POST',
      headers: getPptxHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'export_lyrics',
        file_id: options.fileId,
        overwrite: options.overwrite,
        output_file_name: options.outputFileName,
        output_folder_id: options.outputFolderId,
        songs: options.songs,
      }),
    });

    const contentType = response.headers.get('content-type') || '';

    if (contentType.startsWith('application/vnd.openxmlformats')) {
      // Binary PPTX response (new file path - uploaded to Vercel Blob)
      const arrayBuffer = await response.arrayBuffer();
      const songsProcessed = parseInt(response.headers.get('x-songs-processed') || '0', 10);
      const slidesGenerated = parseInt(response.headers.get('x-slides-generated') || '0', 10);

      const blob = await put(
        `pptx-exports/${options.outputFileName || 'export.pptx'}`,
        Buffer.from(arrayBuffer),
        { access: 'public' }
      );

      return {
        success: true,
        data: {
          file_id: '',
          file_name: options.outputFileName || 'export.pptx',
          web_view_link: '',
          download_url: blob.url,
          songs_processed: songsProcessed,
          slides_generated: slidesGenerated,
        },
      };
    } else {
      // JSON response (overwrite path or error responses)
      const text = await response.text();
      let result: { success: boolean; error?: string; data?: PptxExportResult };
      try {
        result = JSON.parse(text);
      } catch {
        console.error('[exportContiToPptx] Non-JSON response:', response.status, text.slice(0, 500));
        return {
          success: false,
          error: `PPT 서버 오류 (${response.status}): 응답을 처리할 수 없습니다`,
        };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'PPT 내보내기에 실패했습니다',
        };
      }

      return {
        success: true,
        data: result.data,
      };
    }
  } catch (error) {
    console.error('[exportContiToPptx]', error);
    return {
      success: false,
      error: 'PPT 내보내기 중 오류가 발생했습니다',
    };
  }
}

export async function inspectPptxTemplate(
  fileId: string
): Promise<ActionResult<PptxTemplateStructure>> {
  try {
    const response = await fetch(getPptxApiUrl(), {
      method: 'GET',
      headers: getPptxHeaders({
        'X-Action': 'inspect',
        'X-File-Id': fileId,
      }),
    });

    const text = await response.text();
    let result: { success: boolean; error?: string; data?: PptxTemplateStructure };
    try {
      result = JSON.parse(text);
    } catch {
      console.error('[inspectPptxTemplate] Non-JSON response:', response.status, text.slice(0, 500));
      return { success: false, error: `PPT 서버 오류 (${response.status}): 응답을 처리할 수 없습니다` };
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('[inspectPptxTemplate]', error);
    return { success: false, error: '템플릿 검사 중 오류가 발생했습니다' };
  }
}
