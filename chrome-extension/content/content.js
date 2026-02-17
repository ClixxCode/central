/**
 * Central content script — injected into app.frontapp.com
 *
 * Observes DOM mutations and injects a "Link to Central" button into
 * the conversation header's toolbar (next to More, Snooze, Assign, Archive).
 *
 * Clicking the button opens an inline panel to create/search/link a task.
 */

// ── Selectors ──────────────────────────────────────────────────────────────────
// Based on Front's actual DOM as of Feb 2026. Class prefixes are stable
// (component name), the hash suffix changes on deploys.
const SELECTORS = {
  // The top-level header container for the open conversation
  conversationHeader: '[class*="conversationHeader__StyledContainer"]',
  // The toolbar area with More / Snooze / Assign / Archive buttons
  topbarActions: '[class*="inboxesTopbarActions__StyledWrapperDiv"]',
  // The More "..." button — we inject just before it
  moreButton: '[data-testid="topbarMoreButton"]',
  // Subject text
  subject: '[data-searchable-subject="true"] span',
  // Viewer container (has data-testid="viewer-{id}")
  viewer: '[class*="viewer__StyledViewerDiv"]',
  // App root for MutationObserver
  appRoot: '#root, [id="app"]',
};

const ICON_SVG = `<svg viewBox="0 0 20 20" fill="none" width="20" height="20"><path d="M2 2h8M2 2v16h16v-8" stroke="#171717" stroke-width="2" stroke-linejoin="round"/><path d="M11 2h7v7" stroke="#dc2626" stroke-width="2" stroke-linejoin="round"/><path d="M6.5 6.5l7 7" stroke="#171717" stroke-width="2" stroke-linecap="round"/><path d="M13.5 6.5l-7 7" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/></svg>`;

const MARKER_ATTR = 'data-central-injected';

let activePanel = null;
let searchTimeout = null;
let currentConversationId = null; // tracks which conversation the injected button is for
let currentTheme = 'light'; // resolved theme ('light' or 'dark')
let centralUrl = ''; // base URL for building task links

// ── Create form state ────────────────────────────────────────────────────────
let createState = {
  boards: [],
  boardUsers: [],
  selectedBoard: null,
  selectedAssignees: [],
  selectedDate: null,
  selectedStatus: null,
  openDropdown: null, // 'board' | 'assignee' | 'date' | 'status' | null
};

function resetCreateState() {
  createState = {
    boards: [],
    boardUsers: [],
    selectedBoard: null,
    selectedAssignees: [],
    selectedDate: null,
    selectedStatus: null,
    openDropdown: null,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiRequest(method, path, body) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'API_REQUEST', method, path, body },
      (response) => resolve(response || { error: 'No response from service worker' })
    );
  });
}

function extractConversationId() {
  // Prefer cnv_ prefixed IDs from the URL (these work with the Front API)
  const match = window.location.href.match(/\/(cnv_[a-zA-Z0-9]+)/);
  if (match) return match[1];

  // Fall back to the viewer's data-testid numeric ID so the button still
  // appears. The actual cnv_ ID will be resolved server-side from the
  // conversationUrl we send along when linking.
  const viewer = document.querySelector('[data-testid^="viewer-"]');
  if (viewer) {
    const testId = viewer.getAttribute('data-testid');
    const viewerId = testId.replace('viewer-', '');
    if (viewerId) return viewerId;
  }

  return null;
}

function extractConversationSubject() {
  const el = document.querySelector(SELECTORS.subject);
  return el?.textContent?.trim() || null;
}

