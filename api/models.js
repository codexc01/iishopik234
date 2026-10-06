import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No key' });
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const start = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: [{ role: 'user', parts: [{ text: 'Привет! Кто ты?' }] }],
      config: {
        systemInstruction: 'Ты — персональный умный AI-ассистент. Отвечай кратко в 1 предложение. Никогда не называй себя Gemini или Google.',
        maxOutputTokens: 60,
        temperature: 0.1
      }
    });
    const time = Date.now() - start;
    return res.status(200).json({ timeMs: time, reply: response.text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
