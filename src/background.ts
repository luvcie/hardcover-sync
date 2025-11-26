// background script for handling extension lifecycle and storage

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[goodreads bg] extension installed');
    initializeSettings();
  }
});

let floatingWindowId: number | null = null;

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isPDF = tab.url.toLowerCase().endsWith('.pdf') ||
                  tab.url.toLowerCase().includes('.pdf?') ||
                  tab.url.includes('pdfjs.action=');

    if (isPDF) {
      console.log('[goodreads bg] pdf detected:', tab.url);

      try {
        await chrome.action.setBadgeText({ tabId: tabId, text: 'PDF' });
        await chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#382115' });
        console.log('[goodreads bg] badge set for pdf tab');
      } catch (error) {
        console.error('[goodreads bg] failed to set badge:', error);
      }

      // don't automatically open floating window anymore - user can click button in popup to open it
    } else {
      try {
        await chrome.action.setBadgeText({ tabId: tabId, text: '' });
      } catch (error) {
        // ignore
      }
    }
  }
});

async function openFloatingWindow() {
  try {
    if (floatingWindowId !== null) {
      try {
        const existingWindow = await chrome.windows.get(floatingWindowId);
        if (existingWindow) {
          await chrome.windows.update(floatingWindowId, { focused: true });
          console.log('[goodreads bg] floating window already open, focusing');
          return;
        }
      } catch (error) {
        floatingWindowId = null;
      }
    }

    const window = await chrome.windows.create({
      url: 'floating.html',
      type: 'popup',
      width: 350,
      height: 600,
      top: 100,
      left: 100,
    });

    floatingWindowId = window.id!;
    console.log('[goodreads bg] floating window created:', floatingWindowId);
  } catch (error) {
    console.error('[goodreads bg] failed to create floating window:', error);
  }
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === floatingWindowId) {
    console.log('[goodreads bg] floating window closed');
    floatingWindowId = null;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openFloatingWindow') {
    openFloatingWindow();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'closeFloatingWindow') {
    if (floatingWindowId !== null) {
      chrome.windows.remove(floatingWindowId).then(() => {
        floatingWindowId = null;
        sendResponse({ success: true });
      }).catch((error) => {
        console.error('[goodreads bg] failed to close window:', error);
        floatingWindowId = null;
        sendResponse({ success: false });
      });
      return true;
    }
    sendResponse({ success: false });
    return true;
  }

  if (request.action === 'getCurrentBook') {
    chrome.storage.sync.get(['currentBook'], (result) => {
      sendResponse({ book: result.currentBook || null });
    });
    return true;
  }

  if (request.action === 'updateProgress') {
    updateReadingProgress(request.bookId, request.page, request.totalPages);
    sendResponse({ success: true });
    return true;
  }
});

function initializeSettings() {
  chrome.storage.sync.get(['settings'], (result) => {
    if (!result.settings) {
      const defaultSettings = {
        autoUpdate: false,
        showNotifications: true,
        buttonPosition: 'bottom-right',
      };

      chrome.storage.sync.set({ settings: defaultSettings }, () => {
        if (chrome.runtime.lastError) {
          console.error('[goodreads bg] failed to initialize settings:', chrome.runtime.lastError);
          return;
        }

        console.log('[goodreads bg] default settings initialized');
      });
    } else {
      console.log('[goodreads bg] settings already exist');
    }
  });
}

function updateReadingProgress(bookId: string, currentPage: number, totalPages: number) {
  const progressData = {
    bookId,
    currentPage,
    totalPages,
    lastUpdated: new Date().toISOString(),
    percentComplete: Math.round((currentPage / totalPages) * 100),
  };

  console.log('[goodreads bg] updating progress:', progressData);

  chrome.storage.sync.set({ currentProgress: progressData }, () => {
    if (chrome.runtime.lastError) {
      console.error('[goodreads bg] failed to save progress:', chrome.runtime.lastError);
      return;
    }

    console.log('[goodreads bg] progress saved successfully');

    // todo: sync to goodreads api
    // syncToGoodreads(progressData);
  });
}

// future: sync progress to goodreads
// function syncToGoodreads(progressData) {
//   // implement goodreads api integration
// }