function extractConversationMeta() {
  const subject = extractConversationSubject();
  const url = window.location.href;

  let sender = null;
  let senderEmail = null;
  let recipient = null;
  let date = null;
  let body = null;

  try {
    // Find all message articles and grab the last (most recent) one
    const messageEls = document.querySelectorAll(
      '[class*="messageViewerBase__StyledMessageDiv"], [role="article"]'
    );
    const scope = messageEls.length > 0 ? messageEls[messageEls.length - 1] : document;

    // ── Sender name ──
    const detailsWrapper = scope.querySelector('[class*="messageViewerRecipient__StyledDetailsWrapperDiv"]');
    if (detailsWrapper) {
      const nameDiv = detailsWrapper.querySelector(':scope > div:first-child');
      const name = nameDiv?.textContent?.trim() || '';
      const accountEl = detailsWrapper.querySelector('[data-account-name]');
      const account = accountEl?.getAttribute('data-account-name') || '';
      sender = account ? `${name} (${account})` : name || null;
    }

    // ── Sender email ──
    const handleEl = scope.querySelector('[class*="messageViewerRecipient__StyledHandleSpan"]');
    if (handleEl) {
      const raw = handleEl.textContent?.trim() || '';
      const emailMatch = raw.match(/<([^>]+)>/);
      senderEmail = emailMatch ? emailMatch[1] : raw || null;
    }

    // ── Recipient (To line) ──
    const toContent = scope.querySelector('[class*="messageViewerDetails__StyledCollapsedSectionContentDiv"]');
    if (toContent) {
      const toLabel = scope.querySelector('[class*="messageViewerDetails__StyledSectionTitleDiv"]');
      const prefix = toLabel?.textContent?.trim() || 'To:';
      recipient = `${prefix} ${toContent.textContent?.trim() || ''}`.trim() || null;
    }

    // ── Date ──
    const dateEl = scope.querySelector('[class*="messageViewerDate__StyledDateDiv"]');
    if (dateEl) {
      date = dateEl.textContent?.trim() || null;
    }

    // ── Message body ──
    const bodyEl =
      scope.querySelector('[class*="messageHtml__StyledHtmlDiv"]') ||
      scope.querySelector('[class*="messageViewerEmailBody__StyledEmailDiv"]');
    if (bodyEl) {
      const text = (bodyEl.innerText || bodyEl.textContent || '').trim();
      body = text.length > 500 ? text.slice(0, 500) + '…' : text || null;
    }
    if (!body) {
      const blurbEl = scope.querySelector('[class*="messageViewerCollapsed__StyledBlurbDiv"]');
      if (blurbEl) {
        body = blurbEl.textContent?.trim() || null;
      }
    }
  } catch { /* graceful fallback — card still renders with subject + URL */ }

  return { subject, sender, senderEmail, recipient, date, body, url };
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateSuggestions() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextMonday = new Date(today);
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));

  const inOneWeek = new Date(today);
  inOneWeek.setDate(inOneWeek.getDate() + 7);

  const inTwoWeeks = new Date(today);
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return [
    { label: 'Today', date: toISODate(today) },
    { label: 'Tomorrow', date: toISODate(tomorrow) },
    { label: 'Next Monday', date: toISODate(nextMonday) },
    { label: 'In 1 week', date: toISODate(inOneWeek) },
    { label: 'In 2 weeks', date: toISODate(inTwoWeeks) },
    { label: 'Next month', date: toISODate(nextMonth) },
  ];
}

// ── Theme ──────────────────────────────────────────────────────────────────────

function resolveTheme(theme) {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  // system
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(overlay) {
  if (overlay) {
    overlay.setAttribute('data-central-theme', currentTheme);
  }
}

// ── URL / UUID detection ───────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractTaskIdFromInput(value) {
  const trimmed = value.trim();

  // Bare UUID
  if (UUID_RE.test(trimmed)) return trimmed;

  // Central URL containing ?task=UUID
  try {
    const url = new URL(trimmed);
    const taskParam = url.searchParams.get('task');
    if (taskParam && UUID_RE.test(taskParam)) return taskParam;
  } catch { /* not a URL */ }

  return null;
}

// ── Panel ──────────────────────────────────────────────────────────────────────

function closePanel() {
  if (activePanel) {
    activePanel.overlay.remove();
    activePanel = null;
    resetCreateState();
  }
}

