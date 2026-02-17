/**
 * Service worker — handles all Central API calls on behalf of the content script.
 * Content scripts can't make cross-origin requests due to Front's CSP,
 * but the service worker has its own execution context.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_REQUEST') {
    handleApiRequest(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'GET_CONFIG') {
    chrome.storage.sync.get(['centralUrl', 'apiToken', 'userName', 'theme'], sendResponse);
    return true;
  }
});

async function handleApiRequest({ method, path, body }) {
  const { centralUrl, apiToken } = await chrome.storage.sync.get([
    'centralUrl',
    'apiToken',
  ]);

  if (!centralUrl || !apiToken) {
    return { error: 'Not configured. Open the extension popup to connect.' };
  }

  const url = `${centralUrl.replace(/\/$/, '')}${path}`;

  const options = {
    method: method || 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}` };
    }

    return { data };
  } catch (err) {
    return { error: `Network error: ${err.message}` };
  }
}
