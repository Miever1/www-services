<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  import { browser } from '$app/environment';
  
  let task = null;
  let taskCreator = null;
  let loading = true;
  let error = null;
  let isLoggedIn = false;
  let currentUser = null;
  let showUserMenu = false;
  let showLanguageMenu = false;
  let currentLanguage = 'en';
  
  // Payment form state
  let suggestedPrice = '';
  let selectedPaymentMethod = 'credit_card'; // credit_card, paypal, online_bank
  let processing = false;
  
  $: taskId = $page.params.id;
  
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
    
    try {
      const url = apiUrl(API_CONFIG.endpoints.task(taskId));
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Task not found');
        }
        throw new Error(`Failed to load task: ${response.status}`);
      }
      
      const data = await response.json();
      task = Array.isArray(data) ? data[0] : data;
      
      if (!task || !task.id) {
        throw new Error('Invalid task data received');
      }
      
      // Parse images if it's a string
      if (task.images) {
        if (typeof task.images === 'string') {
          try {
            task.images = JSON.parse(task.images);
          } catch (e) {
            task.images = [];
          }
        }
        if (!Array.isArray(task.images)) {
          task.images = [];
        }
      } else {
        task.images = [];
      }
      
      // Initialize suggested price with task price
      suggestedPrice = task.price ? task.price.toString() : '';
      
      // Load task creator information
      if (task.user_id) {
        await loadTaskCreator(task.user_id);
      }
      
    } catch (err) {
      console.error('Error loading task:', err);
      error = err.message || 'Failed to load task';
    } finally {
      loading = false;
    }
  }
  
  async function loadTaskCreator(userId) {
    try {
      const response = await fetch(apiUrl(API_CONFIG.endpoints.user(userId)), {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        taskCreator = Array.isArray(data) ? data[0] : data;
      }
    } catch (err) {
      console.error('Error loading task creator:', err);
      // Continue without creator info
    }
  }
  
  function handleUserUpdate(event) {
    console.log('Payment page handleUserUpdate called:', event);
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
      console.log('Updated currentUser in payment page:', currentUser);
    } else {
      currentUser = null;
      isLoggedIn = false;
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
  
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  }
  
  function formatPrice(price) {
    if (!price) return '0€';
    return `${price}€`;
  }
  
  async function handleConfirmAndPay() {
    if (!task) return;
    
    // Validate suggested price
    const priceValue = parseFloat(suggestedPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert('Please enter a valid price');
      return;
    }
    
    processing = true;
    
    try {
      // TODO: Implement actual payment processing
      // For now, just simulate payment
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      alert('Payment successful! Your order has been confirmed.');
      // Redirect back to task detail page
      goto(`/task/${taskId}`);
    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment failed. Please try again.');
    } finally {
      processing = false;
    }
  }
  
  function handleCancel() {
    goto(`/task/${taskId}`);
  }
  
  onMount(async () => {
    // Check login status
    if (browser) {
      const userData = localStorage.getItem('user');
      if (userData) {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
      }
      
      const savedLanguage = localStorage.getItem('language');
      if (savedLanguage) {
        currentLanguage = savedLanguage;
      }
      
      window.addEventListener('userUpdated', handleUserUpdate);
      window.addEventListener('storage', (e) => {
        if (e.key === 'user') {
          handleUserUpdate();
        }
      });
    }
    
    await loadTask();
  });
</script>

<svelte:head>
  <title>Price Adjustment & Payment - HandyGO</title>
</svelte:head>

<div class="payment-page">
  <!-- Header -->
  <header class="header">
    <div class="header-container">
      <a href="/" class="nav-left" on:click|preventDefault={() => goto('/')}>
        <img src="/favicon.png" alt="HandyGO" class="logo-icon" />
        <h1 class="logo">HandyGO</h1>
      </a>
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
        {:else}
          <button class="btn-login" on:click={() => goto('/login')}>Sign In</button>
          <button class="btn-register" on:click={() => goto('/register')}>Sign Up</button>
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
        <h2>Error</h2>
        <p>{error}</p>
        <button class="btn-back" on:click={() => goto('/')}>Go Back</button>
      </div>
    {:else if task}
      <div class="payment-content">
        <h1 class="page-title">Price Adjustment & Payment</h1>
        
        <!-- Task Details Card -->
        <div class="task-details-card">
          <div class="task-details-content">
            {#if task.images && task.images.length > 0}
              <div class="task-image">
                <img src={task.images[0]?.data || task.images[0]} alt={task.name} />
              </div>
            {:else}
              <div class="task-image-placeholder">📸</div>
            {/if}
            <div class="task-info">
              <h2 class="task-title">{task.name}</h2>
              <div class="task-meta">
                <span class="task-price">{formatPrice(task.price)}/Task</span>
                <span class="task-date">Task Date: {formatDate(task.time)}</span>
              </div>
              {#if taskCreator}
                <div class="task-helper">
                  <span class="helper-label">Helper:</span>
                  {#if taskCreator.avatar_url}
                    <img src={taskCreator.avatar_url} alt={taskCreator.name || taskCreator.username} class="helper-avatar" />
                  {:else}
                    <img src="https://ui-avatars.com/api/?name={encodeURIComponent(taskCreator.name || taskCreator.username || 'Helper')}&size=32&background=ECF86E&color=000" alt={taskCreator.name || taskCreator.username} class="helper-avatar" />
                  {/if}
                  <span class="helper-name">{taskCreator.name || taskCreator.username || 'Helper'}</span>
                </div>
              {/if}
            </div>
            <div class="task-icon">🏃</div>
          </div>
        </div>
        
        <!-- Price Adjustment -->
        <div class="price-adjustment-section">
          <h3 class="section-title">Price Adjustment</h3>
          <div class="price-input-wrapper">
            <label for="suggested-price" class="price-label">Suggested Price:</label>
            <input 
              id="suggested-price"
              type="number" 
              class="price-input" 
              placeholder="€22"
              bind:value={suggestedPrice}
              min="0"
              step="0.01"
            />
          </div>
          <p class="price-note">Final price should be negotiated with Helper.</p>
        </div>
        
        <!-- Payment Method Selection -->
        <div class="payment-method-section">
          <h3 class="section-title">Select Payment Method</h3>
          <div class="payment-methods">
            <button 
              class="payment-method-card" 
              class:selected={selectedPaymentMethod === 'credit_card'}
              on:click={() => selectedPaymentMethod = 'credit_card'}
            >
              <div class="payment-method-icon">💳</div>
              <span class="payment-method-name">Credit Card</span>
            </button>
            <button 
              class="payment-method-card" 
              class:selected={selectedPaymentMethod === 'paypal'}
              on:click={() => selectedPaymentMethod = 'paypal'}
            >
              <div class="payment-method-icon paypal-icon">
                <svg viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M82.5 8.5h-8.3c-0.3 0-0.6 0.2-0.7 0.5l-5.4 34.3c0 0.2 0.2 0.4 0.4 0.4h6.3c0.3 0 0.6-0.2 0.7-0.5l1.1-7.1c0.1-0.3 0.4-0.5 0.7-0.5h4.9c6.4 0 10.1-3.1 11.2-9.3c0.5-3.2 0-5.5-1.5-7.2C92.7 9.3 88.3 8.5 82.5 8.5zm2.1 13.1c-0.7 4.4-3.8 4.4-6.6 4.4h-2.7l1.8-11.5c0-0.2 0.2-0.4 0.4-0.4h1.5c1.9 0 3.4 0 4.4 0.7c0.7 0.5 1 1.4 1.2 2.8zM49.2 8.5h-6.3c-0.3 0-0.6 0.2-0.7 0.5L36.1 42.2c0 0.2 0.2 0.4 0.4 0.4h5.7c0.3 0 0.6-0.2 0.7-0.5l1.4-8.8c0.1-0.3 0.4-0.5 0.7-0.5h4.4c5.7 0 9-2.9 10.1-8.7c0.6-3.3 0-5.8-1.2-7.4C55.8 9.6 52.7 8.5 49.2 8.5zm2 11.6c-0.5 3.2-2.6 3.2-4.7 3.2h-2.2l1.3-8.3c0-0.2 0.2-0.4 0.4-0.4h1.4c1.5 0 2.8 0 3.6 0.6c0.6 0.4 0.9 1.2 1.2 2.9zM20.7 8.5h6.3c0.3 0 0.6 0.2 0.7 0.5l1.4 9.2l6.4-9.7h6.7c0.3 0 0.6 0.2 0.7 0.5l2.1 13.3h-5.7l-0.3 2h5.4c0.3 0 0.6 0.2 0.7 0.5l1.1 7.1c0.1 0.3-0.1 0.5-0.4 0.5h-5.3c-0.3 0-0.6-0.2-0.7-0.5l-0.2-1.3H19.8l-3.1 19.8c0 0.2-0.2 0.4-0.4 0.4H10.1c-0.3 0-0.6-0.2-0.7-0.5L3.9 9.4c0-0.3 0.2-0.5 0.4-0.5h16.4z" fill="#003087"/>
                  <path d="M16.7 25.3h5.7l-0.9 5.7c0 0.2-0.2 0.4-0.4 0.4h-5.3c-0.3 0-0.6-0.2-0.7-0.5L10 9.4c0-0.3 0.2-0.5 0.4-0.5h16.4c0.3 0 0.6 0.2 0.7 0.5l1.4 9.2" fill="#009CDE"/>
                </svg>
              </div>
              <span class="payment-method-name">PayPal MobilePay</span>
            </button>
            <button 
              class="payment-method-card" 
              class:selected={selectedPaymentMethod === 'online_bank'}
              on:click={() => selectedPaymentMethod = 'online_bank'}
            >
              <div class="payment-method-icon">🏦</div>
              <span class="payment-method-name">Online Bank</span>
            </button>
          </div>
        </div>
        
        <!-- Order Summary -->
        <div class="order-summary-section">
          <h3 class="section-title">Order Summary</h3>
          <div class="order-summary-content">
            <div class="summary-row">
              <span class="summary-label">Price:</span>
              <span class="summary-value">€{suggestedPrice || task.price || '0'}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Date:</span>
              <span class="summary-value">{formatDate(task.time)}</span>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="action-buttons">
          <button class="btn-cancel" on:click={handleCancel} disabled={processing}>
            Cancel
          </button>
          <button class="btn-confirm" on:click={handleConfirmAndPay} disabled={processing}>
            {processing ? 'Processing...' : 'Confirm and Pay'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  .payment-page {
    min-height: 100vh;
    background-color: #F5F5F5;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    max-width: 1400px;
    margin: 0 auto;
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
  
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 20px;
  }
  
  .loading,
  .error {
    text-align: center;
    padding: 4rem 0;
  }
  
  .error h2 {
    margin-bottom: 1rem;
    color: #000;
  }
  
  .btn-back {
    background: #ECF86E;
    color: #000000;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 1rem;
  }
  
  .payment-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #000000;
    margin: 0;
  }
  
  /* Task Details Card */
  .task-details-card {
    background: #ECF86E;
    border-radius: 12px;
    padding: 1.5rem;
    position: relative;
    overflow: hidden;
  }
  
  .task-details-content {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }
  
  .task-image {
    width: 150px;
    height: 150px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: #fff;
  }
  
  .task-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .task-image-placeholder {
    width: 150px;
    height: 150px;
    border-radius: 8px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    flex-shrink: 0;
  }
  
  .task-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .task-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #000;
    margin: 0;
  }
  
  .task-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .task-price {
    font-size: 1.1rem;
    font-weight: 600;
    color: #000;
  }
  
  .task-date {
    font-size: 0.9rem;
    color: #666;
  }
  
  .task-helper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: auto;
  }
  
  .helper-label {
    font-size: 0.9rem;
    color: #666;
  }
  
  .helper-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .helper-name {
    font-weight: 600;
    color: #000;
  }
  
  .task-icon {
    position: absolute;
    top: 1rem;
    right: 1rem;
    font-size: 2rem;
  }
  
  /* Price Adjustment Section */
  .price-adjustment-section {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 2rem;
  }
  
  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #000;
    margin-bottom: 1rem;
  }
  
  .price-input-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .price-label {
    font-weight: 600;
    color: #000;
  }
  
  .price-input {
    flex: 1;
    max-width: 200px;
    padding: 0.75rem 1rem;
    border: 2px solid #E0E0E0;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
  }
  
  .price-input:focus {
    outline: none;
    border-color: #ECF86E;
  }
  
  .price-note {
    font-size: 0.9rem;
    color: #666;
    margin: 0;
  }
  
  /* Payment Method Section */
  .payment-method-section {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 2rem;
  }
  
  .payment-methods {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }
  
  .payment-method-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    border: 2px solid #E0E0E0;
    border-radius: 8px;
    background: #FFFFFF;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .payment-method-card:hover {
    border-color: #ECF86E;
    background: #F8FFCB;
  }
  
  .payment-method-card.selected {
    border-color: #ECF86E;
    background: #ECF86E;
  }
  
  .payment-method-icon {
    font-size: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .payment-method-icon.paypal-icon {
    font-size: 0;
    width: 80px;
    height: 26px;
  }
  
  .payment-method-icon.paypal-icon svg {
    width: 100%;
    height: 100%;
  }
  
  .payment-method-name {
    font-weight: 600;
    color: #000;
    text-align: center;
  }
  
  /* Order Summary Section */
  .order-summary-section {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 2rem;
  }
  
  .order-summary-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .summary-label {
    font-weight: 600;
    color: #666;
  }
  
  .summary-value {
    font-weight: 700;
    color: #000;
    font-size: 1.1rem;
  }
  
  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }
  
  .btn-cancel,
  .btn-confirm {
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }
  
  .btn-cancel {
    background: #E0E0E0;
    color: #666;
  }
  
  .btn-cancel:hover:not(:disabled) {
    background: #D0D0D0;
  }
  
  .btn-confirm {
    background: #ECF86E;
    color: #000;
  }
  
  .btn-confirm:hover:not(:disabled) {
    background: #E0F055;
  }
  
  .btn-cancel:disabled,
  .btn-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .task-details-content {
      flex-direction: column;
    }
    
    .task-image,
    .task-image-placeholder {
      width: 100%;
      height: 200px;
    }
    
    .task-icon {
      position: static;
      align-self: flex-end;
    }
    
    .payment-methods {
      grid-template-columns: 1fr;
    }
    
    .action-buttons {
      flex-direction: column-reverse;
    }
    
    .btn-cancel,
    .btn-confirm {
      width: 100%;
    }
  }
</style>

