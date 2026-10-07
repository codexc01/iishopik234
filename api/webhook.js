import { addAllowed, removeAllowed, getStorage } from './storage.js';

const ADMIN_ID = '7965402795';

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
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
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
          const rest = data.replace('allow_', '');
          const parts = rest.split('_');
          const targetId = parts[0];
          const targetUser = parts[1] || '';

          if (targetId) {
            await addAllowed(targetId, token);
          }
          if (targetUser) {
            await addAllowed(targetUser, token);
          }

          if (targetId) {
            await tgRequest('sendMessage', {
              chat_id: targetId,
              text: '🎉 Администратор одобрил вам доступ к AI Ассистенту!'
            }, token);
          }

          if (cq.message && cq.message.message_id) {
            const display = targetUser ? `${targetId} (@${targetUser})` : targetId;
            await tgRequest('editMessageText', {
              chat_id: cq.message.chat.id,
              message_id: cq.message.message_id,
              text: `✅ Доступ успешно выдан: ${display}`
            }, token);
          }
        } else if (data.startsWith('deny_')) {
          const targetId = data.replace('deny_', '').split('_')[0];
          if (targetId) {
            await tgRequest('sendMessage', {
              chat_id: targetId,
              text: 'Доступ ограничен'
            }, token);
          }

          if (cq.message && cq.message.message_id) {
            await tgRequest('editMessageText', {
              chat_id: cq.message.chat.id,
              message_id: cq.message.message_id,
              text: `❌ Запрос пользователя ${targetId} отклонен.`
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

      if (text.startsWith('/start')) {
        await tgRequest('setChatMenuButton', {
          chat_id: chatId,
          menu_button: {
            type: 'web_app',
            text: 'AI Ассистент',
            web_app: { url: appUrl }
          }
        }, token);
        return res.status(200).json({ ok: true });
      }

      if (chatId === ADMIN_ID) {
        if (text.startsWith('/allow')) {
          const parts = text.split(/\s+/);
          const target = (parts[1] || '').trim();
          if (target) {
            await addAllowed(target, token);
            const isNumeric = /^\d+$/.test(target);
            if (isNumeric) {
              await tgRequest('sendMessage', {
                chat_id: target,
                text: '🎉 Администратор предоставил вам доступ к AI Ассистенту!'
              }, token);
            }
            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: `✅ Доступ успешно выдан: ${target}`
            }, token);
            return res.status(200).json({ ok: true });
          } else {
            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: 'Используйте: /allow <ID или @username>'
            }, token);
            return res.status(200).json({ ok: true });
          }
        }

        if (text.startsWith('/revoke')) {
          const parts = text.split(/\s+/);
          const target = (parts[1] || '').trim();
          if (target) {
            await removeAllowed(target, token);
            const isNumeric = /^\d+$/.test(target);
            if (isNumeric) {
              await tgRequest('sendMessage', {
                chat_id: target,
                text: 'Доступ ограничен'
              }, token);
            }
            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: `🚫 Доступ отозван: ${target}`
            }, token);
            return res.status(200).json({ ok: true });
          } else {
            await tgRequest('sendMessage', {
              chat_id: chatId,
              text: 'Используйте: /revoke <ID или @username>'
            }, token);
            return res.status(200).json({ ok: true });
          }
        }

        if (text === '/users' || text === '/list') {
          const storage = await getStorage(token);
          const list = storage.allowed.map(x => `• ${x}`).join('\n') || 'Список пуст';
          await tgRequest('sendMessage', {
            chat_id: chatId,
            text: `👥 Разрешенные пользователи:\n\n${list}`
          }, token);
          return res.status(200).json({ ok: true });
        }

        await tgRequest('sendMessage', {
          chat_id: chatId,
          text: `👑 Панель Главного Администратора\n\nВаш ID: ${ADMIN_ID}\n\nУправление доступом:\n• /allow <ID или @username> — выдать доступ\n• /revoke <ID или @username> — отозвать доступ\n• /users — список допущенных пользователей\n\nЗапросы от новых пользователей будут приходить сюда с кнопками быстрого одобрения.`
        }, token);
        return res.status(200).json({ ok: true });
      }

      await tgRequest('sendMessage', {
        chat_id: chatId,
        text: 'Доступ ограничен'
      }, token);

      const callbackDataAllow = 'allow_' + chatId + (user.username ? ('_' + user.username) : '');
      const callbackDataDeny = 'deny_' + chatId;

      await tgRequest('sendMessage', {
        chat_id: ADMIN_ID,
        text: `🔔 Запрос на доступ к AI Ассистенту!\n\n👤 Пользователь: ${userName} (${userHandle})\n🆔 Telegram ID: ${chatId}`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Одобрить доступ',
                callback_data: callbackDataAllow
              },
              {
                text: '❌ Отклонить',
                callback_data: callbackDataDeny
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
