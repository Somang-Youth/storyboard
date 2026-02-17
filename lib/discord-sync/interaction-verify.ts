function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.trim();
  if (cleaned.length % 2 !== 0) {
    throw new Error('Invalid hex input');
  }

  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function verifyDiscordInteraction(body: string, signature: string, timestamp: string): Promise<boolean> {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex) {
    throw new Error('DISCORD_PUBLIC_KEY is not set');
  }

  const publicKey = toArrayBuffer(hexToBytes(publicKeyHex));
  const signatureBytes = toArrayBuffer(hexToBytes(signature));
  const payload = toArrayBuffer(new TextEncoder().encode(`${timestamp}${body}`));

  const key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'Ed25519' }, key, signatureBytes, payload);
}
