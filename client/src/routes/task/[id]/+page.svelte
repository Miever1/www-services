<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  import { browser } from '$app/environment';
  
  let task = null;
  let loading = true;
  let error = null;
  let favorites = new Set();
  let isLoggedIn = false;
  let currentUser = null;
  let showUserMenu = false;
  let showLanguageMenu = false;
  let currentLanguage = 'en';
  let similarTasks = [];
  let recommendedTasks = [];
  let taskCreator = null; // Task creator/user information
  
  $: taskId = $page.params.id;
  let lastLoadedTaskId = null; // Track last loaded task ID
  
  // Watch for taskId changes and reload task immediately when route changes
  // This reactive statement will trigger whenever taskId changes
  $: if (taskId && browser && taskId !== lastLoadedTaskId) {
    console.log('🔄 Route changed - Loading task:', taskId, '(previous:', lastLoadedTaskId, ')');
    
    // Update lastLoadedTaskId immediately to prevent duplicate loads
    lastLoadedTaskId = taskId;
    
    // Reset state when taskId changes
    loading = true;
    error = null;
    task = null;
    
    // Load task immediately when taskId changes
    loadTask().then(() => {
      if (task) {
        console.log('✅ Task loaded successfully:', task.id);
        loadRecommendations();
        // Reload favorites when task changes
        if (browser) {
          const savedFavorites = localStorage.getItem('favoriteTasks');
          if (savedFavorites) {
            favorites = new Set(JSON.parse(savedFavorites));
          }
        }
      } else {
        console.warn('⚠️ Task loaded but is null or undefined');
      }
    }).catch(err => {
      console.error('❌ Error loading task:', err);
    });
  }
  
  onMount(async () => {
    // Check login status
    if (browser) {
      const userData = localStorage.getItem('user');
      if (userData) {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
      }
      
      // Get language setting
      const savedLanguage = localStorage.getItem('language');
      if (savedLanguage) {
        currentLanguage = savedLanguage;
      }
      
      // Load saved favorites
      const savedFavorites = localStorage.getItem('favoriteTasks');
      if (savedFavorites) {
        favorites = new Set(JSON.parse(savedFavorites));
      }

      // Listen for favorites updates from other pages
      window.addEventListener('favoritesUpdated', handleFavoritesUpdate);
      window.addEventListener('storage', handleStorageChange);
      
      // Listen for user updates from other pages/tabs
      window.addEventListener('userUpdated', handleUserUpdate);
      window.addEventListener('storage', (e) => {
        if (e.key === 'user') {
          handleUserUpdate();
        }
      });
      
      // Also reload favorites when page becomes visible (user switches back from another tab)
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Initialize taskId tracking
      if (taskId) {
        lastLoadedTaskId = taskId;
        // Load task on initial mount
        await loadTask();
        if (task) {
          loadRecommendations();
        }
      }
    }
  });

  function handleFavoritesUpdate(event) {
    if (event.detail && event.detail.favorites) {
      favorites = new Set(event.detail.favorites);
    }
  }

  function handleStorageChange(event) {
    if (event.key === 'favoriteTasks' && event.newValue) {
      favorites = new Set(JSON.parse(event.newValue));
    }
  }

  function handleVisibilityChange() {
    // Reload favorites when page becomes visible
    if (!document.hidden) {
      const savedFavorites = localStorage.getItem('favoriteTasks');
      if (savedFavorites) {
        favorites = new Set(JSON.parse(savedFavorites));
      }
    }
  }
  
  function handleUserUpdate(event) {
    console.log('Task detail page handleUserUpdate called:', event);
    // Try to get user from event detail first, then localStorage
    let updatedUser = null;
    if (event && event.detail && event.detail.user) {
      updatedUser = event.detail.user;
      console.log('Got user from event detail:', updatedUser);
    } else {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          updatedUser = JSON.parse(userData);
          console.log('Got user from localStorage:', updatedUser);
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    }
    
    if (updatedUser) {
      // Force reactivity by creating a new object
      currentUser = { ...updatedUser };
      isLoggedIn = true;
      console.log('Updated currentUser in task detail page:', currentUser);
      
      // If the updated user is the task creator, update taskCreator too
      if (taskCreator && taskCreator.id === updatedUser.id) {
        taskCreator = {
          ...taskCreator,
          ...updatedUser
        };
        console.log('Updated taskCreator:', taskCreator);
      }
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });
  
  function handleLogout() {
    localStorage.removeItem('user');
    isLoggedIn = false;
    currentUser = null;
    showUserMenu = false;
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
  
  const languages = {
    en: 'English',
    sv: 'Svenska',
    fi: 'Suomi'
  };
  
  async function loadTask() {
    if (!taskId) {
      error = 'Task ID is missing';
      loading = false;
      return;
    }
    
    loading = true;
    error = null;
    task = null; // Clear previous task
    
    try {
      const url = apiUrl(API_CONFIG.endpoints.task(taskId));
      console.log('Loading task from:', url);
      
      const response = await fetch(url, {
        credentials: 'include' // Include cookies for session
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Task not found');
        }
        throw new Error(`Failed to load task: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      // API returns single object (not array)
      task = Array.isArray(data) ? data[0] : data;
      
      if (!task || !task.id) {
        throw new Error('Invalid task data received');
      }
      
      // Parse images if it's a string (JSON from database)
      if (task.images) {
        if (typeof task.images === 'string') {
          try {
            task.images = JSON.parse(task.images);
          } catch (e) {
            console.warn('Failed to parse images:', e);
            task.images = [];
          }
        }
        // Ensure images is an array
        if (!Array.isArray(task.images)) {
          task.images = [];
        }
      } else {
        task.images = [];
      }
      
      console.log('Task loaded with images:', task.images);
      
      // Reload favorites when task loads to ensure sync
      if (browser) {
        const savedFavorites = localStorage.getItem('favoriteTasks');
        if (savedFavorites) {
          favorites = new Set(JSON.parse(savedFavorites));
        }
      }
      
      // Load task creator information
      if (task.user_id) {
        await loadTaskCreator(task.user_id, task);
      }
      
      console.log('Successfully loaded task:', task);
    } catch (err) {
      console.error('Error loading task:', err);
      error = err.message || 'Failed to load task';
      task = null;
    } finally {
      loading = false;
    }
  }
  
  async function loadTaskCreator(userId, taskData) {
    if (!userId) return;
    
    try {
      // Try to get user from localStorage first (if it's the current user)
      if (browser) {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.id === userId) {
            taskCreator = user;
            return;
          }
        }
      }
      
      // Try to fetch user information from API
      try {
        const response = await fetch(apiUrl(API_CONFIG.endpoints.user(userId)), {
          credentials: 'include'
        });
        
        if (response.ok) {
          const userData = await response.json();
          taskCreator = Array.isArray(userData) ? userData[0] : userData;
          if (taskCreator && taskCreator.id) {
            console.log('Task creator loaded from API:', taskCreator);
            return;
          }
        }
      } catch (apiError) {
        console.warn('Failed to fetch user from API, trying fallback:', apiError);
      }
      
      // Fallback: check if taskData already contains user information
      if (taskData && (taskData.username || taskData.user_name || taskData.creator_name)) {
        taskCreator = {
          id: userId,
          username: taskData.username || taskData.user_name || `User ${userId.substring(0, 8)}`,
          name: taskData.creator_name || taskData.username || taskData.user_name || `User ${userId.substring(0, 8)}`,
          email: taskData.user_email || null,
          avatar_url: taskData.creator_avatar_url || null
        };
        console.log('Task creator loaded from task data:', taskCreator);
        return;
      }
      
      // Last resort: create a basic user object
      taskCreator = {
        id: userId,
        username: `User ${userId.substring(0, 8)}`,
        name: `User ${userId.substring(0, 8)}`,
        email: null,
        avatar_url: null
      };
      
      console.log('Task creator loaded (basic):', taskCreator);
    } catch (err) {
      console.error('Error loading task creator:', err);
      taskCreator = {
        id: userId,
        username: 'Unknown User',
        name: 'Unknown User',
        avatar_url: null
      };
    }
  }
  
  function toggleFavorite(taskId, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // 切换收藏状态 - 必须创建全新的Set来触发Svelte响应式更新
    const newFavorites = new Set(favorites);
    if (newFavorites.has(taskId)) {
      newFavorites.delete(taskId);
      console.log('取消收藏任务:', taskId);
    } else {
      newFavorites.add(taskId);
      console.log('收藏任务:', taskId);
    }
    
    // 创建全新的Set引用以强制触发响应式更新
    favorites = new Set(newFavorites);
    
    // Save favorites to localStorage to sync across pages
    if (browser) {
      localStorage.setItem('favoriteTasks', JSON.stringify([...favorites]));
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('favoritesUpdated', { 
        detail: { favorites: [...favorites] } 
      }));
    }
  }
  
  // 响应式函数：Svelte会自动追踪favorites的变化
  $: isFavorite = (taskId) => {
    return favorites.has(taskId);
  }
  
  function handleSendMessage() {
    if (!task || !taskCreator) {
      alert('Task information not loaded yet. Please wait...');
      return;
    }
    // Navigate to messages page with task and other user info
    goto(`/messages?taskId=${task.id}&otherUserId=${taskCreator.id}`);
  }
  
  function handlePayAndBuy() {
    goto(`/task/${taskId}/payment`);
  }
  
  function openMapNavigation(address) {
    // Create a Google Maps search URL
    const query = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  }
  
  async function loadRecommendations() {
    if (!task) return;
    
    try {
      // Load all tasks
      const response = await fetch(apiUrl(API_CONFIG.endpoints.tasks), {
        credentials: 'include' // Include cookies for session
      });
      const allTasks = await response.json();
      
      // Parse images field for each task if it exists
      const parsedTasks = allTasks.map(t => {
        if (t.images) {
          if (typeof t.images === 'string') {
            try {
              t.images = JSON.parse(t.images);
            } catch (e) {
              console.warn('Failed to parse images for task:', t.id, e);
              t.images = [];
            }
          }
          if (!Array.isArray(t.images)) {
            t.images = [];
          }
        } else {
          t.images = [];
        }
        return t;
      });
      
      // Filter out current task
      const otherTasks = parsedTasks.filter(t => t.id !== task.id);
      
      // Track used task IDs to avoid duplicates
      const usedTaskIds = new Set();
      const recommendations = [];
      
      // Try to find similar tasks based on category
      if (task.category) {
        const similarByCategory = otherTasks.filter(t => 
          t.category === task.category && !usedTaskIds.has(t.id)
        );
        similarByCategory.forEach(t => {
          recommendations.push(t);
          usedTaskIds.add(t.id);
        });
      }
      
      // If we have some recommendations, stop here - don't force fill to 6
      // Only add more if there are no category matches
      if (recommendations.length === 0) {
        // If no category matches, get user's favorite tasks
        const savedFavorites = localStorage.getItem('favoriteTasks');
        if (savedFavorites) {
          const favoriteIds = JSON.parse(savedFavorites);
          const favoriteTasks = otherTasks.filter(t => 
            favoriteIds.includes(t.id) && !usedTaskIds.has(t.id)
          );
          favoriteTasks.forEach(t => {
            recommendations.push(t);
            usedTaskIds.add(t.id);
          });
        }
        
        // If still no recommendations, get recently viewed tasks
        if (recommendations.length === 0) {
          const viewedTasks = localStorage.getItem('viewedTasks');
          if (viewedTasks) {
            const viewedIds = JSON.parse(viewedTasks);
            const viewedTasksList = otherTasks.filter(t => 
              viewedIds.includes(t.id) && !usedTaskIds.has(t.id)
            );
            viewedTasksList.forEach(t => {
              recommendations.push(t);
              usedTaskIds.add(t.id);
            });
          }
        }
        
        // If still no recommendations, get the latest tasks (but only a few)
        if (recommendations.length === 0) {
          const latestTasks = otherTasks
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .filter(t => !usedTaskIds.has(t.id))
            .slice(0, 3); // Only get 3 latest, not force to 6
          latestTasks.forEach(t => {
            recommendations.push(t);
            usedTaskIds.add(t.id);
          });
        }
      }
      
      // Set recommendations - don't force to 6, use whatever we have
      recommendedTasks = recommendations;
      similarTasks = recommendations;
      
      // Mark current task as viewed
      const viewedTasks = JSON.parse(localStorage.getItem('viewedTasks') || '[]');
      if (!viewedTasks.includes(task.id)) {
        viewedTasks.unshift(task.id);
        localStorage.setItem('viewedTasks', JSON.stringify(viewedTasks.slice(0, 50))); // Keep last 50
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      recommendedTasks = [];
      similarTasks = [];
    }
  }
</script>

<svelte:head>
  <title>{task ? task.name : 'Task Details'} - HandyGO</title>
</svelte:head>

<main class="task-detail-page">
  <!-- Navigation Header -->
  <header class="header">
    <div class="container">
      <div class="nav-left" on:click={() => goto('/')} role="button" tabindex="0" on:keydown={(e) => { if (e.key === 'Enter') goto('/'); }}>
        <img src="/favicon.png" alt="HandyGO" class="logo-icon" />
        <h1 class="logo">HandyGO</h1>
      </div>
      <nav class="nav-right">
        {#if isLoggedIn}
          <!-- User Menu -->
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
          
          <!-- Notifications -->
          <button class="icon-button" title="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2"/>
              <circle cx="19" cy="5" r="4" fill="#ECF86E"/>
            </svg>
          </button>
          
          <!-- Messages -->
          <button class="icon-button" title="Messages">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        {:else}
          <!-- Login/Register Buttons -->
          <button class="btn-login" on:click={() => goto('/login')}>Login</button>
          <button class="btn-register" on:click={() => goto('/register')}>Register</button>
        {/if}
        
        <!-- Language Selector -->
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

  <div class="container">
    {#if loading}
      <div class="loading">
        <p>Loading...</p>
      </div>
    {:else if error}
      <div class="error">
        <h2>Task Not Found</h2>
        <p>{error}</p>
        <a href="/search" class="back-btn">Back to Search</a>
      </div>
    {:else if task}
      <div class="task-layout">
        <!-- Left Column: Image Gallery -->
        <div class="image-column">
          <div class="image-gallery">
            {#if task.images && Array.isArray(task.images) && task.images.length > 0}
              <!-- Main Image -->
              <div class="main-image">
                <img src={task.images[0]?.data || task.images[0]} alt="Task image 1" />
              </div>
              <!-- Thumbnail Gallery -->
              <div class="thumbnail-gallery">
                {#each task.images.slice(0, 5) as imageObj, index}
                  <div class="thumbnail" on:click={() => {
                    // Swap with main image on click
                    const temp = task.images[0];
                    task.images[0] = task.images[index];
                    task.images[index] = temp;
                    task.images = [...task.images]; // Trigger reactivity
                  }}>
                    <img src={imageObj?.data || imageObj} alt="Thumbnail {index + 1}" />
                  </div>
                {/each}
              </div>
            {:else}
              <div class="main-image">📸</div>
              <div class="thumbnail-gallery">
                <div class="thumbnail">📸</div>
                <div class="thumbnail">📸</div>
                <div class="thumbnail">📸</div>
                <div class="thumbnail">📸</div>
                <div class="thumbnail">📸</div>
              </div>
            {/if}
          </div>
        </div>
        
        <!-- Right Column: Main Information -->
        <div class="info-column">
          <!-- Title and Price -->
          <div class="post-header">
            <div class="post-header-top">
              <h1 class="post-title">{task.name || 'Title'}</h1>
              <button
                class="favorite-btn-main {isFavorite(task.id) ? 'active' : ''}" 
                on:click={() => toggleFavorite(task.id)}
                title={isFavorite(task.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="heart-icon">
                  <path d="M32 407.584A279.584 279.584 0 0 1 512 212.64a279.584 279.584 0 0 1 480 194.944 278.144 278.144 0 0 1-113.024 224.512L562.592 892.8a96 96 0 0 1-124.416-1.952L130.016 620.16A278.976 278.976 0 0 1 32 407.584z" class="heart-path"/>
                </svg>
              </button>
            </div>
            <div class="post-price">
              <span class="price">{task.price ? `€${task.price}` : 'Price not set'}</span>
              <span class="price-description">{task.category || 'Category'}</span>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="action-buttons">
            <button class="btn-primary" on:click={handleSendMessage}>Send Message</button>
            <button class="btn-secondary" on:click={handlePayAndBuy}>Pay and buy</button>
          </div>
          
          <!-- Product Description -->
          <div class="product-description">
            <h3>Description</h3>
            <p>{task.description || 'Describe the product\'s condition, purchase date, usage history, etc. Provide as much detail as possible...'}</p>
          </div>
          
          <!-- Address -->
          <button class="post-address" on:click={() => openMapNavigation(task.location || 'Aalto Campus, Espoo')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>{task.location || 'Aalto Campus, Espoo'}</span>
          </button>
          
          <!-- Helper Information -->
          {#if taskCreator}
            <div class="helper-card-inline">
              <div class="helper-profile">
                {#if taskCreator?.avatar_url}
                  <img 
                    src={taskCreator.avatar_url} 
                    alt="Creator Avatar" 
                    class="helper-avatar"
                  />
                {:else}
                  <img 
                    src="https://ui-avatars.com/api/?name={encodeURIComponent(taskCreator?.name || taskCreator?.username || 'User')}&background=ECF86E&color=000" 
                    alt="Creator Avatar" 
                    class="helper-avatar"
                  />
                {/if}
                <div class="helper-name">{taskCreator?.name || taskCreator?.username || 'Unknown User'}</div>
              </div>
              <button class="info-btn" on:click={() => window.location.href = `/profile?user=${taskCreator.id}`}>
                More Information
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 6h10M6 1l5 5-5 5" stroke-linecap="round"></path>
                </svg>
              </button>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Similar Recommendations Section -->
      <div class="similar-section">
        <h2 class="section-title">Similar recommendations</h2>
        <div class="similar-grid">
          {#if recommendedTasks.length > 0}
            {#each recommendedTasks as recTask, index}
              <div class="similar-card" on:click={() => goto(`/task/${recTask.id}`)} role="button" tabindex="0">
                <div class="card-image">
                  {#if recTask.images && Array.isArray(recTask.images) && recTask.images.length > 0}
                    <img src={recTask.images[0]?.data || recTask.images[0]} alt={recTask.name} />
                  {:else}
                    <div class="card-image-placeholder">×</div>
                  {/if}
                  <button class="favorite-btn {isFavorite(recTask.id) ? 'active' : ''}" on:click={(e) => { e.stopPropagation(); toggleFavorite(recTask.id); }} on:mouseenter|stopPropagation>
                    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="heart-icon">
                      <path d="M32 407.584A279.584 279.584 0 0 1 512 212.64a279.584 279.584 0 0 1 480 194.944 278.144 278.144 0 0 1-113.024 224.512L562.592 892.8a96 96 0 0 1-124.416-1.952L130.016 620.16A278.976 278.976 0 0 1 32 407.584z" class="heart-path"/>
                    </svg>
                  </button>
                </div>
                <p class="card-location">{recTask.location || 'Aalto Campus, Espoo'}</p>
                <h4 class="card-title">{recTask.name}</h4>
              </div>
            {/each}
          {:else}
            <div class="no-recommendations">
              <p>No recommendations available at the moment.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #FFFFFF;
    color: #000000;
  }
  
  /* Header Styles */
  .header {
    background: #FFFFFF;
    border-bottom: 1px solid #EAF2FD;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  
  .header .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 20px;
  }
  
  .nav-left {
    display: flex;
    align-items: center;
    gap: 15px;
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
  
  /* Nav Right Styles */
  .nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  /* Buttons */
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
  
  /* Icon Buttons */
  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .icon-button:hover {
    background: #EAF2FD;
    color: #000;
  }
  
  /* User Menu */
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
  
  .dropdown-item svg {
    flex-shrink: 0;
  }
  
  /* Language Selector */
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
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 20px;
  }
  
  .loading,
  .error {
    text-align: center;
    padding: 4rem 0;
  }
  
  .back-btn {
    background: #ECF86E;
    color: #000000;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    display: inline-block;
    margin-top: 1rem;
  }
  
  /* Task Layout */
  .task-layout {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 2rem;
    margin-bottom: 3rem;
  }
  
  /* Left Column: Image Only */
  .image-column {
    /* Image column stays narrow */
  }
  
  /* Right Column: Info */
  .info-column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  /* Image Gallery */
  .image-gallery {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .main-image {
    width: 100%;
    aspect-ratio: 4 / 3;
    background: #EAF2FD;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    overflow: hidden;
  }
  
  .main-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .thumbnail-gallery {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
  }
  
  .thumbnail {
    aspect-ratio: 1;
    background: #EAF2FD;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s ease, border-color 0.2s ease;
    border: 2px solid transparent;
  }
  
  .thumbnail:hover {
    transform: scale(1.05);
    border-color: #ECF86E;
  }
  
  .thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  /* Post Header */
  .post-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .post-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  
  .post-title {
    font-size: 2rem;
    font-weight: 700;
    color: #000000;
    flex: 1;
    margin: 0;
  }

  .favorite-btn-main {
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid #EAF2FD;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    padding: 0;
  }

  .favorite-btn-main:hover {
    transform: scale(1.1);
    border-color: #ECF86E;
  }

  .favorite-btn-main.active {
    background: rgba(255, 0, 0, 0.1);
    border-color: #FF0000;
  }

  .favorite-btn-main .heart-icon {
    width: 24px;
    height: 24px;
  }

  .favorite-btn-main .heart-path {
    fill: #999;
    transition: fill 0.2s ease;
  }

  .favorite-btn-main.active .heart-path {
    fill: #FF0000;
  }

  .favorite-btn-main:hover .heart-path {
    fill: #FF6B6B;
  }
  
  .post-price {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .price {
    font-size: 1.5rem;
    font-weight: 700;
    color: #000000;
  }
  
  .price-description {
    font-size: 0.9rem;
    color: #666;
  }
  
  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: 1rem;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 1rem 2rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .btn-primary {
    flex: 2;
    background: #EAF2FD;
    color: #000000;
  }
  
  .btn-primary:hover {
    background: #D4E8FD;
  }
  
  .btn-secondary {
    flex: 1;
    background: #ECF86E;
    color: #000000;
  }
  
  .btn-secondary:hover {
    background: #E0F055;
  }
  
  /* Product Description */
  .product-description {
    background: #F8FFCB;
    padding: 1.5rem;
    border-radius: 8px;
  }
  
  .product-description h3 {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #000000;
  }
  
  .product-description p {
    line-height: 1.6;
    color: #666;
  }
  
  /* Address */
  .post-address {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #0066CC;
    font-size: 0.9rem;
    background: none;
    border: none;
    padding: 0.5rem 0;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  
  .post-address:hover {
    color: #0052A3;
    text-decoration-color: #0052A3;
  }
  
  .post-address svg {
    color: #0066CC;
  }
  
  .post-address:hover svg {
    color: #0052A3;
  }
  
  /* Helper Card Inline */
  .helper-card-inline {
    background: #F8FFCB;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  
  .helper-profile {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .helper-avatar {
    width: 50px;
    height: 50px;
    background: #EAF2FD;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    object-fit: cover;
    display: block;
  }
  
  .helper-name {
    font-size: 1rem;
    font-weight: 600;
    color: #000000;
  }
  
  .info-btn {
    background: #ECF86E;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  
  .info-btn:hover {
    background: #E0F055;
  }
  
  /* Similar Recommendations */
  .similar-section {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 2px solid #EAF2FD;
  }
  
  .section-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    color: #000000;
  }
  
  .similar-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  
  .similar-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    cursor: pointer;
  }
  
  .card-image {
    aspect-ratio: 1;
    background: #EAF2FD;
    border-radius: 8px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  
  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  
  .card-image-placeholder {
    position: absolute;
    font-size: 3rem;
    color: #000000;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .favorite-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: all 0.2s ease;
  }
  
  .favorite-btn:hover {
    transform: scale(1.1);
  }
  
  .favorite-btn .heart-icon {
    width: 18px;
    height: 18px;
  }
  
  .favorite-btn .heart-path {
    fill: #999;
    transition: fill 0.2s ease;
  }
  
  .favorite-btn.active .heart-path {
    fill: #FF0000;
  }
  
  .card-location {
    font-size: 0.85rem;
    color: #666;
  }
  
  .card-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #000000;
  }
  
  .no-recommendations {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem 2rem;
    color: #666;
  }
  
  /* Responsive Design */
  @media (max-width: 968px) {
    .task-layout {
      grid-template-columns: 300px 1fr;
    }
    
    .similar-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 768px) {
    .task-layout {
      grid-template-columns: 1fr;
    }
    
    .helper-card-inline {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .info-btn {
      align-self: flex-end;
    }
  }
  
  @media (max-width: 640px) {
    .action-buttons {
      flex-direction: column;
    }
    
    .btn-primary,
    .btn-secondary {
      flex: 1;
    }
    
    .thumbnail-gallery {
      grid-template-columns: repeat(3, 1fr);
    }
    
    .similar-grid {
      grid-template-columns: 1fr;
    }
  }
</style>