function showPanel(anchorEl, conversationId, subject) {
  closePanel();

  const overlay = document.createElement('div');
  overlay.className = 'central-panel-overlay';
  overlay.setAttribute('data-central-theme', currentTheme);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });

  const panel = document.createElement('div');
  panel.className = 'central-panel';

  // Position below the anchor button
  const rect = anchorEl.getBoundingClientRect();
  panel.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 520)}px`;
  panel.style.left = `${Math.min(rect.left, window.innerWidth - 370)}px`;

  panel.innerHTML = `
    <div class="central-panel-header">
      <h3>Link to Central</h3>
      <button class="central-panel-close">&times;</button>
    </div>
    <div class="central-panel-create">
      <div class="central-panel-create-form">
        <input type="text" class="central-title-input" placeholder="Task name..." value="${escapeHtml(subject || '')}" autofocus>
        <textarea class="central-desc-input" placeholder="Description (optional)" rows="2"></textarea>
        <div class="central-chip-row">
          <button class="central-chip" data-chip="board">Board</button>
          <button class="central-chip" data-chip="assignee">Assignee</button>
          <button class="central-chip" data-chip="date">Date</button>
          <button class="central-chip" data-chip="status">Status</button>
        </div>
        <div class="central-form-footer">
          <button class="central-btn-cancel">Cancel</button>
          <button class="central-btn-primary" disabled>Create &amp; Link</button>
        </div>
      </div>
    </div>
    <div class="central-panel-search-section">
      <button class="central-panel-search-toggle">
        <span class="toggle-icon">&#9656;</span>
        Search existing tasks
      </button>
      <div class="central-panel-search-hint">or paste a Central task URL</div>
      <div class="central-panel-search" hidden>
        <input type="text" placeholder="Search tasks or paste a URL...">
      </div>
      <div class="central-panel-results" hidden></div>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  activePanel = { overlay, panel, conversationId, subject };

  // Wire up close
  panel.querySelector('.central-panel-close').addEventListener('click', closePanel);

  // Wire up create button + Enter on title + input tracking
  panel.querySelector('.central-btn-primary').addEventListener('click', handleCreate);
  const titleInput = panel.querySelector('.central-title-input');
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCreate();
  });
  titleInput.addEventListener('input', updateCreateBtnState);

  // Wire up cancel
  panel.querySelector('.central-btn-cancel').addEventListener('click', () => {
    closePanel();
  });

  // Wire up chip buttons
  panel.querySelectorAll('.central-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = chip.dataset.chip;
      toggleDropdown(type);
    });
  });

  // Close dropdown when clicking elsewhere in the form
  const createForm = panel.querySelector('.central-panel-create-form');
  createForm.addEventListener('click', (e) => {
    if (!e.target.closest('.central-chip') && !e.target.closest('.central-dropdown')) {
      closeDropdown();
    }
  });

  // Wire up search toggle
  const searchSection = panel.querySelector('.central-panel-search-section');
  const searchToggle = panel.querySelector('.central-panel-search-toggle');
  const searchHint = panel.querySelector('.central-panel-search-hint');
  const searchDiv = panel.querySelector('.central-panel-search');
  const resultsDiv = panel.querySelector('.central-panel-results');
  const createSection = panel.querySelector('.central-panel-create');

  searchToggle.addEventListener('click', () => {
    const isExpanded = searchSection.classList.contains('expanded');
    if (isExpanded) {
      // Collapse search, show create
      searchSection.classList.remove('expanded');
      searchDiv.hidden = true;
      resultsDiv.hidden = true;
      searchHint.hidden = false;
      createSection.hidden = false;
    } else {
      // Expand search, hide create
      searchSection.classList.add('expanded');
      searchDiv.hidden = false;
      resultsDiv.hidden = false;
      searchHint.hidden = true;
      createSection.hidden = true;
      const searchInput = searchDiv.querySelector('input');
      resultsDiv.innerHTML = '<div class="central-panel-empty">Type to search for a task</div>';
      setTimeout(() => searchInput.focus(), 50);
    }
  });

  // Wire up search input
  const searchInput = panel.querySelector('.central-panel-search input');
  searchInput.addEventListener('input', () => {
    const val = searchInput.value;
    const taskId = extractTaskIdFromInput(val);
    if (taskId) {
      // URL or UUID detected — link directly
      clearTimeout(searchTimeout);
      resultsDiv.innerHTML = '<div class="central-panel-loading">Linking...</div>';
      linkToTask(taskId);
      return;
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(val), 300);
  });

  // Auto-load boards immediately so chips are ready
  loadBoards();

  setTimeout(() => titleInput.focus(), 50);
}

// ── Dropdown management ─────────────────────────────────────────────────────

