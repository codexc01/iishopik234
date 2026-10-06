import { GoogleGenAI } from '@google/genai';

let cachedModel = null;

const SYSTEM_PROMPT = 'Отвечай максимально кратко, ёмко и строго по делу. Без приветствий, лишних вступлений и пространных рассуждений. Ответ должен быть не длиннее 1-3 коротких предложений или кратких пунктов.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
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
      const sanitizedHistory = history.slice(-10);
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
      maxOutputTokens: 200,
      temperature: 0.3
    };

    let modelsToTry = cachedModel ? [cachedModel] : [];

    if (modelsToTry.length === 0) {
      try {
        const listRes = await ai.models.list();
        if (listRes) {
          const dynamicList = [];
          for await (const m of listRes) {
            let name = m && m.name ? m.name : '';
            if (name.startsWith('models/')) {
              name = name.slice(7);
            }
            if (name) {
              dynamicList.push(name);
            }
          }
          if (dynamicList.length > 0) {
            const flashModels = dynamicList.filter(n => n.includes('flash'));
            modelsToTry = flashModels.concat(dynamicList);
          }
        }
      } catch (e) {}

      if (modelsToTry.length === 0) {
        modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash'];
      }
    }

    let reply = '';
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config
        });
        if (response && response.text) {
          reply = response.text.trim();
          cachedModel = model;
          break;
        }
      } catch (err) {
        lastError = err;
        if (cachedModel === model) {
          cachedModel = null;
        }
      }
    }

    if (!reply && lastError) {
      throw lastError;
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
