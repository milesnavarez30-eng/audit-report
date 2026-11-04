/**
 * CCTV OPS V2 - Microsoft Graph Service
 * Clean REST Client for Microsoft Graph API using delegated user tokens.
 * Supports:
 * - Outlook Mail (Inbox, Read, Send, Reply, Reply All, Attachments)
 * - Microsoft Teams (Chats, Chat Messages, Send Chat, Teams, Channels, Post Channel, Reply Channel)
 */

window.CCTV_MS_GRAPH = (function () {
  'use strict';

  const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

  /**
   * Helper to execute Graph requests with bearer tokens
   */
  async function apiFetch(endpoint, options = {}, scopes = ['User.Read']) {
    if (!window.CCTV_MS_AUTH) {
      throw new Error('Authentication service not available');
    }

    const token = await window.CCTV_MS_AUTH.acquireToken(scopes);
    const url = endpoint.startsWith('https://') ? endpoint : `${GRAPH_BASE_URL}${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 202 || response.status === 204) {
      return { success: true };
    }

    const contentType = response.headers.get('content-type') || '';
    let responseData = null;
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const err = new Error(responseData?.error?.message || `Microsoft Graph error (${response.status})`);
      err.status = response.status;
      err.code = responseData?.error?.code;
      err.details = responseData?.error;

      // Detect admin consent or forbidden scopes
      if (response.status === 403) {
        if (err.code === 'Authorization_RequestDenied' || responseData?.error?.message?.includes('consent')) {
          err.requiresAdminConsent = true;
        }
      }
      throw err;
    }

    return responseData;
  }

  // =========================================================================
  // OUTLOOK GRAPH APIS
  // =========================================================================

  /**
   * Get Inbox Messages
   */
  async function getInboxMessages(top = 30, skip = 0, searchQuery = '') {
    let endpoint = `/me/mailFolders/inbox/messages?$top=${top}&$skip=${skip}&$select=id,subject,bodyPreview,receivedDateTime,from,toRecipients,ccRecipients,isRead,hasAttachments,importance&$orderby=receivedDateTime desc`;
    if (searchQuery && searchQuery.trim()) {
      const escaped = encodeURIComponent(searchQuery.trim());
      endpoint += `&$search="${escaped}"`;
    }
    const res = await apiFetch(endpoint, { method: 'GET' }, ['Mail.Read']);
    return res.value || [];
  }

  /**
   * Get Full Message Details
   */
  async function getMessage(messageId) {
    const endpoint = `/me/messages/${messageId}?$select=id,subject,body,receivedDateTime,from,toRecipients,ccRecipients,isRead,hasAttachments,importance`;
    return await apiFetch(endpoint, { method: 'GET' }, ['Mail.Read']);
  }

  /**
   * Get Message Attachments Metadata
   */
  async function getMessageAttachments(messageId) {
    const endpoint = `/me/messages/${messageId}/attachments?$select=id,name,contentType,size,isInline`;
    const res = await apiFetch(endpoint, { method: 'GET' }, ['Mail.Read']);
    return res.value || [];
  }

  /**
   * Send Email (POST /me/sendMail)
   */
  async function sendMail({ toRecipients = [], ccRecipients = [], subject = '', bodyHtml = '', saveToSentItems = true }) {
    if (!toRecipients || toRecipients.length === 0) {
      throw new Error('At least one recipient (To) is required');
    }

    const payload = {
      message: {
        subject: subject || '(No Subject)',
        body: {
          contentType: 'HTML',
          content: bodyHtml || ''
        },
        toRecipients: toRecipients.map(email => ({
          emailAddress: { address: email.trim() }
        })),
        ccRecipients: ccRecipients.map(email => ({
          emailAddress: { address: email.trim() }
        }))
      },
      saveToSentItems: Boolean(saveToSentItems)
    };

    return await apiFetch('/me/sendMail', {
      method: 'POST',
      body: payload
    }, ['Mail.Send']);
  }

  /**
   * Reply to an Email (POST /me/messages/{id}/reply or replyAll)
   */
  async function replyMessage(messageId, commentHtml, replyAll = false) {
    const action = replyAll ? 'replyAll' : 'reply';
    const endpoint = `/me/messages/${messageId}/${action}`;
    const payload = {
      comment: commentHtml || ''
    };

    return await apiFetch(endpoint, {
      method: 'POST',
      body: payload
    }, ['Mail.Send']);
  }

  /**
   * Update message read status
   */
  async function markMessageRead(messageId, isRead = true) {
    try {
      return await apiFetch(`/me/messages/${messageId}`, {
        method: 'PATCH',
        body: { isRead: Boolean(isRead) }
      }, ['Mail.ReadWrite', 'Mail.Read']);
    } catch (_) {
      // Non-critical if Mail.ReadWrite is not consented
      return null;
    }
  }

  // =========================================================================
  // MICROSOFT TEAMS GRAPH APIS
  // =========================================================================

  /**
   * Get User Chats
   */
  async function getChats(top = 30) {
    const endpoint = `/me/chats?$top=${top}&$expand=members&$orderby=lastUpdatedDateTime desc`;
    const res = await apiFetch(endpoint, { method: 'GET' }, ['Chat.Read']);
    return res.value || [];
  }

  /**
   * Get Messages from a Chat
   */
  async function getChatMessages(chatId, top = 50) {
    const endpoint = `/chats/${chatId}/messages?$top=${top}`;
    const res = await apiFetch(endpoint, { method: 'GET' }, ['Chat.Read']);
    const list = res.value || [];
    // Return in chronological order
    return list.reverse();
  }

  /**
   * Send a Message to a Chat (POST /chats/{id}/messages)
   */
  async function sendChatMessage(chatId, contentHtml) {
    if (!contentHtml || !contentHtml.trim()) {
      throw new Error('Message content cannot be empty');
    }

    const payload = {
      body: {
        contentType: 'html',
        content: contentHtml
      }
    };

    return await apiFetch(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: payload
    }, ['ChatMessage.Send']);
  }

  /**
   * Get Joined Teams
   */
  async function getJoinedTeams() {
    const endpoint = `/me/joinedTeams?$select=id,displayName,description`;
    const res = await apiFetch(endpoint, { method: 'GET' }, ['Team.ReadBasic.All']);
    return res.value || [];
  }

  /**
   * Get Channels for a Team
   */
  async function getTeamChannels(teamId) {
    const endpoint = `/teams/${teamId}/channels?$select=id,displayName,description,membershipType`;
    const res = await apiFetch(endpoint, { method: 'GET' }, ['Channel.ReadBasic.All']);
    return res.value || [];
  }

  /**
   * Get Channel Messages
   */
  async function getChannelMessages(teamId, channelId, top = 50) {
    const endpoint = `/teams/${teamId}/channels/${channelId}/messages?$top=${top}`;
    const res = await apiFetch(endpoint, { method: 'GET' }, ['ChannelMessage.Read.All']);
    const list = res.value || [];
    return list.reverse();
  }

  /**
   * Send a Message to a Channel (POST /teams/{team-id}/channels/{channel-id}/messages)
   */
  async function sendChannelMessage(teamId, channelId, contentHtml) {
    if (!contentHtml || !contentHtml.trim()) {
      throw new Error('Message content cannot be empty');
    }

    const payload = {
      body: {
        contentType: 'html',
        content: contentHtml
      }
    };

    return await apiFetch(`/teams/${teamId}/channels/${channelId}/messages`, {
      method: 'POST',
      body: payload
    }, ['ChannelMessage.Send']);
  }

  /**
   * Reply to a Channel Thread
   */
  async function replyChannelMessage(teamId, channelId, messageId, contentHtml) {
    if (!contentHtml || !contentHtml.trim()) {
      throw new Error('Reply content cannot be empty');
    }

    const payload = {
      body: {
        contentType: 'html',
        content: contentHtml
      }
    };

    return await apiFetch(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`, {
      method: 'POST',
      body: payload
    }, ['ChannelMessage.Send']);
  }

  return {
    // Outlook
    getInboxMessages,
    getMessage,
    getMessageAttachments,
    sendMail,
    replyMessage,
    markMessageRead,

    // Teams
    getChats,
    getChatMessages,
    sendChatMessage,
    getJoinedTeams,
    getTeamChannels,
    getChannelMessages,
    sendChannelMessage,
    replyChannelMessage
  };
})();