function toggleDropdown(type) {
  if (createState.openDropdown === type) {
    closeDropdown();
    return;
  }

  // For assignee/status, require board first
  if ((type === 'assignee' || type === 'status') && !createState.selectedBoard) {
    const boardChip = activePanel?.panel.querySelector('[data-chip="board"]');
    if (boardChip) {
      boardChip.style.borderColor = 'var(--c-destructive)';
      setTimeout(() => { boardChip.style.borderColor = ''; }, 800);
    }
    return;
  }

  closeDropdown();
  createState.openDropdown = type;

  const chipRow = activePanel.panel.querySelector('.central-chip-row');
  const dropdown = document.createElement('div');
  dropdown.className = 'central-dropdown';
  dropdown.addEventListener('click', (e) => e.stopPropagation());

  switch (type) {
    case 'board':
      renderBoardDropdown(dropdown);
      break;
    case 'assignee':
      renderAssigneeDropdown(dropdown);
      break;
    case 'date':
      renderDateDropdown(dropdown);
      break;
    case 'status':
      renderStatusDropdown(dropdown);
      break;
  }

  chipRow.appendChild(dropdown);

  // Focus search input if present
  const searchInput = dropdown.querySelector('.central-dropdown-search input');
  if (searchInput) setTimeout(() => searchInput.focus(), 30);
}

function closeDropdown() {
  createState.openDropdown = null;
  const existing = activePanel?.panel.querySelector('.central-dropdown');
  if (existing) existing.remove();
}

// ── Board dropdown ──────────────────────────────────────────────────────────

function renderBoardDropdown(dropdown) {
  const boards = createState.boards;
  if (!boards.length) {
    dropdown.innerHTML = '<div class="central-dropdown-empty">Loading boards...</div>';
    return;
  }

  dropdown.innerHTML = `
    <div class="central-dropdown-search">
      <input type="text" placeholder="Search boards...">
    </div>
    <div class="central-dropdown-list"></div>
  `;

  const searchInput = dropdown.querySelector('.central-dropdown-search input');
  const listEl = dropdown.querySelector('.central-dropdown-list');

  function render(filter) {
    listEl.innerHTML = '';
    const q = (filter || '').toLowerCase();

    // Group by client
    const groups = {};
    for (const b of boards) {
      const groupName = b.clientName || 'No Client';
      if (q && !b.name.toLowerCase().includes(q) && !groupName.toLowerCase().includes(q)) continue;
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(b);
    }

    for (const [groupName, groupBoards] of Object.entries(groups)) {
      const header = document.createElement('div');
      header.className = 'central-dropdown-group';
      header.textContent = groupName;
      listEl.appendChild(header);

      for (const b of groupBoards) {
        const item = document.createElement('div');
        item.className = 'central-dropdown-item' + (createState.selectedBoard?.id === b.id ? ' selected' : '');
        item.textContent = b.name;
        item.addEventListener('click', () => selectBoard(b));
        listEl.appendChild(item);
      }
    }

    if (!listEl.children.length) {
      listEl.innerHTML = '<div class="central-dropdown-empty">No boards found</div>';
    }
  }

  searchInput.addEventListener('input', () => render(searchInput.value));
  render('');
}

async function selectBoard(board) {
  createState.selectedBoard = board;
  // Auto-select first status
  if (board.statusOptions?.length) {
    createState.selectedStatus = board.statusOptions[0];
  } else {
    createState.selectedStatus = null;
  }
  createState.selectedAssignees = [];
  createState.boardUsers = [];
  closeDropdown();
  renderChips();
  updateCreateBtnState();

  // Load assignable users for the board
  const res = await apiRequest('GET', `/api/extension/users?boardId=${board.id}`);
  if (res && !res.error && res.data) {
    createState.boardUsers = res.data;
  }
}

// ── Assignee dropdown ───────────────────────────────────────────────────────

