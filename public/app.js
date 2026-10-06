const SUN_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>`;
const MOON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
const COPY_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const CHECK_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const RETRY_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"></path></svg>`;
const SPARKLE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path></svg>`;

const STORAGE_CHATS_KEY = 'tg_gemini_chats_v2';
const STORAGE_ACTIVE_ID_KEY = 'tg_gemini_active_chat_id_v2';
const STORAGE_THEME_KEY = 'tg_gemini_theme_preference';
const STORAGE_ACCESS_KEY = 'tg_access_token';

const urlParams = new URLSearchParams(window.location.search);
const accessParam = urlParams.get('access') || urlParams.get('tgWebAppStartParam');
if (accessParam) {
  try {
    localStorage.setItem(STORAGE_ACCESS_KEY, accessParam);
  } catch {}
}

function getAuthHeaders() {
  const initData = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || '';
  let token = '';
  try {
    token = localStorage.getItem(STORAGE_ACCESS_KEY) || '';
  } catch {}
  return {
    'Content-Type': 'application/json',
    'x-telegram-init-data': initData,
    'x-access-token': token
  };
}

const accessBlockedOverlay = document.getElementById('accessBlockedOverlay');

function showAccessBlocked() {
  if (accessBlockedOverlay) {
    accessBlockedOverlay.classList.add('active');
  }
  const appLayout = document.querySelector('.app-layout');
  if (appLayout) {
    appLayout.style.display = 'none';
  }
}

async function checkAuthorization() {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      showAccessBlocked();
      return;
    }
    const data = await res.json().catch(() => null);
    if (!data || !data.authorized) {
      showAccessBlocked();
    }
  } catch (err) {
    showAccessBlocked();
  }
}

const drawerBackdrop = document.getElementById('drawerBackdrop');
const sidebarDrawer = document.getElementById('sidebarDrawer');
const openDrawerBtn = document.getElementById('openDrawerBtn');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const drawerNewChatBtn = document.getElementById('drawerNewChatBtn');
const headerNewChatBtn = document.getElementById('headerNewChatBtn');
const headerThemeToggleBtn = document.getElementById('headerThemeToggleBtn');
const drawerThemeToggleBtn = document.getElementById('drawerThemeToggleBtn');
const headerThemeIcon = document.getElementById('headerThemeIcon');
const drawerThemeIcon = document.getElementById('drawerThemeIcon');
const drawerThemeLabel = document.getElementById('drawerThemeLabel');
const drawerHistory = document.getElementById('drawerHistory');
const chatMessages = document.getElementById('chatMessages');
const chatViewport = document.getElementById('chatViewport');
const chatDateBadge = document.getElementById('chatDateBadge');
const typingContainer = document.getElementById('typingContainer');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

let chats = [];
let activeChatId = null;
let currentTheme = 'dark';
let isGenerating = false;

function initTelegram() {
  if (window.Telegram && window.Telegram.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      if (window.Telegram.WebApp.colorScheme) {
        const tgScheme = window.Telegram.WebApp.colorScheme;
        const saved = localStorage.getItem(STORAGE_THEME_KEY);
        if (!saved) {
          currentTheme = tgScheme === 'light' ? 'light' : 'dark';
        }
      }
    } catch (e) {}
  }
}

function triggerHaptic(type) {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
    try {
      if (type === 'selection') {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      } else if (type === 'success') {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else if (type === 'impact') {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    } catch (e) {}
  }
}

function applyTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem(STORAGE_THEME_KEY, currentTheme);

  if (currentTheme === 'dark') {
    headerThemeIcon.innerHTML = SUN_SVG;
    drawerThemeIcon.innerHTML = SUN_SVG;
    drawerThemeLabel.textContent = 'Светлая тема';
  } else {
    headerThemeIcon.innerHTML = MOON_SVG;
    drawerThemeIcon.innerHTML = MOON_SVG;
    drawerThemeLabel.textContent = 'Тёмная тема';
  }

  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.setHeaderColor) {
    try {
      window.Telegram.WebApp.setHeaderColor(currentTheme === 'dark' ? '#0c0d11' : '#ffffff');
    } catch (e) {}
  }
}

function toggleTheme() {
  triggerHaptic('impact');
  const next = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function getInitialMockData() {
  const now = Date.now();
  const dayMs = 86400000;
  return [
    {
      id: 'demo-1',
      title: 'Спокойный вечер',
      timestamp: now,
      messages: [
        {
          role: 'user',
          content: 'Как провести спокойный вечер и отвлечься от работы?',
          timestamp: now - 60000
        },
        {
          role: 'assistant',
          content: 'Попробуй вечер без спешки. Вот простой план на час:\n\n• **Смени обстановку.** Прогуляйся 15 минут без телефона.\n• **Добавь уюта.** Приготовь чай и включи спокойную музыку.\n• **Освободи голову.** Запиши мысли и оставь задачи до завтра.\n\nНе нужно делать всё. Начни с того, что сейчас приятно именно тебе.',
          timestamp: now
        }
      ]
    },
    {
      id: 'demo-2',
      title: 'Идеи для быстрого ужина',
      timestamp: now - 3600000 * 6,
      messages: [
        {
          role: 'user',
          content: 'Идеи для быстрого ужина',
          timestamp: now - 3600000 * 6
        }
      ]
    },
    {
      id: 'demo-3',
      title: 'Что почитать на выходных',
      timestamp: now - dayMs,
      messages: [
        {
          role: 'user',
          content: 'Что почитать на выходных',
          timestamp: now - dayMs
        }
      ]
    },
    {
      id: 'demo-4',
      title: 'План поездки в Петербург',
      timestamp: now - dayMs - 3600000 * 5,
      messages: [
        {
          role: 'user',
          content: 'План поездки в Петербург',
          timestamp: now - dayMs - 3600000 * 5
        }
      ]
    },
    {
      id: 'demo-5',
      title: 'Как выстроить привычку',
      timestamp: now - dayMs * 3,
      messages: [
        {
          role: 'user',
          content: 'Как выстроить привычку',
          timestamp: now - dayMs * 3
        }
      ]
    },
    {
      id: 'demo-6',
      title: 'Подарок для друга',
      timestamp: now - dayMs * 4,
      messages: [
        {
          role: 'user',
          content: 'Подарок для друга',
          timestamp: now - dayMs * 4
        }
      ]
    }
  ];
}

function loadChats() {
  const saved = localStorage.getItem(STORAGE_CHATS_KEY);
  if (saved) {
    try {
      chats = JSON.parse(saved);
      if (!Array.isArray(chats)) {
        chats = getInitialMockData();
      }
    } catch (e) {
      chats = getInitialMockData();
    }
  } else {
    chats = getInitialMockData();
    saveChats();
  }

  const savedActiveId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
  if (savedActiveId && chats.some(c => c.id === savedActiveId)) {
    activeChatId = savedActiveId;
  } else if (chats.length > 0) {
    activeChatId = chats[0].id;
  } else {
    createNewChat(false);
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(chats));
  if (activeChatId) {
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, activeChatId);
  }
}

function getActiveChat() {
  return chats.find(c => c.id === activeChatId) || null;
}

function createNewChat(focus = true) {
  triggerHaptic('impact');
  if (typingContainer) {
    typingContainer.classList.remove('active');
  }
  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: 'Новый чат',
    timestamp: Date.now(),
    messages: []
  };
  chats.unshift(newChat);
  activeChatId = newChat.id;
  saveChats();
  renderHistory();
  renderActiveChat();
  closeDrawer();
  if (focus) {
    messageInput.focus();
  }
}

function selectChat(id) {
  triggerHaptic('selection');
  if (typingContainer) {
    typingContainer.classList.remove('active');
  }
  activeChatId = id;
  saveChats();
  renderHistory();
  renderActiveChat();
  closeDrawer();
}

function openDrawer() {
  triggerHaptic('selection');
  renderHistory();
  sidebarDrawer.classList.add('active');
  drawerBackdrop.classList.add('active');
}

function closeDrawer() {
  sidebarDrawer.classList.remove('active');
  drawerBackdrop.classList.remove('active');
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

function formatDateItem(timestamp) {
  const d = new Date(timestamp);
  const now = new Date();
  const isSameDay = d.toDateString() === now.toDateString();
  const timeStr = formatTime(timestamp);
  if (isSameDay) {
    return timeStr;
  }
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  return `${day} ${month}, ${timeStr}`;
}

function groupChatsByPeriod(list) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const thisWeekStart = todayStart - 86400000 * 6;

  const groups = {
    today: [],
    yesterday: [],
    week: [],
    earlier: []
  };

  list.forEach(c => {
    const t = c.timestamp;
    if (t >= todayStart) {
      groups.today.push(c);
    } else if (t >= yesterdayStart) {
      groups.yesterday.push(c);
    } else if (t >= thisWeekStart) {
      groups.week.push(c);
    } else {
      groups.earlier.push(c);
    }
  });

  return groups;
}

function renderHistory() {
  drawerHistory.textContent = '';
  const groups = groupChatsByPeriod(chats);

  const sections = [
    { label: 'Сегодня', items: groups.today },
    { label: 'Вчера', items: groups.yesterday },
    { label: 'На этой неделе', items: groups.week },
    { label: 'Ранее', items: groups.earlier }
  ];

  sections.forEach(sec => {
    if (sec.items.length === 0) return;

    const sectionEl = document.createElement('div');
    sectionEl.className = 'history-section';

    const labelEl = document.createElement('div');
    labelEl.className = 'section-label';
    labelEl.textContent = sec.label;
    sectionEl.appendChild(labelEl);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'history-items';

    sec.items.forEach(c => {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'chat-item' + (c.id === activeChatId ? ' active' : '');
      itemBtn.addEventListener('click', () => selectChat(c.id));

      const headerRow = document.createElement('div');
      headerRow.className = 'chat-item-header';

      const titleEl = document.createElement('span');
      titleEl.className = 'chat-item-title';
      titleEl.textContent = c.title || 'Новый чат';
      headerRow.appendChild(titleEl);

      if (c.id === activeChatId) {
        const dot = document.createElement('span');
        dot.className = 'chat-item-dot';
        headerRow.appendChild(dot);
      }

      itemBtn.appendChild(headerRow);

      const timeEl = document.createElement('span');
      timeEl.className = 'chat-item-time';
      timeEl.textContent = formatDateItem(c.timestamp);
      itemBtn.appendChild(timeEl);

      itemsContainer.appendChild(itemBtn);
    });

    sectionEl.appendChild(itemsContainer);
    drawerHistory.appendChild(sectionEl);
  });
}

function renderInlineSafe(element, text) {
  let currentIndex = 0;
  const tokenRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      const plain = text.substring(currentIndex, match.index);
      element.appendChild(document.createTextNode(plain));
    }

    if (match[2]) {
      const strong = document.createElement('strong');
      strong.textContent = match[2];
      element.appendChild(strong);
    } else if (match[3]) {
      const em = document.createElement('em');
      em.textContent = match[3];
      element.appendChild(em);
    } else if (match[4]) {
      const code = document.createElement('code');
      code.textContent = match[4];
      element.appendChild(code);
    }

    currentIndex = tokenRegex.lastIndex;
  }

  if (currentIndex < text.length) {
    const trailing = text.substring(currentIndex);
    element.appendChild(document.createTextNode(trailing));
  }
}

function renderMarkdownSafe(container, rawText) {
  const lines = rawText.split('\n');
  let currentList = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      currentList = null;
      return;
    }

    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)$/);
    if (bulletMatch) {
      if (!currentList) {
        currentList = document.createElement('ul');
        container.appendChild(currentList);
      }
      const li = document.createElement('li');
      renderInlineSafe(li, bulletMatch[3]);
      currentList.appendChild(li);
    } else {
      currentList = null;
      const p = document.createElement('p');
      renderInlineSafe(p, trimmed);
      container.appendChild(p);
    }
  });
}

function copyToClipboard(text, buttonElement) {
  triggerHaptic('success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }

  buttonElement.classList.add('copied');
  buttonElement.innerHTML = CHECK_SVG;
  setTimeout(() => {
    buttonElement.classList.remove('copied');
    buttonElement.innerHTML = COPY_SVG;
  }, 1600);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
  } catch (e) {}
  document.body.removeChild(ta);
}

function renderActiveChat() {
  chatMessages.textContent = '';
  if (typingContainer) {
    typingContainer.classList.remove('active');
  }
  const currentChat = getActiveChat();

  if (!currentChat || currentChat.messages.length === 0) {
    const now = new Date();
    chatDateBadge.textContent = `Сегодня, ${formatTime(now.getTime())}`;
    return;
  }

  const firstMsg = currentChat.messages[0];
  chatDateBadge.textContent = `Сегодня, ${formatTime(firstMsg.timestamp || currentChat.timestamp)}`;

  currentChat.messages.forEach((msg, idx) => {
    const messageItem = document.createElement('div');
    messageItem.className = 'message-item ' + (msg.role === 'user' ? 'user' : 'assistant');

    if (msg.role === 'user') {
      const bubble = document.createElement('div');
      bubble.className = 'user-bubble';
      bubble.textContent = msg.content;
      messageItem.appendChild(bubble);
    } else {
      const wrapper = document.createElement('div');
      wrapper.className = 'assistant-wrapper';

      const label = document.createElement('div');
      label.className = 'assistant-label';
      label.innerHTML = SPARKLE_SVG;
      const labelText = document.createElement('span');
      labelText.textContent = 'Ассистент';
      label.appendChild(labelText);
      wrapper.appendChild(label);

      const bubble = document.createElement('div');
      bubble.className = 'assistant-bubble';
      renderMarkdownSafe(bubble, msg.content);
      wrapper.appendChild(bubble);

      const actions = document.createElement('div');
      actions.className = 'message-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'action-btn copy-btn';
      copyBtn.innerHTML = COPY_SVG;
      copyBtn.setAttribute('aria-label', 'Скопировать ответ');
      copyBtn.addEventListener('click', () => copyToClipboard(msg.content, copyBtn));
      actions.appendChild(copyBtn);

      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'action-btn retry-btn';
      retryBtn.innerHTML = RETRY_SVG;
      retryBtn.setAttribute('aria-label', 'Повторить запрос');
      retryBtn.addEventListener('click', () => regenerateResponse(idx));
      actions.appendChild(retryBtn);

      wrapper.appendChild(actions);
      messageItem.appendChild(wrapper);
    }

    chatMessages.appendChild(messageItem);
  });

  scrollToBottom();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatViewport.scrollTop = chatViewport.scrollHeight;
  });
}

function autoResizeInput() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

async function handleSendMessage(text) {
  const query = text.trim();
  if (!query || query.length > 4000 || isGenerating) return;

  const currentChat = getActiveChat();
  if (!currentChat) return;

  triggerHaptic('impact');

  if (currentChat.messages.length === 0) {
    currentChat.title = query.length > 32 ? query.substring(0, 32).trim() + '...' : query;
  }

  const userMsg = {
    role: 'user',
    content: query,
    timestamp: Date.now()
  };

  currentChat.messages.push(userMsg);
  currentChat.timestamp = Date.now();
  saveChats();
  renderActiveChat();
  renderHistory();

  messageInput.value = '';
  autoResizeInput();
  isGenerating = true;
  sendBtn.disabled = true;

  if (typingContainer) {
    typingContainer.classList.add('active');
  }
  scrollToBottom();

  const historyPayload = currentChat.messages.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content
  }));

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message: query,
        history: historyPayload
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 403) {
        showAccessBlocked();
      }
      const errText = data && data.error ? data.error : 'Не удалось получить ответ.';
      throw new Error(errText);
    }

    const reply = data && typeof data.reply === 'string' ? data.reply : '';

    currentChat.messages.push({
      role: 'assistant',
      content: reply,
      timestamp: Date.now()
    });
    currentChat.timestamp = Date.now();
    saveChats();
    triggerHaptic('success');
  } catch (err) {
    currentChat.messages.push({
      role: 'assistant',
      content: err.message || 'Не удалось получить ответ.',
      timestamp: Date.now()
    });
    saveChats();
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
    if (typingContainer) {
      typingContainer.classList.remove('active');
    }
    renderActiveChat();
    renderHistory();
  }
}

async function regenerateResponse(assistantIndex) {
  if (isGenerating) return;
  const currentChat = getActiveChat();
  if (!currentChat) return;

  let userQuery = '';
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (currentChat.messages[i].role === 'user') {
      userQuery = currentChat.messages[i].content;
      break;
    }
  }

  if (!userQuery) return;

  triggerHaptic('impact');
  currentChat.messages.splice(assistantIndex, 1);
  saveChats();
  renderActiveChat();

  isGenerating = true;
  sendBtn.disabled = true;

  if (typingContainer) {
    typingContainer.classList.add('active');
  }
  scrollToBottom();

  const historyPayload = currentChat.messages.slice(0, assistantIndex).map(m => ({
    role: m.role,
    content: m.content
  }));

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message: userQuery,
        history: historyPayload
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 403) {
        showAccessBlocked();
      }
      const errText = data && data.error ? data.error : 'Не удалось повторить запрос.';
      throw new Error(errText);
    }

    const reply = data && typeof data.reply === 'string' ? data.reply : '';

    currentChat.messages.push({
      role: 'assistant',
      content: reply,
      timestamp: Date.now()
    });
    saveChats();
    triggerHaptic('success');
  } catch (err) {
    currentChat.messages.push({
      role: 'assistant',
      content: err.message || 'Не удалось повторить запрос.',
      timestamp: Date.now()
    });
    saveChats();
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
    if (typingContainer) {
      typingContainer.classList.remove('active');
    }
    renderActiveChat();
    renderHistory();
  }
}

openDrawerBtn.addEventListener('click', openDrawer);
closeDrawerBtn.addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);
drawerNewChatBtn.addEventListener('click', () => createNewChat(true));
headerNewChatBtn.addEventListener('click', () => createNewChat(true));
headerThemeToggleBtn.addEventListener('click', toggleTheme);
drawerThemeToggleBtn.addEventListener('click', toggleTheme);

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSendMessage(messageInput.value);
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage(messageInput.value);
  }
});

messageInput.addEventListener('input', autoResizeInput);

const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
initTelegram();
applyTheme(savedTheme || currentTheme);
loadChats();
renderHistory();
renderActiveChat();
checkAuthorization();
