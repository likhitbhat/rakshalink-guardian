// Web Push sender for the Cloudflare Worker runtime.
// Implements VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291)
// using only Web Crypto — no Node-only `web-push` dependency.

// Publishable VAPID application server public key (safe to expose).
export const VAPID_PUBLIC_KEY =
  "BJjlqJAJYU8QP9J4PZBRdw3vbYtEBz3bgjheWtVHuxpOhgFmvh-xwv4njunSjOBH1yb7QHZcojtE1C-zXP-d-uw";

const VAPID_SUBJECT = "mailto:alerts@rakshalink.app";

export type WebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const base64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Copy into a standalone ArrayBuffer so Web Crypto / fetch accept it under
// strict TS (avoids the SharedArrayBuffer union on Uint8Array.buffer).
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function getPrivateJwk(): JsonWebKey {
  const raw = process.env.VAPID_PRIVATE_KEY;
  if (!raw) throw new Error("VAPID_PRIVATE_KEY is not configured");
  const jwk = JSON.parse(raw) as JsonWebKey;
  if (!jwk.d || !jwk.x || !jwk.y) throw new Error("VAPID_PRIVATE_KEY must be an EC P-256 JWK with d/x/y");
  return { kty: "EC", crv: "P-256", d: jwk.d, x: jwk.x, y: jwk.y, ext: true };
}

// Build a signed VAPID JWT (ES256) for the given push endpoint origin.
async function buildVapidJwt(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };
  const enc = new TextEncoder();
  const signingInput =
    bytesToB64url(enc.encode(JSON.stringify(header))) +
    "." +
    bytesToB64url(enc.encode(JSON.stringify(payload)));

  const key = await crypto.subtle.importKey(
    "jwk",
    getPrivateJwk(),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(signingInput),
  );
  return signingInput + "." + bytesToB64url(new Uint8Array(sig));
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey("raw", ab(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: ab(salt), info: ab(info) },
    baseKey,
    length * 8,
  );
  return new Uint8Array(bits);
}

// Encrypt the payload with aes128gcm for a single subscription.
async function encryptPayload(
  sub: WebPushSubscription,
  payload: Uint8Array,
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(sub.p256dh); // 65 bytes uncompressed
  const authSecret = b64urlToBytes(sub.auth); // 16 bytes

  // Ephemeral server ECDH key pair.
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey),
  );

  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, serverKeys.privateKey, 256),
  );

  const enc = new TextEncoder();
  // IKM derivation (RFC 8291 §3.4)
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPublic,
    serverPublicRaw,
  );
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  // Single record: append 0x02 padding-delimiter, no extra padding.
  const plaintext = concat(payload, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext),
  );

  // aes128gcm header: salt(16) | rs(4) | idlen(1) | keyid(server pub 65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const idlen = new Uint8Array([serverPublicRaw.length]);

  return concat(salt, rs, idlen, serverPublicRaw, ciphertext);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  alertId?: string;
};

export type SendResult = { ok: boolean; status: number; gone: boolean; endpoint: string };

// Send one Web Push message. Returns gone=true when the subscription is expired
// (404/410) so the caller can delete it.
export async function sendWebPush(
  sub: WebPushSubscription,
  payload: PushPayload,
): Promise<SendResult> {
  const audience = new URL(sub.endpoint).origin;
  const jwt = await buildVapidJwt(audience);
  const body = await encryptPayload(sub, new TextEncoder().encode(JSON.stringify(payload)));

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });

  return {
    ok: res.ok,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
    endpoint: sub.endpoint,
  };
}
