/**
 * Auto-connect content script — injected into Central's settings/integrations page.
 *
 * When a user generates an extension token, the raw token is briefly visible in the DOM.
 * This script detects it and automatically saves it to the extension's storage.
 */

const TOKEN_REGEX = /^cntrl_[a-f0-9]{40}$/;

function findVisibleToken() {
  // The ExtensionTokenCard renders the token inside a <code> element
  const codeElements = document.querySelectorAll('code');
  for (const el of codeElements) {
    const text = el.textContent?.trim();
    if (text && TOKEN_REGEX.test(text)) {
      return text;
    }
  }
  return null;
}

function checkAndConnect() {
  // Skip if already connected
  chrome.storage.sync.get(['apiToken'], (config) => {
    if (config.apiToken) return; // already connected

    const token = findVisibleToken();
    if (!token) return;

    // Determine the Central URL from the current page
    const centralUrl = window.location.origin;

    // Verify the token works and save it
    chrome.runtime.sendMessage(
      { type: 'API_REQUEST', method: 'GET', path: '/api/extension/verify' },
      (response) => {
        // The service worker won't have config yet, so verify directly
        fetch(`${centralUrl}/api/extension/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((user) => {
            if (!user) return;

            chrome.storage.sync.set({
              centralUrl,
              apiToken: token,
              userName: user.name || user.email,
            });

            // Show a brief confirmation in the page
            showNotification('Central extension connected!');
          })
          .catch(() => {});
      }
    );
  });
}

function showNotification(text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 99999;
    background: #22c55e; color: #fff; padding: 10px 16px;
    border-radius: 8px; font-size: 13px; font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: opacity 0.3s;
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// Watch for the token to appear in the DOM
const observer = new MutationObserver(() => {
  checkAndConnect();
});

observer.observe(document.body, { childList: true, subtree: true, characterData: true });

// Also check immediately in case the token is already visible
checkAndConnect();
