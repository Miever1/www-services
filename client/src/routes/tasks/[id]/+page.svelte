<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  
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
  let selectedImageIndex = 0; // Track which image is currently displayed as main image
  
  $: taskId = $page.params.id;
  $: currentMainImage = task && task.images && task.images.length > 0 ? task.images[selectedImageIndex] : null;
  
  // Watch for taskId changes and reload task
  $: if (taskId) {
    loadTask().then(() => {
      loadRecommendations();
    });
  }
  
  onMount(async () => {
    // Check login status
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
    loading = true;
    error = null;
    try {
      const response = await fetch(apiUrl(API_CONFIG.endpoints.task(taskId)), {
        credentials: 'include' // Include cookies for session
      });
      if (!response.ok) {
        throw new Error('Task not found');
      }
      const data = await response.json();
      // API returns array, extract first item
      task = Array.isArray(data) ? data[0] : data;
      
      // Parse images if it's a string
      if (task.images) {
        try {
          task.images = typeof task.images === 'string' ? JSON.parse(task.images) : task.images;
          if (!Array.isArray(task.images)) {
            task.images = [];
          }
        } catch (e) {
          console.error('Error parsing images:', e);
          task.images = [];
        }
      } else {
        task.images = [];
      }
      
      // Reset selected image index
      selectedImageIndex = 0;
      
      console.log('Loaded task:', task);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  function toggleFavorite(taskId) {
    if (favorites.has(taskId)) {
      favorites.delete(taskId);
    } else {
      favorites.add(taskId);
    }
    favorites = new Set([...favorites]);
    
    // Save favorites to localStorage
    localStorage.setItem('favoriteTasks', JSON.stringify([...favorites]));
  }
  
  function isFavorite(taskId) {
    return favorites.has(taskId);
  }
  
  function handleSendMessage() {
    alert('Message feature coming soon!');
  }
  
  function handlePayAndBuy() {
    alert('Payment feature coming soon!');
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
      
      // Filter out current task
      const otherTasks = allTasks.filter(t => t.id !== task.id);
      
      // Try to find similar tasks based on category
      if (task.category) {
        similarTasks = otherTasks.filter(t => t.category === task.category).slice(0, 6);
      }
      
      // If we don't have enough similar tasks, get user's favorite tasks
      if (similarTasks.length < 6) {
        const savedFavorites = localStorage.getItem('favoriteTasks');
        if (savedFavorites) {
          const favoriteIds = JSON.parse(savedFavorites);
          const favoriteTasks = otherTasks.filter(t => favoriteIds.includes(t.id));
          similarTasks = [...similarTasks, ...favoriteTasks].slice(0, 6);
        }
      }
      
      // If still not enough, get recently viewed tasks
      if (similarTasks.length < 6) {
        const viewedTasks = localStorage.getItem('viewedTasks');
        if (viewedTasks) {
          const viewedIds = JSON.parse(viewedTasks);
          const viewedTasksList = otherTasks.filter(t => viewedIds.includes(t.id));
          similarTasks = [...similarTasks, ...viewedTasksList].slice(0, 6);
        }
      }
      
      // If still not enough, just get the latest tasks
      if (similarTasks.length < 6) {
        const latestTasks = otherTasks
          .sort((a, b) => new Date(b.time) - new Date(a.time))
          .slice(0, 6 - similarTasks.length);
        similarTasks = [...similarTasks, ...latestTasks];
      }
      
      recommendedTasks = similarTasks.slice(0, 6);
      
      // Mark current task as viewed
      const viewedTasks = JSON.parse(localStorage.getItem('viewedTasks') || '[]');
      if (!viewedTasks.includes(task.id)) {
        viewedTasks.unshift(task.id);
        localStorage.setItem('viewedTasks', JSON.stringify(viewedTasks.slice(0, 50))); // Keep last 50
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      recommendedTasks = [];
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
              <img src="https://ui-avatars.com/api/?name={currentUser?.name || 'User'}&background=ECF86E&color=000" alt="User Avatar" class="user-avatar" />
              <span class="user-name">{currentUser?.name || 'User'}</span>
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
            {#if task.images && task.images.length > 0}
              <div class="main-image">
                <img src={currentMainImage} alt={task.name} />
              </div>
              {#if task.images.length > 1}
                <div class="thumbnail-gallery">
                  {#each task.images.slice(0, 5) as image, index}
                    <div 
                      class="thumbnail" 
                      class:active={index === selectedImageIndex}
                      on:click={() => selectedImageIndex = index}
                      role="button"
                      tabindex="0"
                    >
                      <img src={image} alt="Thumbnail {index + 1}" />
                    </div>
                  {/each}
                </div>
              {/if}
            {:else}
              <div class="main-image">📸✨</div>
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
            <h1 class="post-title">{task.name || 'Title'}</h1>
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
          <div class="helper-card-inline">
            <div class="helper-profile">
              <div class="helper-avatar">👤</div>
              <div class="helper-name">Helper Name</div>
            </div>
            <button class="info-btn">
              More Information
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 6h10M6 1l5 5-5 5" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>
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
    cursor: pointer;
    overflow: hidden;
    border: 2px solid transparent;
    transition: all 0.2s ease;
  }
  
  .thumbnail:hover {
    border-color: #ECF86E;
  }
  
  .thumbnail.active {
    border-color: #000;
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
  
  .post-title {
    font-size: 2rem;
    font-weight: 700;
    color: #000000;
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
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
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
  }
  
  .card-image::after {
    content: '×';
    position: absolute;
    font-size: 3rem;
    color: #000000;
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
