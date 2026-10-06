export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  const slash2 = String.fromCharCode(47, 47);
  const token = process.env.TELEGRAM_BOT_TOKEN || '8574883810:AAHNExqjTWtnQP8lWrFT2Vvxh4e9WrSETTc';
  const appUrl = process.env.APP_URL || ('https:' + slash2 + 'iishopik234.vercel.app');

  try {
    let update = req.body;
    if (typeof update === 'string') {
      try {
        update = JSON.parse(update);
      } catch {
        return res.status(200).send('OK');
      }
    } else if (!update) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      try {
        update = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        return res.status(200).send('OK');
      }
    }

    if (update && update.message && update.message.chat) {
      const chatId = update.message.chat.id;
      const text = (update.message.text || '').trim();

      if (text.startsWith('/start') || text) {
        const tgApiUrl = 'https:' + slash2 + 'api.telegram.org/bot' + token + '/sendMessage';
        await fetch(tgApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Запустить AI Ассистент:',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Открыть AI Ассистент',
                    web_app: {
                      url: appUrl
                    }
                  }
                ]
              ]
            }
          })
        });
      }
    }
  } catch (err) {
    console.error(err);
  }

  return res.status(200).json({ ok: true });
}
