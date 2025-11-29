// settings page script for api token configuration

(function() {
  let apiTokenInput: HTMLTextAreaElement;
  let saveTokenBtn: HTMLElement;
  let testTokenBtn: HTMLElement;
  let statusMessage: HTMLElement;
  let enableKeybindsCheckbox: HTMLInputElement;
  let themeRadios: NodeListOf<HTMLInputElement>;

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[hardcover settings] initializing settings page');

    apiTokenInput = document.getElementById('api-token') as HTMLTextAreaElement;
    saveTokenBtn = document.getElementById('save-token-btn')!;
    testTokenBtn = document.getElementById('test-token-btn')!;
    statusMessage = document.getElementById('status-message')!;
    enableKeybindsCheckbox = document.getElementById('enable-keybinds') as HTMLInputElement;
    themeRadios = document.querySelectorAll('input[name="theme"]');

    saveTokenBtn.addEventListener('click', handleSaveToken);
    testTokenBtn.addEventListener('click', handleTestToken);
    enableKeybindsCheckbox.addEventListener('change', handleKeybindsToggle);

    themeRadios.forEach(radio => {
      radio.addEventListener('change', handleThemeChange);
    });

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

  function loadThemePreference() {
    console.log('[hardcover settings] loading theme preference');

    chrome.storage.local.get(['theme'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[hardcover settings] storage error:', chrome.runtime.lastError);
        return;
      }

      // default to auto if not set
      const theme = result.theme || 'auto';
      const radioToCheck = document.getElementById(`theme-${theme}`) as HTMLInputElement;
      if (radioToCheck) {
        radioToCheck.checked = true;
      }
      console.log('[hardcover settings] theme preference loaded:', theme);
    });
  }

  function handleThemeChange() {
    const selectedTheme = Array.from(themeRadios).find(radio => radio.checked)?.value || 'auto';
    console.log('[hardcover settings] theme changed to:', selectedTheme);

    chrome.storage.local.set({ theme: selectedTheme }, () => {
      if (chrome.runtime.lastError) {
        console.error('[hardcover settings] failed to save theme:', chrome.runtime.lastError);
        showStatus('failed to save theme preference', 'error');
        return;
      }

      console.log('[hardcover settings] theme preference saved');
      applyTheme();
      showStatus('theme updated', 'success');
    });
  }

  function applyTheme() {
    chrome.storage.local.get(['theme'], (result) => {
      const theme = result.theme || 'auto';
      console.log('[hardcover settings] applying theme:', theme);

      if (theme === 'auto') {
        // check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    });
  }

  // listen for storage changes to update theme in real-time
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.theme) {
      console.log('[hardcover settings] theme changed in storage, reapplying');
      applyTheme();
    }
  });

  // listen for system theme changes when in auto mode
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
