import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

function validateInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const keys = Array.from(params.keys()).sort();
    const checkString = keys.map(k => `${k}=${params.get(k)}`).join('\n');

    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculated = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (calculated.length !== hash.length) return null;
    const isMatch = crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(hash, 'hex'));
    if (!isMatch) return null;

    const authDate = parseInt(params.get('auth_date'), 10);
    if (isNaN(authDate) || (Math.floor(Date.now() / 1000) - authDate) > 86400) {
      return null;
    }

    const userRaw = params.get('user');
    return userRaw ? JSON.parse(userRaw) : null;
  } catch {
    return null;
  }
}

function generateUserToken(uid, secret) {
  return crypto.createHmac('sha256', secret).update(`access:${uid}`).digest('hex').slice(0, 16);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8574883810:AAHNExqjTWtnQP8lWrFT2Vvxh4e9WrSETTc';
  const adminId = String(process.env.ADMIN_ID || '7965402795');

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid Request' });
      }
    } else if (!body) {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString();
        body = JSON.parse(raw);
      } catch {
        return res.status(400).json({ error: 'Invalid Request' });
      }
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    const initDataHeader = req.headers['x-telegram-init-data'] || body.initData || '';
    const authTokenHeader = req.headers['x-auth-token'] || body.authToken || '';

    const validatedUser = validateInitData(initDataHeader, botToken);
    let isAuthorized = false;

    if (validatedUser && validatedUser.id) {
      const currentUserId = String(validatedUser.id);
      if (currentUserId === adminId) {
        isAuthorized = true;
      } else {
        const expectedToken = generateUserToken(currentUserId, botToken);
        if (authTokenHeader && authTokenHeader === expectedToken) {
          isAuthorized = true;
        } else {
          const allowedList = (process.env.ALLOWED_USERS || '').split(',').map(s => s.trim());
          if (allowedList.includes(currentUserId)) {
            isAuthorized = true;
          }
        }
      }
    } else if (authTokenHeader) {
      const adminToken = generateUserToken(adminId, botToken);
      if (authTokenHeader === adminToken) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access Denied. Contact admin 7965402795.' });
    }

    const { message, history } = body;
    if (typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > 4000) {
      return res.status(400).json({ error: 'Invalid Request' });
    }

    const contents = [];
    if (Array.isArray(history)) {
      const sanitizedHistory = history.slice(-20);
      for (const item of sanitizedHistory) {
        if (
          item &&
          typeof item === 'object' &&
          typeof item.content === 'string' &&
          (item.role === 'user' || item.role === 'model' || item.role === 'assistant')
        ) {
          const itemText = item.content.trim();
          if (itemText.length > 0 && itemText.length <= 4000) {
            const role = item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
            contents.push({
              role,
              parts: [{ text: itemText }]
            });
          }
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: trimmed }]
    });

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let reply = '';
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents
        });
        if (response && response.text) {
          reply = response.text;
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!reply && lastError) {
      throw lastError;
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
