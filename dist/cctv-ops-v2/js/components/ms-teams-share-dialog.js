/**
 * CCTV OPS V2 - Reusable "Send to Microsoft Teams" Dialog
 * Allows operators to share reports (CCTV Report, EDR, Maintenance) directly into Teams.
 * - Chooses between Chat or Team/Channel destination
 * - Pre-populates editable formatted report preview
 * - Checks size and warns before sending
 * - Sends via signed-in Microsoft account using Microsoft Graph
 * - Does NOT alter source records or touch CCTV Audit clipboard code
 */

window.CCTV_TEAMS_SHARE = (function () {
  'use strict';

  let currentPayload = {
    reportType: '',
    rawContent: '',
    htmlContent: '',
    metadata: {}
  };

  /**
   * Initialize dialog listeners
   */
  function init() {
    // Destination type radio toggle
    const typeRadios = document.querySelectorAll('input[name="teamsShareDestType"]');
    typeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const isChat = e.target.value === 'chat';
        document.getElementById('teamsShareChatGroup').style.display = isChat ? 'block' : 'none';
        document.getElementById('teamsShareChannelGroup').style.display = isChat ? 'none' : 'block';
      });
    });

    // Team selection change -> load its channels
    document.getElementById('teamsShareTeamSelect')?.addEventListener('change', (e) => {
      loadChannelsForSelectedTeam(e.target.value);
    });

    // Close buttons
    document.getElementById('btnTeamsShareClose')?.addEventListener('click', close);
    document.getElementById('btnTeamsShareCancel')?.addEventListener('click', close);

    // Send button
    document.getElementById('btnTeamsShareSend')?.addEventListener('click', handleSend);

    // Character counter / size check
    document.getElementById('teamsShareMessagePreview')?.addEventListener('input', checkPayloadSize);
  }

  /**
   * Open the Share Dialog with report content
   */
  async function open({ reportType = 'Report', subject = '', htmlContent = '', plainContent = '', metadata = {} }) {
    currentPayload = {
      reportType,
      rawContent: plainContent || htmlContent,
      htmlContent: htmlContent || plainContent,
      metadata
    };

    // Ensure user is signed in to Microsoft
    if (!window.CCTV_MS_AUTH) {
      if (window.showToast) window.showToast('Microsoft authentication service not ready', 'warning');
      return;
    }

    const account = window.CCTV_MS_AUTH.getAccount();
    if (!account) {
      // Prompt user to sign in
      try {
        if (window.showToast) window.showToast('Please sign in with your Microsoft account first', 'info');
        await window.CCTV_MS_AUTH.signIn(window.CCTV_MS_AUTH.SCOPES.TEAMS);
      } catch (err) {
        if (window.showToast) window.showToast(`Sign in required: ${err.message}`, 'warning');
        return;
      }
    }

    const modal = document.getElementById('modalMsTeamsShare');
    if (!modal) return;

    modal.hidden = false;
    modal.classList.add('is-visible');

    // Set dialog title
    const titleEl = document.getElementById('teamsShareModalTitle');
    if (titleEl) {
      titleEl.textContent = `Send ${reportType} to Microsoft Teams`;
    }

    // Set preview textarea
    const previewEl = document.getElementById('teamsShareMessagePreview');
    if (previewEl) {
      previewEl.value = plainContent || stripHtml(htmlContent);
    }

    checkPayloadSize();
    await populateDestinations();
  }

  /**
   * Close the dialog
   */
  function close() {
    const modal = document.getElementById('modalMsTeamsShare');
    if (modal) {
      modal.hidden = true;
      modal.classList.remove('is-visible');
    }
  }

  /**
   * Populate Chat and Team dropdowns
   */
  async function populateDestinations() {
    const chatSelect = document.getElementById('teamsShareChatSelect');
    const teamSelect = document.getElementById('teamsShareTeamSelect');

    if (chatSelect) chatSelect.innerHTML = '<option value="">Loading chats...</option>';
    if (teamSelect) teamSelect.innerHTML = '<option value="">Loading teams...</option>';

    try {
      if (window.CCTV_MS_GRAPH) {
        const [chats, joinedTeams] = await Promise.all([
          window.CCTV_MS_GRAPH.getChats(25).catch(() => []),
          window.CCTV_MS_GRAPH.getJoinedTeams().catch(() => [])
        ]);

        if (chatSelect) {
          if (chats.length === 0) {
            chatSelect.innerHTML = '<option value="">(No chats available)</option>';
          } else {
            chatSelect.innerHTML = chats.map(c => {
              const title = c.topic || (c.members ? c.members.map(m => m.displayName).filter(Boolean).join(', ') : 'Direct Message');
              return `<option value="${c.id}">${escapeHtml(title)}</option>`;
            }).join('');
          }
        }

        if (teamSelect) {
          if (joinedTeams.length === 0) {
            teamSelect.innerHTML = '<option value="">(No teams available)</option>';
          } else {
            teamSelect.innerHTML = joinedTeams.map(t => `
              <option value="${t.id}">${escapeHtml(t.displayName)}</option>
            `).join('');

            // Automatically load channels for first team
            if (joinedTeams.length > 0) {
              loadChannelsForSelectedTeam(joinedTeams[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Teams-Share] Error populating destinations:', err);
    }
  }

  /**
   * Load channels for selected team
   */
  async function loadChannelsForSelectedTeam(teamId) {
    const channelSelect = document.getElementById('teamsShareChannelSelect');
    if (!channelSelect || !teamId) return;

    channelSelect.innerHTML = '<option value="">Loading channels...</option>';

    try {
      const channels = await window.CCTV_MS_GRAPH.getTeamChannels(teamId);
      if (channels.length === 0) {
        channelSelect.innerHTML = '<option value="">(No channels available)</option>';
      } else {
        channelSelect.innerHTML = channels.map(ch => `
          <option value="${ch.id}"># ${escapeHtml(ch.displayName)}</option>
        `).join('');
      }
    } catch (err) {
      channelSelect.innerHTML = '<option value="">Channels restricted</option>';
    }
  }

  /**
   * Check payload size and display warnings if very large
   */
  function checkPayloadSize() {
    const previewEl = document.getElementById('teamsShareMessagePreview');
    const warningEl = document.getElementById('teamsShareSizeWarning');
    if (!previewEl || !warningEl) return;

    const charCount = previewEl.value.length;
    // Microsoft Teams messages have a size limit (typically 28 KB)
    if (charCount > 15000) {
      warningEl.style.display = 'block';
      warningEl.innerHTML = `
        <strong>Warning: Large Message (${charCount} characters):</strong><br>
        This report is very large. Consider sending a summarized version to ensure Microsoft Teams accepts the payload without truncation.
      `;
    } else {
      warningEl.style.display = 'none';
    }
  }

  /**
   * Handle Send Action
   */
  async function handleSend() {
    const sendBtn = document.getElementById('btnTeamsShareSend');
    const previewEl = document.getElementById('teamsShareMessagePreview');
    const destType = document.querySelector('input[name="teamsShareDestType"]:checked')?.value || 'chat';
    const textContent = previewEl?.value || '';

    if (!textContent.trim()) {
      if (window.showToast) window.showToast('Message content cannot be empty', 'warning');
      return;
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending to Teams...';
    }

    try {
      // Build clean HTML formatted message
      const formattedHtml = `
        <div style="font-family:Segoe UI,Inter,sans-serif; line-height:1.5;">
          <h4 style="margin:0 0 8px 0; color:#464775;">📊 CCTV OPS — ${escapeHtml(currentPayload.reportType)}</h4>
          <pre style="white-space:pre-wrap; font-family:Consolas,monospace; font-size:12px; background:#f4f4f4; padding:8px; border-radius:4px; color:#111;">${escapeHtml(textContent)}</pre>
          <div style="font-size:10.5px; color:#888; margin-top:6px;">Shared securely from CCTV OPS console</div>
        </div>
      `;

      if (destType === 'chat') {
        const chatId = document.getElementById('teamsShareChatSelect')?.value;
        if (!chatId) {
          throw new Error('Please select a destination Chat');
        }
        await window.CCTV_MS_GRAPH.sendChatMessage(chatId, formattedHtml);
      } else {
        const teamId = document.getElementById('teamsShareTeamSelect')?.value;
        const channelId = document.getElementById('teamsShareChannelSelect')?.value;
        if (!teamId || !channelId) {
          throw new Error('Please select a destination Team and Channel');
        }
        await window.CCTV_MS_GRAPH.sendChannelMessage(teamId, channelId, formattedHtml);
      }

      if (window.showToast) {
        window.showToast(`${currentPayload.reportType} sent successfully to Microsoft Teams!`, 'success');
      }

      close();
    } catch (err) {
      console.error('[Teams-Share] Failed to send report:', err);
      if (window.showToast) {
        window.showToast(`Failed to send to Teams: ${err.message}`, 'error');
      }
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to Teams';
      }
    }
  }

  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
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
    open,
    close
  };
})();
