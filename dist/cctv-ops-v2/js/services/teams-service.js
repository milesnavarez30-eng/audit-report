/**
 * CCTV OPS V2 - Native Microsoft Teams Service
 * Interactive Teams client inside CCTV OPS:
 * - View & search 1:1 and Group Chats
 * - View Chat message history & send messages (ChatMessage.Send)
 * - View joined Teams & Channels
 * - Post new channel conversations & reply to threads (ChannelMessage.Send)
 * - Handles admin consent detection gracefully (e.g. ChannelMessage.Read.All)
 * - Explains Work/School account requirements for Teams Graph APIs
 */

window.CCTV_TEAMS = (function () {
  'use strict';

  let currentTab = 'chats'; // 'chats' | 'teams'
  let chats = [];
  let teams = [];
  let channels = {}; // teamId -> channels[]
  let activeTarget = null; // { type: 'chat', id: string, title: string } | { type: 'channel', teamId: string, channelId: string, title: string }
  let activeMessages = [];
  let isLoading = false;

  /**
   * Initialize Teams Workspace UI and Listeners
   */
  function init() {
    bindEvents();

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
   * Render Teams Workspace according to current auth & config state
   */
  function render() {
    const stateContainer = document.getElementById('teamsStateView');
    const mainLayout = document.getElementById('teamsMainLayout');
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
    checkAccountCompatibility(authState.account);

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
      if ((currentTab === 'chats' && chats.length === 0) || (currentTab === 'teams' && teams.length === 0)) {
        loadNavList();
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
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6264a7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Microsoft Teams</span>
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
          <button type="button" class="btn btn-primary btn-sm" data-action="configure" style="background:#6264a7; border-color:#6264a7;">Configure Microsoft 365</button>
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
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6264a7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Microsoft Teams</span>
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
          <button type="button" class="btn btn-primary btn-sm" data-action="connect" style="background:#6264a7; border-color:#6264a7;">Connect Microsoft Account</button>
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
          console.error('[Teams] Sign-in error:', err);
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
   * Bind event handlers
   */
  function bindEvents() {
    // Switch between Chats and Teams/Channels tabs
    document.getElementById('btnTeamsTabChats')?.addEventListener('click', () => {
      switchTab('chats');
    });

    document.getElementById('btnTeamsTabTeams')?.addEventListener('click', () => {
      switchTab('teams');
    });

    // Account pill click
    document.getElementById('teamsAccountPill')?.addEventListener('click', () => {
      if (window.CCTV_MS_CONFIG_DIALOG) {
        window.CCTV_MS_CONFIG_DIALOG.open();
      }
    });

    // Send Message Button
    document.getElementById('btnTeamsSend')?.addEventListener('click', handleSendMessage);

    // Enter key to send message (Shift+Enter for newline)
    document.getElementById('teamsMessageInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Mobile Back to Nav list
    document.getElementById('btnTeamsMobileBack')?.addEventListener('click', () => {
      document.querySelector('.teams-split-layout')?.classList.remove('mobile-chat-active');
      activeTarget = null;
      renderNavList();
    });
  }

  /**
   * Switch between Chats and Teams tab
   */
  function switchTab(tab) {
    currentTab = tab;
    document.getElementById('btnTeamsTabChats')?.classList.toggle('active', tab === 'chats');
    document.getElementById('btnTeamsTabTeams')?.classList.toggle('active', tab === 'teams');
    loadNavList();
  }

  /**
   * Check if account is a personal MSA vs Work/School
   */
  function checkAccountCompatibility(account) {
    const banner = document.getElementById('teamsNoticeBanner');
    if (!banner) return;

    if (account && account.isPersonal) {
      banner.style.display = 'flex';
      banner.className = 'ms-notice-banner is-error';
      banner.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>Microsoft Teams Graph APIs require a <strong>Work or School (Entra ID)</strong> account. Personal Microsoft accounts (@outlook.com) are not supported by Teams endpoints.</span>
      `;
    } else {
      banner.style.display = 'none';
    }
  }

  /**
   * Load Chat or Team list
   */
  async function loadNavList() {
    if (!window.CCTV_MS_GRAPH || !window.CCTV_MS_AUTH) {
      render();
      return;
    }
    const account = window.CCTV_MS_AUTH.getAccount();
    if (!account) {
      render();
      return;
    }

    const listEl = document.getElementById('teamsNavList');
    if (listEl && ((currentTab === 'chats' && chats.length === 0) || (currentTab === 'teams' && teams.length === 0))) {
      listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">Loading...</div>';
    }

    try {
      if (currentTab === 'chats') {
        chats = await window.CCTV_MS_GRAPH.getChats(30);
      } else {
        teams = await window.CCTV_MS_GRAPH.getJoinedTeams();
      }
      renderNavList();
    } catch (err) {
      console.error('[Teams] Failed to load list:', err);
      if (listEl) {
        if (err.requiresAdminConsent) {
          listEl.innerHTML = `
            <div style="padding:16px; color:#fbbf24; font-size:11.5px; line-height:1.4;">
              <strong>Admin Consent Required:</strong><br>
              Your Microsoft 365 tenant requires administrator approval for delegated Teams permissions.
            </div>
          `;
        } else {
          listEl.innerHTML = `
            <div style="padding:16px; color:#f87171; font-size:11.5px;">
              ${err.message || 'Unable to load Teams list'}
            </div>
          `;
        }
      }
    }
  }

  /**
   * Render Chats or Teams navigation list
   */
  function renderNavList() {
    const listEl = document.getElementById('teamsNavList');
    if (!listEl) return;

    if (currentTab === 'chats') {
      if (chats.length === 0) {
        listEl.innerHTML = '<div style="padding:24px 16px; text-align:center; color:var(--text-muted); font-size:12px;">No chats found</div>';
        return;
      }

      listEl.innerHTML = chats.map(chat => {
        const title = getChatTitle(chat);
        const isSelected = activeTarget && activeTarget.type === 'chat' && activeTarget.id === chat.id;
        const timeStr = formatChatTime(chat.lastUpdatedDateTime);

        return `
          <div class="teams-chat-item ${isSelected ? 'active' : ''}" data-chat-id="${chat.id}">
            <div class="teams-avatar">${title.charAt(0).toUpperCase()}</div>
            <div class="teams-chat-info">
              <div class="teams-chat-title-row">
                <span class="teams-chat-title">${escapeHtml(title)}</span>
                <span class="teams-chat-time">${timeStr}</span>
              </div>
              <div class="teams-chat-preview">${chat.chatType === 'group' ? 'Group Chat' : 'Direct Message'}</div>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.teams-chat-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.chatId;
          const chat = chats.find(c => c.id === id);
          selectChat(chat);
        });
      });
    } else {
      // Teams and Channels View
      if (teams.length === 0) {
        listEl.innerHTML = '<div style="padding:24px 16px; text-align:center; color:var(--text-muted); font-size:12px;">No joined teams</div>';
        return;
      }

      listEl.innerHTML = teams.map(team => `
        <div class="teams-team-group" data-team-id="${team.id}">
          <div class="teams-team-header">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>${escapeHtml(team.displayName)}</span>
          </div>
          <div class="teams-channels-container" id="channels_${team.id}">
            <div style="padding:6px 28px; font-size:11px; color:var(--text-muted);">Loading channels...</div>
          </div>
        </div>
      `).join('');

      // Fetch channels for each team
      teams.forEach(team => {
        fetchTeamChannels(team);
      });
    }
  }

  /**
   * Fetch and render channels for a team
   */
  async function fetchTeamChannels(team) {
    const container = document.getElementById(`channels_${team.id}`);
    if (!container) return;

    try {
      const chs = await window.CCTV_MS_GRAPH.getTeamChannels(team.id);
      channels[team.id] = chs;

      if (chs.length === 0) {
        container.innerHTML = '<div style="padding:6px 28px; font-size:11px; color:var(--text-muted);">No channels</div>';
        return;
      }

      container.innerHTML = chs.map(ch => {
        const isSelected = activeTarget && activeTarget.type === 'channel' && activeTarget.channelId === ch.id;
        return `
          <div class="teams-channel-item ${isSelected ? 'active' : ''}" data-team-id="${team.id}" data-channel-id="${ch.id}">
            <span style="color:var(--text-muted); font-size:13px; margin-right:4px;">#</span>
            <span class="teams-chat-title">${escapeHtml(ch.displayName)}</span>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.teams-channel-item').forEach(el => {
        el.addEventListener('click', () => {
          const tId = el.dataset.teamId;
          const cId = el.dataset.channelId;
          const ch = channels[tId]?.find(c => c.id === cId);
          selectChannel(team, ch);
        });
      });
    } catch (err) {
      console.warn(`[Teams] Error loading channels for team ${team.displayName}:`, err);
      container.innerHTML = `<div style="padding:6px 28px; font-size:10.5px; color:#fbbf24;">Channels restricted</div>`;
    }
  }

  /**
   * Select a Chat
   */
  async function selectChat(chat) {
    if (!chat) return;
    const title = getChatTitle(chat);
    activeTarget = {
      type: 'chat',
      id: chat.id,
      title: title
    };

    document.querySelector('.teams-split-layout')?.classList.add('mobile-chat-active');
    renderNavList();
    renderActiveHeader(title, 'Microsoft Teams Chat');
    loadMessages();
  }

  /**
   * Select a Channel
   */
  async function selectChannel(team, channel) {
    if (!channel) return;
    activeTarget = {
      type: 'channel',
      teamId: team.id,
      channelId: channel.id,
      title: `${team.displayName} > #${channel.displayName}`
    };

    document.querySelector('.teams-split-layout')?.classList.add('mobile-chat-active');
    renderNavList();
    renderActiveHeader(channel.displayName, team.displayName);
    loadMessages();
  }

  /**
   * Render conversation header
   */
  function renderActiveHeader(title, subtitle) {
    const titleEl = document.getElementById('teamsActiveTitle');
    const subEl = document.getElementById('teamsActiveSubtitle');
    const emptyEl = document.getElementById('teamsEmptyState');
    const activeWrap = document.getElementById('teamsActiveWrap');

    if (emptyEl) emptyEl.style.display = 'none';
    if (activeWrap) activeWrap.style.display = 'flex';

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
  }

  /**
   * Load messages for active target
   */
  async function loadMessages() {
    if (!activeTarget) return;

    const threadEl = document.getElementById('teamsThreadContainer');
    if (threadEl) {
      threadEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">Loading messages...</div>';
    }

    try {
      if (activeTarget.type === 'chat') {
        activeMessages = await window.CCTV_MS_GRAPH.getChatMessages(activeTarget.id, 40);
      } else {
        activeMessages = await window.CCTV_MS_GRAPH.getChannelMessages(activeTarget.teamId, activeTarget.channelId, 40);
      }
      renderThreadView();
    } catch (err) {
      console.error('[Teams] Error loading messages:', err);
      if (threadEl) {
        if (err.requiresAdminConsent) {
          threadEl.innerHTML = `
            <div style="padding:24px; text-align:center; color:#fbbf24; font-size:12px;">
              <strong>Admin Consent Required</strong><br>
              Reading channel messages requires <code>ChannelMessage.Read.All</code> which must be approved by your tenant administrator.<br>
              <div style="margin-top:10px; color:var(--text-muted);">You can still send messages or post reports below.</div>
            </div>
          `;
        } else {
          threadEl.innerHTML = `<div style="padding:20px; text-align:center; color:#f87171; font-size:12px;">${err.message || 'Unable to load messages'}</div>`;
        }
      }
    }
  }

  /**
   * Render message thread bubbles
   */
  function renderThreadView() {
    const threadEl = document.getElementById('teamsThreadContainer');
    if (!threadEl) return;

    if (!activeTarget) {
      const emptyEl = document.getElementById('teamsEmptyState');
      const activeWrap = document.getElementById('teamsActiveWrap');
      if (emptyEl) emptyEl.style.display = 'flex';
      if (activeWrap) activeWrap.style.display = 'none';
      return;
    }

    if (activeMessages.length === 0) {
      threadEl.innerHTML = '<div style="padding:30px; text-align:center; color:var(--text-muted); font-size:12px;">No messages yet. Send a message below to start the conversation.</div>';
      return;
    }

    const currentAccount = window.CCTV_MS_AUTH?.getAccount();
    const myUsername = currentAccount?.username?.toLowerCase() || '';

    threadEl.innerHTML = activeMessages.map(msg => {
      const senderName = msg.from?.user?.displayName || 'Unknown';
      const senderEmail = (msg.from?.user?.id || '').toLowerCase();
      const isMe = myUsername && (senderEmail.includes(myUsername) || senderName === currentAccount?.name);
      const timeStr = formatChatTime(msg.createdDateTime);
      const content = msg.body?.content || '';

      return `
        <div class="teams-msg-bubble-wrap ${isMe ? 'is-me' : ''}">
          <div class="teams-msg-avatar">${senderName.charAt(0).toUpperCase()}</div>
          <div class="teams-msg-content-wrap">
            <div class="teams-msg-header">
              <span class="teams-msg-sender">${escapeHtml(senderName)}</span>
              <span>${timeStr}</span>
            </div>
            <div class="teams-msg-bubble">${content}</div>
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  /**
   * Handle Send Message
   */
  async function handleSendMessage() {
    if (!activeTarget) return;

    const input = document.getElementById('teamsMessageInput');
    const sendBtn = document.getElementById('btnTeamsSend');
    const text = input?.value || '';

    if (!text.trim()) return;

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
    }

    try {
      const formattedHtml = `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;

      if (activeTarget.type === 'chat') {
        await window.CCTV_MS_GRAPH.sendChatMessage(activeTarget.id, formattedHtml);
      } else {
        await window.CCTV_MS_GRAPH.sendChannelMessage(activeTarget.teamId, activeTarget.channelId, formattedHtml);
      }

      if (input) input.value = '';
      if (window.showToast) {
        window.showToast('Message sent to Microsoft Teams', 'success');
      }

      // Refresh messages
      setTimeout(() => loadMessages(), 800);
    } catch (err) {
      console.error('[Teams] Failed to send message:', err);
      if (window.showToast) {
        window.showToast(`Failed to send message: ${err.message}`, 'error');
      }
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `
          <span>Send</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        `;
      }
    }
  }

  /**
   * Helper: determine readable title for chat
   */
  function getChatTitle(chat) {
    if (chat.topic) return chat.topic;
    if (chat.members && chat.members.length > 0) {
      const currentAcc = window.CCTV_MS_AUTH?.getAccount();
      const otherMembers = chat.members
        .map(m => m.displayName)
        .filter(name => name && name !== currentAcc?.name);

      if (otherMembers.length > 0) {
        return otherMembers.join(', ');
      }
    }
    return 'Teams Conversation';
  }

  function formatChatTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function updateAccountBadge(account) {
    const pill = document.getElementById('teamsAccountPill');
    const avatar = document.getElementById('teamsAccountAvatar');
    const name = document.getElementById('teamsAccountName');

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
    loadNavList,
    selectChat,
    selectChannel,
    getChats: () => chats,
    getTeams: () => teams,
    getChannels: () => channels
  };
})();
