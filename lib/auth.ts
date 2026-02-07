const COOKIE_NAME = 'auth-token';
const encoder = new TextEncoder();

async function signToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode('authenticated'));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  const expected = await signToken(secret);
  return token === expected;
}

export { COOKIE_NAME, signToken, verifyToken };
