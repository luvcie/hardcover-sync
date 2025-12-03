// settings page script for api token configuration

(function() {
  let apiTokenInput: HTMLTextAreaElement;
  let saveTokenBtn: HTMLElement;
  let testTokenBtn: HTMLElement;
  let statusMessage: HTMLElement;
  let enableKeybindsCheckbox: HTMLInputElement;
  
  // Theme elements
  let themeModeRadios: NodeListOf<HTMLInputElement>;
  let themeCategorySelect: HTMLSelectElement;
  let customThemeSelect: HTMLSelectElement;

  const themeCategories = {
    'dark-vibrant': [
      { value: 'dracula', label: 'dracula' },
      { value: 'gruvbox', label: 'gruvbox dark' },
      { value: 'solarized-dark', label: 'solarized dark' },
      { value: 'tokyo-night', label: 'tokyo night' },
      { value: 'monokai', label: 'monokai' },
      { value: 'one-dark', label: 'one dark' },
      { value: 'synthwave', label: "synthwave '84" },
      { value: 'terminal', label: 'terminal' }
    ],
    'dark-soft': [
      { value: 'catppuccin', label: 'catppuccin mocha' },
      { value: 'catppuccin-macchiato', label: 'catppuccin macchiato' },
      { value: 'catppuccin-frappe', label: 'catppuccin frappe' },
      { value: 'rose-pine', label: 'rosé pine' },
      { value: 'rose-pine-moon', label: 'rosé pine moon' },
      { value: 'nord', label: 'nord' },
      { value: 'kanagawa', label: 'kanagawa' },
      { value: 'everforest', label: 'everforest' }
    ],
    'light': [
      { value: 'catppuccin-latte', label: 'catppuccin latte' },
      { value: 'gruvbox-light', label: 'gruvbox light' },
      { value: 'rose-pine-dawn', label: 'rosé pine dawn' },
      { value: 'solarized-light', label: 'solarized light' }
    ],
    'retro-classic': [
      { value: 'classic-cherry', label: 'classic cherry' },
      { value: 'classic-gleep', label: 'classic gleep' },
      { value: 'classic-indigo', label: 'classic indigo' },
      { value: 'classic-platinum', label: 'classic platinum' },
      { value: 'classic-yorha', label: 'classic yorha' }
    ]
  };

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[hardcover settings] initializing settings page');

    apiTokenInput = document.getElementById('api-token') as HTMLTextAreaElement;
    saveTokenBtn = document.getElementById('save-token-btn')!;
    testTokenBtn = document.getElementById('test-token-btn')!;
    statusMessage = document.getElementById('status-message')!;
    enableKeybindsCheckbox = document.getElementById('enable-keybinds') as HTMLInputElement;
    
    themeModeRadios = document.querySelectorAll('input[name="theme-mode"]');
    themeCategorySelect = document.getElementById('theme-category') as HTMLSelectElement;
    customThemeSelect = document.getElementById('custom-theme-select') as HTMLSelectElement;

    saveTokenBtn.addEventListener('click', handleSaveToken);
    testTokenBtn.addEventListener('click', handleTestToken);
    enableKeybindsCheckbox.addEventListener('change', handleKeybindsToggle);

    themeModeRadios.forEach(radio => {
      radio.addEventListener('change', handleThemeModeChange);
    });
    themeCategorySelect.addEventListener('change', handleCategoryChange);
    customThemeSelect.addEventListener('change', handleCustomThemeChange);

    loadToken();
    loadKeybindsPreference();
    loadThemePreference();
    applyTheme();
  });

  function loadToken() {
    console.log('[hardcover settings] loading token from storage');

    chrome.storage.sync.get(['hardcoverToken'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[hardcover settings] storage error:', chrome.runtime.lastError);
        return;
      }

      if (result.hardcoverToken) {
        console.log('[hardcover settings] token found');
        apiTokenInput.value = result.hardcoverToken;
        showStatus('token loaded', 'success');
      } else {
        console.log('[hardcover settings] no token found');
      }
    });
  }

  function handleSaveToken() {
    const token = apiTokenInput.value.trim();

    if (!token) {
      showStatus('please enter a token', 'error');
      return;
    }

    console.log('[hardcover settings] saving token');

    chrome.storage.sync.set({ hardcoverToken: token }, () => {
      if (chrome.runtime.lastError) {
        console.error('[hardcover settings] failed to save token:', chrome.runtime.lastError);
        showStatus('failed to save token', 'error');
        return;
      }

      console.log('[hardcover settings] token saved successfully');
      showStatus('token saved successfully', 'success');
    });
  }

  async function handleTestToken() {
    const token = apiTokenInput.value.trim();

    if (!token) {
      showStatus('please enter a token first', 'error');
      return;
    }

    showStatus('testing connection...', 'info');

    try {
      const response = await fetch('https://api.hardcover.app/v1/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: `
            query Test {
              me {
                username
              }
            }
          `
        })
      });

      const data = await response.json();

      console.log('[hardcover settings] full api response:', JSON.stringify(data, null, 2));

      // me is an array, get first element
      if (data.errors) {
        console.error('[hardcover settings] api error:', data.errors);
        showStatus('token is invalid or expired', 'error');
        return;
      }

      if (data.data && data.data.me) {
        console.log('[hardcover settings] me object:', JSON.stringify(data.data.me, null, 2));

        const meData = Array.isArray(data.data.me) ? data.data.me[0] : data.data.me;
        const identifier = meData?.username || meData?.name || meData?.id || 'user';
        console.log('[hardcover settings] token is valid, identifier:', identifier);
        showStatus(`connected as ${identifier}`, 'success');
      } else {
        console.error('[hardcover settings] unexpected response structure');
        showStatus('unexpected response from api', 'error');
      }
    } catch (error) {
      console.error('[hardcover settings] test failed:', error);
      showStatus('failed to connect to hardcover api', 'error');
    }
  }

  function loadKeybindsPreference() {
    console.log('[hardcover settings] loading keybinds preference');

    chrome.storage.sync.get(['keybindsEnabled'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[hardcover settings] storage error:', chrome.runtime.lastError);
        return;
      }

      // default to true if not set
      const enabled = result.keybindsEnabled !== false;
      enableKeybindsCheckbox.checked = enabled;
      console.log('[hardcover settings] keybinds enabled:', enabled);
    });
  }

  function handleKeybindsToggle() {
    const enabled = enableKeybindsCheckbox.checked;
    console.log('[hardcover settings] keybinds toggled to:', enabled);

    chrome.storage.sync.set({ keybindsEnabled: enabled }, () => {
      if (chrome.runtime.lastError) {
        console.error('[hardcover settings] failed to save preference:', chrome.runtime.lastError);
        showStatus('failed to save preference', 'error');
        return;
      }

      console.log('[hardcover settings] keybinds preference saved');
      showStatus(
        enabled ? 'keyboard shortcuts enabled' : 'keyboard shortcuts disabled',
        'success'
      );
    });
  }

  function populateThemeSelect(category: string) {
    customThemeSelect.innerHTML = '';
    
    let options = [];
    if (category === 'all') {
      options = [
        ...themeCategories['dark-vibrant'],
        ...themeCategories['dark-soft'],
        ...themeCategories['light'],
        ...themeCategories['retro-classic']
      ];
    } else {
      options = themeCategories[category as keyof typeof themeCategories] || [];
    }

    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      customThemeSelect.appendChild(option);
    });
  }

  function loadThemePreference() {
    console.log('[hardcover settings] loading theme preference');

    chrome.storage.local.get(['theme'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[hardcover settings] storage error:', chrome.runtime.lastError);
        return;
      }

      // default to auto if not set
      const theme = result.theme || 'auto';
      
      // Check if it's one of the standard themes
      const isStandard = ['auto', 'light', 'dark'].includes(theme);

      if (isStandard) {
        const radio = document.getElementById(`theme-mode-${theme}`) as HTMLInputElement;
        if (radio) radio.checked = true;
        themeCategorySelect.disabled = true;
        customThemeSelect.disabled = true;
        // Populate default
        populateThemeSelect('all'); 
      } else {
        const customRadio = document.getElementById('theme-mode-custom') as HTMLInputElement;
        if (customRadio) customRadio.checked = true;
        themeCategorySelect.disabled = false;
        customThemeSelect.disabled = false;

        // Find category
        let foundCategory = 'all';
        for (const [cat, themes] of Object.entries(themeCategories)) {
          if (themes.some(t => t.value === theme)) {
            foundCategory = cat;
            break;
          }
        }
        
        themeCategorySelect.value = foundCategory;
        populateThemeSelect(foundCategory);
        customThemeSelect.value = theme;
      }

      console.log('[hardcover settings] theme preference loaded:', theme);
    });
  }

  function handleThemeModeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const mode = target.value;
    
    console.log('[hardcover settings] theme mode changed to:', mode);

    if (mode === 'custom') {
      themeCategorySelect.disabled = false;
      customThemeSelect.disabled = false;
      // If first time switching to custom, load default list and select first
      if (customThemeSelect.options.length === 0) {
        populateThemeSelect('all');
      }
      saveTheme(customThemeSelect.value);
    } else {
      themeCategorySelect.disabled = true;
      customThemeSelect.disabled = true;
      saveTheme(mode);
    }
  }

  function handleCategoryChange() {
    const category = themeCategorySelect.value;
    populateThemeSelect(category);
    // Auto-select first theme in new category
    if (customThemeSelect.options.length > 0) {
        customThemeSelect.selectedIndex = 0;
        handleCustomThemeChange();
    }
  }

  function handleCustomThemeChange() {
    const selectedTheme = customThemeSelect.value;
    console.log('[hardcover settings] custom theme changed to:', selectedTheme);
    
    const customRadio = document.getElementById('theme-mode-custom') as HTMLInputElement;
    if (customRadio && !customRadio.checked) {
      customRadio.checked = true;
    }

    saveTheme(selectedTheme);
  }

  function saveTheme(theme: string) {
    chrome.storage.local.set({ theme: theme }, () => {
      if (chrome.runtime.lastError) {
        console.error('[hardcover settings] failed to save theme:', chrome.runtime.lastError);
        showStatus('failed to save theme preference', 'error');
        return;
      }

      console.log('[hardcover settings] theme preference saved:', theme);
      applyTheme();
      showStatus('theme updated', 'success');
    });
  }

  function applyTheme() {
    chrome.storage.local.get(['theme'], (result) => {
      const theme = result.theme || 'auto';
      console.log('[hardcover settings] applying theme:', theme);

      if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.theme) {
      console.log('[hardcover settings] theme changed in storage, reapplying');
      applyTheme();
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chrome.storage.local.get(['theme'], (result) => {
      if (result.theme === 'auto' || !result.theme) {
        console.log('[hardcover settings] system theme changed, reapplying');
        applyTheme();
      }
    });
  });

  function showStatus(message: string, type: 'success' | 'error' | 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');

    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 5000);
  }
})();