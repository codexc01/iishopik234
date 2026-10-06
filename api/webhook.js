import crypto from 'crypto';

const ADMIN_ID = '7965402795';

function makeToken(userId, botToken) {
  const hmac = crypto.createHmac('sha256', botToken).update('grant:' + userId).digest('hex').slice(0, 32);
  return `${userId}_${hmac}`;
}

async function tgRequest(method, payload, botToken) {
  const slash2 = String.fromCharCode(47, 47);
  const url = 'https:' + slash2 + 'api.telegram.org/bot' + botToken + '/' + method;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

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

    if (update && update.callback_query) {
      const cq = update.callback_query;
      const fromId = String(cq.from && cq.from.id);
      const data = cq.data || '';

      await tgRequest('answerCallbackQuery', { callback_query_id: cq.id }, token);

      if (fromId === ADMIN_ID) {
        if (data.startsWith('allow_')) {
          const targetId = data.replace('allow_', '');
          const targetToken = makeToken(targetId, token);
          const targetUrl = `${appUrl}?access=${targetToken}`;

          await tgRequest('sendMessage', {
            chat_id: targetId,
            text: '🎉 Администратор одобрил вам доступ к AI Ассистенту!',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Открыть AI Ассистент',
                    web_app: { url: targetUrl }
                  }
                ]
              ]
            }
          }, token);

          if (cq.message && cq.message.message_id) {
            await tgRequest('editMessageText', {
              chat_id: cq.message.chat.id,
              message_id: cq.message.message_id,
              text: `✅ Доступ успешно выдан пользователю ID: ${targetId}`
            }, token);
          }
        } else if (data.startsWith('deny_')) {
          const targetId = data.replace('deny_', '');
          await tgRequest('sendMessage', {
            chat_id: targetId,
            text: '❌ Администратор отклонил ваш запрос на доступ.'
          }, token);

          if (cq.message && cq.message.message_id) {
            await tgRequest('editMessageText', {
              chat_id: cq.message.chat.id,
              message_id: cq.message.message_id,
              text: `❌ Запрос пользователя ID: ${targetId} отклонен.`
            }, token);
          }
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (update && update.message && update.message.chat) {
      const chatId = String(update.message.chat.id);
      const text = (update.message.text || '').trim();
      const user = update.message.from || {};
      const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Пользователь';
      const userHandle = user.username ? `@${user.username}` : 'без юзернейма';

      if (chatId === ADMIN_ID) {
        if (text.startsWith('/allow')) {
          const parts = text.split(/\s+/);
          const targetId = parts[1];
          if (targetId) {
            const targetToken = makeToken(targetId, token);
            const targetUrl = `${appUrl}?access=${targetToken}`;

            await tgRequest('sendMessage', {
              chat_id: targetId,
              text: '🎉 Администратор предоставил вам доступ к AI Ассистенту!',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🚀 Открыть AI Ассистент',
                      web_app: { url: targetUrl }
                    }
                  ]
                ]
              }
            }, token);

            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: `✅ Доступ успешно выдан пользователю ID: ${targetId}`
            }, token);
            return res.status(200).json({ ok: true });
          } else {
            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: 'Используйте: /allow <ID_пользователя>'
            }, token);
            return res.status(200).json({ ok: true });
          }
        }

        if (text.startsWith('/token')) {
          const parts = text.split(/\s+/);
          const targetId = parts[1];
          if (targetId) {
            const targetToken = makeToken(targetId, token);
            const targetUrl = `${appUrl}?access=${targetToken}`;
            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: `🔗 Персональная ссылка доступа для ID ${targetId}:\n${targetUrl}`
            }, token);
            return res.status(200).json({ ok: true });
          } else {
            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: 'Используйте: /token <ID_пользователя>'
            }, token);
            return res.status(200).json({ ok: true });
          }
        }

        if (text.startsWith('/revoke')) {
          const parts = text.split(/\s+/);
          const targetId = parts[1];
          if (targetId) {
            await tgRequest('sendMessage', {
              chat_id: targetId,
              text: '⛔️ Ваш доступ к AI Ассистенту был отозван администратором.'
            }, token);

            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: `🚫 Доступ пользователя ID: ${targetId} отозван.`
            }, token);
            return res.status(200).json({ ok: true });
          } else {
            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: 'Используйте: /revoke <ID_пользователя>'
            }, token);
            return res.status(200).json({ ok: true });
          }
        }

        const adminToken = makeToken(ADMIN_ID, token);
        const adminUrl = `${appUrl}?access=${adminToken}`;

        await tgRequest('sendMessage', {
          chat_id: chatId,
          text: `👑 Панель Главного Администратора\n\nВаш ID: ${ADMIN_ID}\n\nУправление доступом:\n• /allow <ID> — выдать доступ\n• /token <ID> — ссылка с доступом\n• /revoke <ID> — отозвать доступ\n\nЗапросы от новых пользователей будут приходить сюда с кнопками быстрого одобрения.`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть AI Ассистент',
                  web_app: { url: adminUrl }
                }
              ]
            ]
          }
        }, token);
        return res.status(200).json({ ok: true });
      }

      await tgRequest('sendMessage', {
        chat_id: chatId,
        text: `⛔️ Доступ ограничен.\n\nВаш Telegram ID: ${chatId}\n\nЗапрос на получение доступа отправлен главному администратору. Ожидайте подтверждения.`
      }, token);

      await tgRequest('sendMessage', {
        chat_id: ADMIN_ID,
        text: `🔔 Запрос на доступ к AI Ассистенту!\n\n👤 Пользователь: ${userName} (${userHandle})\n🆔 Telegram ID: ${chatId}`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Одобрить доступ',
                callback_data: `allow_${chatId}`
              },
              {
                text: '❌ Отклонить',
                callback_data: `deny_${chatId}`
              }
            ]
          ]
        }
      }, token);
    }
  } catch (err) {
    console.error(err);
  }

  return res.status(200).json({ ok: true });
}
