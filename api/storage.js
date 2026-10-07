const ADMIN_ID = '7965402795';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let memoryCache = null;
let memoryCacheTime = 0;

export async function getStorage(botToken = BOT_TOKEN) {
  const now = Date.now();
  if (memoryCache && now - memoryCacheTime < 10000) {
    return memoryCache;
  }

  const slash2 = String.fromCharCode(47, 47);
  const url = 'https:' + slash2 + 'api.telegram.org/bot' + botToken + '/getChat?chat_id=' + ADMIN_ID;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.ok && data.result && data.result.pinned_message) {
      const text = data.result.pinned_message.text || '';
      const messageId = data.result.pinned_message.message_id;
      if (text.startsWith('[SYSTEM_STORAGE]')) {
        const jsonPart = text.replace('[SYSTEM_STORAGE]', '').trim();
        const parsed = JSON.parse(jsonPart);
        const allowed = Array.isArray(parsed.allowed) ? parsed.allowed : [];
        memoryCache = { messageId, allowed };
        memoryCacheTime = now;
        return memoryCache;
      }
    }
  } catch (e) {}

  return { messageId: 42, allowed: [ADMIN_ID] };
}

export async function addAllowed(entry, botToken = BOT_TOKEN) {
  const clean = String(entry).trim().replace(/^@/, '').toLowerCase();
  if (!clean) return false;

  const current = await getStorage(botToken);
  const allowedSet = new Set(current.allowed.map(x => String(x).toLowerCase()));
  allowedSet.add(clean);
  const newAllowed = Array.from(allowedSet);

  const payload = { allowed: newAllowed };
  const newText = '[SYSTEM_STORAGE]\n' + JSON.stringify(payload);

  const slash2 = String.fromCharCode(47, 47);
  const editUrl = 'https:' + slash2 + 'api.telegram.org/bot' + botToken + '/editMessageText';
  const res = await fetch(editUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: ADMIN_ID,
      message_id: current.messageId,
      text: newText
    })
  });
  const data = await res.json();
  if (data && data.ok) {
    memoryCache = { messageId: current.messageId, allowed: newAllowed };
    memoryCacheTime = Date.now();
    return true;
  }
  return false;
}

export async function removeAllowed(entry, botToken = BOT_TOKEN) {
  const clean = String(entry).trim().replace(/^@/, '').toLowerCase();
  if (!clean || clean === ADMIN_ID) return false;

  const current = await getStorage(botToken);
  const newAllowed = current.allowed.filter(x => String(x).toLowerCase() !== clean);

  const payload = { allowed: newAllowed };
  const newText = '[SYSTEM_STORAGE]\n' + JSON.stringify(payload);

  const slash2 = String.fromCharCode(47, 47);
  const editUrl = 'https:' + slash2 + 'api.telegram.org/bot' + botToken + '/editMessageText';
  const res = await fetch(editUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: ADMIN_ID,
      message_id: current.messageId,
      text: newText
    })
  });
  const data = await res.json();
  if (data && data.ok) {
    memoryCache = { messageId: current.messageId, allowed: newAllowed };
    memoryCacheTime = Date.now();
    return true;
  }
  return false;
}

export async function isUserAllowed(userId, username, botToken = BOT_TOKEN) {
  const uId = userId ? String(userId).trim() : '';
  const uName = username ? String(username).trim().replace(/^@/, '').toLowerCase() : '';

  if (uId === ADMIN_ID) return true;

  const storage = await getStorage(botToken);
  const allowed = storage.allowed.map(x => String(x).toLowerCase());

  if (uId && allowed.includes(uId)) return true;
  if (uName && allowed.includes(uName)) return true;

  return false;
}
