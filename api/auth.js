import crypto from 'crypto';
import { isUserAllowed } from './storage.js';

function makeToken(userId, botToken) {
  const hmac = crypto.createHmac('sha256', botToken).update('grant:' + userId).digest('hex').slice(0, 32);
  return `${userId}_${hmac}`;
}

function verifyTelegramWebAppData(initData, token) {
  if (!initData || typeof initData !== 'string') return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const calculated = crypto.createHmac('sha256', secret).update(sorted).digest('hex');
    if (calculated !== hash) return null;
    const userRaw = params.get('user');
    if (!userRaw) return null;
    return JSON.parse(userRaw);
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || '8574883810:AAHNExqjTWtnQP8lWrFT2Vvxh4e9WrSETTc';
  const initData = req.headers['x-telegram-init-data'];
  const accessHeader = req.headers['x-access-token'];

  const tgUser = verifyTelegramWebAppData(initData, token);

  if (tgUser) {
    const ok = await isUserAllowed(tgUser.id, tgUser.username, token);
    if (ok) {
      const grantToken = makeToken(tgUser.id, token);
      return res.status(200).json({ authorized: true, token: grantToken });
    }
    return res.status(403).json({ authorized: false, error: 'Доступ ограничен' });
  }

  if (accessHeader && typeof accessHeader === 'string') {
    const parts = accessHeader.trim().split('_');
    if (parts.length === 2) {
      const [userId, hash] = parts;
      const expected = crypto.createHmac('sha256', token).update('grant:' + userId).digest('hex').slice(0, 32);
      if (hash === expected) {
        return res.status(200).json({ authorized: true, token: accessHeader });
      }
    }
  }

  return res.status(403).json({ authorized: false, error: 'Доступ ограничен' });
}
