import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = 'Ты — персональный умный AI-ассистент. Отвечай молниеносно, предельно кратко, емко и строго по сути заданного вопроса: максимум 1-2 коротких предложения или пара четких тезисов. Категорически запрещено здороваться, делать вступления, растягивать мысль или лить воду. Строжайший запрет: никогда не называй себя Gemini, Google, Bard или другими именами корпораций и кодовыми названиями моделей. Если спрашивают, кто ты или какая ты языковая модель — отвечай кратко: "Я ваш персональный умный AI-ассистент, готовый помочь с любыми задачами".';

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
