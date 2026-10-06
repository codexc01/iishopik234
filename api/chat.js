import { GoogleGenAI } from '@google/genai';

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
    
    let candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

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
          candidateModels = flashModels.concat(dynamicList);
        }
      }
    } catch (e) {}

    let reply = '';
    let lastError = null;

    for (const model of candidateModels) {
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
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
