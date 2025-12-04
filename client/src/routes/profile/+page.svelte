<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  
  let currentUser = null;
  let userTasks = [];
  let favoriteTasks = [];
  let loading = true;
  let activeTab = 'posted'; // posted, accepted, favourite, reviews
  let isLoggedIn = false;
  let showLanguageMenu = false;
  let currentLanguage = 'en';
  let favorites = new Set();
  
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
          await loadUserTasks();
        } else {
          // Redirect to login if not logged in
          goto('/login');
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      const userData = localStorage.getItem('user');
      if (userData) {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
        await loadUserTasks();
      } else {
        goto('/login');
      }
    }
  }

  async function loadUserTasks() {
    if (!currentUser?.id) return;
    
    try {
      const response = await fetch(`${apiUrl(API_CONFIG.endpoints.tasks)}?userId=${currentUser.id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        userTasks = await response.json();
      }
    } catch (error) {
      console.error('Error loading user tasks:', error);
    } finally {
      loading = false;
    }
  }

  async function loadFavoriteTasks() {
    try {
      // Load favorite task IDs from localStorage
      const savedFavorites = localStorage.getItem('favoriteTasks');
      if (!savedFavorites) {
        favoriteTasks = [];
        return;
      }
      
      favorites = new Set(JSON.parse(savedFavorites));
      const favoriteIds = Array.from(favorites);
      
      if (favoriteIds.length === 0) {
        favoriteTasks = [];
        return;
      }
      
      // Load all tasks and filter by favorites
      const response = await fetch(apiUrl(API_CONFIG.endpoints.tasks), {
        credentials: 'include'
      });
      
      if (response.ok) {
        const allTasks = await response.json();
        favoriteTasks = allTasks.filter(task => favoriteIds.includes(task.id));
      }
    } catch (error) {
      console.error('Error loading favorite tasks:', error);
      favoriteTasks = [];
    }
  }

  function toggleFavorite(taskId, event) {
    if (event) event.stopPropagation();
    
    if (favorites.has(taskId)) {
      favorites.delete(taskId);
    } else {
      favorites.add(taskId);
    }
    favorites = new Set([...favorites]);
    
    // Save to localStorage to sync across pages
    localStorage.setItem('favoriteTasks', JSON.stringify([...favorites]));
    
    // Dispatch custom event to notify other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('favoritesUpdated', { 
        detail: { favorites: [...favorites] } 
      }));
    }
    
    // Reload favorite tasks if on favorites tab
    if (activeTab === 'favourite') {
      loadFavoriteTasks();
    }
  }

  function isFavorite(taskId) {
    return favorites.has(taskId);
  }

  // Watch for activeTab changes
  $: if (activeTab === 'favourite') {
    loadFavoriteTasks();
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function getTaskIcon(type) {
    // You can customize icons based on task type
    return '📦';
  }

  function handleLogout() {
    localStorage.removeItem('user');
    isLoggedIn = false;
    currentUser = null;
    goto('/login');
  }

  function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    showLanguageMenu = false;
  }

  function toggleLanguageMenu() {
    showLanguageMenu = !showLanguageMenu;
  }

  onMount(async () => {
    await fetchCurrentUser();
    
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      currentLanguage = savedLanguage;
    }
    
    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('favoriteTasks');
    if (savedFavorites) {
      favorites = new Set(JSON.parse(savedFavorites));
    }

    // Listen for favorites updates from other pages
    if (typeof window !== 'undefined') {
      window.addEventListener('favoritesUpdated', handleFavoritesUpdate);
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('userUpdated', handleUserUpdate);
    }
  });

  function handleFavoritesUpdate(event) {
    if (event.detail && event.detail.favorites) {
      favorites = new Set(event.detail.favorites);
      // Reload favorite tasks if on favorites tab
      if (activeTab === 'favourite') {
        loadFavoriteTasks();
      }
    }
  }

  function handleStorageChange(event) {
    if (event.key === 'favoriteTasks' && event.newValue) {
      favorites = new Set(JSON.parse(event.newValue));
      // Reload favorite tasks if on favorites tab
      if (activeTab === 'favourite') {
        loadFavoriteTasks();
      }
    }
    if (event.key === 'user') {
      if (event.newValue) {
        try {
          const updatedUser = JSON.parse(event.newValue);
          // Force reactivity by creating a new object
          currentUser = { ...updatedUser };
          isLoggedIn = true;
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      } else {
        currentUser = null;
        isLoggedIn = false;
      }
      // Also call handleUserUpdate to ensure consistency
      handleUserUpdate(event);
    }
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

  onDestroy(() => {
    // Clean up event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('favoritesUpdated', handleFavoritesUpdate);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userUpdated', handleUserUpdate);
    }
  });
</script>

<svelte:head>
  <title>Profile - HandyGO</title>
</svelte:head>

<div class="profile-page">
  <!-- Top Navigation -->
  <header class="top-nav">
    <div class="nav-container">
      <div class="nav-left" on:click={() => goto('/')} role="button" tabindex="0">
        <img src="/favicon.png" alt="HandyGO" class="logo-icon" />
        <span class="logo-text">HandyGo</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="search-icon">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="search-text">Search for help</span>
      </div>
      
      <div class="nav-right">
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
        <button class="help-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2"/>
            <path d="M8 12V8M8 4H8.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Help
        </button>
        {#if isLoggedIn}
          <button class="btn-signout" on:click={handleLogout}>Sign Out</button>
        {:else}
          <button class="btn-signup" on:click={() => goto('/register')}>Sign Up</button>
          <button class="btn-signin" on:click={() => goto('/login')}>Sign In</button>
        {/if}
      </div>
    </div>
  </header>

  <div class="content-wrapper">
    <!-- Left Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-content">
        <div class="sidebar-item" on:click={() => goto('/')} role="button" tabindex="0">
          <img src="/favicon.png" alt="HandyGO" class="sidebar-logo" />
          <span>HandyGo</span>
        </div>
        
        <div class="sidebar-item" class:active={activeTab === 'profile'} on:click={() => activeTab = 'profile'}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" fill="currentColor"/>
            <path d="M0 14C0 10.6863 2.68629 8 6 8H10C13.3137 8 16 10.6863 16 14V16H0V14Z" fill="currentColor"/>
          </svg>
          <span>Profile</span>
        </div>
        
        <div class="sidebar-item" class:active={activeTab === 'posted'} on:click={() => activeTab = 'posted'}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M14 2H2C0.9 2 0 2.9 0 4V12C0 13.1 0.9 14 2 14H14C15.1 14 16 13.1 16 12V4C16 2.9 15.1 2 14 2ZM14 12H2V4H14V12Z" fill="currentColor"/>
            <path d="M4 6H12V8H4V6ZM4 9H10V11H4V9Z" fill="currentColor"/>
          </svg>
          <span>My Posted</span>
        </div>
        
        <div class="sidebar-item" class:active={activeTab === 'accepted'} on:click={() => activeTab = 'accepted'}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2"/>
            <path d="M8 4V8L11 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>My Accepted</span>
        </div>
        
        <div class="sidebar-item" class:active={activeTab === 'favourite'} on:click={() => activeTab = 'favourite'}>
          <svg width="20" height="20" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 407.584A279.584 279.584 0 0 1 512 212.64a279.584 279.584 0 0 1 480 194.944 278.144 278.144 0 0 1-113.024 224.512L562.592 892.8a96 96 0 0 1-124.416-1.952L130.016 620.16A278.976 278.976 0 0 1 32 407.584z" fill="currentColor"/>
          </svg>
          <span>Favorites</span>
        </div>
        
        <div class="sidebar-item" class:active={activeTab === 'settings'} on:click={() => activeTab = 'settings'}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" fill="currentColor"/>
            <path d="M13.6569 7.29289L12.2426 5.87868C12.0521 5.68816 11.7793 5.58816 11.5 5.61246L10.5153 5.72473C10.2795 5.54447 10.0261 5.38573 9.75736 5.25146L9.87868 3.75736C9.91321 3.47803 9.81321 3.20521 9.62268 3.01467L8.20711 1.60046C7.81658 1.20994 7.18342 1.20994 6.79289 1.60046L5.37868 3.01467C5.18816 3.20521 5.08816 3.47803 5.12268 3.75736L5.244 5.25146C4.97527 5.38573 4.72188 5.54447 4.48609 5.72473L3.5 5.61246C3.2207 5.58816 2.94788 5.68816 2.75736 5.87868L1.34315 7.29289C0.952623 7.68342 0.952623 8.31658 1.34315 8.70711L2.75736 10.1213C2.94788 10.3118 3.2207 10.4118 3.5 10.3875L4.48609 10.4998C4.72188 10.68 4.97527 10.8388 5.244 10.973L5.12268 12.4671C5.08816 12.7464 5.18816 13.0193 5.37868 13.2098L6.79289 14.624C7.18342 15.0145 7.81658 15.0145 8.20711 14.624L9.62268 13.2098C9.81321 13.0193 9.91321 12.7464 9.87868 12.4671L9.75736 10.973C10.0261 10.8388 10.2795 10.68 10.5153 10.4998L11.5 10.3875C11.7793 10.4118 12.0521 10.3118 12.2426 10.1213L13.6569 8.70711C14.0474 8.31658 14.0474 7.68342 13.6569 7.29289Z" fill="currentColor"/>
          </svg>
          <span>Settings</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      {#if loading}
        <div class="loading">Loading...</div>
      {:else if currentUser}
        <!-- Profile Overview -->
        <div class="profile-card">
          <div class="profile-overview">
            <div class="profile-avatar">
              {#if currentUser.avatar_url}
                <img src={currentUser.avatar_url} alt="Profile" />
              {:else}
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || currentUser.username || currentUser.email || 'User')}&size=120&background=ECF86E&color=000`} 
                  alt="Profile" 
                />
              {/if}
            </div>
            <div class="profile-info">
              <h2 class="profile-name">{currentUser.name || currentUser.username || 'User'}</h2>
              <p class="profile-email">Aalto email: {currentUser.email || 'N/A'}</p>
              {#if currentUser.address}
                <p class="profile-address">📍 {currentUser.address}</p>
              {/if}
              {#if currentUser.bio}
                <p class="profile-bio">{currentUser.bio}</p>
              {/if}
              <div class="profile-rating">
                <div class="stars">
                  {#each Array(5) as _, i}
                    <svg width="20" height="20" viewBox="0 0 20 20" fill={i < 4 ? '#FFD700' : (i < 4.8 ? 'url(#half-star)' : 'none')} stroke="#FFD700">
                      <path d="M10 0L12.2451 6.90983H19.5106L13.6327 11.1803L15.8779 18.0902L10 13.8197L4.12215 18.0902L6.36729 11.1803L0.489435 6.90983H7.75486L10 0Z"/>
                      {#if i === 4}
                        <defs>
                          <linearGradient id="half-star" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="80%" stop-color="#FFD700"/>
                            <stop offset="80%" stop-color="none"/>
                          </linearGradient>
                        </defs>
                      {/if}
                    </svg>
                  {/each}
                </div>
                <span class="rating-text">4.8/5.0</span>
              </div>
            </div>
            <button class="edit-profile-btn" on:click={() => goto('/profile/edit')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M11.3333 2.00004C11.5084 1.82489 11.7163 1.68601 11.9452 1.59131C12.1741 1.49661 12.4194 1.44824 12.6667 1.44824C12.914 1.44824 13.1593 1.49661 13.3882 1.59131C13.6171 1.68601 13.825 1.82489 14 2.00004C14.1751 2.17519 14.314 2.3831 14.4087 2.61199C14.5034 2.84088 14.5518 3.0862 14.5518 3.33337C14.5518 3.58054 14.5034 3.82586 14.4087 4.05475C14.314 4.28364 14.1751 4.49155 14 4.66671L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00004Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Edit Profile
            </button>
          </div>
        </div>

        <!-- Content based on active tab -->
        {#if activeTab === 'posted'}
          <!-- My Posted Section -->
          <div class="posted-section">
            <h3 class="section-title">My Posted</h3>
            {#if userTasks.length === 0}
              <div class="no-tasks">
                <p>You haven't posted any tasks yet.</p>
                <button class="post-first-btn" on:click={() => goto('/post')}>Post Your First Task</button>
              </div>
            {:else}
              <div class="tasks-list">
                {#each userTasks as task}
                  <div class="task-card" on:click={() => goto(`/task/${task.id}`)} role="button" tabindex="0">
                    <div class="task-icon">{getTaskIcon(task.type)}</div>
                    <div class="task-content">
                      <h4 class="task-name">{task.name}</h4>
                      <p class="task-details">
                        {task.price > 0 ? `${task.price} €` : 'Free'} 
                        {task.description ? ` • ${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}` : ''}
                      </p>
                      <p class="task-date">Posted: {formatDate(task.time)}</p>
                    </div>
                    <div class="task-status">
                      {#if task.completed}
                        <span class="status-badge completed">Completed</span>
                      {:else}
                        <span class="status-badge in-progress">In Progress</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else if activeTab === 'favourite'}
          <!-- Favorites Section -->
          <div class="posted-section">
            <h3 class="section-title">My Favorites</h3>
            {#if favoriteTasks.length === 0}
              <div class="no-tasks">
                <p>You haven't favorited any tasks yet.</p>
                <button class="post-first-btn" on:click={() => goto('/search')}>Browse Tasks</button>
              </div>
            {:else}
              <div class="tasks-list">
                {#each favoriteTasks as task}
                  <div class="task-card" on:click={() => goto(`/task/${task.id}`)} role="button" tabindex="0">
                    <div class="task-icon">{getTaskIcon(task.type)}</div>
                    <div class="task-content">
                      <h4 class="task-name">{task.name}</h4>
                      <p class="task-details">
                        {task.price > 0 ? `${task.price} €` : 'Free'} 
                        {task.description ? ` • ${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}` : ''}
                      </p>
                      <p class="task-date">Posted: {formatDate(task.time)}</p>
                      {#if task.location}
                        <p class="task-location">📍 {task.location}</p>
                      {/if}
                    </div>
                    <div class="task-actions">
                      <button 
                        class="favorite-btn {isFavorite(task.id) ? 'active' : ''}" 
                        on:click={(e) => toggleFavorite(task.id, e)}
                        title={isFavorite(task.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="heart-icon">
                          <path d="M32 407.584A279.584 279.584 0 0 1 512 212.64a279.584 279.584 0 0 1 480 194.944 278.144 278.144 0 0 1-113.024 224.512L562.592 892.8a96 96 0 0 1-124.416-1.952L130.016 620.16A278.976 278.976 0 0 1 32 407.584z" class="heart-path" fill={isFavorite(task.id) ? '#FF0000' : '#999'}></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else if activeTab === 'accepted'}
          <!-- My Accepted Section -->
          <div class="posted-section">
            <h3 class="section-title">My Accepted</h3>
            <div class="no-tasks">
              <p>You haven't accepted any tasks yet.</p>
              <button class="post-first-btn" on:click={() => goto('/search')}>Browse Tasks</button>
            </div>
          </div>
        {:else if activeTab === 'profile'}
          <!-- Profile Overview Only -->
          <div></div>
        {:else}
          <!-- Other tabs placeholder -->
          <div class="posted-section">
            <h3 class="section-title">Coming Soon</h3>
            <div class="no-tasks">
              <p>This feature is coming soon.</p>
            </div>
          </div>
        {/if}
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

  .profile-page {
    min-height: 100vh;
    background-color: #F5F5F5;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Top Navigation */
  .top-nav {
    background: #FFFFFF;
    border-bottom: 1px solid #E0E0E0;
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .nav-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
  }

  .logo-icon {
    width: 32px;
    height: 32px;
  }

  .logo-text {
    font-size: 1.5rem;
    font-weight: 700;
    color: #000;
  }

  .search-icon {
    color: #666;
    margin-left: 1rem;
  }

  .search-text {
    color: #666;
    font-size: 0.9rem;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
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
  }

  .language-btn:hover {
    background: #F5F5F5;
  }

  .language-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: #fff;
    border: 1px solid #E0E0E0;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    min-width: 150px;
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-item {
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .dropdown-item:hover,
  .dropdown-item.active {
    background: #F8FFCB;
  }

  .help-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: #666;
    font-weight: 500;
    padding: 0.5rem 1rem;
    cursor: pointer;
    border-radius: 8px;
  }

  .help-btn:hover {
    background: #F5F5F5;
  }

  .btn-signup,
  .btn-signin,
  .btn-signout {
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-signup {
    background: #ECF86E;
    color: #000;
  }

  .btn-signup:hover {
    background: #E0F055;
  }

  .btn-signin,
  .btn-signout {
    background: transparent;
    border: 2px solid #000;
    color: #000;
  }

  .btn-signin:hover,
  .btn-signout:hover {
    background: #000;
    color: #fff;
  }

  /* Content Wrapper */
  .content-wrapper {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    gap: 2rem;
  }

  /* Sidebar */
  .sidebar {
    width: 250px;
    flex-shrink: 0;
  }

  .sidebar-content {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    color: #666;
    font-weight: 500;
  }

  .sidebar-item:hover {
    background: #F5F5F5;
    color: #000;
  }

  .sidebar-item.active {
    background: #ECF86E;
    color: #000;
    font-weight: 600;
  }

  .sidebar-logo {
    width: 24px;
    height: 24px;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Profile Card */
  .profile-card {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 2rem;
  }

  .profile-overview {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    background: #ECF86E;
    flex-shrink: 0;
  }

  .profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-info {
    flex: 1;
  }

  .profile-name {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: #000;
  }

  .profile-email {
    color: #666;
    margin-bottom: 1rem;
  }

  .profile-rating {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stars {
    display: flex;
    gap: 2px;
  }

  .rating-text {
    font-weight: 600;
    color: #000;
  }

  .edit-profile-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #ECF86E;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    color: #000;
  }

  .edit-profile-btn:hover {
    background: #E0F055;
  }

  /* Posted Section */
  .posted-section {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 2rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    color: #000;
  }

  .tasks-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .task-card {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.5rem;
    background: #F9F9F9;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .task-card:hover {
    background: #F0F0F0;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .task-icon {
    font-size: 2rem;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #FFFFFF;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .task-content {
    flex: 1;
  }

  .task-name {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #000;
  }

  .task-details {
    color: #666;
    margin-bottom: 0.25rem;
  }

  .task-date {
    color: #999;
    font-size: 0.9rem;
  }

  .task-status {
    flex-shrink: 0;
  }

  .status-badge {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .status-badge.in-progress {
    background: #ECF86E;
    color: #000;
  }

  .status-badge.completed {
    background: #D4E8FD;
    color: #000;
  }

  .no-tasks {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .post-first-btn {
    margin-top: 1rem;
    padding: 0.75rem 2rem;
    background: #ECF86E;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .post-first-btn:hover {
    background: #E0F055;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .task-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .favorite-btn {
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid #EAF2FD;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    padding: 0;
  }

  .favorite-btn:hover {
    transform: scale(1.1);
    border-color: #ECF86E;
  }

  .favorite-btn.active {
    background: rgba(255, 0, 0, 0.1);
    border-color: #FF0000;
  }

  .favorite-btn .heart-icon {
    width: 20px;
    height: 20px;
  }

  .task-location {
    color: #999;
    font-size: 0.85rem;
    margin-top: 0.25rem;
  }

  @media (max-width: 1024px) {
    .content-wrapper {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
    }

    .sidebar-content {
      flex-direction: row;
      overflow-x: auto;
    }
  }
</style>

