/**
 * CCTV OPS V2 - Native Outlook Service
 * Full-featured interactive Outlook client inside CCTV OPS:
 * - Inbox viewing & live search
 * - Reading pane with HTML sanitization & attachment inspection
 * - Native composer: Send mail (POST /me/sendMail)
 * - Reply & Reply All
 * - In-app new mail notifications & unread badges
 * - Never opens Outlook Web for normal usage
 */

window.CCTV_OUTLOOK = (function () {
  'use strict';

  let messages = [];
  let currentMessage = null;
  let currentFilter = 'all'; // 'all' | 'unread'
  let searchQuery = '';
  let isLoading = false;
  let pollingTimer = null;
  const notifiedMessageIds = new Set();
  let composeState = {
    isOpen: false,
    mode: 'new', // 'new' | 'reply' | 'replyAll'
    replyToId: null,
    to: '',
    cc: '',
    subject: '',
    body: ''
  };

  /**
   * HTML Sanitizer to prevent XSS in email preview
   */
  function sanitizeHtml(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove dangerous tags
    const blockedTags = ['script', 'iframe', 'object', 'embed', 'link', 'style', 'base', 'meta', 'applet', 'form'];
    blockedTags.forEach(tag => {
      const els = temp.querySelectorAll(tag);
      els.forEach(el => el.remove());
    });

    // Remove inline event handlers & dangerous attributes
    const allEls = temp.querySelectorAll('*');
    allEls.forEach(el => {
      for (let i = el.attributes.length - 1; i >= 0; i--) {
        const attr = el.attributes[i];
        const attrName = attr.name.toLowerCase();
        const attrVal = attr.value.toLowerCase().replace(/\s+/g, '');

        if (attrName.startsWith('on') || attrVal.startsWith('javascript:') || attrVal.startsWith('vbscript:') || attrVal.startsWith('data:text/html')) {
          el.removeAttribute(attr.name);
        }
      }

      // Ensure links open safely in external tab if clicked
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return temp.innerHTML;
  }

  /**
   * Format dates cleanly
   */
  function formatEmailDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return dateStr;
    }
  }

  function formatFullDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return dateStr;
    }
  }

  /**
   * Format file sizes
   */
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Initialize Outlook Workspace UI and Event Listeners
   */
  function init() {
    bindEvents();
    startNotificationPolling();

    // Listen for MS Auth changes
    if (window.CCTV_MS_AUTH) {
      window.CCTV_MS_AUTH.onAuthStateChanged((account, authState) => {
        updateAccountBadge(account);
        render();
      });
    }

    // Always render initial visible state
    render();
  }

  /**
   * Render Outlook Workspace according to current auth & config state
   */
  function render() {
    const stateContainer = document.getElementById('outlookStateView');
    const mainLayout = document.getElementById('outlookMainLayout');
    if (!stateContainer || !mainLayout) return;

    if (!window.CCTV_MS_AUTH) {
      stateContainer.style.display = 'flex';
      mainLayout.style.display = 'none';
      stateContainer.innerHTML = renderErrorCard('Microsoft authentication service is not loaded.');
      bindStateCardEvents(stateContainer);
      return;
    }

    const authState = window.CCTV_MS_AUTH.getAuthStatus();
    updateAccountBadge(authState.account);

    if (authState.status === 'ERROR') {
      stateContainer.style.display = 'flex';
      mainLayout.style.display = 'none';
      stateContainer.innerHTML = renderErrorCard(authState.error || 'Microsoft integration unavailable');
      bindStateCardEvents(stateContainer);
    } else if (authState.status === 'UNCONFIGURED') {
      stateContainer.style.display = 'flex';
      mainLayout.style.display = 'none';
      stateContainer.innerHTML = renderUnconfiguredCard(authState.config);
      bindStateCardEvents(stateContainer);
    } else if (authState.status === 'READY_TO_SIGN_IN') {
      stateContainer.style.display = 'flex';
      mainLayout.style.display = 'none';
      stateContainer.innerHTML = renderReadyCard(authState.config);
      bindStateCardEvents(stateContainer);
    } else if (authState.status === 'CONNECTED') {
      stateContainer.style.display = 'none';
      mainLayout.style.display = '';
      if (messages.length === 0 && !isLoading) {
        loadInbox();
      }
    }
  }

  function renderUnconfiguredCard(config) {
    const redirectUri = config?.redirectUri || window.location.href.split('?')[0].split('#')[0];
    return `
      <div class="ms-state-card">
        <div class="ms-state-head">
          <div class="ms-state-title-wrap">
            <div class="ms-state-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              <span>Microsoft Outlook</span>
            </div>
            <div class="ms-state-subtitle">Microsoft 365 is not configured yet.</div>
          </div>
          <span class="ms-status-chip status-unconfigured">Status: Not connected</span>
        </div>

        <div class="ms-state-info-box">
          <div class="ms-info-row">
            <span class="ms-info-label">Mode</span>
            <span class="ms-info-val" style="color:var(--text-secondary); font-weight:500;">Native Microsoft Graph Integration</span>
          </div>
          <div class="ms-info-row">
            <span class="ms-info-label">Client ID</span>
            <span class="ms-info-val" style="color:#fbbf24;">Missing</span>
          </div>
          <div class="ms-info-row">
            <span class="ms-info-label">Tenant</span>
            <span class="ms-info-val" style="color:#fbbf24;">Missing</span>
          </div>
          <div class="ms-info-row" style="flex-direction:column; align-items:stretch; gap:4px;">
            <span class="ms-info-label">Redirect URI</span>
            <div class="ms-uri-display">
              <code>${escapeHtml(redirectUri)}</code>
              <button type="button" class="btn btn-outline btn-xs" data-action="copy-uri" title="Copy Redirect URI">Copy</button>
            </div>
          </div>
        </div>

        <div class="ms-state-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="configure" style="background:#0078d4; border-color:#0078d4;">Configure Microsoft 365</button>
          <button type="button" class="btn btn-outline btn-sm" disabled title="Configure Microsoft Entra first">Connect Microsoft Account</button>
        </div>
        <div class="ms-disabled-note">Configure Microsoft Entra first.</div>
      </div>
    `;
  }

  function renderReadyCard(config) {
    const redirectUri = config?.redirectUri || window.location.href.split('?')[0].split('#')[0];
    const clientDisplay = config?.clientId ? `${config.clientId.substring(0, 8)}...${config.clientId.substring(config.clientId.length - 4)}` : 'Configured';
    return `
      <div class="ms-state-card">
        <div class="ms-state-head">
          <div class="ms-state-title-wrap">
            <div class="ms-state-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              <span>Microsoft Outlook</span>
            </div>
            <div class="ms-state-subtitle">Microsoft 365 is configured and ready to connect.</div>
          </div>
          <span class="ms-status-chip status-ready">Status: Ready to Sign In</span>
        </div>

        <div class="ms-state-info-box">
          <div class="ms-info-row">
            <span class="ms-info-label">Mode</span>
            <span class="ms-info-val" style="color:var(--text-secondary); font-weight:500;">Native Microsoft Graph Integration</span>
          </div>
          <div class="ms-info-row">
            <span class="ms-info-label">Client ID</span>
            <span class="ms-info-val">${escapeHtml(clientDisplay)}</span>
          </div>
          <div class="ms-info-row">
            <span class="ms-info-label">Tenant</span>
            <span class="ms-info-val">${escapeHtml(config?.tenantId || 'common')}</span>
          </div>
          <div class="ms-info-row" style="flex-direction:column; align-items:stretch; gap:4px;">
            <span class="ms-info-label">Redirect URI</span>
            <div class="ms-uri-display">
              <code>${escapeHtml(redirectUri)}</code>
              <button type="button" class="btn btn-outline btn-xs" data-action="copy-uri" title="Copy Redirect URI">Copy</button>
            </div>
          </div>
        </div>

        <div class="ms-state-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="connect" style="background:#0078d4; border-color:#0078d4;">Connect Microsoft Account</button>
          <button type="button" class="btn btn-outline btn-sm" data-action="configure">Configure Microsoft 365</button>
        </div>
      </div>
    `;
  }

  function renderErrorCard(safeError) {
    return `
      <div class="ms-state-card">
        <div class="ms-state-head">
          <div class="ms-state-title-wrap">
            <div class="ms-state-title" style="color:#f87171;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>Microsoft integration unavailable</span>
            </div>
            <div class="ms-state-subtitle">A problem prevented connecting with Microsoft services.</div>
          </div>
          <span class="ms-status-chip status-error">Status: Error</span>
        </div>

        <div class="ms-state-info-box">
          <div class="ms-info-row">
            <span class="ms-info-label">Mode</span>
            <span class="ms-info-val" style="color:var(--text-secondary); font-weight:500;">Native Microsoft Graph Integration</span>
          </div>
          <div class="ms-info-row" style="flex-direction:column; align-items:flex-start; gap:4px;">
            <span class="ms-info-label">Reason:</span>
            <div style="color:#f87171; font-family:var(--font-mono, monospace); font-size:11.5px; word-break:break-word;">${escapeHtml(safeError)}</div>
          </div>
        </div>

        <div class="ms-state-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="retry">Retry</button>
          <button type="button" class="btn btn-outline btn-sm" data-action="configure">Microsoft 365 Settings</button>
        </div>
      </div>
    `;
  }

  function bindStateCardEvents(container) {
    if (!container) return;

    // Configure button
    container.querySelectorAll('[data-action="configure"]').forEach(btn => {
      btn.onclick = () => {
        if (window.CCTV_MS_CONFIG_DIALOG) {
          window.CCTV_MS_CONFIG_DIALOG.open();
        }
      };
    });

    // Connect button
    container.querySelectorAll('[data-action="connect"]').forEach(btn => {
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        try {
          if (window.CCTV_MS_AUTH) {
            await window.CCTV_MS_AUTH.signIn();
          }
        } catch (err) {
          console.error('[Outlook] Sign-in error:', err);
        } finally {
          render();
        }
      };
    });

    // Retry button
    container.querySelectorAll('[data-action="retry"]').forEach(btn => {
      btn.onclick = () => {
        if (window.CCTV_MS_AUTH) {
          window.CCTV_MS_AUTH.clearError();
        }
        render();
      };
    });

    // Copy URI button
    container.querySelectorAll('[data-action="copy-uri"]').forEach(btn => {
      btn.onclick = () => {
        const auth = window.CCTV_MS_AUTH;
        const uri = auth ? auth.getRedirectUri() : window.location.href.split('?')[0].split('#')[0];
        navigator.clipboard?.writeText(uri).then(() => {
          if (window.showToast) window.showToast('Redirect URI copied to clipboard', 'info');
        }).catch(() => {
          if (window.showToast) window.showToast(uri, 'info');
        });
      };
    });
  }

  /**
   * Bind all Outlook UI event handlers
   */
  function bindEvents() {
    // Refresh button
    document.getElementById('btnOutlookRefresh')?.addEventListener('click', () => {
      loadInbox(true);
    });

    // Compose button
    document.getElementById('btnOutlookCompose')?.addEventListener('click', () => {
      openComposer({ mode: 'new' });
    });

    // Account badge click -> opens Entra config / login dialog
    document.getElementById('outlookAccountPill')?.addEventListener('click', () => {
      if (window.CCTV_MS_CONFIG_DIALOG) {
        window.CCTV_MS_CONFIG_DIALOG.open();
      }
    });

    // Search input
    const searchInput = document.getElementById('outlookSearchInput');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        searchQuery = e.target.value;
        debounceTimer = setTimeout(() => {
          renderMessageList();
        }, 250);
      });
    }

    // Filter chips (All / Unread)
    document.querySelectorAll('.outlook-filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.outlook-filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter || 'all';
        renderMessageList();
      });
    });

    // Composer Send button
    document.getElementById('btnComposerSend')?.addEventListener('click', handleSendEmail);

    // Composer Cancel button
    document.getElementById('btnComposerCancel')?.addEventListener('click', closeComposer);

    // Mobile Back to Inbox button
    document.getElementById('btnOutlookMobileBack')?.addEventListener('click', () => {
      document.querySelector('.outlook-split-layout')?.classList.remove('mobile-reading-active');
      currentMessage = null;
      renderMessageList();
    });

    // Reading pane action buttons
    document.getElementById('btnOutlookReply')?.addEventListener('click', () => {
      if (!currentMessage) return;
      openComposer({
        mode: 'reply',
        replyToId: currentMessage.id,
        to: currentMessage.from?.emailAddress?.address || '',
        subject: currentMessage.subject.startsWith('Re:') ? currentMessage.subject : `Re: ${currentMessage.subject}`
      });
    });

    document.getElementById('btnOutlookReplyAll')?.addEventListener('click', () => {
      if (!currentMessage) return;
      const to = currentMessage.from?.emailAddress?.address || '';
      const ccList = (currentMessage.toRecipients || [])
        .map(r => r.emailAddress?.address)
        .filter(addr => addr && addr.toLowerCase() !== to.toLowerCase());

      openComposer({
        mode: 'replyAll',
        replyToId: currentMessage.id,
        to: to,
        cc: ccList.join(', '),
        subject: currentMessage.subject.startsWith('Re:') ? currentMessage.subject : `Re: ${currentMessage.subject}`
      });
    });
  }

  /**
   * Load Inbox messages from Graph
   */
  async function loadInbox(showToastFeedback = false) {
    if (!window.CCTV_MS_GRAPH || !window.CCTV_MS_AUTH) {
      render();
      return;
    }
    const account = window.CCTV_MS_AUTH.getAccount();
    if (!account) {
      render();
      return;
    }

    isLoading = true;
    const listEl = document.getElementById('outlookMessageList');
    if (listEl && messages.length === 0) {
      listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">Loading messages...</div>';
    }

    try {
      const fetched = await window.CCTV_MS_GRAPH.getInboxMessages(35);
      messages = fetched;
      renderMessageList();

      const unreadCount = messages.filter(m => !m.isRead).length;
      updateUnreadBadge(unreadCount);

      if (showToastFeedback && window.showToast) {
        window.showToast('Inbox refreshed', 'info');
      }
    } catch (err) {
      console.error('[Outlook] Failed to load inbox:', err);
      if (listEl && messages.length === 0) {
        listEl.innerHTML = `
          <div style="padding:20px; text-align:center; color:#f87171; font-size:12px;">
            ${err.message || 'Unable to load inbox'}
            <div style="margin-top:8px;">
              <button type="button" class="btn btn-outline btn-xs" onclick="window.CCTV_OUTLOOK.loadInbox()">Retry</button>
            </div>
          </div>
        `;
      }
    } finally {
      isLoading = false;
    }
  }

  /**
   * Render Inbox message list
   */
  function renderMessageList() {
    const listEl = document.getElementById('outlookMessageList');
    if (!listEl) return;

    let filtered = messages;
    if (currentFilter === 'unread') {
      filtered = filtered.filter(m => !m.isRead);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        (m.from?.emailAddress?.name && m.from.emailAddress.name.toLowerCase().includes(q)) ||
        (m.from?.emailAddress?.address && m.from.emailAddress.address.toLowerCase().includes(q)) ||
        (m.bodyPreview && m.bodyPreview.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="padding:32px 16px; text-align:center; color:var(--text-muted); font-size:12px;">
          ${messages.length === 0 ? 'No emails in Inbox' : 'No messages match filter'}
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(msg => {
      const senderName = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown Sender';
      const isSelected = currentMessage && currentMessage.id === msg.id;
      const isUnread = !msg.isRead;
      const timeStr = formatEmailDate(msg.receivedDateTime);

      return `
        <div class="outlook-msg-item ${isSelected ? 'active' : ''} ${isUnread ? 'is-unread' : ''}" data-msg-id="${msg.id}">
          <div class="outlook-msg-header-row">
            <span class="outlook-msg-sender">
              ${isUnread ? '<span class="unread-dot"></span>' : ''}
              ${escapeHtml(senderName)}
            </span>
            <span class="outlook-msg-time">${timeStr}</span>
          </div>
          <div class="outlook-msg-subject">${escapeHtml(msg.subject || '(No Subject)')}</div>
          <div class="outlook-msg-preview">${escapeHtml(msg.bodyPreview || '')}</div>
          ${msg.hasAttachments ? `
            <div class="outlook-msg-badges">
              <svg class="outlook-attachment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Attach click listeners to message items
    listEl.querySelectorAll('.outlook-msg-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.msgId;
        openMessage(id);
      });
    });
  }

  /**
   * Open email and render reading pane
   */
  async function openMessage(messageId) {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    currentMessage = msg;
    closeComposer();
    renderMessageList();

    // Show mobile reading pane
    document.querySelector('.outlook-split-layout')?.classList.add('mobile-reading-active');

    const readingPane = document.getElementById('outlookReadingCol');
    if (readingPane) readingPane.style.display = 'flex';

    renderReadingPaneHeader(msg);

    const bodyEl = document.getElementById('outlookReadingBody');
    if (bodyEl) {
      bodyEl.innerHTML = '<div style="padding:20px; color:var(--text-muted); font-size:12px;">Loading email content...</div>';
    }

    try {
      const fullMsg = await window.CCTV_MS_GRAPH.getMessage(messageId);
      currentMessage = fullMsg;

      // Render sanitized body
      let contentHtml = '';
      if (fullMsg.body?.contentType?.toLowerCase() === 'html') {
        contentHtml = sanitizeHtml(fullMsg.body.content);
      } else {
        contentHtml = `<pre style="white-space:pre-wrap; font-family:inherit;">${escapeHtml(fullMsg.body?.content || '')}</pre>`;
      }

      if (bodyEl) {
        bodyEl.innerHTML = `<div class="outlook-sanitized-body">${contentHtml}</div>`;
      }

      // Load attachments metadata if present
      if (fullMsg.hasAttachments) {
        loadAttachments(messageId);
      } else {
        const attContainer = document.getElementById('outlookAttachmentsContainer');
        if (attContainer) attContainer.style.display = 'none';
      }

      // Mark as read in local state
      if (!msg.isRead) {
        msg.isRead = true;
        renderMessageList();
        updateUnreadBadge(messages.filter(m => !m.isRead).length);
        window.CCTV_MS_GRAPH.markMessageRead(messageId, true);
      }
    } catch (err) {
      console.error('[Outlook] Error fetching message content:', err);
      if (bodyEl) {
        bodyEl.innerHTML = `<div style="padding:20px; color:#f87171; font-size:12px;">Failed to load email body: ${err.message}</div>`;
      }
    }
  }

  /**
   * Render reading pane header
   */
  function renderReadingPaneHeader(msg) {
    const subjectEl = document.getElementById('outlookReadingSubject');
    const fromEl = document.getElementById('outlookReadingFrom');
    const toEl = document.getElementById('outlookReadingTo');
    const emptyEl = document.getElementById('outlookEmptyState');
    const contentEl = document.getElementById('outlookMessageContent');

    if (emptyEl) emptyEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'flex';

    if (subjectEl) subjectEl.textContent = msg.subject || '(No Subject)';

    const senderName = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown';
    const senderEmail = msg.from?.emailAddress?.address ? `<${msg.from.emailAddress.address}>` : '';
    if (fromEl) {
      fromEl.innerHTML = `<strong>${escapeHtml(senderName)}</strong> ${escapeHtml(senderEmail)} · <span>${formatFullDate(msg.receivedDateTime)}</span>`;
    }

    if (toEl) {
      const toRecipients = (msg.toRecipients || []).map(r => r.emailAddress?.name || r.emailAddress?.address).join(', ');
      toEl.textContent = `To: ${toRecipients}`;
    }
  }

  /**
   * Render empty state in reading pane
   */
  function renderReadingPane() {
    if (currentMessage) return;
    const emptyEl = document.getElementById('outlookEmptyState');
    const contentEl = document.getElementById('outlookMessageContent');
    if (emptyEl) emptyEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';
  }

  /**
   * Load attachments metadata
   */
  async function loadAttachments(messageId) {
    const container = document.getElementById('outlookAttachmentsContainer');
    const listEl = document.getElementById('outlookAttachmentsList');
    if (!container || !listEl) return;

    try {
      const atts = await window.CCTV_MS_GRAPH.getMessageAttachments(messageId);
      if (atts.length > 0) {
        container.style.display = 'flex';
        listEl.innerHTML = atts.map(att => `
          <div class="outlook-att-item" title="${escapeHtml(att.name || '')} (${formatBytes(att.size)})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>${escapeHtml(att.name || 'Attachment')}</span>
            <small style="color:var(--text-muted); font-size:10px;">(${formatBytes(att.size)})</small>
          </div>
        `).join('');
      } else {
        container.style.display = 'none';
      }
    } catch (err) {
      console.warn('[Outlook] Error fetching attachments:', err);
      container.style.display = 'none';
    }
  }

  // =========================================================================
  // COMPOSER & SENDING
  // =========================================================================

  /**
   * Open Composer
   */
  function openComposer({ mode = 'new', replyToId = null, to = '', cc = '', subject = '', body = '' }) {
    composeState = {
      isOpen: true,
      mode,
      replyToId,
      to,
      cc,
      subject,
      body
    };

    const readingPane = document.getElementById('outlookReadingCol');
    const composerPane = document.getElementById('outlookComposerCol');

    if (readingPane) readingPane.style.display = 'none';
    if (composerPane) composerPane.style.display = 'flex';

    // Show mobile reading pane container
    document.querySelector('.outlook-split-layout')?.classList.add('mobile-reading-active');

    // Populate fields
    const titleEl = document.getElementById('outlookComposerTitle');
    const toInput = document.getElementById('composerTo');
    const ccInput = document.getElementById('composerCc');
    const subjInput = document.getElementById('composerSubject');
    const bodyInput = document.getElementById('composerBody');

    if (titleEl) {
      titleEl.textContent = mode === 'reply' ? 'Reply to Email' : (mode === 'replyAll' ? 'Reply All to Email' : 'New Message');
    }
    if (toInput) toInput.value = to;
    if (ccInput) ccInput.value = cc;
    if (subjInput) subjInput.value = subject;
    if (bodyInput) bodyInput.value = body;

    // Focus appropriate input
    if (!to) {
      toInput?.focus();
    } else {
      bodyInput?.focus();
    }
  }

  /**
   * Close Composer
   */
  function closeComposer() {
    composeState.isOpen = false;
    const readingPane = document.getElementById('outlookReadingCol');
    const composerPane = document.getElementById('outlookComposerCol');

    if (composerPane) composerPane.style.display = 'none';
    if (readingPane) readingPane.style.display = 'flex';

    if (!currentMessage) {
      document.querySelector('.outlook-split-layout')?.classList.remove('mobile-reading-active');
      renderReadingPane();
    }
  }

  /**
   * Send Email Handler
   */
  async function handleSendEmail() {
    const toVal = document.getElementById('composerTo')?.value || '';
    const ccVal = document.getElementById('composerCc')?.value || '';
    const subjVal = document.getElementById('composerSubject')?.value || '';
    const bodyVal = document.getElementById('composerBody')?.value || '';
    const sendBtn = document.getElementById('btnComposerSend');

    const toRecipients = toVal.split(',').map(s => s.trim()).filter(Boolean);
    const ccRecipients = ccVal.split(',').map(s => s.trim()).filter(Boolean);

    if (toRecipients.length === 0) {
      if (window.showToast) window.showToast('Please enter at least one recipient (To)', 'warning');
      return;
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
    }

    try {
      // Convert plain body newlines to HTML paragraphs/breaks
      const formattedBody = `<div style="font-family:Inter,Segoe UI,Arial,sans-serif; font-size:14px; line-height:1.5; color:#222;">
        ${bodyVal.replace(/\n/g, '<br>')}
      </div>`;

      if (composeState.mode === 'reply' && composeState.replyToId) {
        await window.CCTV_MS_GRAPH.replyMessage(composeState.replyToId, formattedBody, false);
      } else if (composeState.mode === 'replyAll' && composeState.replyToId) {
        await window.CCTV_MS_GRAPH.replyMessage(composeState.replyToId, formattedBody, true);
      } else {
        await window.CCTV_MS_GRAPH.sendMail({
          toRecipients,
          ccRecipients,
          subject: subjVal,
          bodyHtml: formattedBody,
          saveToSentItems: true
        });
      }

      if (window.showToast) {
        window.showToast('Email sent successfully via Microsoft Graph', 'success');
      }

      closeComposer();
      // Refresh inbox after a brief delay
      setTimeout(() => loadInbox(), 1500);
    } catch (err) {
      console.error('[Outlook] Send error:', err);
      if (window.showToast) {
        window.showToast(`Failed to send email: ${err.message}`, 'error');
      }
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      }
    }
  }

  // =========================================================================
  // NOTIFICATIONS & BACKGROUND POLLING
  // =========================================================================

  /**
   * Background polling for new mail notifications
   */
  function startNotificationPolling() {
    if (pollingTimer) clearInterval(pollingTimer);

    // Poll every 60 seconds
    pollingTimer = setInterval(async () => {
      if (!window.CCTV_MS_AUTH || !window.CCTV_MS_GRAPH) return;
      const acc = window.CCTV_MS_AUTH.getAccount();
      if (!acc) return;

      try {
        const latest = await window.CCTV_MS_GRAPH.getInboxMessages(10);
        const newUnread = latest.filter(m => !m.isRead);

        newUnread.forEach(msg => {
          if (!notifiedMessageIds.has(msg.id)) {
            notifiedMessageIds.add(msg.id);
            // Notify user via in-app toast
            notifyNewEmail(msg);
          }
        });

        // Update badge count
        updateUnreadBadge(newUnread.length);
      } catch (_) {
        // Silently skip on polling failure
      }
    }, 60000);
  }

  /**
   * Display in-app toast for newly detected mail
   */
  function notifyNewEmail(msg) {
    const sender = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'New Email';
    const subj = msg.subject || '(No Subject)';

    if (window.showToast) {
      window.showToast(`New Mail from ${sender}: ${subj}`, 'info');
    }
  }

  /**
   * Update sidebar & topbar unread badges
   */
  function updateUnreadBadge(count) {
    const railBadge = document.getElementById('railOutlookBadge');
    if (railBadge) {
      if (count > 0) {
        railBadge.textContent = count > 99 ? '99+' : count;
        railBadge.style.display = 'inline-block';
      } else {
        railBadge.style.display = 'none';
      }
    }
  }

  /**
   * Update Account Profile Badge in Outlook Header
   */
  function updateAccountBadge(account) {
    const pill = document.getElementById('outlookAccountPill');
    const avatar = document.getElementById('outlookAccountAvatar');
    const name = document.getElementById('outlookAccountName');

    if (!pill || !avatar || !name) return;

    if (account) {
      pill.classList.remove('is-anonymous');
      avatar.textContent = account.initials || 'M';
      name.textContent = account.name || account.username || 'Microsoft User';
      pill.title = `Signed in as ${account.username} (${account.isWorkSchool ? 'Work/School' : 'Personal'})\nClick to view settings / switch account`;
    } else {
      pill.classList.add('is-anonymous');
      avatar.textContent = '?';
      name.textContent = 'Sign In to Microsoft';
      pill.title = 'Click to connect Microsoft 365 account';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    init,
    render,
    loadInbox,
    openMessage,
    openComposer,
    closeComposer,
    formatEmailDate,
    formatFullDate
  };
})();
