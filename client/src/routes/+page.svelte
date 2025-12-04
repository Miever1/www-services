<script>
  import { goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  import { browser } from '$app/environment';
  
  let isLoggedIn = false;
  let currentUser = null;
  let showUserMenu = false;
  let showLanguageMenu = false;
  let currentLanguage = 'en';
  let avatarUpdateKey = 0; // Force avatar refresh
  
  async function checkLoginStatus() {
    if (!browser) return;
    
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
          isLoggedIn = false;
          currentUser = null;
          localStorage.removeItem('user');
        }
      }
    } catch (err) {
      console.error('Failed to check login status:', err);
      // Fallback to localStorage if API fails
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          currentUser = JSON.parse(userData);
          isLoggedIn = true;
        } catch (e) {
          isLoggedIn = false;
        }
      }
    }
  }
  
  async function handleUserUpdate(event) {
    console.log('handleUserUpdate called:', event);
    // Try to get user from event detail first, then localStorage
    let updatedUser = null;
    if (event && event.detail && event.detail.user) {
      updatedUser = event.detail.user;
      console.log('Got user from event detail:', updatedUser);
      console.log('Avatar URL in event:', updatedUser.avatar_url);
    } else {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          updatedUser = JSON.parse(userData);
          console.log('Got user from localStorage:', updatedUser);
          console.log('Avatar URL in localStorage:', updatedUser.avatar_url);
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    }
    
    if (updatedUser) {
      // Force reactivity by creating a completely new object with all fields
      const newUser = {
        id: updatedUser.id,
        username: updatedUser.username || '',
        email: updatedUser.email || '',
        name: updatedUser.name || null,
        avatar_url: updatedUser.avatar_url !== undefined && updatedUser.avatar_url !== null ? updatedUser.avatar_url : null, // Preserve empty strings but handle undefined/null
        bio: updatedUser.bio || null,
        address: updatedUser.address || null,
        phone: updatedUser.phone || null
      };
      // Use JSON parse/stringify to force deep reactivity
      currentUser = null; // First set to null to trigger change
      await tick(); // Wait for DOM update
      currentUser = JSON.parse(JSON.stringify(newUser));
      isLoggedIn = true;
      // Force reactivity by reassigning
      currentUser = { ...currentUser };
      avatarUpdateKey = Date.now(); // Force avatar refresh
      await tick(); // Wait for DOM update after setting new value
      // Force another update after tick
      avatarUpdateKey = Date.now() + 1;
      await tick();
      console.log('Updated currentUser:', currentUser);
      console.log('Avatar update key:', avatarUpdateKey);
      console.log('Current user avatar_url:', currentUser.avatar_url);
      console.log('Current user avatar_url type:', typeof currentUser.avatar_url);
      console.log('Current user avatar_url length:', currentUser.avatar_url ? currentUser.avatar_url.length : 'null');
      console.log('Will avatar show?', currentUser?.avatar_url && currentUser.avatar_url.trim() !== '' ? 'YES' : 'NO');
      console.log('Avatar URL preview:', currentUser?.avatar_url ? currentUser.avatar_url.substring(0, 100) + '...' : 'null');
    } else {
      currentUser = null;
      isLoggedIn = false;
    }
  }
  
  onMount(() => {
    // 从localStorage获取语言设置
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      currentLanguage = savedLanguage;
    }
    
    // 检查登录状态
    checkLoginStatus();
    
    // Listen for user updates from other tabs/pages
    if (browser) {
      window.addEventListener('storage', (e) => {
        if (e.key === 'user') {
          handleUserUpdate();
        }
      });
      
      // Also listen for custom events within the same tab
      window.addEventListener('userUpdated', handleUserUpdate);
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
</script>

<svelte:head>
  <title>HandyGO - Campus Task Sharing Platform</title>
  <meta name="description" content="Aalto University's campus-based task-sharing platform for students" />
</svelte:head>

<main class="homepage">
  <!-- Navigation Header -->
  <header class="header">
    <div class="container">
      <div class="nav-left">
        <img src="/favicon.png" alt="HandyGO" class="logo-icon" />
        <h1 class="logo">HandyGO</h1>
      </div>
      <nav class="nav-right">
        {#if isLoggedIn}
          <!-- User Menu -->
          <div class="user-menu-wrapper">
            <div class="user-info" on:click={toggleUserMenu}>
              {#if currentUser?.avatar_url}
                {@const hasCustomAvatar = currentUser.avatar_url && currentUser.avatar_url.trim() !== ''}
                {#if hasCustomAvatar}
                  <img 
                    src={currentUser.avatar_url}
                    alt="User Avatar" 
                    class="user-avatar"
                    key={currentUser.id + '_avatar_' + avatarUpdateKey}
                    on:load={() => console.log('Avatar image loaded successfully:', currentUser.avatar_url?.substring(0, 50))}
                    on:error={(e) => {
                      console.error('Failed to load avatar image:', currentUser.avatar_url?.substring(0, 50));
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || currentUser?.username || 'User')}&background=ECF86E&color=000`;
                    }}
                  />
                {:else}
                  <img 
                    src="https://ui-avatars.com/api/?name={encodeURIComponent(currentUser?.name || currentUser?.username || 'User')}&background=ECF86E&color=000" 
                    alt="User Avatar" 
                    class="user-avatar"
                    key={currentUser?.id || 'default'}
                  />
                {/if}
              {:else}
                <img 
                  src="https://ui-avatars.com/api/?name={encodeURIComponent(currentUser?.name || currentUser?.username || 'User')}&background=ECF86E&color=000" 
                  alt="User Avatar" 
                  class="user-avatar"
                  key={currentUser?.id || 'default'}
                />
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

  <!-- Hero Section -->
  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <h2 class="hero-title">Help that's just around campus</h2>
        <p class="hero-subtitle">Find trusted students to help — anytime, anywhere.</p>
        <h3 class="hero-tagline">Quick help anytime.</h3>
        
        <!-- Action Buttons -->
        <div class="action-buttons">
          <button class="action-btn" on:click={() => goto('/search')}>Search for help</button>
          <button class="action-btn" on:click={() => {
            if (!isLoggedIn) {
              goto('/login?redirect=/post');
            } else {
              goto('/post');
            }
          }}>Post a task</button>
        </div>
      </div>
    </div>
  </section>

  <!-- Main Content Area -->
  <section class="main-content">
    <div class="container">
      <!-- Features Section -->
      <div class="features-section">
        <h3 class="section-title">Your skills, your stuff, your student income.</h3>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">🔧</div>
            <h4>Run errands</h4>
            <p>Help fellow students with everyday tasks and errands on campus. Quick and reliable service.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🏃</div>
            <h4>Run errands</h4>
            <p>Fast delivery and pickup services. Get help when you need it, anytime on campus.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🤝</div>
            <h4>Item Sharing</h4>
            <p>Share and borrow items from other students. Save money and build community connections.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">♻️</div>
            <h4>Resell idle items</h4>
            <p>Turn your unused items into income. Quick and easy resale platform for students.</p>
          </div>
        </div>
      </div>
      
      <!-- Our Advantage Section -->
      <div class="advantage-section">
        <div class="advantage-hero">
          <!-- Left content area - empty for now -->
        </div>
        <div class="advantage-list">
          <div class="advantage-card">
            <div class="advantage-card-header">
              <span class="advantage-letter">A</span>
              <div class="advantage-icon">✓</div>
            </div>
            <h4 class="advantage-card-title">Verified Community</h4>
            <p class="advantage-card-description">Verified student community ensuring safety and trust.</p>
          </div>
          <div class="advantage-card">
            <div class="advantage-card-header">
              <span class="advantage-letter">B</span>
              <div class="advantage-icon">⚡</div>
            </div>
            <h4 class="advantage-card-title">Quick Response</h4>
            <p class="advantage-card-description">Quick response time with campus-wide coverage.</p>
          </div>
          <div class="advantage-card">
            <div class="advantage-card-header">
              <span class="advantage-letter">C</span>
              <div class="advantage-icon">💰</div>
            </div>
            <h4 class="advantage-card-title">Affordable Prices</h4>
            <p class="advantage-card-description">Affordable prices designed for student budgets.</p>
          </div>
          <div class="advantage-card">
            <div class="advantage-card-header">
              <span class="advantage-letter">D</span>
              <div class="advantage-icon">🔒</div>
            </div>
            <h4 class="advantage-card-title">Secure Payment</h4>
            <p class="advantage-card-description">Secure payment system with full transaction protection.</p>
          </div>
          {#if !isLoggedIn}
            <a href="/register" class="advantage-btn">Register as a helper</a>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <!-- How It Works Section -->
  <section class="how-it-works">
    <div class="container">
      <h3 class="section-title">How It Works</h3>
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <h4>Post Your Need</h4>
          <p>Describe what help you need and set your location</p>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <h4>Find Helpers</h4>
          <p>Browse available helpers or wait for offers</p>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <h4>Connect & Complete</h4>
          <p>Chat with your helper and complete the task</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-brand">
          <h4>HandyGO</h4>
          <p>Campus Task Sharing for Aalto Students</p>
        </div>
        <div class="footer-links">
          <a href="/help">Help & FAQ</a>
          <a href="/rules">Platform Rules</a>
          <a href="/contact">Contact</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2025 HandyGO - CS-E4400 Design of WWW Services</p>
      </div>
    </div>
  </footer>
</main>

<style>
  /* Global Styles */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #000000;
    background-color: #FFFFFF;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
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
  }
  
  .logo-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
  
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .nav-divider {
    color: #666;
    font-size: 1.2rem;
    font-weight: 300;
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
  
  .tagline {
    font-size: 0.9rem;
    color: #666;
    font-weight: 400;
  }
  
  .nav-menu {
    display: flex;
    gap: 2rem;
  }
  
  .nav-link {
    text-decoration: none;
    color: #000000;
    font-weight: 500;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    transition: all 0.2s ease;
  }
  
  .nav-link:hover,
  .nav-link.active {
    background-color: #ECF86E;
    color: #000000;
  }
  
  /* Hero Section */
  .hero {
    background: linear-gradient(135deg, #F8FFCB 0%, #EAF2FD 100%);
    padding: 4rem 0;
    text-align: center;
  }
  
  .hero-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: #000000;
  }
  
  .hero-subtitle {
    font-size: 1.2rem;
    color: #666;
    margin-bottom: 0.5rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .hero-tagline {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 2rem;
    color: #000000;
  }
  
  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
  }
  
  .action-btn {
    background: #ECF86E;
    border: 2px solid #ECF86E;
    padding: 1rem 2rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s ease;
    color: #000000;
  }
  
  .action-btn:hover {
    background: #E0F055;
    border-color: #E0F055;
    transform: translateY(-2px);
  }
  
  .search-box {
    display: flex;
    background: #FFFFFF;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  
  .search-input {
    flex: 1;
    padding: 1rem 1.5rem;
    border: none;
    font-size: 1rem;
    outline: none;
  }
  
  .search-button {
    background: #ECF86E;
    border: none;
    padding: 1rem 1.5rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .search-button:hover {
    background: #E0F055;
  }
  
  .quick-tags {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .tag {
    background: #FFFFFF;
    border: 2px solid #EAF2FD;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }
  
  .tag:hover {
    border-color: #ECF86E;
    background: #F8FFCB;
  }
  
  /* Main Content Section */
  .main-content {
    padding: 4rem 0;
    background: #FFFFFF;
  }
  
  .features-section {
    margin-bottom: 4rem;
  }
  
  .section-title {
    font-size: 2.5rem;
    font-weight: 700;
    text-align: center;
    margin-bottom: 3rem;
    color: #000000;
  }
  
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
  }
  
  .feature-card {
    text-align: center;
    padding: 2rem;
    background: #F8FFCB;
    border-radius: 12px;
    transition: transform 0.2s ease;
  }
  
  .feature-card:hover {
    transform: translateY(-5px);
  }
  
  .feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .feature-card h4 {
    font-size: 1.3rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #000000;
  }
  
  .feature-card p {
    color: #666;
  }
  
  /* Recent Tasks Section */
  .recent-tasks {
    padding: 4rem 0;
    background: #EAF2FD;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  
  .view-all {
    color: #000000;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s ease;
  }
  
  .view-all:hover {
    color: #ECF86E;
  }
  
  .tasks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }
  
  .task-card {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  .task-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  
  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  
  .task-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: #000000;
    margin: 0;
  }
  
  .task-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
  }
  
  .task-status.active {
    background: #ECF86E;
    color: #000000;
  }
  
  .task-status.completed {
    background: #EAF2FD;
    color: #666;
  }
  
  .task-description {
    color: #666;
    margin-bottom: 1rem;
    line-height: 1.5;
  }
  
  .task-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .task-time {
    font-size: 0.9rem;
    color: #999;
  }
  
  .view-task-btn {
    background: #ECF86E;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .view-task-btn:hover {
    background: #E0F055;
  }
  
  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }
  
  .no-tasks {
    text-align: center;
    padding: 3rem;
  }
  
  .no-tasks p {
    font-size: 1.1rem;
    color: #666;
    margin-bottom: 1rem;
  }
  
  .post-first-btn {
    background: #ECF86E;
    color: #000000;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    transition: background-color 0.2s ease;
  }
  
  .post-first-btn:hover {
    background: #E0F055;
  }
  
  /* How It Works Section */
  .how-it-works {
    padding: 4rem 0;
    background: #FFFFFF;
  }
  
  .steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    text-align: center;
  }
  
  .step {
    padding: 2rem;
  }
  
  .step-number {
    width: 60px;
    height: 60px;
    background: #ECF86E;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 auto 1rem;
    color: #000000;
  }
  
  .step h4 {
    font-size: 1.3rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #000000;
  }
  
  .step p {
    color: #666;
  }
  
  /* Footer */
  .footer {
    background: #000000;
    color: #FFFFFF;
    padding: 2rem 0 1rem;
  }
  
  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .footer-brand h4 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  .footer-brand p {
    color: #999;
  }
  
  .footer-links {
    display: flex;
    gap: 2rem;
  }
  
  .footer-links a {
    color: #FFFFFF;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  
  .footer-links a:hover {
    color: #ECF86E;
  }
  
  .footer-bottom {
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid #333;
    color: #999;
  }
  
  /* Advantage Section */
  .advantage-section {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 4rem;
    margin-top: 4rem;
    align-items: stretch;
  }
  
  .advantage-hero {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
    min-height: 100%;
    background: linear-gradient(135deg, #EAF2FD 0%, #F8FFCB 100%);
    padding: 3rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .advantage-list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .advantage-card {
    background: #FFFFFF;
    border: 2px solid #EAF2FD;
    border-radius: 16px;
    padding: 1.25rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: default;
    position: relative;
    overflow: hidden;
  }
  
  .advantage-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: #ECF86E;
    transform: scaleY(0);
    transform-origin: bottom;
    transition: transform 0.3s ease;
  }
  
  .advantage-card:hover {
    border-color: #ECF86E;
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  }
  
  .advantage-card:hover::before {
    transform: scaleY(1);
  }
  
  .advantage-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  
  .advantage-letter {
    font-size: 2rem;
    font-weight: 800;
    color: #ECF86E;
    line-height: 1;
    font-family: 'Inter', sans-serif;
  }
  
  .advantage-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    background: #F8FFCB;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }
  
  .advantage-card:hover .advantage-icon {
    background: #ECF86E;
    transform: rotate(5deg) scale(1.1);
  }
  
  .advantage-card-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #000000;
    margin-bottom: 0.5rem;
    margin-top: 0;
  }
  
  .advantage-card-description {
    color: #666;
    line-height: 1.6;
    margin: 0;
    font-size: 0.95rem;
  }
  
  .advantage-btn {
    background: #ECF86E;
    color: #000000;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 1.5rem;
    box-shadow: 0 4px 12px rgba(236, 248, 110, 0.3);
    width: 100%;
    text-align: center;
  }
  
  .advantage-btn:hover {
    background: #E0F055;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(236, 248, 110, 0.4);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .header .container {
      flex-direction: column;
      gap: 1rem;
    }
    
    .nav-left {
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .nav-menu {
      gap: 1rem;
    }
    
    .hero-title {
      font-size: 2rem;
    }
    
    .hero-subtitle {
      font-size: 1rem;
    }
    
    .quick-tags {
      gap: 0.5rem;
    }
    
    .tag {
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
    }
    
    .section-title {
      font-size: 2rem;
    }
    
    .footer-content {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
    
    .footer-links {
      gap: 1rem;
    }
    
    .advantage-section {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    
    .advantage-hero {
      min-height: 300px;
      padding: 2rem;
    }
    
    .advantage-hero-title {
      font-size: 2rem;
    }
    
    .advantage-hero-subtitle {
      font-size: 1rem;
    }
    
    .advantage-stats {
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .stat-number {
      font-size: 1.5rem;
    }
    
    .stat-label {
      font-size: 0.75rem;
    }
    
    .feature-item {
      padding: 0.5rem;
    }
    
    .feature-item svg {
      width: 20px;
      height: 20px;
    }
    
    .feature-item span {
      font-size: 0.85rem;
    }
    
    .advantage-card {
      padding: 1.25rem;
    }
    
    .advantage-letter {
      font-size: 1.5rem;
    }
  }
</style>