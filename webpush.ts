// ============================================
// Web Push helper (VAPID) — يستخدم Web Crypto API
// متوافق مع Cloudflare Workers (لا يستخدم Node APIs)
// ============================================

import { getSetting, setSetting } from './db';

// ===== Base64 URL helpers =====
function b64uToUint8(b64u: string): Uint8Array {
  // base64url → base64
  let b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function uint8ToB64u(arr: Uint8Array | ArrayBuffer): string {
  const u = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function strToBuf(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// ===== توليد مفاتيح VAPID (P-256 ECDSA) =====
// نقوم بتوليدها مرة واحدة وتخزينها في bot_settings
export async function ensureVapidKeys(
  db: D1Database
): Promise<{ publicKey: string; privateKey: string }> {
  let pub = (await getSetting(db, 'vapid_public_key')) || '';
  let priv = (await getSetting(db, 'vapid_private_key')) || '';
  if (pub && priv) return { publicKey: pub, privateKey: priv };

  // توليد زوج مفاتيح ECDSA P-256
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  // raw public key (65 bytes: 0x04 || X || Y)
  const rawPub = await crypto.subtle.exportKey('raw', kp.publicKey);
  // JWK private key (نحفظ الـ d فقط كقيمة base64url + المنحنى)
  const jwkPriv = await crypto.subtle.exportKey('jwk', kp.privateKey);
  pub = uint8ToB64u(rawPub);
  priv = JSON.stringify(jwkPriv); // نخزن الـ JWK كاملاً للاسترجاع

  await setSetting(db, 'vapid_public_key', pub);
  await setSetting(db, 'vapid_private_key', priv);
  return { publicKey: pub, privateKey: priv };
}

export async function getVapidPublicKey(db: D1Database): Promise<string> {
  const k = await ensureVapidKeys(db);
  return k.publicKey;
}

// ===== توقيع JWT (ES256) لـ VAPID =====
async function signVapidJwt(audience: string, subject: string, privJwkJson: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, // 12h
    sub: subject,
  };
  const headB64 = uint8ToB64u(strToBuf(JSON.stringify(header)));
  const payloadB64 = uint8ToB64u(strToBuf(JSON.stringify(payload)));
  const signingInput = `${headB64}.${payloadB64}`;

  const jwk = JSON.parse(privJwkJson);
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    strToBuf(signingInput)
  );
  const sigB64 = uint8ToB64u(new Uint8Array(sig));
  return `${signingInput}.${sigB64}`;
}

// ===== AES-128-GCM Encryption for Web Push (RFC 8291) =====
// تشفير حمولة الإشعار باستخدام مخطط aes128gcm
async function encryptPayloadAes128Gcm(
  payload: Uint8Array,
  recipientP256dh: string,
  recipientAuth: string
): Promise<{ body: Uint8Array; salt: Uint8Array; ephemeralPublic: Uint8Array }> {
  // 1) توليد مفتاح ECDH عابر
  const ephemeralKp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const ephemeralPubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeralKp.publicKey)
  );

  // 2) استيراد مفتاح المستلم العام
  const recipientPubRaw = b64uToUint8(recipientP256dh);
  const recipientKey = await crypto.subtle.importKey(
    'raw',
    recipientPubRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 3) اشتقاق سر مشترك ECDH
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientKey },
    ephemeralKp.privateKey,
    256
  );
  const ikm1 = new Uint8Array(sharedSecret); // 32 bytes

  // 4) auth secret
  const authSecret = b64uToUint8(recipientAuth);

  // 5) HKDF لاستخراج IKM المعزز عن auth_secret
  const authInfoStr = 'WebPush: info\0';
  const authInfo = new Uint8Array(authInfoStr.length + recipientPubRaw.length + ephemeralPubRaw.length);
  authInfo.set(strToBuf(authInfoStr), 0);
  authInfo.set(recipientPubRaw, authInfoStr.length);
  authInfo.set(ephemeralPubRaw, authInfoStr.length + recipientPubRaw.length);

  const prk = await hkdfExtract(authSecret, ikm1);
  const ikm = await hkdfExpand(prk, authInfo, 32);

  // 6) Salt عشوائي للتشفير
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk2 = await hkdfExtract(salt, ikm);

  // 7) اشتقاق Content Encryption Key (CEK) و Nonce
  const cek = await hkdfExpand(prk2, strToBuf('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk2, strToBuf('Content-Encoding: nonce\0'), 12);

  // 8) تكوين الـ plaintext = payload + 0x02 (padding delimiter)
  const padded = new Uint8Array(payload.length + 1);
  padded.set(payload, 0);
  padded[payload.length] = 0x02;

  // 9) تشفير AES-128-GCM
  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    cekKey,
    padded
  );
  const cipher = new Uint8Array(cipherBuf);

  // 10) بناء الرأس وفق RFC 8188
  // header: salt(16) + rs(4) + idlen(1) + keyid (ephemeral pub raw 65 bytes)
  const rs = 4096;
  const keyid = ephemeralPubRaw;
  const header = new Uint8Array(16 + 4 + 1 + keyid.length);
  header.set(salt, 0);
  // rs as big-endian uint32
  header[16] = (rs >>> 24) & 0xff;
  header[17] = (rs >>> 16) & 0xff;
  header[18] = (rs >>> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = keyid.length;
  header.set(keyid, 21);

  // 11) النص الكامل
  const body = new Uint8Array(header.length + cipher.length);
  body.set(header, 0);
  body.set(cipher, header.length);

  return { body, salt, ephemeralPublic: ephemeralPubRaw };
}

// HKDF Extract: HMAC-SHA256(salt, IKM)
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, ikm);
  return new Uint8Array(mac);
}

