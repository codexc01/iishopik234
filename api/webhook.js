import crypto from 'crypto';

function generateUserToken(uid, secret) {
  return crypto.createHmac('sha256', secret).update(`access:${uid}`).digest('hex').slice(0, 16);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || '8574883810:AAHNExqjTWtnQP8lWrFT2Vvxh4e9WrSETTc';
  const appUrl = process.env.APP_URL || 'https://iishopik234.vercel.app';
  const adminId = String(process.env.ADMIN_ID || '7965402795');

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

    if (update && update.callback_query) {
      const cb = update.callback_query;
      const cbSenderId = String(cb.from.id);
      const data = cb.data || '';

      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cb.id })
      });

      if (cbSenderId === adminId && data.startsWith('allow:')) {
        const targetId = data.split(':')[1];
        const userToken = generateUserToken(targetId, token);
        const targetUrl = `${appUrl}?auth=${userToken}`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetId,
            text: targetUrl,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'AI Ассистент',
                    web_app: { url: targetUrl }
                  }
                ]
              ]
            }
          })
        });

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminId,
            text: `Доступ пользователю ${targetId} успешно выдан.`
          })
        });
      }
      return res.status(200).json({ ok: true });
    }

    if (update && update.message && update.message.chat) {
      const chatId = update.message.chat.id;
      const senderId = String(update.message.from ? update.message.from.id : chatId);
      const text = (update.message.text || '').trim();
      const isAdmin = senderId === adminId;

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const startParam = parts[1] || '';
        const expectedToken = generateUserToken(senderId, token);
        const isAuthorizedUser = isAdmin || (startParam && startParam === expectedToken);

        if (isAdmin || isAuthorizedUser) {
          const targetUrl = isAuthorizedUser && !isAdmin ? `${appUrl}?auth=${expectedToken}` : appUrl;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: targetUrl,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'AI Ассистент',
                      web_app: { url: targetUrl }
                    }
                  ]
                ]
              }
            })
          });
        } else {
          const username = update.message.from && update.message.from.username ? `@${update.message.from.username}` : `ID: ${senderId}`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `Доступ ограничен.\nВаш Telegram ID: ${senderId}\nОбратитесь к администратору для получения доступа.`
            })
          });

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: adminId,
              text: `Запрос на доступ:\nПользователь: ${username} (ID: ${senderId})\n\nЧтобы открыть доступ, нажмите кнопку ниже или отправьте:\n/allow ${senderId}`,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: `Разрешить доступ ${senderId}`,
                      callback_data: `allow:${senderId}`
                    }
                  ]
                ]
              }
            })
          });
        }
        return res.status(200).json({ ok: true });
      }

      if (isAdmin && text.startsWith('/allow')) {
        const parts = text.split(' ');
        const targetId = (parts[1] || '').trim();
        if (targetId) {
          const userToken = generateUserToken(targetId, token);
          const targetUrl = `${appUrl}?auth=${userToken}`;

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetId,
              text: targetUrl,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'AI Ассистент',
                      web_app: { url: targetUrl }
                    }
                  ]
                ]
              }
            })
          });

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: adminId,
              text: `Доступ пользователю ${targetId} успешно выдан.`
            })
          });
        } else {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: adminId,
              text: 'Укажите ID: /allow <ID_пользователя>'
            })
          });
        }
        return res.status(200).json({ ok: true });
      }

      if (isAdmin && text.startsWith('/revoke')) {
        const parts = text.split(' ');
        const targetId = (parts[1] || '').trim();
        if (targetId) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetId,
              text: 'Ваш доступ к AI Ассистенту был отозван администратором.'
            })
          });

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: adminId,
              text: `Доступ для пользователя ${targetId} успешно отозван.`
            })
          });
        }
        return res.status(200).json({ ok: true });
      }

      if (isAdmin && (text === '/admin' || text === '/help')) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminId,
            text: `Панель администратора:\n\nГлавный администратор: ${adminId}\n\nКоманды:\n/allow <ID> — Выдать доступ\n/revoke <ID> — Забрать доступ`
          })
        });
        return res.status(200).json({ ok: true });
      }
    }
  } catch (err) {
    console.error(err);
  }

  return res.status(200).json({ ok: true });
}
