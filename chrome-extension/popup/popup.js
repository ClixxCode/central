/**
 * Central URLs to try, in order. First one that responds wins.
 */
const CENTRAL_URLS = [
  'https://central.clix.co',
  'http://localhost:3000',
];

const setupForm = document.getElementById('setup-form');
const connectedState = document.getElementById('connected-state');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const errorMsg = document.getElementById('error-msg');
const apiTokenInput = document.getElementById('api-token');
const userNameEl = document.getElementById('user-name');
const settingsLink = document.getElementById('settings-link');

// Set the settings link to the first URL
settingsLink.href = `${CENTRAL_URLS[0]}/settings/integrations`;

// ── Theme ──────────────────────────────────────────────────────────────────────

function resolveTheme(pref) {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  document.body.setAttribute('data-central-theme', resolved);

  // Highlight the active button
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === pref);
  });
}

// Load saved config on open
chrome.storage.sync.get(['centralUrl', 'apiToken', 'userName', 'theme'], (config) => {
  if (config.centralUrl && config.apiToken && config.userName) {
    showConnected(config.userName);
    settingsLink.href = `${config.centralUrl}/settings/integrations`;
  }

  // Apply theme (default: system)
  const themePref = config.theme || 'system';
  applyTheme(themePref);
});

// Theme button clicks
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const pref = btn.dataset.theme;
    chrome.storage.sync.set({ theme: pref });
    applyTheme(pref);
  });
});

connectBtn.addEventListener('click', () => connectWithToken(apiTokenInput.value.trim()));

disconnectBtn.addEventListener('click', () => {
  chrome.storage.sync.remove(['centralUrl', 'apiToken', 'userName'], () => {
    setupForm.hidden = false;
    connectedState.hidden = true;
    apiTokenInput.value = '';
  });
});

// Listen for auto-detected tokens from the Central settings page content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOKEN_DETECTED' && message.token) {
    connectWithToken(message.token);
    sendResponse({ ok: true });
  }
});

async function connectWithToken(apiToken) {
  if (!apiToken) {
    showError('Please enter an API token.');
    return;
  }

  if (!apiToken.startsWith('cntrl_')) {
    showError('Token should start with "cntrl_".');
    return;
  }

  connectBtn.disabled = true;
  connectBtn.textContent = 'Connecting...';
  hideError();

  // Try each Central URL
  for (const baseUrl of CENTRAL_URLS) {
    try {
      const res = await fetch(`${baseUrl}/api/extension/verify`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      if (!res.ok) continue;

      const user = await res.json();

      await chrome.storage.sync.set({
        centralUrl: baseUrl,
        apiToken,
        userName: user.name || user.email,
      });

      showConnected(user.name || user.email);
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
      return;
    } catch {
      // This URL didn't work, try next
    }
  }

  // None worked
  showError('Could not verify token. Make sure Central is running.');
  connectBtn.disabled = false;
  connectBtn.textContent = 'Connect';
}

function showConnected(name) {
  setupForm.hidden = true;
  connectedState.hidden = false;
  userNameEl.textContent = `Connected as ${name}`;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function hideError() {
  errorMsg.hidden = true;
}