function renderAssigneeDropdown(dropdown) {
  const users = createState.boardUsers;

  dropdown.innerHTML = `
    <div class="central-dropdown-search">
      <input type="text" placeholder="Search people...">
    </div>
    <div class="central-dropdown-list"></div>
  `;

  const searchInput = dropdown.querySelector('.central-dropdown-search input');
  const listEl = dropdown.querySelector('.central-dropdown-list');

  function render(filter) {
    listEl.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const selectedIds = new Set(createState.selectedAssignees.map(u => u.id));

    const filtered = users.filter(u => {
      if (!q) return true;
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });

    if (!filtered.length) {
      listEl.innerHTML = '<div class="central-dropdown-empty">No people found</div>';
      return;
    }

    for (const u of filtered) {
      const isSelected = selectedIds.has(u.id);
      const item = document.createElement('div');
      item.className = 'central-dropdown-item' + (isSelected ? ' selected' : '');
      item.innerHTML = `
        <span class="central-dropdown-check">${isSelected ? '&#10003;' : ''}</span>
        <span class="central-avatar">${u.avatarUrl ? `<img src="${escapeHtml(u.avatarUrl)}">` : escapeHtml(getInitials(u.name))}</span>
        <span>${escapeHtml(u.name || u.email)}</span>
      `;
      item.addEventListener('click', () => {
        toggleAssignee(u);
        render(searchInput.value);
      });
      listEl.appendChild(item);
    }
  }

  searchInput.addEventListener('input', () => render(searchInput.value));
  render('');
}

function toggleAssignee(user) {
  const idx = createState.selectedAssignees.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    createState.selectedAssignees.splice(idx, 1);
  } else {
    createState.selectedAssignees.push(user);
  }
  renderChips();
}

// ── Date dropdown ───────────────────────────────────────────────────────────

function renderDateDropdown(dropdown) {
  const suggestions = getDateSuggestions();

  dropdown.innerHTML = `
    <div class="central-dropdown-list"></div>
    <div class="central-dropdown-date-input">
      <input type="date">
    </div>
  `;

  const listEl = dropdown.querySelector('.central-dropdown-list');

  for (const s of suggestions) {
    const item = document.createElement('div');
    item.className = 'central-dropdown-item date-option' + (createState.selectedDate === s.date ? ' selected' : '');
    item.innerHTML = `
      <span>${escapeHtml(s.label)}</span>
      <span class="date-label">${formatDate(s.date)}</span>
    `;
    item.addEventListener('click', () => {
      createState.selectedDate = s.date;
      closeDropdown();
      renderChips();
    });
    listEl.appendChild(item);
  }

  // Clear option if date is set
  if (createState.selectedDate) {
    const clearItem = document.createElement('div');
    clearItem.className = 'central-dropdown-item';
    clearItem.style.color = 'var(--c-muted-fg)';
    clearItem.textContent = 'Clear date';
    clearItem.addEventListener('click', () => {
      createState.selectedDate = null;
      closeDropdown();
      renderChips();
    });
    listEl.appendChild(clearItem);
  }

  const dateInput = dropdown.querySelector('input[type="date"]');
  if (createState.selectedDate) dateInput.value = createState.selectedDate;
  dateInput.addEventListener('change', () => {
    if (dateInput.value) {
      createState.selectedDate = dateInput.value;
      closeDropdown();
      renderChips();
    }
  });
}

// ── Status dropdown ─────────────────────────────────────────────────────────

function renderStatusDropdown(dropdown) {
  const statuses = createState.selectedBoard?.statusOptions || [];

  dropdown.innerHTML = '<div class="central-dropdown-list"></div>';
  const listEl = dropdown.querySelector('.central-dropdown-list');

  if (!statuses.length) {
    listEl.innerHTML = '<div class="central-dropdown-empty">No status options</div>';
    return;
  }

  for (const s of statuses) {
    const isSelected = createState.selectedStatus?.id === s.id;
    const item = document.createElement('div');
    item.className = 'central-dropdown-item' + (isSelected ? ' selected' : '');
    item.innerHTML = `
      <span class="central-status-dot" style="background: ${escapeHtml(s.color)}"></span>
      <span>${escapeHtml(s.label)}</span>
    `;
    item.addEventListener('click', () => {
      createState.selectedStatus = s;
      closeDropdown();
      renderChips();
    });
    listEl.appendChild(item);
  }
}

// ── Chip rendering ──────────────────────────────────────────────────────────

