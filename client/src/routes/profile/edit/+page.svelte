<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  import { browser } from '$app/environment';
  
  let currentUser = null;
  let loading = true;
  let isLoggedIn = false;
  let editForm = {
    name: '',
    username: '',
    avatar_url: '',
    bio: '',
    address: '',
    phone: ''
  };
  let avatarPreview = '';
  let saving = false;
  let showUserMenu = false;
  let showLanguageMenu = false;
  let currentLanguage = 'en';
  
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
          
          // Initialize form with current user data
          editForm = {
            name: currentUser.name || '',
            username: currentUser.username || '',
            avatar_url: currentUser.avatar_url || '',
            bio: currentUser.bio || '',
            address: currentUser.address || '',
            phone: currentUser.phone || ''
          };
          
          // Set avatar preview
          if (editForm.avatar_url) {
            avatarPreview = editForm.avatar_url;
          } else if (editForm.name || editForm.username) {
            avatarPreview = `https://ui-avatars.com/api/?name=${encodeURIComponent(editForm.name || editForm.username)}&size=120&background=ECF86E&color=000`;
          }
          
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          goto('/login?redirect=/profile/edit');
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      const userData = localStorage.getItem('user');
      if (userData) {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
        
        // Initialize form with current user data
        editForm = {
          name: currentUser.name || '',
          username: currentUser.username || '',
          avatar_url: currentUser.avatar_url || '',
          bio: currentUser.bio || '',
          address: currentUser.address || '',
          phone: currentUser.phone || ''
        };
        
        // Set avatar preview
        if (editForm.avatar_url) {
          avatarPreview = editForm.avatar_url;
        } else if (editForm.name || editForm.username) {
          avatarPreview = `https://ui-avatars.com/api/?name=${encodeURIComponent(editForm.name || editForm.username)}&size=120&background=ECF86E&color=000`;
        }
      } else {
        goto('/login?redirect=/profile/edit');
      }
    } finally {
      loading = false;
    }
  }
  
  function handleAvatarUrlChange() {
    // Update preview when avatar URL changes
    if (editForm.avatar_url) {
      avatarPreview = editForm.avatar_url;
    } else if (editForm.name || editForm.username) {
      avatarPreview = `https://ui-avatars.com/api/?name=${encodeURIComponent(editForm.name || editForm.username)}&size=120&background=ECF86E&color=000`;
    }
  }
  
  function handleNameChange() {
    // Update avatar preview when name changes (if no custom avatar)
    if (!editForm.avatar_url && (editForm.name || editForm.username)) {
      avatarPreview = `https://ui-avatars.com/api/?name=${encodeURIComponent(editForm.name || editForm.username)}&size=120&background=ECF86E&color=000`;
    }
  }
  
  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Convert to base64
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        editForm.avatar_url = e.target.result;
        avatarPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read image file');
    }
  }
  
  async function saveProfile() {
    if (!currentUser) return;
    
    saving = true;
    try {
      const response = await fetch(apiUrl(API_CONFIG.endpoints.auth.updateProfile), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
      
      const result = await response.json();
      
      // Ensure result.user contains all fields
      if (!result.user) {
        throw new Error('Invalid response from server');
      }
      
      // Ensure result.user contains all fields
      console.log('Server response:', result);
      console.log('Result user:', result.user);
      console.log('Result user avatar_url:', result.user.avatar_url);
      console.log('Result user avatar_url type:', typeof result.user.avatar_url);
      console.log('Result user avatar_url length:', result.user.avatar_url ? result.user.avatar_url.length : 'null/undefined');
      
      // Update current user with new data - create new object to force reactivity
      const updatedUser = {
        id: result.user.id || currentUser?.id,
        username: result.user.username || currentUser?.username || '',
        email: result.user.email || currentUser?.email || '',
        name: result.user.name || null,
        avatar_url: result.user.avatar_url !== undefined ? result.user.avatar_url : null, // Preserve empty strings, only use null if undefined
        bio: result.user.bio || null,
        address: result.user.address || null,
        phone: result.user.phone || null
      };
      
      console.log('Updated user object:', updatedUser);
      console.log('Updated user avatar_url:', updatedUser.avatar_url);
      console.log('Updated user avatar_url exists?', !!updatedUser.avatar_url);
      
      // Update currentUser to trigger reactivity on THIS page immediately
      // Use JSON parse/stringify to ensure deep copy and trigger reactivity
      const newCurrentUser = JSON.parse(JSON.stringify(updatedUser));
      console.log('New currentUser before assignment:', newCurrentUser);
      console.log('New currentUser avatar_url:', newCurrentUser.avatar_url);
      currentUser = newCurrentUser;
      console.log('CurrentUser after assignment:', currentUser);
      console.log('CurrentUser avatar_url after assignment:', currentUser?.avatar_url);
      
      // Wait a bit for Svelte to process the update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Update localStorage (this will trigger storage event for other tabs)
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Dispatch event multiple times to ensure all pages catch it
      // Note: localStorage.setItem in the same tab does NOT trigger storage event
      // So we must use custom event
      if (typeof window !== 'undefined') {
        // Function to dispatch the event
        const dispatchUpdate = () => {
          const event = new CustomEvent('userUpdated', { 
            detail: { user: updatedUser },
            bubbles: true,
            cancelable: true
          });
          window.dispatchEvent(event);
        };
        
        // Trigger immediately (for same page)
        dispatchUpdate();
        
        // Also use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          dispatchUpdate();
        });
        
        // And one more with setTimeout for any late listeners
        setTimeout(() => {
          dispatchUpdate();
        }, 50);
        
        // One more after a longer delay to catch any pages that loaded late
        setTimeout(() => {
          dispatchUpdate();
        }, 200);
        
        // Final dispatch after even longer delay
        setTimeout(() => {
          dispatchUpdate();
        }, 500);
        
        // One more final dispatch for safety
        setTimeout(() => {
          dispatchUpdate();
        }, 1000);
      }
      
      // Show success message
      alert('Profile updated successfully!');
      
      // Update editForm to reflect saved changes
      editForm = {
        ...editForm,
        name: updatedUser.name || '',
        username: updatedUser.username || '',
        avatar_url: updatedUser.avatar_url || '',
        bio: updatedUser.bio || '',
        address: updatedUser.address || '',
        phone: updatedUser.phone || ''
      };
      
      // Update avatar preview
      if (updatedUser.avatar_url) {
        avatarPreview = updatedUser.avatar_url;
      }
      
      // Redirect back to profile page after events have time to propagate
      // Use longer delay to ensure all pages have processed the update
      setTimeout(() => {
        goto('/profile');
      }, 1200);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(`Failed to update profile: ${error.message}`);
    } finally {
      saving = false;
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

  onMount(async () => {
    await fetchCurrentUser();
    
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      currentLanguage = savedLanguage;
    }
    
    // Listen for user updates
    if (browser) {
      window.addEventListener('userUpdated', handleUserUpdate);
      window.addEventListener('storage', (e) => {
        if (e.key === 'user') {
          handleUserUpdate();
        }
      });
    }
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('userUpdated', handleUserUpdate);
    }
  });
