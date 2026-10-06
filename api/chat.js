import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';

const ADMIN_ID = '7965402795';

const SYSTEM_PROMPT = 'Ты — персональный умный AI-ассистент. Отвечай молниеносно, предельно кратко, емко и строго по сути заданного вопроса: максимум 1-2 коротких предложения или пара четких тезисов. Категорически запрещено здороваться, делать вступления, растягивать мысль или лить воду. Строжайший запрет: никогда не называй себя Gemini, Google, Bard или другими именами корпораций и кодовыми названиями моделей. Если спрашивают, кто ты или какая ты языковая модель — отвечай кратко: "Я ваш персональный умный AI-ассистент, готовый помочь с любыми задачами".';

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
    const user = JSON.parse(userRaw);
    return user.id ? String(user.id) : null;
  } catch (e) {
    return null;
  }
}

function verifyAccessToken(accessHeader, botToken) {
  if (!accessHeader || typeof accessHeader !== 'string') return null;
  const parts = accessHeader.trim().split('_');
  if (parts.length !== 2) return null;
  const [userId, hash] = parts;
  const expected = crypto.createHmac('sha256', botToken).update('grant:' + userId).digest('hex').slice(0, 32);
  if (hash === expected) {
    return userId;
  }
  return null;
}

function checkAuthorized(req, botToken) {
  const initData = req.headers['x-telegram-init-data'];
  const accessHeader = req.headers['x-access-token'];

  const tgUserId = verifyTelegramWebAppData(initData, botToken);
  const tokenUserId = verifyAccessToken(accessHeader, botToken);

  if (tgUserId) {
    if (tgUserId === ADMIN_ID) {
      return true;
    }
    if (tokenUserId && tokenUserId === tgUserId) {
      return true;
    }
    return false;
  }

  if (tokenUserId) {
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8574883810:AAHNExqjTWtnQP8lWrFT2Vvxh4e9WrSETTc';
  if (!checkAuthorized(req, botToken)) {
    return res.status(403).json({ error: 'Доступ ограничен' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel environment variables' });
  }

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
      const sanitizedHistory = history.slice(-4);
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
    const config = {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 120,
      temperature: 0.1
    };

    let reply = '';
    const models = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config
        });
        if (response && response.text) {
          reply = response.text.trim();
          break;
        }
      } catch (err) {
        if (model === models[models.length - 1]) {
          throw err;
        }
      }
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
