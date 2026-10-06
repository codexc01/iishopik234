import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No key' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const listRes = await ai.models.list();
    const names = [];
    for await (const m of listRes) {
      names.push(m.name);
    }
    return res.status(200).json({ models: names });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