function renderChips() {
  if (!activePanel) return;
  const chipRow = activePanel.panel.querySelector('.central-chip-row');
  if (!chipRow) return;

  // Board chip
  const boardChip = chipRow.querySelector('[data-chip="board"]');
  if (boardChip) {
    if (createState.selectedBoard) {
      boardChip.className = 'central-chip active-board';
      boardChip.textContent = createState.selectedBoard.clientName
        ? `${createState.selectedBoard.clientName} / ${createState.selectedBoard.name}`
        : createState.selectedBoard.name;
    } else {
      boardChip.className = 'central-chip';
      boardChip.textContent = 'Board';
    }
  }

  // Assignee chip
  const assigneeChip = chipRow.querySelector('[data-chip="assignee"]');
  if (assigneeChip) {
    if (createState.selectedAssignees.length > 0) {
      assigneeChip.className = 'central-chip active-assignee';
      const names = createState.selectedAssignees.map(u => u.name?.split(' ')[0] || u.email).join(', ');
      assigneeChip.innerHTML = '';
      const avatarsSpan = document.createElement('span');
      avatarsSpan.className = 'central-chip-avatars';
      for (const u of createState.selectedAssignees.slice(0, 3)) {
        const av = document.createElement('span');
        av.className = 'central-avatar';
        if (u.avatarUrl) {
          av.innerHTML = `<img src="${escapeHtml(u.avatarUrl)}">`;
        } else {
          av.textContent = getInitials(u.name);
        }
        avatarsSpan.appendChild(av);
      }
      assigneeChip.appendChild(avatarsSpan);
      const countText = createState.selectedAssignees.length > 3
        ? ` +${createState.selectedAssignees.length - 3}`
        : '';
      assigneeChip.appendChild(document.createTextNode(
        createState.selectedAssignees.length <= 2
          ? ' ' + names
          : ` ${createState.selectedAssignees.length} people${countText}`
      ));
    } else {
      assigneeChip.className = 'central-chip';
      assigneeChip.textContent = 'Assignee';
    }
  }

  // Date chip
  const dateChip = chipRow.querySelector('[data-chip="date"]');
  if (dateChip) {
    if (createState.selectedDate) {
      dateChip.className = 'central-chip active-date';
      dateChip.textContent = formatDate(createState.selectedDate);
    } else {
      dateChip.className = 'central-chip';
      dateChip.textContent = 'Date';
    }
  }

  // Status chip
  const statusChip = chipRow.querySelector('[data-chip="status"]');
  if (statusChip) {
    if (createState.selectedStatus) {
      statusChip.className = 'central-chip active-status';
      statusChip.innerHTML = `<span class="central-status-dot" style="background: ${escapeHtml(createState.selectedStatus.color)}"></span> ${escapeHtml(createState.selectedStatus.label)}`;
    } else {
      statusChip.className = 'central-chip';
      statusChip.textContent = 'Status';
    }
  }
}

function updateCreateBtnState() {
  if (!activePanel) return;
  const btn = activePanel.panel.querySelector('.central-btn-primary');
  const title = activePanel.panel.querySelector('.central-title-input');
  if (btn && title) {
    btn.disabled = !createState.selectedBoard || !title.value.trim();
  }
}

// ── Search ──────────────────────────────────────────────────────────────────

async function handleSearch(query) {
  if (!activePanel) return;
  const resultsEl = activePanel.panel.querySelector('.central-panel-results');

  if (!query || query.length < 2) {
    resultsEl.innerHTML = '<div class="central-panel-empty">Type to search for a task</div>';
    return;
  }

  resultsEl.innerHTML = '<div class="central-panel-loading">Searching...</div>';

  const res = await apiRequest('GET', `/api/extension/tasks?search=${encodeURIComponent(query)}`);

  if (!activePanel) return;

  if (res.error) {
    resultsEl.innerHTML = `<div class="central-panel-error">${escapeHtml(res.error)}</div>`;
    return;
  }

  const tasks = res.data;
  if (!tasks || tasks.length === 0) {
    resultsEl.innerHTML = '<div class="central-panel-empty">No tasks found</div>';
    return;
  }

  resultsEl.innerHTML = '';
  for (const task of tasks) {
    const item = document.createElement('div');
    item.className = 'central-panel-result';
    item.innerHTML = `
      <div class="central-panel-result-title">${escapeHtml(task.title)}</div>
      <div class="central-panel-result-meta">${escapeHtml(task.clientName || '')} · ${escapeHtml(task.boardName || '')}</div>
    `;
    item.addEventListener('click', () => linkToTask(task.id, { boardId: task.boardId, clientSlug: task.clientSlug }));
    resultsEl.appendChild(item);
  }
}