// HKDF Expand: ادفع info + 0x01 (نستعمل T1 فقط لأن جميع الإخراجات < 32 بايت)
async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const buf = new Uint8Array(info.length + 1);
  buf.set(info, 0);
  buf[info.length] = 0x01;
  const t1 = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  return t1.subarray(0, length);
}

// ===== الواجهة الرئيسية =====
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  event_type?: string;
  event_ref_id?: number;
  icon?: string;
  badge?: string;
}

// إرسال إشعار لمشترك واحد
export async function sendWebPushToSubscription(
  db: D1Database,
  sub: { endpoint: string; p256dh_key: string; auth_key: string },
  payload: PushPayload
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const { privateKey } = await ensureVapidKeys(db);
    const vapidSubject = (await getSetting(db, 'vapid_subject')) || 'mailto:admin@example.com';
    const vapidPublicKey = await getVapidPublicKey(db);

    const u = new URL(sub.endpoint);
    const aud = `${u.protocol}//${u.host}`;
    const jwt = await signVapidJwt(aud, vapidSubject, privateKey);

    // تشفير الحمولة
    const payloadBytes = strToBuf(JSON.stringify(payload));
    const { body } = await encryptPayloadAes128Gcm(payloadBytes, sub.p256dh_key, sub.auth_key);

    // الإرسال
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: '86400',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body,
    });

    if (res.status === 410 || res.status === 404) {
      // المشترك مفقود — احذفه
      try {
        await db.prepare('DELETE FROM push_devices WHERE endpoint = ?').bind(sub.endpoint).run();
      } catch (_) {}
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('webpush failed', res.status, txt);
      return { ok: false, status: res.status, error: txt };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    console.error('sendWebPush error:', e?.message);
    return { ok: false, status: 0, error: e?.message };
  }
}

// إرسال إشعار لكل أجهزة مشرف لوحة معين
export async function sendWebPushToUser(
  db: D1Database,
  panelUserId: number,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  let sent = 0,
    failed = 0;
  let devices: any[] = [];
  try {
    const r = await db
      .prepare(
        'SELECT endpoint, p256dh_key, auth_key FROM push_devices WHERE panel_user_id = ? AND is_enabled = 1'
      )
      .bind(panelUserId)
      .all();
    devices = (r.results as any[]) || [];
  } catch (_) {}
  for (const d of devices) {
    const r = await sendWebPushToSubscription(db, d, payload);
    if (r.ok) {
      sent++;
      try {
        await db
          .prepare('UPDATE push_devices SET last_used_at = CURRENT_TIMESTAMP WHERE endpoint = ?')
          .bind(d.endpoint)
          .run();
      } catch (_) {}
    } else {
      failed++;
    }
  }
  return { sent, failed };
}