</script>

<svelte:head>
  <title>Edit Profile - HandyGO</title>
</svelte:head>

<div class="edit-profile-page">
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
    {:else if !isLoggedIn}
      <div class="error">
        <h2>Please Login</h2>
        <p>You need to be logged in to edit your profile.</p>
        <a href="/login?redirect=/profile/edit" class="back-btn">Go to Login</a>
      </div>
    {:else}
      <div class="edit-profile-content">
        <div class="page-header">
          <h1 class="page-title">Edit Profile</h1>
          <button class="btn-back" on:click={() => goto('/profile')}>
            ← Back to Profile
          </button>
        </div>
        
        <div class="edit-form-card">
          <!-- Avatar Section -->
          <div class="form-section">
            <label for="avatar-upload" class="form-label">Profile Picture</label>
            <div class="avatar-upload-section">
              <div class="avatar-preview-large">
                {#if avatarPreview}
                  <img src={avatarPreview} alt="Avatar preview" />
                {:else}
                  <div class="avatar-placeholder">👤</div>
                {/if}
              </div>
              <div class="avatar-upload-options">
                <label for="avatar-upload" class="upload-avatar-btn">
                  <input id="avatar-upload" type="file" accept="image/*" on:change={handleAvatarUpload} style="display: none;" />
                  Upload Image
                </label>
                <input 
                  type="text" 
                  class="form-input" 
                  placeholder="Or paste image URL"
                  bind:value={editForm.avatar_url}
                  on:input={handleAvatarUrlChange}
                />
              </div>
            </div>
          </div>
          
          <!-- Name -->
          <div class="form-section">
            <label for="edit-name" class="form-label">Name</label>
            <input 
              id="edit-name"
              type="text" 
              class="form-input" 
              placeholder="Enter your name"
              bind:value={editForm.name}
              on:input={handleNameChange}
            />
          </div>
          
          <!-- Username -->
          <div class="form-section">
            <label for="edit-username" class="form-label">Username</label>
            <input 
              id="edit-username"
              type="text" 
              class="form-input" 
              placeholder="Enter username"
              bind:value={editForm.username}
              on:input={handleNameChange}
            />
          </div>
          
          <!-- Bio -->
          <div class="form-section">
            <label for="edit-bio" class="form-label">Bio / Description</label>
            <textarea 
              id="edit-bio"
              class="form-textarea" 
              placeholder="Tell us about yourself..."
              bind:value={editForm.bio}
              rows="4"
            ></textarea>
          </div>
          
          <!-- Address -->
          <div class="form-section">
            <label for="edit-address" class="form-label">Address</label>
            <input 
              id="edit-address"
              type="text" 
              class="form-input" 
              placeholder="Enter your address"
              bind:value={editForm.address}
            />
          </div>
          
          <!-- Phone -->
          <div class="form-section">
            <label for="edit-phone" class="form-label">Phone (optional)</label>
            <input 
              id="edit-phone"
              type="tel" 
              class="form-input" 
              placeholder="Enter your phone number"
              bind:value={editForm.phone}
            />
          </div>
          
          <!-- Action Buttons -->
          <div class="form-actions">
            <button class="btn-cancel" on:click={() => goto('/profile')} disabled={saving}>
              Cancel
            </button>
            <button class="btn-save" on:click={saveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
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
  
  .edit-profile-page {
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
  
  .header .container {
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
    max-width: 800px;
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
  
  .edit-profile-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #000000;
    margin: 0;
  }
  
  .btn-back {
    background: transparent;
    border: 2px solid #E0E0E0;
    color: #666;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .btn-back:hover {
    background: #F5F5F5;
    border-color: #D0D0D0;
  }
  
  .edit-form-card {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 2rem;
  }
  
  .form-section {
    margin-bottom: 2rem;
  }
  
  .form-label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: #000;
    font-size: 1rem;
  }
  
  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #E0E0E0;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.2s;
  }
  
  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #ECF86E;
  }
  
  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }
  
  .avatar-upload-section {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }
  
  .avatar-preview-large {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    background: #ECF86E;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .avatar-preview-large img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    font-size: 3rem;
  }
  
  .avatar-upload-options {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .upload-avatar-btn {
    padding: 0.75rem 1.5rem;
    background: #ECF86E;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
    color: #000;
  }
  
  .upload-avatar-btn:hover {
    background: #E0F055;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #E0E0E0;
  }
  
  .btn-cancel,
  .btn-save {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .btn-cancel {
    background: transparent;
    border: 2px solid #E0E0E0;
    color: #666;
  }
  
  .btn-cancel:hover:not(:disabled) {
    background: #F5F5F5;
    border-color: #D0D0D0;
  }
  
  .btn-save {
    background: #ECF86E;
    color: #000;
  }
  
  .btn-save:hover:not(:disabled) {
    background: #E0F055;
  }
  
  .btn-cancel:disabled,
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .avatar-upload-section {
      flex-direction: column;
      align-items: center;
    }
    
    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
    
    .form-actions {
      flex-direction: column-reverse;
    }
    
    .btn-cancel,
    .btn-save {
      width: 100%;
    }
  }
</style>