// ── Board loading ───────────────────────────────────────────────────────────

async function loadBoards() {
  if (createState.boards.length > 0) return; // Already loaded

  const res = await apiRequest('GET', '/api/extension/boards');
  if (!activePanel) return;

  if (res.error) return;

  createState.boards = res.data || [];
}

// ── Create task ─────────────────────────────────────────────────────────────

async function handleCreate() {
  if (!activePanel) return;
  const title = activePanel.panel.querySelector('.central-title-input').value.trim();
  const description = activePanel.panel.querySelector('.central-desc-input')?.value.trim() || '';
  const createBtn = activePanel.panel.querySelector('.central-btn-primary');

  if (!createState.selectedBoard || !title) return;

  createBtn.disabled = true;
  createBtn.textContent = 'Creating...';

  const payload = {
    boardId: createState.selectedBoard.id,
    title,
  };

  if (createState.selectedStatus) {
    payload.status = createState.selectedStatus.id;
  }

  if (createState.selectedAssignees.length > 0) {
    payload.assigneeIds = createState.selectedAssignees.map(u => u.id);
  }

  if (createState.selectedDate) {
    payload.dueDate = createState.selectedDate;
  }

  // Send conversation metadata for rich card rendering
  const conversationMeta = extractConversationMeta();
  payload.conversationMeta = conversationMeta;
  if (description) {
    payload.description = description;
  }

  const res = await apiRequest('POST', '/api/extension/tasks', payload);
  if (!activePanel) return;

  if (res.error) {
    createBtn.textContent = 'Create & Link';
    createBtn.disabled = false;
    const errEl = document.createElement('div');
    errEl.className = 'central-panel-error';
    errEl.textContent = res.error;
    activePanel.panel.querySelector('.central-panel-create-form').appendChild(errEl);
    setTimeout(() => errEl.remove(), 3000);
    return;
  }

  await linkToTask(res.data.id, {
    skipMeta: true,
    boardId: createState.selectedBoard.id,
    clientSlug: createState.selectedBoard.clientSlug,
  });
}

// ── Link to task ────────────────────────────────────────────────────────────

async function linkToTask(taskId, options = {}) {
  if (!activePanel) return;
  const { conversationId, subject } = activePanel;

  const conversationUrl = window.location.href;
  const payload = {
    taskId,
    conversationId,
    subject,
    conversationUrl,
  };

  // Only send conversationMeta when linking to an existing task (not after create,
  // which already embeds the card in the description)
  if (!options.skipMeta) {
    payload.conversationMeta = extractConversationMeta();
  }

  // Show linking state
  const resultsEl = activePanel.panel.querySelector('.central-panel-results');
  if (resultsEl) resultsEl.innerHTML = '<div class="central-panel-loading">Linking...</div>';
  if (resultsEl) resultsEl.hidden = false;

  // Build task URL before closing panel
  const taskUrl = (options.boardId && options.clientSlug)
    ? `${centralUrl}/clients/${options.clientSlug}/boards/${options.boardId}?task=${taskId}`
    : `${centralUrl}`;

  const res = await apiRequest('POST', '/api/extension/conversations/link', payload);

  if (res.error) {
    if (activePanel && resultsEl) {
      resultsEl.innerHTML = `<div class="central-panel-error">${escapeHtml(res.error)}</div>`;
    }
    return;
  }

  closePanel();
  showToast(taskId, taskUrl);
}

// ── DOM Injection ──────────────────────────────────────────────────────────────

