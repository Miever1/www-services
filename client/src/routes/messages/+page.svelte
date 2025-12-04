<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  import { browser } from '$app/environment';
  
  let currentUser = null;
  let isLoggedIn = false;
  let showUserMenu = false;
  let showLanguageMenu = false;
  let currentLanguage = 'en';
  
  // Conversations and messages
  let conversations = [];
  let selectedConversation = null;
  let messages = [];
  let loadingConversations = true;
  let loadingMessages = false;
  
  // Message input
  let messageInput = '';
  let sending = false;
  
  // Search
  let searchQuery = '';
  
  // Polling interval
  let messagePollInterval = null;
  
  $: taskId = $page.url.searchParams.get('taskId');
  $: otherUserId = $page.url.searchParams.get('otherUserId');
  
  // Track if we're processing URL params to avoid duplicate calls
  let processingUrlParams = false;
  
  // Reactively handle URL parameter changes
  $: if (taskId && otherUserId && isLoggedIn && !loadingConversations && !processingUrlParams && browser) {
    handleUrlParams();
  }
  
  async function handleUrlParams() {
    if (!taskId || !otherUserId || processingUrlParams) return;
    
    // Check if conversation already selected
    if (selectedConversation && 
        selectedConversation.task_id === taskId && 
        selectedConversation.other_user_id === otherUserId) {
      return; // Already selected
    }
    
    processingUrlParams = true;
    
    try {
      // Try to find in existing conversations
      const existingConv = conversations.find(c => 
        c.task_id === taskId && c.other_user_id === otherUserId
      );
      
      if (existingConv) {
        await selectConversation(existingConv);
      } else {
        // Create new conversation if it doesn't exist
        await selectConversationForTask(taskId, otherUserId);
      }
    } finally {
      processingUrlParams = false;
    }
  }
  
  const languages = {
    en: 'English',
    sv: 'Svenska',
    fi: 'Suomi'
  };
  
  async function fetchCurrentUser() {
    try {
      const response = await fetch(apiUrl(API_CONFIG.endpoints.auth.session), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          currentUser = data.user;
          isLoggedIn = true;
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          goto('/login?redirect=/messages');
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      const userData = localStorage.getItem('user');
      if (userData) {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
      } else {
        goto('/login?redirect=/messages');
      }
    }
  }
  
  async function loadConversations() {
    if (!isLoggedIn) return;
    
    loadingConversations = true;
    try {
      const response = await fetch(apiUrl(API_CONFIG.endpoints.messages.conversations), {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        conversations = Array.isArray(data) ? data : [];
        
        // If taskId and otherUserId are provided, select that conversation
        // This will be handled by the reactive statement and handleUrlParams
        if (!taskId || !otherUserId) {
          if (conversations.length > 0 && !selectedConversation) {
            // Select first conversation by default if no URL params
            selectConversation(conversations[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      loadingConversations = false;
    }
  }
  
  async function selectConversationForTask(taskId, otherUserId) {
    try {
      console.log('Selecting conversation for task:', taskId, 'with user:', otherUserId);
      
      // Get task info
      const taskResponse = await fetch(apiUrl(API_CONFIG.endpoints.task(taskId)), {
        credentials: 'include'
      });
      if (!taskResponse.ok) {
        console.error('Failed to fetch task:', taskResponse.status);
        return;
      }
      
      const taskData = await taskResponse.json();
      // Handle different response formats
      const task = taskData.task || taskData;
      
      // Get other user info
      const userResponse = await fetch(apiUrl(API_CONFIG.endpoints.user(otherUserId)), {
        credentials: 'include'
      });
      if (!userResponse.ok) {
        console.error('Failed to fetch user:', userResponse.status);
        return;
      }
      
      const userData = await userResponse.json();
      // Handle different response formats: { user: {...} } or direct user object
      const otherUserObj = userData.user || (Array.isArray(userData) ? userData[0] : userData);
      
      if (!otherUserObj) {
        console.error('Invalid user data received');
        return;
      }
      
      console.log('Creating temporary conversation with task:', task.name, 'and user:', otherUserObj.name || otherUserObj.username);
      
      // Create a temporary conversation object
      const tempConv = {
        task_id: taskId,
        other_user_id: otherUserId,
        task_name: task.name || 'Task',
        task_price: task.price || 0,
        task_time: task.time,
        other_username: otherUserObj?.username || 'User',
        other_name: otherUserObj?.name || otherUserObj?.username || 'User',
        other_avatar_url: otherUserObj?.avatar_url || null,
        last_message_content: null,
        last_message_created_at: null
      };
      
      // Select the temporary conversation (this will load messages)
      await selectConversation(tempConv);
      
      // Reload conversations to get the real one if it exists
      await loadConversations();
      
      // After reloading, check if we have a real conversation and switch to it
      // This prevents duplicate conversation entries
      const realConv = conversations.find(c => 
        c.task_id === taskId && c.other_user_id === otherUserId
      );
      if (realConv && (!selectedConversation || selectedConversation.task_id !== realConv.task_id || selectedConversation.other_user_id !== realConv.other_user_id)) {
        console.log('Found real conversation, switching to it');
        await selectConversation(realConv);
      }
    } catch (error) {
      console.error('Error selecting conversation for task:', error);
      alert('Failed to open conversation. Please try again.');
    }
  }
  
  async function selectConversation(conversation) {
    selectedConversation = conversation;
    await loadMessages(conversation.task_id, conversation.other_user_id);
    
    // Start polling for new messages
    startMessagePolling(conversation.task_id, conversation.other_user_id);
  }
  
  async function loadMessages(taskId, otherUserId) {
    if (!taskId || !otherUserId) return;
    
    loadingMessages = true;
    try {
      const url = apiUrl(API_CONFIG.endpoints.messages.messages(taskId, otherUserId));
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        messages = Array.isArray(data) ? data : [];
        
        // Scroll to bottom after messages load
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      loadingMessages = false;
    }
  }
  
  async function sendMessage() {
    if (!messageInput.trim() || !selectedConversation || sending) return;
    
    const content = messageInput.trim();
    messageInput = '';
    sending = true;
    
    try {
      const response = await fetch(apiUrl(API_CONFIG.endpoints.messages.send), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          task_id: selectedConversation.task_id,
          receiver_id: selectedConversation.other_user_id,
          content: content
        })
      });
      
      if (response.ok) {
        // Reload messages
        await loadMessages(selectedConversation.task_id, selectedConversation.other_user_id);
        // Reload conversations to update last message
        await loadConversations();
      } else {
        alert('Failed to send message. Please try again.');
        messageInput = content; // Restore message
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
      messageInput = content; // Restore message
    } finally {
      sending = false;
    }
  }
  
  function startMessagePolling(taskId, otherUserId) {
    // Clear existing interval
    if (messagePollInterval) {
      clearInterval(messagePollInterval);
    }
    
    // Poll for new messages every 3 seconds
    messagePollInterval = setInterval(async () => {
      if (selectedConversation && selectedConversation.task_id === taskId) {
        await loadMessages(taskId, otherUserId);
        await loadConversations(); // Update conversation list
      }
    }, 3000);
  }
  
  function stopMessagePolling() {
    if (messagePollInterval) {
      clearInterval(messagePollInterval);
      messagePollInterval = null;
    }
  }
  
  function scrollToBottom() {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
  
  function formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  }
  
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function handleLogout() {
    localStorage.removeItem('user');
    isLoggedIn = false;
    currentUser = null;
    showUserMenu = false;
    goto('/login');
  }
  
  function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    showLanguageMenu = false;
  }
  
  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
  }
  
  function toggleLanguageMenu() {
    showLanguageMenu = !showLanguageMenu;
  }
  
  function handleUserUpdate(event) {
    // Try to get user from event detail first, then localStorage
    let updatedUser = null;
    if (event && event.detail && event.detail.user) {
      updatedUser = event.detail.user;
    } else {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          updatedUser = JSON.parse(userData);
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    }
    
    if (updatedUser) {
      // Force reactivity by creating a new object
      currentUser = { ...updatedUser };
      isLoggedIn = true;
    } else {
      currentUser = null;
      isLoggedIn = false;
    }
  }
  
  $: filteredConversations = searchQuery 
    ? conversations.filter(c => 
        (c.other_name || c.other_username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.task_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;
  
  onMount(async () => {
    await fetchCurrentUser();
    
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      currentLanguage = savedLanguage;
    }
    
    if (isLoggedIn) {
      await loadConversations();
      
      // After loading conversations, check if we need to select a conversation from URL params
      // This handles the case when navigating from task detail page with taskId and otherUserId
      if (taskId && otherUserId && !selectedConversation) {
        // Try to find existing conversation first
        const existingConv = conversations.find(c => 
          c.task_id === taskId && c.other_user_id === otherUserId
        );
        
        if (existingConv) {
          await selectConversation(existingConv);
        } else {
          // Create new conversation if it doesn't exist
          await selectConversationForTask(taskId, otherUserId);
        }
      }
    }
    
    if (browser) {
      window.addEventListener('userUpdated', handleUserUpdate);
      window.addEventListener('storage', (e) => {
        if (e.key === 'user') {
          handleUserUpdate(e);
        }
      });
    }
  });
  
  onDestroy(() => {
    stopMessagePolling();
    if (browser) {
      window.removeEventListener('userUpdated', handleUserUpdate);
    }
  });
</script>

<svelte:head>
  <title>Messages - HandyGO</title>
</svelte:head>

<div class="messages-page">
  <!-- Header -->
  <header class="header">
    <div class="header-container">
      <a href="/" class="nav-left" on:click|preventDefault={() => goto('/')}>
        <img src="/favicon.png" alt="HandyGO" class="logo-icon" />
        <h1 class="logo">HandyGO</h1>
      </a>
      <nav class="nav-right">
        {#if isLoggedIn}
          <div class="user-menu-wrapper">
            <div class="user-info" on:click={toggleUserMenu}>
              {#if currentUser?.avatar_url}
                <img src={currentUser.avatar_url} alt="User Avatar" class="user-avatar" />
              {:else}
                <img src="https://ui-avatars.com/api/?name={encodeURIComponent(currentUser?.name || currentUser?.username || 'User')}&background=ECF86E&color=000" alt="User Avatar" class="user-avatar" />
              {/if}
              <span class="user-name">{currentUser?.name || currentUser?.username || 'User'}</span>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" class="dropdown-arrow">
                <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            {#if showUserMenu}
              <div class="user-dropdown">
                <a href="/profile" class="dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" fill="currentColor"/>
                    <path d="M0 14C0 10.6863 2.68629 8 6 8H10C13.3137 8 16 10.6863 16 14V16H0V14Z" fill="currentColor"/>
                  </svg>
                  Profile
                </a>
                <button class="dropdown-item" on:click={handleLogout}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 2L1 7L6 12M1 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  Logout
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <button class="btn-login" on:click={() => goto('/login')}>Sign In</button>
          <button class="btn-register" on:click={() => goto('/register')}>Sign Up</button>
        {/if}
        
        <div class="language-wrapper">
          <button class="language-btn" on:click={toggleLanguageMenu}>
            {languages[currentLanguage]}
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" class="dropdown-arrow">
              <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          {#if showLanguageMenu}
            <div class="language-dropdown">
              <button class="dropdown-item" class:active={currentLanguage === 'en'} on:click={() => changeLanguage('en')}>
                English
              </button>
              <button class="dropdown-item" class:active={currentLanguage === 'sv'} on:click={() => changeLanguage('sv')}>
                Svenska
              </button>
              <button class="dropdown-item" class:active={currentLanguage === 'fi'} on:click={() => changeLanguage('fi')}>
                Suomi
              </button>
            </div>
          {/if}
        </div>
      </nav>
    </div>
  </header>

  <div class="messages-container-wrapper">
    <!-- Left Sidebar - Conversations List -->
    <aside class="conversations-sidebar">
      <div class="sidebar-header">
        <h2>Messages</h2>
        <div class="search-container">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search" 
            class="search-input"
            bind:value={searchQuery}
          />
        </div>
      </div>
      
      <div class="conversations-list">
        {#if loadingConversations}
          <div class="loading">Loading conversations...</div>
        {:else if filteredConversations.length === 0}
          <div class="empty-state">No conversations yet</div>
        {:else}
          {#each filteredConversations as conversation}
            <button 
              class="conversation-item"
              class:active={selectedConversation?.task_id === conversation.task_id && selectedConversation?.other_user_id === conversation.other_user_id}
              on:click={async () => await selectConversation(conversation)}
            >
              <div class="conversation-avatar">
                {#if conversation.other_avatar_url}
                  <img src={conversation.other_avatar_url} alt={conversation.other_name || conversation.other_username} />
                {:else}
                  <img src="https://ui-avatars.com/api/?name={encodeURIComponent(conversation.other_name || conversation.other_username || 'User')}&size=48&background=ECF86E&color=000" alt={conversation.other_name || conversation.other_username} />
                {/if}
              </div>
              <div class="conversation-info">
                <div class="conversation-header">
                  <span class="conversation-name">{conversation.other_name || conversation.other_username || 'User'}</span>
                </div>
                <div class="conversation-task">Task: {conversation.task_name || 'Untitled Task'}</div>
                {#if conversation.last_message_content}
                  <div class="conversation-preview">{conversation.last_message_content}</div>
                {/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </aside>

    <!-- Main Chat Area -->
    <main class="chat-area">
      {#if selectedConversation}
        <!-- Chat Header -->
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-avatar">
              {#if selectedConversation.other_avatar_url}
                <img src={selectedConversation.other_avatar_url} alt={selectedConversation.other_name || selectedConversation.other_username} />
              {:else}
                <img src="https://ui-avatars.com/api/?name={encodeURIComponent(selectedConversation.other_name || selectedConversation.other_username || 'User')}&size=40&background=ECF86E&color=000" alt={selectedConversation.other_name || selectedConversation.other_username} />
              {/if}
            </div>
            <div>
              <h3 class="chat-title">Chat with {selectedConversation.other_name || selectedConversation.other_username || 'User'}</h3>
              <p class="chat-subtitle">Regarding '{selectedConversation.task_name || 'Task'}'</p>
            </div>
          </div>
        </div>
        
        <!-- Task Banner -->
        <div class="task-banner">
          <div class="task-banner-info">
            <span class="task-banner-title">Task: {selectedConversation.task_name || 'Untitled Task'}</span>
            <span class="task-banner-status">Status - Ongoing</span>
          </div>
          <button class="btn-view-task" on:click={() => goto(`/task/${selectedConversation.task_id}`)}>
            View Task
          </button>
        </div>
        
        <!-- Messages -->
        <div class="messages-container">
          {#if loadingMessages}
            <div class="loading">Loading messages...</div>
          {:else if messages.length === 0}
            <div class="empty-state">No messages yet. Start the conversation!</div>
          {:else}
            {#each messages as message}
              <div class="message" class:sent={message.sender_id === currentUser?.id}>
                <div class="message-avatar">
                  {#if message.sender_id === currentUser?.id}
                    {#if currentUser?.avatar_url}
                      <img src={currentUser.avatar_url} alt={currentUser.name || currentUser.username} />
                    {:else}
                      <img src="https://ui-avatars.com/api/?name={encodeURIComponent(currentUser?.name || currentUser?.username || 'User')}&size=32&background=ECF86E&color=000" alt={currentUser.name || currentUser.username} />
                    {/if}
                  {:else}
                    {#if selectedConversation.other_avatar_url}
                      <img src={selectedConversation.other_avatar_url} alt={selectedConversation.other_name || selectedConversation.other_username} />
                    {:else}
                      <img src="https://ui-avatars.com/api/?name={encodeURIComponent(selectedConversation.other_name || selectedConversation.other_username || 'User')}&size=32&background=ECF86E&color=000" alt={selectedConversation.other_name || selectedConversation.other_username} />
                    {/if}
                  {/if}
                </div>
                <div class="message-content">
                  <p class="message-text">{message.content}</p>
                  <span class="message-time">{formatDate(message.created_at)}</span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
        
        <!-- Message Input -->
        <div class="message-input-container">
          <button class="attachment-btn" title="Attach file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input 
            type="text" 
            placeholder="Type message"
            class="message-input"
            bind:value={messageInput}
            on:keydown={handleKeyPress}
            disabled={sending}
          />
          <button 
            class="send-btn"
            on:click={sendMessage}
            disabled={sending || !messageInput.trim()}
            title="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      {:else}
        <div class="no-conversation-selected">
          <p>Select a conversation to start chatting</p>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  .messages-page {
    min-height: 100vh;
    background-color: #F5F5F5;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    flex-direction: column;
  }
  
  /* Header Styles */
  .header {
    background: #FFFFFF;
    border-bottom: 1px solid #EAF2FD;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 20px;
    max-width: 100%;
    margin: 0;
  }
  
  .nav-left {
    display: flex;
    align-items: center;
    gap: 15px;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }
  
  .nav-left:hover {
    opacity: 0.7;
  }
  
  .logo-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
  
  .logo {
    font-size: 1.8rem;
    font-weight: 700;
    color: #000000;
    margin: 0;
  }
  
  .nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .btn-login {
    background: transparent;
    border: 2px solid #000;
    color: #000;
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .btn-login:hover {
    background: #000;
    color: #fff;
  }
  
  .btn-register {
    background: #ECF86E;
    border: none;
    color: #000;
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .btn-register:hover {
    background: #E0F055;
  }
  
  .user-menu-wrapper {
    position: relative;
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
  }
  
  .user-info:hover {
    background: #EAF2FD;
  }
  
  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .user-name {
    font-weight: 600;
    color: #000;
  }
  
  .dropdown-arrow {
    transition: transform 0.2s ease;
  }
  
  .user-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: #fff;
    border: 1px solid #EAF2FD;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    min-width: 180px;
    z-index: 1000;
    overflow: hidden;
  }
  
  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: none;
    background: none;
    color: #000;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s ease;
    text-decoration: none;
  }
  
  .dropdown-item:hover,
  .dropdown-item.active {
    background: #F8FFCB;
  }
  
  .language-wrapper {
    position: relative;
  }
  
  .language-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: #666;
    font-weight: 500;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s ease;
  }
  
  .language-btn:hover {
    background: #EAF2FD;
    color: #000;
  }
  
  .language-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: #fff;
    border: 1px solid #EAF2FD;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    min-width: 150px;
    z-index: 1000;
    overflow: hidden;
  }
  
  /* Messages Container Wrapper */
  .messages-container-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
    max-height: calc(100vh - 80px);
  }
  
  /* Conversations Sidebar */
  .conversations-sidebar {
    width: 350px;
    background: #FFFFFF;
    border-right: 1px solid #EAF2FD;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid #EAF2FD;
  }
  
  .sidebar-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #000;
    margin-bottom: 1rem;
  }
  
  .search-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #F5F5F5;
    border-radius: 8px;
  }
  
  .search-container svg {
    color: #666;
    flex-shrink: 0;
  }
  
  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 0.9rem;
    color: #000;
  }
  
  .search-input::placeholder {
    color: #999;
  }
  
  .conversations-list {
    flex: 1;
    overflow-y: auto;
  }
  
  .conversation-item {
    width: 100%;
    display: flex;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
    border-bottom: 1px solid #F5F5F5;
  }
  
  .conversation-item:hover {
    background: #F8FFCB;
  }
  
  .conversation-item.active {
    background: #ECF86E;
  }
  
  .conversation-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: #ECF86E;
  }
  
  .conversation-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .conversation-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .conversation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .conversation-name {
    font-weight: 600;
    color: #000;
    font-size: 1rem;
  }
  
  .conversation-task {
    font-size: 0.85rem;
    color: #666;
  }
  
  .conversation-preview {
    font-size: 0.85rem;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .loading,
  .empty-state {
    padding: 2rem;
    text-align: center;
    color: #666;
  }
  
  /* Chat Area */
  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #FFFFFF;
    overflow: hidden;
  }
  
  .chat-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #EAF2FD;
    background: #FFFFFF;
  }
  
  .chat-header-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .chat-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background: #ECF86E;
    flex-shrink: 0;
  }
  
  .chat-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .chat-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #000;
    margin: 0;
  }
  
  .chat-subtitle {
    font-size: 0.85rem;
    color: #666;
    margin: 0;
  }
  
  .task-banner {
    background: #ECF86E;
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .task-banner-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .task-banner-title {
    font-weight: 600;
    color: #000;
  }
  
  .task-banner-status {
    font-size: 0.85rem;
    color: #666;
  }
  
  .btn-view-task {
    background: #000;
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .btn-view-task:hover {
    background: #333;
  }
  
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .message {
    display: flex;
    gap: 0.75rem;
    max-width: 70%;
    align-items: flex-start;
  }
  
  .message.sent {
    align-self: flex-end;
    flex-direction: row-reverse;
  }
  
  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: #ECF86E;
    flex-shrink: 0;
  }
  
  .message-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .message-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .message.sent .message-content {
    align-items: flex-end;
  }
  
  .message-text {
    background: #F5F5F5;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    color: #000;
    margin: 0;
    word-wrap: break-word;
  }
  
  .message.sent .message-text {
    background: #ECF86E;
  }
  
  .message-time {
    font-size: 0.75rem;
    color: #999;
    padding: 0 0.5rem;
  }
  
  .message-input-container {
    padding: 1rem 1.5rem;
    border-top: 1px solid #EAF2FD;
    display: flex;
    gap: 0.75rem;
    align-items: center;
    background: #FFFFFF;
  }
  
  .attachment-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    color: #666;
    cursor: pointer;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  
  .attachment-btn:hover {
    background: #F5F5F5;
    color: #000;
  }
  
  .message-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 2px solid #E0E0E0;
    border-radius: 24px;
    font-size: 1rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s ease;
  }
  
  .message-input:focus {
    border-color: #ECF86E;
  }
  
  .message-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .send-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: #ECF86E;
    color: #000;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  
  .send-btn:hover:not(:disabled) {
    background: #E0F055;
  }
  
  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .no-conversation-selected {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-size: 1.1rem;
  }
  
  @media (max-width: 768px) {
    .conversations-sidebar {
      width: 100%;
      max-width: 100%;
    }
    
    .messages-container-wrapper {
      flex-direction: column;
    }
    
    .message {
      max-width: 85%;
    }
  }
</style>

