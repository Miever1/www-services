<script>
  import { goto } from '$app/navigation';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  import { saveUserToStorage } from '$lib/user-storage.js';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let emailOrUsername = '';
  let password = '';
  let showPassword = false;
  let error = '';
  let loading = false;
  let showLanguageMenu = false;
  let currentLanguage = 'en';
  
  const languages = {
    en: 'English',
    sv: 'Svenska',
    fi: 'Suomi'
  };
  
  function toggleLanguageMenu() {
    showLanguageMenu = !showLanguageMenu;
  }
  
  function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    showLanguageMenu = false;
  }
  
  onMount(() => {
    if (browser) {
      const savedLanguage = localStorage.getItem('language');
      if (savedLanguage && languages[savedLanguage]) {
        currentLanguage = savedLanguage;
      }
    }
  });

  async function handleLogin() {
    error = '';
    loading = true;

    if (!emailOrUsername || !password) {
      error = 'Please fill in all fields';
      loading = false;
      return;
    }

    try {
      const response = await fetch(apiUrl(API_CONFIG.endpoints.auth.login), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: emailOrUsername.includes('@') ? emailOrUsername : undefined,
          username: emailOrUsername.includes('@') ? undefined : emailOrUsername,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Store user info if returned
        if (data.user) {
          if (browser) {
            // Use safe storage function to prevent QuotaExceededError
            saveUserToStorage(data.user);
          }
        }
        goto('/');
      } else {
        error = data.error || data.message || 'Login failed. Please check your credentials.';
      }
    } catch (err) {
      console.error('Login error:', err);
      error = 'Failed to connect to server. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Log in - HandyGO</title>
</svelte:head>

<div class="auth-container">
  <!-- Top Header -->
  <header class="header">
    <div class="container">
      <div class="nav-left" on:click={() => goto('/')} role="button" tabindex="0">
        <img src="/favicon.png" alt="HandyGO" class="logo-icon" />
        <h1 class="logo">HandyGO</h1>
      </div>
      <nav class="nav-right">
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

  <div class="content-wrapper">
    <!-- Left Card - Marketing -->
    <div class="marketing-card">
      <h1 class="marketing-title">Connect & Get It Done</h1>
      <p class="marketing-description">
        Connect with verified fellow students for quick, reliable help with campus tasks.
      </p>
      <div class="marketing-illustration">
        <img src="/login-illustration.png" alt="HandyGO Illustration" class="illustration-image" />
      </div>
    </div>

    <!-- Right Card - Login Form -->
    <div class="form-card">
      <h2 class="form-title">Welcome Back</h2>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <form on:submit|preventDefault={handleLogin} class="auth-form">
        <div class="form-group">
          <label for="email-username">Username or Aalto Email</label>
          <input
            id="email-username"
            type="text"
            bind:value={emailOrUsername}
            placeholder="Enter username or email"
            required
            disabled={loading}
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              bind:value={password}
              placeholder="Enter password"
              required
              disabled={loading}
            />
            <button
              type="button"
              class="eye-button"
              on:click={() => showPassword = !showPassword}
              tabindex="-1"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                {#if showPassword}
                  <path d="M10 3C5.5 3 1.73 6.11 0 10.5C1.73 14.89 5.5 18 10 18C14.5 18 18.27 14.89 20 10.5C18.27 6.11 14.5 3 10 3ZM10 15C7.24 15 5 12.76 5 10C5 7.24 7.24 5 10 5C12.76 5 15 7.24 15 10C15 12.76 12.76 15 10 15ZM10 7C8.34 7 7 8.34 7 10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10C13 8.34 11.66 7 10 7Z" fill="currentColor"/>
                {:else}
                  <path d="M10 3C5.5 3 1.73 6.11 0 10.5C1.73 14.89 5.5 18 10 18C14.5 18 18.27 14.89 20 10.5C18.27 6.11 14.5 3 10 3ZM10 15C7.24 15 5 12.76 5 10C5 7.24 7.24 5 10 5C12.76 5 15 7.24 15 10C15 12.76 12.76 15 10 15Z" fill="currentColor"/>
                  <line x1="0" y1="0" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
                {/if}
              </svg>
            </button>
          </div>
        </div>

        <a href="/forgot-password" class="forgot-password">Forget password?</a>

        <button type="submit" class="submit-button" disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <div class="form-footer">
        <span>Haven't registered yet?</span>
        <a href="/register" class="link">Create an account</a>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="auth-footer">
    <a href="/about">About</a>
    <a href="/services">Services</a>
    <a href="/faq">FAQ</a>
    <a href="/terms">Terms</a>
    <a href="/privacy">Privacy</a>
  </footer>
</div>

<style>
  .auth-container {
    height: 100vh;
    max-height: 100vh;
    background-color: #E5E5E5;
    display: flex;
    flex-direction: column;
    position: relative;
    padding: 0;
    overflow: hidden;
  }

  /* Top Header */
  .header {
    background: #FFFFFF;
    border-bottom: 1px solid #EAF2FD;
    position: relative;
    flex-shrink: 0;
  }

  .header .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 20px;
    max-width: 1200px;
    margin: 0 auto;
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

  .nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
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
  
  .dropdown-arrow {
    transition: transform 0.2s ease;
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

  .content-wrapper {
    flex: 1;
    display: grid;
    grid-template-columns: 1.2fr 0.85fr;
    gap: 10px;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
    padding: 16px 200px 16px 100px;
    overflow: hidden;
    min-height: 0;
  }

  .form-card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    overflow-y: auto;
    min-height: 0;
    max-width: 420px;
    align-self: start;
  }

  .marketing-card {
    display: flex;
    flex-direction: column;
    position: relative;
    background: transparent;
    border-radius: 0;
    padding: 60px 20px 0 60px;
    box-shadow: none;
    overflow-y: auto;
    min-height: 0;
  }

  .marketing-title {
    font-size: 2.25rem;
    font-weight: 700;
    color: #000;
    margin-bottom: 12px;
    line-height: 1.2;
  }

  .marketing-description {
    font-size: 0.95rem;
    color: #666;
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .marketing-illustration {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin-top: auto;
  }

  .illustration-image {
    width: 100%;
    max-width: 100%;
    height: auto;
    object-fit: contain;
    border-radius: 12px;
  }

  .form-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #000;
    margin-bottom: 20px;
  }

  .error-message {
    background: #fee;
    color: #c00;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 0.9rem;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-weight: 600;
    color: #000;
    font-size: 0.9rem;
  }

  .form-group input {
    width: 100%;
    padding: 12px 0;
    border: none;
    border-bottom: 2px solid #ddd;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .form-group input:focus {
    border-bottom-color: #ECF86E;
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .password-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-input-wrapper input {
    flex: 1;
    padding-right: 40px;
  }

  .eye-button {
    position: absolute;
    right: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .eye-button:hover {
    color: #000;
  }

  .forgot-password {
    color: #0066cc;
    text-decoration: none;
    font-size: 0.9rem;
    align-self: flex-start;
    margin-top: -8px;
  }

  .forgot-password:hover {
    text-decoration: underline;
  }

  .submit-button {
    background: #ECF86E;
    border: none;
    border-radius: 8px;
    padding: 14px 28px;
    font-size: 1rem;
    font-weight: 600;
    color: #000;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 8px;
  }

  .submit-button:hover:not(:disabled) {
    background: #E0F055;
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .form-footer {
    margin-top: 24px;
    text-align: center;
    color: #666;
    font-size: 0.9rem;
  }

  .form-footer .link {
    color: #0066cc;
    text-decoration: none;
    margin-left: 4px;
    font-weight: 600;
  }

  .form-footer .link:hover {
    text-decoration: underline;
  }

  .auth-footer {
    background: #2A2A2A;
    padding: 20px;
    display: flex;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
    margin-top: 40px;
  }

  .auth-footer a {
    color: #B0B0B0;
    text-decoration: none;
    font-size: 0.9rem;
  }

  .auth-footer a:hover {
    color: #ECF86E;
  }

  @media (max-width: 1024px) {
    .content-wrapper {
      grid-template-columns: 1fr;
      gap: 30px;
    }

    .form-card {
      max-width: 100%;
      margin: 0;
    }

    .marketing-card {
      display: none;
    }
  }
</style>

