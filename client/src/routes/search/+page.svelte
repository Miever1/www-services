<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { apiUrl, API_CONFIG } from '$lib/api-config.js';
  import { browser } from '$app/environment';
  
  let L = null;
  
  let tasks = [];
  let loading = true;
  let searchQuery = '';
  let postType = 'all';
  let distance = '';
  let minPrice = '';
  let maxPrice = '';
  let noPriceLimit = false;
  let hoveredTask = null;
  let favorites = new Set();
  let hoverTimeout = null;
  let isLoggedIn = false;
  let currentUser = null;
  let showUserMenu = false;
  let showLanguageMenu = false;
  let currentLanguage = 'en';
  let map = null;
  let mapContainer = null;
  let markers = [];
  let markersInitialized = false;
  let lastTasksHash = '';
  let selectedTaskId = null; // Track selected/hovered task from map marker
  let taskCoordinates = new Map(); // Store stable coordinates for each task
  let filterByMapBounds = false; // Whether to filter tasks by current map bounds
  
  $: {
    searchQuery = $page.url.searchParams.get('q') || '';
  }
  
  // Reload tasks when search query changes (only in browser)
  $: if (searchQuery !== undefined && browser) {
    loadTasks();
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
    
    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('favoriteTasks');
    if (savedFavorites) {
      favorites = new Set(JSON.parse(savedFavorites));
    }
    
    // Listen for favorites updates from other pages
    if (browser) {
      window.addEventListener('favoritesUpdated', handleFavoritesUpdate);
      window.addEventListener('storage', handleStorageChange);
      // Listen for user updates from other pages/tabs
      window.addEventListener('userUpdated', handleUserUpdate);
      window.addEventListener('storage', (e) => {
        if (e.key === 'user') {
          handleUserUpdate();
        }
      });
    }
    
    // Load tasks
    await loadTasks();
    
    // Import Leaflet only in browser
    if (browser) {
      const leafletModule = await import('leaflet');
      L = leafletModule.default;
      
      // Initialize map after DOM is ready
      setTimeout(() => {
        initMap();
      }, 100);
    }
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('favoritesUpdated', handleFavoritesUpdate);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userUpdated', handleUserUpdate);
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
    if (event.key === 'user' && event.newValue) {
      // Reload user info when it changes
      try {
        currentUser = JSON.parse(event.newValue);
        isLoggedIn = true;
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    } else if (event.key === 'user' && !event.newValue) {
      // User logged out
      currentUser = null;
      isLoggedIn = false;
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
  
  function initMap() {
    if (!mapContainer || map || !L) return;
    
    // Initialize Leaflet map centered on Aalto University ABLOCK
    map = L.map(mapContainer, {
      zoomControl: false,
      attributionControl: true
    }).setView([60.1848, 24.8274], 15);
    
    // Add CartoDB Positron tile layer (modern, minimal style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    
    // Add custom zoom controls
    const zoomControl = L.control.zoom({
      position: 'topright'
    }).addTo(map);
    
    // Force map to recalculate size after a short delay to ensure layout is stable
    setTimeout(() => {
      if (map) {
        map.invalidateSize();
        // Ensure zoom controls are visible and positioned correctly
        ensureZoomControlsVisible();
      }
    }, 100);
    
    // Add markers for tasks
    if (tasks.length > 0) {
      addMarkersToMap();
    }
    
    // Listen for map move/zoom events to update filters if "Search this area" is active
    map.on('moveend zoomend', () => {
      if (filterByMapBounds) {
        // Automatically refresh task list when map bounds change and filter is active
        loadTasks();
      }
      // Ensure zoom controls stay visible after map events
      ensureZoomControlsVisible();
      // Ensure map header button stays in correct position
      ensureMapHeaderPosition();
    });
    
    // Ensure zoom controls are always visible after zoom
    map.on('zoomend', () => {
      ensureZoomControlsVisible();
      ensureMapHeaderPosition();
    });
    
    // Also listen for zoomstart to fix position immediately
    map.on('zoomstart', () => {
      ensureMapHeaderPosition();
    });
    
    // Function to ensure zoom controls are always visible and correctly positioned
    function ensureZoomControlsVisible() {
      const zoomControls = document.querySelector('.leaflet-control-zoom');
      if (zoomControls) {
        zoomControls.style.display = 'block';
        zoomControls.style.visibility = 'visible';
        zoomControls.style.opacity = '1';
        zoomControls.style.position = 'absolute';
        zoomControls.style.top = '16px';
        zoomControls.style.right = '16px';
        zoomControls.style.zIndex = '1000';
        zoomControls.style.margin = '0';
      }
    }
    
    // Function to ensure map header button stays in correct position
    function ensureMapHeaderPosition() {
      const mapHeader = document.querySelector('.map-header');
      const mapPanel = document.querySelector('.map-panel');
      if (mapHeader && mapPanel) {
        // Force the header to stay at the top center of map-panel (NOT map-container)
        // This ensures it doesn't move when the map zooms
        mapHeader.style.position = 'absolute';
        mapHeader.style.top = '16px'; // Fixed 16px from top of map-panel
        mapHeader.style.left = '50%';
        mapHeader.style.transform = 'translateX(-50%)';
        mapHeader.style.zIndex = '999';
        mapHeader.style.margin = '0';
        mapHeader.style.padding = '0';
      }
    }
    
    // Use MutationObserver to watch for changes to zoom controls and map header
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        ensureZoomControlsVisible();
        ensureMapHeaderPosition();
      });
      
      const mapElement = mapContainer;
      if (mapElement) {
        observer.observe(mapElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });
        // Also observe the parent container for header changes
        const parentContainer = mapElement.parentElement;
        if (parentContainer) {
          observer.observe(parentContainer, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
          });
        }
      }
    }
    
    // Periodically check and fix zoom controls and header position (safety net)
    const zoomControlCheckInterval = setInterval(() => {
      if (map && mapContainer) {
        ensureZoomControlsVisible();
        ensureMapHeaderPosition();
      } else {
        clearInterval(zoomControlCheckInterval);
      }
    }, 500); // Check every 500ms
    
    // Initial positioning
    setTimeout(() => {
      ensureMapHeaderPosition();
    }, 200);
  }
  
  function addMarkersToMap() {
    if (!map || !L) return;
    
    // STRICT CHECK: Don't recreate markers if they're already initialized
    // This prevents markers from moving when hovering over cards
    if (markersInitialized && markers.length > 0) {
      console.log('⚠️ Markers already initialized, skipping recreation. This should not happen during hover!');
      console.trace('Stack trace to see what triggered this');
      return;
    }
    
    console.log('✅ Creating markers... (This should only happen when tasks change)');
    
    // Clear existing markers
    markers.forEach(marker => {
      if (marker && map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    markers = [];
    
    // Add marker for each task (showing rank number)
    // ABLOCK coordinates: 60.1848, 24.8274
    const ABLOCK_LAT = 60.1848;
    const ABLOCK_LNG = 24.8274;
    
    console.log(`Adding markers for ${tasks.length} tasks (showing first 10)`);
    
    tasks.slice(0, 10).forEach((task, index) => {
      const rank = index + 1; // Rank is 1-indexed
      const taskId = task?.id || `task_${index}`;
      
      if (!task || !task.id) {
        console.warn(`Task at index ${index} is missing ID, using fallback: ${taskId}`);
      }
      
      // Use cached coordinates if available, otherwise calculate and cache based on task location
      let lat, lng;
      if (taskCoordinates.has(taskId)) {
        const coords = taskCoordinates.get(taskId);
        lat = coords.lat;
        lng = coords.lng;
      } else {
        // Try to parse coordinates from task location field or generate stable coordinates
        const taskLocation = task?.location || '';
        
        // Helper function to generate stable hash from string
        function hashString(str) {
          if (!str || typeof str !== 'string') return 0;
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return hash;
        }
        
        // Try to parse location as coordinates (format: "lat,lng" or "[lat, lng]")
        let parsedLat = null;
        let parsedLng = null;
        if (taskLocation) {
          // Try to match coordinate patterns
          const coordMatch = taskLocation.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
          if (coordMatch) {
            parsedLat = parseFloat(coordMatch[1]);
            parsedLng = parseFloat(coordMatch[2]);
            // Validate parsed coordinates (Finland area)
            if (parsedLat >= 60 && parsedLat <= 70 && parsedLng >= 20 && parsedLng <= 32) {
              lat = parsedLat;
              lng = parsedLng;
            }
          }
        }
        
        // If coordinates couldn't be parsed, generate stable position based on location text or task ID
        if (!lat || !lng) {
          // Use location text if available, otherwise use task ID for stable hash
          const hashSource = taskLocation || taskId;
          const hash = Math.abs(hashString(hashSource));
          const combinedHash = hash + (index * 7919); // Prime number for better distribution
          
          // Generate position around ABLOCK with visible offsets
          // Offset range: -0.01 to +0.01 degrees (about 1 km)
          // This ensures markers are spread out around ABLOCK but still visible on the map
          const latOffset = ((combinedHash % 2000 - 1000) / 100000); // ±0.01 degrees
          const lngOffset = (((combinedHash >> 11) % 2000 - 1000) / 100000); // ±0.01 degrees
          
          lat = ABLOCK_LAT + latOffset;
          lng = ABLOCK_LNG + lngOffset;
          
          // Validate coordinates before creating marker
          if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) || 
              lat < 60 || lat > 61 || lng < 24 || lng > 25) {
            console.warn(`Invalid coordinates for task ${taskId}, using ABLOCK with index offset`);
            // Use ABLOCK with index-based offset as fallback (spread in a grid)
            const row = Math.floor(index / 3);
            const col = index % 3;
            lat = ABLOCK_LAT + (row * 0.001) - 0.001; // 3 rows with larger spacing
            lng = ABLOCK_LNG + (col * 0.001) - 0.001; // 3 columns with larger spacing
          }
        }
        
        // Cache the coordinates to ensure they remain stable
        taskCoordinates.set(taskId, { lat, lng });
        console.log(`📍 Cached coordinates for task ${taskId} (${taskLocation || 'no location'}): (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
      }
      
      // Create custom icon with rank number for each marker (black modern style)
      // The SVG viewBox is 155x200, icon size is 32x42
      // The teardrop tip should point to the exact coordinate
      const pinIcon = L.divIcon({
        html: `
          <div style="position: relative; width: 32px; height: 42px;">
            <svg width="32" height="42" viewBox="0 0 155 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
              <path d="M77.1375 0C34.6 0 -0.00416623 34.6 3.76228e-07 77.1333C3.76228e-07 92.9333 4.74583 108.125 13.6292 120.913C14.075 121.679 14.525 122.421 15.0542 123.142L71.3583 197.358C72.8875 199.063 74.9417 200 77.1417 200C79.3125 200 81.3792 199.054 83.1667 197.05L139.212 123.129C139.767 122.396 140.238 121.592 140.496 121.121C149.508 108.154 154.279 92.9458 154.279 77.1417C154.279 34.6 119.675 0 77.1375 0Z" fill="#000000"/>
            </svg>
            <span style="position: absolute; top: 28%; left: 50%; transform: translateX(-50%); font-weight: 700; font-size: 0.85rem; color: #FFFFFF; text-shadow: 0 1px 2px rgba(0,0,0,0.5); line-height: 1;">${rank}</span>
          </div>
        `,
        className: 'custom-pin',
        iconSize: [32, 42],
        iconAnchor: [16, 42], // Center horizontally (32/2), bottom vertically (42)
        popupAnchor: [0, -42]
      });
      
      // Create marker with explicit coordinates to ensure stability
      // Store the original coordinates as constants to prevent any changes
      const originalLat = lat;
      const originalLng = lng;
      const originalLatLng = L.latLng(originalLat, originalLng);
      
      // Create marker without adding to map first
      const marker = L.marker(originalLatLng, { 
        icon: pinIcon,
        draggable: false,
        keyboard: false,
        riseOnHover: false // Prevent marker from moving on hover
      });
      
      // LOCK the marker position BEFORE adding to map
      // Override setLatLng to always restore original position
      const originalSetLatLng = marker.setLatLng.bind(marker);
      marker.setLatLng = function(newLatLng) {
        // Always restore to original position - ignore any attempts to move it
        if (L && this._map) {
          // Force set the internal position property
          this._latlng = originalLatLng;
          // Update the visual position immediately
          if (this._updatePosition) {
            this._updatePosition();
          }
          // Also update the icon position if it exists
          if (this._icon && this._icon.parentNode) {
            const point = this._map.latLngToLayerPoint(originalLatLng);
            L.DomUtil.setPosition(this._icon, point);
          }
        }
        return this;
      };
      
      // Also override getLatLng to always return original position
      const originalGetLatLng = marker.getLatLng.bind(marker);
      marker.getLatLng = function() {
        // Always return the original locked position
        return originalLatLng;
      };
      
      // Lock the internal _latlng property
      try {
        Object.defineProperty(marker, '_latlng', {
          get: function() {
            return originalLatLng;
          },
          set: function(val) {
            // Ignore any attempts to set position directly
            // Force it back to original
            this._latlng = originalLatLng;
            if (this._map && this._updatePosition) {
              this._updatePosition();
            }
          },
          configurable: false
        });
      } catch (e) {
        // If we can't lock it, at least ensure it's set correctly
        marker._latlng = originalLatLng;
      }
      
      // Now add to map
      marker.addTo(map);
      
      // Force set position immediately after adding
      marker.setLatLng(originalLatLng);
      
      // Periodically check and fix position (safety net)
      // Use more frequent checks and immediate restoration
      const positionCheckInterval = setInterval(() => {
        if (!marker._map || !marker._icon) {
          clearInterval(positionCheckInterval);
          return;
        }
        const currentPos = marker.getLatLng();
        // Check if position has moved (tolerance of 0.0001 degrees ~ 11 meters)
        if (currentPos && (Math.abs(currentPos.lat - originalLat) > 0.0001 || Math.abs(currentPos.lng - originalLng) > 0.0001)) {
          console.warn(`⚠️ Marker ${taskId} position changed from (${currentPos.lat.toFixed(6)}, ${currentPos.lng.toFixed(6)}) to (${originalLat.toFixed(6)}, ${originalLng.toFixed(6)})! Restoring.`);
          // Force restore immediately
          marker._latlng = originalLatLng;
          if (marker._updatePosition) {
            marker._updatePosition();
          }
          marker.setLatLng(originalLatLng);
        }
        // Always ensure _latlng property is correct
        if (marker._latlng && (Math.abs(marker._latlng.lat - originalLat) > 0.0001 || Math.abs(marker._latlng.lng - originalLng) > 0.0001)) {
          marker._latlng = originalLatLng;
        }
      }, 50); // Check every 50ms for faster response
      
      // Store interval ID so we can clear it if needed
      marker._positionCheckInterval = positionCheckInterval;
      
      // Debug: log marker creation
      console.log(`Created marker #${rank} for task ${taskId} at (${lat.toFixed(6)}, ${lng.toFixed(6)}) - Position LOCKED`);
      
      // Store task reference and coordinates in marker for hover matching
      marker._taskId = task.id;
      marker._lat = lat;
      marker._lng = lng;
      marker._locked = true; // Mark as locked
      
      // Add click event to marker - scroll to card when clicked
      // IMPORTANT: Lock position immediately on click to prevent movement
      marker.on('click', (e) => {
        // Prevent any default behaviors that might move the marker
        if (e.originalEvent) {
          e.originalEvent.preventDefault();
          e.originalEvent.stopPropagation();
          e.originalEvent.stopImmediatePropagation();
        }
        
        // Immediately lock position before any other operations
        marker.setLatLng(originalLatLng);
        
        // Use requestAnimationFrame to ensure position is locked before other updates
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            // Lock position again after any async operations
            marker.setLatLng(originalLatLng);
            console.log(`📍 Marker clicked for task ${task.id} - Position locked`);
            
            selectedTaskId = task.id;
            // Scroll to corresponding card (only scrolls the card list, not the page)
            scrollToCard(task.id);
          });
        } else {
          marker.setLatLng(originalLatLng);
          console.log(`📍 Marker clicked for task ${task.id} - Position locked`);
          selectedTaskId = task.id;
          scrollToCard(task.id);
        }
      });
      
      // Add hover events for visual feedback (highlight marker)
      marker.on('mouseover', (e) => {
        // Lock position on hover to prevent any movement
        marker.setLatLng(originalLatLng);
        selectedTaskId = task.id;
        // Just highlight, don't scroll on hover
      });
      
      marker.on('mouseout', () => {
        // Lock position on mouseout as well
        marker.setLatLng(originalLatLng);
        // Don't clear immediately, let card hover take over if mouse moves there
        setTimeout(() => {
          marker.setLatLng(originalLatLng); // Lock again after timeout
          if (selectedTaskId === task.id) {
            selectedTaskId = null;
          }
        }, 100);
      });
      
      // Lock position on any other events that might cause movement
      marker.on('dragstart drag dragend', (e) => {
        e.preventDefault();
        marker.setLatLng(originalLatLng);
      });
      
      markers.push(marker);
    });
    
    console.log(`Successfully created ${markers.length} markers on the map`);
    console.log('Marker coordinates:', markers.map(m => ({
      taskId: m._taskId,
      lat: m._lat?.toFixed(6),
      lng: m._lng?.toFixed(6)
    })));
    
    markersInitialized = true;
  }
  
  // Watch for hoveredTask or selectedTaskId changes and highlight corresponding marker
  // IMPORTANT: This ONLY changes marker styling (opacity, scale, z-index, color), NEVER position
  $: if (map && markers.length > 0 && markersInitialized) {
    const highlightedTaskId = hoveredTask?.id || selectedTaskId;
    
    // Use requestAnimationFrame to ensure DOM is ready
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        markers.forEach((marker) => {
          if (!marker._icon || !marker._map) return; // Skip if marker not ready
          
          // DO NOT touch marker position here - only change visual styling
          if (highlightedTaskId && marker._taskId === highlightedTaskId) {
            // Highlight the hovered/selected marker with enhanced styling
            marker.setOpacity(1);
            marker.setZIndexOffset(1000);
            const iconElement = marker._icon;
            if (iconElement) {
              iconElement.style.transform = 'scale(1.4)';
              iconElement.style.transition = 'transform 0.2s ease, filter 0.2s ease';
              iconElement.style.filter = 'drop-shadow(0 4px 12px rgba(236, 248, 110, 0.8))';
              iconElement.style.zIndex = '1000';
              // Change pin color to yellow/green for highlighted state
              const svg = iconElement.querySelector('svg path');
              if (svg) {
                svg.setAttribute('fill', '#ECF86E');
              }
            }
          } else {
            // Dim other markers
            marker.setOpacity(0.5);
            marker.setZIndexOffset(0);
            const iconElement = marker._icon;
            if (iconElement) {
              iconElement.style.transform = 'scale(1)';
              iconElement.style.filter = 'none';
              iconElement.style.zIndex = 'auto';
              // Restore original black color
              const svg = iconElement.querySelector('svg path');
              if (svg) {
                svg.setAttribute('fill', '#000000');
              }
            }
          }
        });
      });
    } else {
      // Fallback if requestAnimationFrame is not available
      markers.forEach((marker) => {
        if (!marker._icon || !marker._map) return;
        
        if (highlightedTaskId && marker._taskId === highlightedTaskId) {
          marker.setOpacity(1);
          marker.setZIndexOffset(1000);
          const iconElement = marker._icon;
          if (iconElement) {
            iconElement.style.transform = 'scale(1.4)';
            iconElement.style.transition = 'transform 0.2s ease, filter 0.2s ease';
            iconElement.style.filter = 'drop-shadow(0 4px 12px rgba(236, 248, 110, 0.8))';
            iconElement.style.zIndex = '1000';
            const svg = iconElement.querySelector('svg path');
            if (svg) {
              svg.setAttribute('fill', '#ECF86E');
            }
          }
        } else {
          marker.setOpacity(0.5);
          marker.setZIndexOffset(0);
          const iconElement = marker._icon;
          if (iconElement) {
            iconElement.style.transform = 'scale(1)';
            iconElement.style.filter = 'none';
            iconElement.style.zIndex = 'auto';
            const svg = iconElement.querySelector('svg path');
            if (svg) {
              svg.setAttribute('fill', '#000000');
            }
          }
        }
      });
    }
  }
  
  // Reset marker opacity and styling when no task is hovered/selected
  // IMPORTANT: This ONLY changes marker styling, NEVER position
  $: if (!hoveredTask && !selectedTaskId && map && markers.length > 0 && markersInitialized) {
    markers.forEach(marker => {
      // DO NOT touch marker position here - only reset visual styling
      marker.setOpacity(1);
      marker.setZIndexOffset(0);
      const iconElement = marker._icon;
      if (iconElement) {
        iconElement.style.transform = 'scale(1)';
        iconElement.style.filter = 'none';
        iconElement.style.zIndex = 'auto';
        // Restore original black color
        const svg = iconElement.querySelector('svg path');
        if (svg) {
          svg.setAttribute('fill', '#000000');
        }
      }
    });
  }
  
  // Watch for tasks changes and reload markers (only when tasks actually change)
  // This reactive statement only depends on tasks, map, L, and loading - NOT on hoveredTask or selectedTaskId
  // CRITICAL: This should NEVER run during hover - only when tasks array reference or content actually changes
  $: if (map && L && tasks.length > 0 && !loading) {
    // Create a stable hash of task IDs to detect changes
    const currentHash = tasks
      .slice(0, 10)
      .map(t => t?.id || '')
      .filter(id => id !== '')
      .join(',');
    
    // STRICT: Only reload markers if the task list hash actually changed AND markers aren't already initialized
    if (currentHash !== lastTasksHash && currentHash !== '' && (!markersInitialized || markers.length === 0)) {
      console.log('📋 Tasks changed, recreating markers. Old hash:', lastTasksHash, 'New hash:', currentHash);
      lastTasksHash = currentHash;
      markersInitialized = false; // Allow recreation
      addMarkersToMap();
    } else if (currentHash !== lastTasksHash && currentHash !== '') {
      // Hash changed but markers are already initialized - just update the hash, don't recreate
      console.log('📋 Task hash changed but markers already exist, updating hash only');
      lastTasksHash = currentHash;
    } else if (currentHash === lastTasksHash && !markersInitialized && markers.length === 0) {
      // Tasks haven't changed but markers need initialization
      console.log('🔧 Initializing markers for the first time');
      addMarkersToMap();
    }
    // If markers are already initialized and hash hasn't changed, do nothing
  }
  
  function handleLogout() {
    localStorage.removeItem('user');
    isLoggedIn = false;
    currentUser = null;
    showUserMenu = false;
    // Dispatch event to notify other pages
    if (browser) {
      window.dispatchEvent(new CustomEvent('userUpdated'));
    }
    window.location.href = '/login';
  }
  
  function toggleUserMenu() {
    console.log('toggleUserMenu called, current showUserMenu:', showUserMenu);
    showUserMenu = !showUserMenu;
    console.log('toggleUserMenu new showUserMenu:', showUserMenu);
  }
  
  function toggleLanguageMenu() {
    console.log('toggleLanguageMenu called, current showLanguageMenu:', showLanguageMenu);
    showLanguageMenu = !showLanguageMenu;
    console.log('toggleLanguageMenu new showLanguageMenu:', showLanguageMenu);
  }
  
  function changeLanguage(lang) {
    currentLanguage = lang;
    if (browser) {
      localStorage.setItem('language', lang);
    }
    showLanguageMenu = false;
  }
  
  const languages = {
    en: 'English',
    sv: 'Svenska',
    fi: 'Suomi'
  };
  
  function calculateRelevance(task, query) {
    if (!query || !query.trim()) return 0;
    
    const queryLower = query.toLowerCase().trim();
    const nameLower = task.name?.toLowerCase() || '';
    const descLower = task.description?.toLowerCase() || '';
    let score = 0;
    
    // Exact match in name gets highest score
    if (nameLower === queryLower) {
      score += 100;
    } else if (nameLower.startsWith(queryLower)) {
      score += 50;
    } else if (nameLower.includes(queryLower)) {
      score += 30;
    }
    
    // Match in description
    if (descLower.includes(queryLower)) {
      score += 10;
    }
    
    // Word-based matching (more words matched = higher score)
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
    queryWords.forEach(word => {
      if (nameLower.includes(word)) score += 20;
      if (descLower.includes(word)) score += 5;
    });
    
    return score;
  }
  
  async function loadTasks() {
    // Only run in browser
    if (!browser) return;
    
    loading = true;
    try {
      const response = await fetch(apiUrl(API_CONFIG.endpoints.tasks), {
        credentials: 'include' // Include cookies for session
      });
      const allTasks = await response.json();
      
      // Parse images field for each task if it exists
      const parsedTasks = allTasks.map(task => {
        if (task.images) {
          if (typeof task.images === 'string') {
            try {
              task.images = JSON.parse(task.images);
            } catch (e) {
              console.warn('Failed to parse images for task:', task.id, e);
              task.images = [];
            }
          }
          if (!Array.isArray(task.images)) {
            task.images = [];
          }
        } else {
          task.images = [];
        }
        return task;
      });
      
      let filteredTasks = parsedTasks;
      
      // Filter by search query
      if (searchQuery) {
        filteredTasks = allTasks.filter(task => 
          task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      // Filter by post type
      if (postType !== 'all') {
        // Assuming tasks have a 'type' field, adjust as needed
        // filteredTasks = filteredTasks.filter(task => task.type === postType);
      }
      
      // Filter by price
      if (!noPriceLimit) {
        if (minPrice) {
          filteredTasks = filteredTasks.filter(task => {
            const price = parseFloat(task.price) || 0;
            return price >= parseFloat(minPrice);
          });
        }
        if (maxPrice) {
          filteredTasks = filteredTasks.filter(task => {
            const price = parseFloat(task.price) || 0;
            return price <= parseFloat(maxPrice);
          });
        }
      }
      
      // Filter by map bounds (if enabled)
      if (filterByMapBounds && map && L) {
        const bounds = map.getBounds();
        filteredTasks = filteredTasks.filter(task => {
          const taskId = task?.id || '';
          // Check if task has cached coordinates
          if (taskCoordinates.has(taskId)) {
            const coords = taskCoordinates.get(taskId);
            const lat = coords.lat;
            const lng = coords.lng;
            // Check if task coordinates are within map bounds
            return bounds.contains([lat, lng]);
          }
          // If no cached coordinates, include the task (shouldn't happen if markers are created)
          return false;
        });
        console.log(`Filtered to ${filteredTasks.length} tasks within map bounds`);
      }
      
      // Calculate relevance and sort
      if (searchQuery) {
        filteredTasks = filteredTasks.map(task => ({
          ...task,
          relevance: calculateRelevance(task, searchQuery)
        })).sort((a, b) => b.relevance - a.relevance);
      } else {
        // If no search query, sort by time (newest first)
        filteredTasks = filteredTasks.sort((a, b) => new Date(b.time) - new Date(a.time));
      }
      
      tasks = filteredTasks;
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      loading = false;
    }
  }
  
  function handleSearch() {
    loadTasks();
  }
  
  function handleKeyPress(event) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }
  
  function handleSearchThisArea() {
    if (!map || !L) {
      console.warn('Map not initialized');
      return;
    }
    
    // Toggle filter by map bounds
    filterByMapBounds = !filterByMapBounds;
    
    if (filterByMapBounds) {
      // Get current map bounds
      const bounds = map.getBounds();
      console.log('Searching in area:', {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
      
      // Reload tasks with map bounds filter
      loadTasks();
    } else {
      // Clear map bounds filter
      loadTasks();
    }
  }
  
  function scrollToCard(taskId) {
    // Find card element by data-task-id attribute
    const cardElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!cardElement) {
      console.warn(`Card with task ID ${taskId} not found`);
      return;
    }
    
    // Find the scrollable container (results-panel)
    const resultsPanel = document.querySelector('.results-panel');
    if (!resultsPanel) {
      console.warn('Results panel container not found, using fallback scroll');
      cardElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      return;
    }
    
    // Get positions using getBoundingClientRect for accurate measurements
    const cardRect = cardElement.getBoundingClientRect();
    const containerRect = resultsPanel.getBoundingClientRect();
    const containerScrollTop = resultsPanel.scrollTop;
    const containerHeight = resultsPanel.clientHeight;
    
    // Calculate card's position relative to the scrollable container
    // cardRect.top is relative to viewport, containerRect.top is relative to viewport
    // So the difference gives us the card's position relative to the container's visible area
    const cardTopInViewport = cardRect.top;
    const containerTopInViewport = containerRect.top;
    
    // Card's top position relative to container's visible top edge
    const cardOffsetFromContainerTop = cardTopInViewport - containerTopInViewport;
    
    // Card's absolute position in the scrollable content
    const cardAbsoluteTop = containerScrollTop + cardOffsetFromContainerTop;
    
    // Calculate scroll position to center the card
    const cardHeight = cardRect.height;
    const scrollTo = cardAbsoluteTop - (containerHeight / 2) + (cardHeight / 2);
    
    console.log(`Scrolling to card ${taskId}:`, {
      cardTopInViewport,
      containerTopInViewport,
      cardOffsetFromContainerTop,
      containerScrollTop,
      cardAbsoluteTop,
      containerHeight,
      cardHeight,
      scrollTo: Math.max(0, scrollTo)
    });
    
    // Smooth scroll within the container only
    resultsPanel.scrollTo({
      top: Math.max(0, scrollTo), // Ensure scrollTop is not negative
      behavior: 'smooth'
    });
  }
  
  function handleCardHover(task, event) {
    // 检查是否点击了收藏按钮
    if (event.target.closest('.favorite-btn')) {
      return;
    }
    // 清除之前的定时器
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    // 立即设置悬停任务
    hoveredTask = task;
    selectedTaskId = task.id;
  }
  
  function handleCardLeave(event) {
    // 检查是否离开了收藏按钮
    if (event.relatedTarget && event.relatedTarget.closest('.favorite-btn')) {
      return;
    }
    // 清除定时器
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    // 清除悬停任务（但保留 selectedTaskId 如果是从地图标记触发的）
    hoveredTask = null;
    // Only clear selectedTaskId if not hovering over a marker
    setTimeout(() => {
      if (!hoveredTask) {
        selectedTaskId = null;
      }
    }, 100);
  }
  
  function formatTimeAgo(dateString) {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffMs = now - postDate;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;
    
    if (diffHours < 24) {
      const hours = Math.floor(diffHours);
      if (hours === 0) return { label: 'Just now', icon: '🆕' };
      return { label: `${hours}h ago`, icon: '⏰' };
    } else if (diffDays < 7) {
      const days = Math.floor(diffDays);
      if (days <= 1) return { label: '24h ago', icon: '⏰' };
      if (days <= 2) return { label: '48h ago', icon: '⏰' };
      return { label: `${days}d ago`, icon: '⏰' };
    }
    return null;
  }
  
  function toggleFavorite(taskId, event) {
    // 完全阻止事件传播，确保不会影响其他元素
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      event.stopImmediatePropagation();
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
    
    // 使用tick()确保DOM更新
    if (browser) {
      // Save to localStorage to sync across pages
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
</script>

<svelte:head>
  <title>Search Tasks - HandyGO</title>
</svelte:head>

<main class="search-page">
  <!-- Navigation Header -->
  <header class="header">
    <div class="container">
      <a href="/" class="nav-left" on:click={(e) => { e.preventDefault(); e.stopPropagation(); console.log('HandyGO logo clicked, navigating to home'); window.location.href = '/'; }}>
        <img src="/favicon.png" alt="HandyGO" class="logo-icon" />
        <h1 class="logo">HandyGO</h1>
      </a>
      <nav class="nav-right">
        {#if isLoggedIn}
          <!-- User Menu -->
          <div class="user-menu-wrapper">
            <div class="user-info" on:click={() => { console.log('User info clicked!'); toggleUserMenu(); }}>
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
                <a href="/profile" class="dropdown-item" on:click={(e) => { e.preventDefault(); e.stopPropagation(); console.log('Profile link clicked'); window.location.href = '/profile'; }}>
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
          <button class="btn-login" on:click={(e) => { e.preventDefault(); e.stopPropagation(); console.log('Login button clicked'); window.location.href = '/login'; }}>Login</button>
          <button class="btn-register" on:click={(e) => { e.preventDefault(); e.stopPropagation(); console.log('Register button clicked'); window.location.href = '/register'; }}>Register</button>
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

  <!-- Main Content with Three Columns -->
  <section class="search-main">
    <div class="search-container">
      <!-- Left Sidebar: Filters -->
      <aside class="filters-panel">
        <div class="search-bar">
          <input 
            type="text" 
            placeholder="Search tasks..." 
            bind:value={searchQuery}
            on:keypress={handleKeyPress}
            class="filter-search-input"
          />
          <button on:click={handleSearch} class="search-icon-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </button>
        </div>
        
        <div class="filter-group">
          <label class="filter-label">Post Type</label>
          <select bind:value={postType} class="filter-select">
            <option value="all">All Types</option>
            <option value="need">Need</option>
            <option value="offer">Offer</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label class="filter-label">Distance</label>
          <select bind:value={distance} class="filter-select">
            <option value="">Select distance</option>
            <option value="3">3 km</option>
            <option value="10">10 km</option>
            <option value="30">30 km</option>
            <option value="50">50 km</option>
            <option value="all">All distances</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label class="filter-label">Price</label>
          <div class="price-inputs">
            <input 
              type="number" 
              placeholder="Min" 
              bind:value={minPrice}
              class="filter-input price-input"
              disabled={noPriceLimit}
            />
            <span class="price-separator">-</span>
            <input 
              type="number" 
              placeholder="Max" 
              bind:value={maxPrice}
              class="filter-input price-input"
              disabled={noPriceLimit}
            />
          </div>
          <button 
            class="price-limit-btn" 
            on:click={() => noPriceLimit = !noPriceLimit}
            role="button"
            type="button"
          >
            {noPriceLimit ? '✓' : ''} No price limit
          </button>
        </div>
      </aside>
      
      <!-- Middle: Search Results -->
      <section class="results-panel">
        {#if loading}
          <div class="loading">
            <p>Loading tasks...</p>
          </div>
        {:else if tasks.length > 0}
          <div class="results-grid">
            {#each tasks as task, index}
              {@const timeInfo = formatTimeAgo(task.time)}
              {@const rank = index + 1}
              {@const isTaskFavorite = favorites.has(task.id)}
              <div 
                class="result-card {selectedTaskId === task.id ? 'selected' : ''}"
                data-task-id={task.id}
                on:click={(e) => {
                  // Don't navigate if clicking on favorite button or its children
                  const clickedFavoriteBtn = e.target.closest('.favorite-btn') || 
                                             e.target.closest('.heart-icon') || 
                                             e.target.closest('.heart-path');
                  
                  if (clickedFavoriteBtn) {
                    // User clicked favorite button, don't navigate
                    return;
                  }
                  
                  // Validate task and task.id before navigation
                  if (!task) {
                    console.error('❌ Task is null or undefined');
                    return;
                  }
                  
                  if (!task.id) {
                    console.error('❌ Task ID is missing:', task);
                    return;
                  }
                  
                  // Ensure task.id is a string
                  const taskId = String(task.id).trim();
                  if (!taskId || taskId === 'undefined' || taskId === 'null') {
                    console.error('❌ Invalid task ID:', taskId, 'from task:', task);
                    return;
                  }
                  
                  console.log('🔵 Card clicked, navigating to task:', taskId);
                  console.log('🔵 Full task object:', task);
                  const targetUrl = `/task/${taskId}`;
                  console.log('🔵 Target URL:', targetUrl);
                  
                  // Use window.location for reliable navigation
                  if (browser && window.location) {
                    console.log('🚀 Navigating to:', targetUrl);
                    window.location.href = targetUrl;
                  } else {
                    // Fallback to goto
                    goto(targetUrl, {
                      invalidateAll: true,
                      keepFocus: false,
                      replaceState: false
                    }).then(() => {
                      console.log('✅ Navigation completed via goto');
                    }).catch(err => {
                      console.error('❌ Navigation error:', err);
                    });
                  }
                }}
                on:keydown={(e) => { 
                  if (e.key === 'Enter') {
                    const clickedFavoriteBtn = e.target.closest('.favorite-btn');
                    if (!clickedFavoriteBtn && task && task.id) {
                      console.log('Navigating to task (Enter key):', task.id);
                      goto(`/task/${task.id}`).catch(err => {
                        console.error('Navigation error:', err);
                      });
                    }
                  }
                }}
                on:mouseenter={(e) => handleCardHover(task, e)}
                on:mouseleave={handleCardLeave}
                role="button"
                tabindex="0"
              >
                <div class="rank-badge">#{rank}</div>
                {#if task.images && Array.isArray(task.images) && task.images.length > 0}
                  <div class="card-image">
                    <img src={task.images[0]?.data || task.images[0]} alt={task.name} />
                  </div>
                {:else}
                  <div class="card-image-placeholder">📸</div>
                {/if}
                <button 
                  type="button"
                  class="favorite-btn {isTaskFavorite ? 'active' : ''}" 
                  on:click={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    toggleFavorite(task.id, e);
                  }}
                  on:mouseenter|stopPropagation
                  on:mouseleave|stopPropagation
                  on:mousedown|stopPropagation
                  on:mouseup|stopPropagation
                  on:pointerdown|stopPropagation
                  on:pointerup|stopPropagation
                  title={isTaskFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="heart-icon" on:click|stopPropagation on:mousedown|stopPropagation>
                    <path d="M32 407.584A279.584 279.584 0 0 1 512 212.64a279.584 279.584 0 0 1 480 194.944 278.144 278.144 0 0 1-113.024 224.512L562.592 892.8a96 96 0 0 1-124.416-1.952L130.016 620.16A278.976 278.976 0 0 1 32 407.584z" class="heart-path"/>
                  </svg>
                </button>
                <div class="card-info">
                  <div class="card-meta">
                    {#if timeInfo}
                      <span class="time-badge">
                        <svg class="time-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                          <path d="M511.913993 63.989249c-247.012263 0-447.924744 200.912481-447.924744 447.924744s200.912481 447.924744 447.924744 447.924744 447.924744-200.912481 447.924744-447.924744S758.926256 63.989249 511.913993 63.989249zM511.913993 895.677474c-211.577356 0-383.763481-172.186125-383.763481-383.763481 0-211.577356 172.014111-383.763481 383.763481-383.763481s383.763481 172.014111 383.763481 383.763481S723.491349 895.677474 511.913993 895.677474z" fill="#575B66"></path>
                          <path d="M672.05913 511.913993l-159.973123 0L512.086007 288.123635c0-17.717453-14.277171-32.166639-31.994625-32.166639-17.717453 0-31.994625 14.449185-31.994625 32.166639l0 255.956996c0 17.717453 14.277171 31.994625 31.994625 31.994625l191.967747 0c17.717453 0 32.166639-14.277171 32.166639-31.994625C704.053754 526.191164 689.604569 511.913993 672.05913 511.913993z" fill="#575B66"></path>
                        </svg>
                        {timeInfo.label}
                      </span>
                    {/if}
                    {#if task.price}
                      <span class="price-badge">€{task.price}</span>
                    {/if}
                  </div>
                  <h3 class="card-title">{task.name}</h3>
                  <p class="card-location">📍 Aalto Campus, Espoo</p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-results">
            <p>No tasks found.</p>
            <a href="/post" class="post-task-btn" on:click|preventDefault={(e) => {
              if (!isLoggedIn) {
                goto('/login?redirect=/post');
              } else {
                goto('/post');
              }
            }}>Post a Task</a>
          </div>
        {/if}
      </section>
      
      <!-- Right: Map -->
      <aside class="map-panel">
        <div class="map-header">
          <button 
            class="search-area-btn {filterByMapBounds ? 'active' : ''}"
            on:click={handleSearchThisArea}
            title={filterByMapBounds ? 'Clear area filter' : 'Filter tasks by current map view'}
          >
            {filterByMapBounds ? 'Clear area filter' : 'Search this area'}
          </button>
        </div>
        <div class="map-container">
          <div bind:this={mapContainer} class="leaflet-container"></div>
        </div>
      </aside>
    </div>
  </section>
</main>

<style>
  :global(body) {
    height: 100vh;
    overflow: hidden;
  }
  
  :global(html) {
    height: 100vh;
    overflow: hidden;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }
  
  .search-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }
  
  
  /* Header Styles */
  .header {
    background: #FFFFFF;
    border-bottom: 1px solid #EAF2FD;
    position: sticky !important;
    top: 0 !important;
    z-index: 10000 !important;
    flex-shrink: 0;
    pointer-events: auto !important;
    isolation: isolate;
  }
  
  .header .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 20px;
    pointer-events: auto !important;
    position: relative;
    z-index: 10001 !important;
  }
  
  .header * {
    pointer-events: auto !important;
  }
  
  .header a,
  .header button,
  .header div[role="button"],
  .header div[on\:click] {
    pointer-events: auto !important;
    cursor: pointer !important;
    position: relative;
    z-index: 10002 !important;
  }
  
  .nav-left {
    display: flex;
    align-items: center;
    gap: 15px;
    cursor: pointer;
    transition: opacity 0.2s ease;
    user-select: none;
    -webkit-user-select: none;
    pointer-events: auto;
    position: relative;
    z-index: 10;
    text-decoration: none;
    color: inherit;
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
    pointer-events: auto !important;
    position: relative;
    z-index: 10;
  }
  
  .nav-right button,
  .nav-right a,
  .nav-right div {
    pointer-events: auto !important;
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
    pointer-events: auto !important;
    z-index: 10010 !important;
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer !important;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
    pointer-events: auto !important;
    position: relative;
    z-index: 10011 !important;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }
  
  .user-info * {
    pointer-events: none !important;
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
    z-index: 10001 !important;
    overflow: hidden;
    pointer-events: auto !important;
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
    cursor: pointer !important;
    border-radius: 8px;
    transition: all 0.2s ease;
    pointer-events: auto !important;
    position: relative;
    z-index: 10011 !important;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
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
    z-index: 10001 !important;
    overflow: hidden;
    pointer-events: auto !important;
  }
  
  .search-main {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
    position: relative;
    z-index: 1;
  }
  
  .search-container {
    display: grid;
    grid-template-columns: 280px 1fr 500px;
    width: 100%;
    height: 100%;
    overflow: hidden;
    min-height: 0;
    position: relative;
    z-index: 1;
  }
  
  /* Left Panel: Filters */
  .filters-panel {
    background: #FFFFFF;
    border-right: 1px solid #EAF2FD;
    padding: 1.5rem;
    overflow-y: hidden;
    overflow-x: hidden;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  
  .search-bar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .filter-search-input {
    flex: 1;
    padding: 0.75rem;
    border: 2px solid #EAF2FD;
    border-radius: 8px;
    font-size: 0.9rem;
    outline: none;
  }
  
  .filter-search-input:focus {
    border-color: #ECF86E;
  }
  
  .search-icon-btn {
    background: #ECF86E;
    border: none;
    padding: 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    color: #000;
  }
  
  .search-icon-btn:hover {
    background: #E0F055;
  }
  
  .filter-group {
    margin-bottom: 1.5rem;
  }
  
  .filter-label {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    color: #000;
    margin-bottom: 0.5rem;
  }
  
  .filter-select,
  .filter-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #EAF2FD;
    border-radius: 8px;
    font-size: 0.9rem;
    outline: none;
  }
  
  .filter-select:focus,
  .filter-input:focus {
    border-color: #ECF86E;
  }
  
  .price-separator {
    color: #666;
    font-weight: 500;
  }
  
  .price-limit-btn {
    width: 100%;
    margin-top: 0.5rem;
    background: transparent;
    border: 2px solid #EAF2FD;
    padding: 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.85rem;
    transition: all 0.2s ease;
  }
  
  .price-limit-btn:hover {
    background: #F8FFCB;
    border-color: #ECF86E;
  }
  
  .price-inputs {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 0.5rem;
    align-items: center;
  }
  
  /* Middle Panel: Results */
  .results-panel {
    background: #FFFFFF;
    padding: 1.5rem;
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    min-height: 0;
  }
  
  .loading {
    text-align: center;
    padding: 4rem 0;
    color: #666;
  }
  
  .results-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  
  .result-card {
    background: #FFFFFF;
    border: 2px solid #EAF2FD;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    z-index: 1;
  }
  
  .result-card:hover {
    border-color: #ECF86E;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 2;
  }
  
  .result-card.selected {
    border-color: #ECF86E;
    box-shadow: 0 6px 20px rgba(236, 248, 110, 0.4);
    background: #FAFFE8;
    z-index: 3;
    transform: scale(1.02);
  }
  
  .rank-badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    background: #000000;
    color: #FFFFFF;
    font-weight: 700;
    font-size: 0.9rem;
    padding: 0.4rem 0.7rem;
    border-radius: 8px;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  
  .card-image-placeholder {
    width: 100%;
    height: 180px;
    background: #EAF2FD;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
  }
  
  .card-image {
    width: 100%;
    height: 180px;
    background: #EAF2FD;
    overflow: hidden;
    position: relative;
  }
  
  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  
  .favorite-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    z-index: 100;
    pointer-events: auto;
    isolation: isolate;
  }
  
  .favorite-btn:hover {
    transform: scale(1.1);
  }
  
  .favorite-btn .heart-icon {
    width: 20px;
    height: 20px;
  }
  
  .favorite-btn .heart-path {
    fill: #999;
    transition: fill 0.2s ease;
  }
  
  .favorite-btn.active .heart-path {
    fill: #FF0000;
  }
  
  .favorite-btn:hover .heart-path {
    fill: #FF6B6B;
  }
  
  .favorite-btn.active {
    background: rgba(255, 0, 0, 0.1);
  }
  
  .card-info {
    padding: 1rem;
  }
  
  .card-meta {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }
  
  .time-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #F8FFCB;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #000;
  }
  
  .time-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  
  .price-badge {
    display: inline-block;
    background: #ECF86E;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #000;
  }
  
  .card-title {
    font-size: 1rem;
    font-weight: 600;
    color: #000;
    margin-bottom: 0.5rem;
    line-height: 1.3;
  }
  
  .card-location {
    font-size: 0.85rem;
    color: #666;
  }
  
  .no-results {
    text-align: center;
    padding: 4rem 0;
  }
  
  .post-task-btn {
    display: inline-block;
    background: #ECF86E;
    color: #000;
    padding: 1rem 2rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    margin-top: 1rem;
  }
  
  /* Right Panel: Map */
  .map-panel {
    background: #FFFFFF;
    border-left: 1px solid #EAF2FD;
    display: flex;
    flex-direction: column;
    height: 100%; /* Ensure fixed height */
    min-height: 0; /* Prevent flex item from expanding */
    overflow: hidden; /* Prevent overflow */
    position: relative; /* Positioning context for map-header */
  }
  
  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden; /* Prevent overflow issues */
    min-height: 0; /* Prevent flex item from expanding */
    flex: 1; /* Take up remaining space */
  }
  
  .leaflet-container {
    width: 100% !important;
    height: 100% !important;
    z-index: 1;
    position: relative; /* Ensure proper stacking context */
  }
  
  /* Ensure Leaflet zoom controls stay visible and fixed - HIGHEST PRIORITY */
  .leaflet-control-zoom {
    z-index: 1000 !important;
    position: absolute !important;
    top: 16px !important; /* Fixed pixel value instead of rem */
    right: 16px !important; /* Fixed pixel value instead of rem */
    margin: 0 !important;
    border: none !important;
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4) !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    transform: none !important;
    width: auto !important;
    height: auto !important;
  }
  
  .leaflet-control-zoom a {
    display: block !important;
    width: 34px !important;
    height: 34px !important;
    line-height: 34px !important;
    text-align: center !important;
    text-decoration: none !important;
    color: #333 !important;
    background: #fff !important;
    border-bottom: 1px solid #ccc !important;
    cursor: pointer !important;
    pointer-events: auto !important;
  }
  
  .leaflet-control-zoom a:hover {
    background: #f4f4f4 !important;
  }
  
  .leaflet-control-zoom-in,
  .leaflet-control-zoom-out {
    font: bold 18px/34px Arial, sans-serif !important;
  }
  
  .map-header {
    position: absolute !important;
    top: 16px !important; /* Fixed pixel value - relative to map-panel */
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 999 !important; /* Below zoom controls but above map */
    pointer-events: none !important;
    margin: 0 !important;
    padding: 0 !important;
    width: auto !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    /* Positioned relative to map-panel, NOT map-container - this prevents movement during zoom */
  }
  
  .search-area-btn {
    background: #000;
    color: #fff;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    pointer-events: auto; /* Allow clicking despite parent's pointer-events: none */
    white-space: nowrap;
    transition: all 0.2s ease;
    position: relative; /* Ensure button is positioned correctly */
  }
  
  .search-area-btn:hover {
    background: #333;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  
  .search-area-btn.active {
    background: #ECF86E;
    color: #000;
  }
  
  .search-area-btn.active:hover {
    background: #d4e55a;
  }
  
  
  /* Responsive */
  @media (max-width: 1200px) {
    .search-container {
      grid-template-columns: 250px 1fr 400px;
    }
  }
  
  @media (max-width: 900px) {
    .search-container {
      grid-template-columns: 1fr;
    }
    
    .map-panel {
      display: none;
    }
  }
</style>