function createLinkButton(conversationId, subject) {
  // Wrap in the same toolbarButton wrapper div that Front uses so it blends in
  const wrapper = document.createElement('div');
  wrapper.className = 'toolbarButton__StyledWrapperDiv-sc-f2705230-0 dsEHCz';
  wrapper.setAttribute(MARKER_ATTR, 'true');

  const btn = document.createElement('div');
  btn.tabIndex = 0;
  btn.role = 'button';
  btn.className = 'front-hover-parent iconButton__StyledIconButtonWrapper-sc-bd5e2939-0 cbfhPr';
  btn.title = 'Link to Central';
  btn.innerHTML = ICON_SVG +
    '<span class="visuallyHidden__StyledWrapperSpan-sc-7f2f4ca0-0 javhyk">Link to Central</span>';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    showPanel(btn, conversationId, subject);
  });

  wrapper.appendChild(btn);
  return wrapper;
}

function injectIntoConversationHeader() {
  // Find the topbar actions area
  const actionsArea = document.querySelector(SELECTORS.topbarActions);
  if (!actionsArea) return;

  const convId = extractConversationId();
  if (!convId) return;

  const existingBtn = actionsArea.querySelector(`[${MARKER_ATTR}]`);

  // If the button is already there for the SAME conversation, nothing to do
  if (existingBtn && currentConversationId === convId) return;

  // Conversation changed or button missing — remove old button + close stale panel
  if (existingBtn) {
    existingBtn.remove();
    closePanel();
  }

  currentConversationId = convId;
  const subject = extractConversationSubject();
  const btn = createLinkButton(convId, subject);

  // Insert before the first child (the More "..." button wrapper)
  const moreBtn = actionsArea.querySelector(SELECTORS.moreButton);
  if (moreBtn) {
    const moreWrapper = moreBtn.closest('[class*="toolbarButton__StyledWrapperDiv"]');
    if (moreWrapper) {
      moreWrapper.parentNode.insertBefore(btn, moreWrapper);
      return;
    }
  }

  // Fallback: prepend to the actions area
  actionsArea.prepend(btn);
}

function injectAll() {
  injectIntoConversationHeader();
}

// ── Observer ───────────────────────────────────────────────────────────────────

function startObserving() {
  chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
    if (!config?.centralUrl || !config?.apiToken) return;

    centralUrl = config.centralUrl.replace(/\/$/, '');

    // Resolve and apply theme
    const themePref = config.theme || 'system';
    currentTheme = resolveTheme(themePref);

    // Initial injection
    injectAll();

    // Watch for DOM changes (Front is a SPA, content changes dynamically)
    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldInject = true;
          break;
        }
      }
      if (shouldInject) {
        clearTimeout(observer._timeout);
        observer._timeout = setTimeout(injectAll, 200);
      }
    });

    const root = document.querySelector(SELECTORS.appRoot) || document.body;
    observer.observe(root, { childList: true, subtree: true });
  });

  // Listen for theme changes from the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.theme) {
      currentTheme = resolveTheme(changes.theme.newValue || 'system');
      // Update any open panel
      if (activePanel?.overlay) {
        applyTheme(activePanel.overlay);
      }
    }
  });
}

// ── Utils ──────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function showToast(taskId, taskUrl) {
  // Remove any existing toast
  document.querySelector('.central-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'central-toast';
  toast.setAttribute('data-central-theme', currentTheme);

  toast.innerHTML = `
    <div class="central-toast-content">
      <span class="central-toast-check">&#10003;</span>
      <span class="central-toast-text">Linked to Central</span>
      <div class="central-toast-actions">
        <button class="central-toast-btn" data-action="copy">Copy URL</button>
        <button class="central-toast-btn" data-action="open">Open task</button>
      </div>
      <button class="central-toast-dismiss">&times;</button>
    </div>
  `;

  document.body.appendChild(toast);

  // Wire up actions
  toast.querySelector('[data-action="copy"]').addEventListener('click', () => {
    navigator.clipboard.writeText(taskUrl).then(() => {
      const btn = toast.querySelector('[data-action="copy"]');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy URL'; }, 1500);
    });
  });

  toast.querySelector('[data-action="open"]').addEventListener('click', () => {
    window.open(taskUrl, '_blank');
    toast.remove();
  });

  toast.querySelector('.central-toast-dismiss').addEventListener('click', () => {
    toast.remove();
  });

  // Auto-dismiss after 15s
  setTimeout(() => toast.remove(), 15000);
}

// ── Init ───────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}
