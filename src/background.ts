// background script for handling extension lifecycle and storage

// wordsninja implementation for browser extension
class WordSegmenter {
  private maxWordLen = 0;
  private wordCost: Record<string, number> = {};
  private maxCost = 9e999;
  private ready = false;

  async loadDictionary(): Promise<void> {
    try {
      const dictUrl = chrome.runtime.getURL('words-en.json');
      const response = await fetch(dictUrl);
      const words: string[] = await response.json();

      words.forEach((word, index) => {
        this.wordCost[word] = Math.log((index + 1) * Math.log(words.length));
        if (word.length > this.maxWordLen) {
          this.maxWordLen = word.length;
        }
        if (this.wordCost[word] < this.maxCost) {
          this.maxCost = this.wordCost[word];
        }
      });

      this.ready = true;
      console.log('[hardcover bg] word segmentation dictionary loaded');
    } catch (error) {
      console.error('[hardcover bg] failed to load dictionary:', error);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  splitSentence(text: string): string[] {
    const splitRegex = /[^a-zA-Z0-9']+/g;
    const parts = text.split(splitRegex);
    const result: string[] = [];

    for (const part of parts) {
      if (part) {
        result.push(...this.splitWords(part));
      }
    }

    return result;
  }

  private splitWords(s: string): string[] {
    const cost = [0];

    const bestMatch = (i: number): [number, number] => {
      let minPair: [number, number] = [Number.MAX_SAFE_INTEGER, 0];

      for (let k = 1; k <= Math.min(i, this.maxWordLen); k++) {
        const c = cost[i - k];
        const substr = s.substring(i - k, i).toLowerCase();
        let cCost: number;

        if (this.wordCost[substr]) {
          cCost = c + this.wordCost[substr];
        } else {
          cCost = Number.MAX_SAFE_INTEGER;
        }

        if (cCost < minPair[0]) {
          minPair = [cCost, k];
        }
      }

      return minPair;
    };

    for (let i = 1; i < s.length + 1; i++) {
      cost.push(bestMatch(i)[0]);
    }

    const out: string[] = [];
    let i = s.length;

    while (i > 0) {
      const k = bestMatch(i)[1];
      const token = s.slice(i - k, i);

      if (token !== "'") {
        out.push(token);
      }

      i -= k;
    }

    return out.reverse();
  }
}

const wordSegmenter = new WordSegmenter();

(async () => {
  await wordSegmenter.loadDictionary();
})();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[goodreads bg] extension installed');
    initializeSettings();
    initializeTheme();
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

      if (tab.url) {
        setTimeout(async () => {
          try {
            await extractPDFFilename(tabId, tab.url!);
          } catch (error) {
            console.error('[hardcover bg] failed to extract pdf metadata:', error);
          }
        }, 2000);
      }
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
      width: 220,
      height: 300,
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

async function toggleFloatingWindow() {
  if (floatingWindowId !== null) {
    try {
      await chrome.windows.remove(floatingWindowId);
      floatingWindowId = null;
      console.log('[goodreads bg] floating window closed via toggle');
    } catch (error) {
      console.error('[goodreads bg] failed to close floating window:', error);
      floatingWindowId = null;
    }
  } else {
    await openFloatingWindow();
  }
}

chrome.commands.onCommand.addListener((command) => {
  console.log('[goodreads bg] command received:', command);

  chrome.storage.sync.get(['keybindsEnabled'], (result) => {
    const enabled = result.keybindsEnabled !== false;

    if (!enabled) {
      console.log('[goodreads bg] keybinds disabled, ignoring command');
      return;
    }

    if (command === 'toggle-floating' || command === 'toggle-floating-alt') {
      toggleFloatingWindow();
    }
  });
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

  if (request.action === 'addBook') {
    addBookToLibrary(request.bookId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'removeBook') {
    removeBookFromLibrary(request.bookId)
      .then((success) => sendResponse({ success }))
      .catch(() => sendResponse({ success: false }));
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

function initializeTheme() {
  chrome.storage.local.get('theme', (data) => {
    if (data.theme === undefined) {
      chrome.storage.local.set({ theme: 'auto' }, () => {
        console.log('[hardcover bg] default theme set to auto');
      });
    }
  });
}

async function updateReadingProgress(bookId: string, currentPage: number, totalPages: number) {
  const progressData = {
    bookId,
    currentPage,
    totalPages,
    lastUpdated: new Date().toISOString(),
    percentComplete: Math.round((currentPage / totalPages) * 100),
  };

  console.log('[hardcover bg] updating progress:', progressData);

  chrome.storage.sync.set({ currentProgress: progressData }, () => {
    if (chrome.runtime.lastError) {
      console.error('[hardcover bg] failed to save progress:', chrome.runtime.lastError);
      return;
    }

    console.log('[hardcover bg] progress saved successfully');
  });

  await syncToHardcover(bookId, currentPage);
}

async function syncToHardcover(bookId: string, currentPage: number) {
  try {
    const result = await chrome.storage.sync.get(['hardcoverToken']);
    const token = result.hardcoverToken;

    if (!token) {
      console.log('[hardcover bg] no api token configured, skipping sync');
      return;
    }

    const checkQuery = `
      query CheckUserBook($bookId: Int!) {
        user_books(
          where: {
            book_id: {_eq: $bookId},
            status_id: {_eq: 2}
          },
          order_by: {id: desc},
          limit: 1
        ) {
          id
          status_id
        }
      }
    `;

    const checkResponse = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: checkQuery,
        variables: { bookId: parseInt(bookId) }
      })
    });

    const checkData = await checkResponse.json();

    if (checkData.errors) {
      console.error('[hardcover bg] api error checking user book:', checkData.errors);
      return;
    }

    if (!checkData.data.user_books || checkData.data.user_books.length === 0) {
      console.log('[hardcover bg] book not in library, skipping sync');
      return;
    }

    const userBookId = checkData.data.user_books[0].id;
    let existingReadId: number | null = null;

    const getReadQuery = `
      query GetUserBookRead($userBookId: Int!) {
        user_book_reads(
          where: {user_book_id: {_eq: $userBookId}},
          order_by: {id: desc},
          limit: 1
        ) {
          id
        }
      }
    `;

    const readResponse = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: getReadQuery,
        variables: { userBookId: userBookId }
      })
    });

    const readData = await readResponse.json();

    if (readData.errors) {
      console.error('[hardcover bg] failed to get read record:', readData.errors);
      return;
    }

    if (readData.data?.user_book_reads?.length > 0) {
      existingReadId = readData.data.user_book_reads[0].id;
    }

    const datesRead = existingReadId
      ? [{ id: existingReadId, progress_pages: currentPage }]
      : [{ progress_pages: currentPage }];

    console.log('[hardcover bg] datesRead:', datesRead);
    const progressMutation = `
      mutation UpdateProgress($userBookId: Int!, $datesRead: [DatesReadInput!]!) {
        upsert_user_book_reads(
          user_book_id: $userBookId,
          datesRead: $datesRead
        ) {
          user_book_id
          error
        }
      }
    `;

    const progressResponse = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: progressMutation,
        variables: {
          userBookId: userBookId,
          datesRead: datesRead
        }
      })
    });

    const progressData = await progressResponse.json();

    if (progressData.errors) {
      console.error('[hardcover bg] failed to update progress:', progressData.errors);
      return;
    }

    if (progressData.data?.upsert_user_book_reads?.error) {
      console.error('[hardcover bg] api returned error:', progressData.data.upsert_user_book_reads.error);
      return;
    }

    console.log('[hardcover bg] progress synced successfully to hardcover');

  } catch (error) {
    console.error('[hardcover bg] sync failed:', error);
  }
}

async function addBookToLibrary(bookId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await chrome.storage.sync.get(['hardcoverToken']);
    const token = result.hardcoverToken;

    if (!token) {
      console.log('[hardcover bg] no api token, cannot add book');
      return { success: false, error: 'no api token' };
    }

    console.log('[hardcover bg] adding book to library (try insert):', bookId);

    const insertMutation = `
      mutation AddBook($bookId: Int!) {
        insert_user_book(object: {
          book_id: $bookId,
          status_id: 2
        }) {
          id
        }
      }
    `;

    const insertResponse = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: insertMutation,
        variables: { bookId: parseInt(bookId) }
      })
    });

    const insertData = await insertResponse.json();

    if (!insertData.errors) {
      console.log('[hardcover bg] insert successful:', insertData.data);
      return { success: true };
    }

    console.warn('[hardcover bg] insert failed, trying update:', insertData.errors);

    // fallback: check if book exists and update
    const checkQuery = `
      query CheckUserBook($bookId: Int!) {
        user_books(
          where: {
            book_id: {_eq: $bookId}
          },
          limit: 1
        ) {
          id
          status_id
        }
      }
    `;

    const checkResponse = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: checkQuery,
        variables: { bookId: parseInt(bookId) }
      })
    });

    const checkData = await checkResponse.json();

    if (checkData.data?.user_books && checkData.data.user_books.length > 0) {
      const userBookId = checkData.data.user_books[0].id;
      console.log('[hardcover bg] found existing book, updating status:', userBookId);

      const updateMutation = `
        mutation UpdateUserBookStatus($id: Int!) {
          update_user_book(
            id: $id,
            object: { status_id: 2 }
          ) {
            id
          }
        }
      `;

      const updateResponse = await fetch('https://api.hardcover.app/v1/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: updateMutation,
          variables: { id: userBookId }
        })
      });

      const updateData = await updateResponse.json();

      if (!updateData.errors) {
        console.log('[hardcover bg] update successful');
        return { success: true };
      }
      
      return { success: false, error: 'update failed: ' + updateData.errors[0]?.message };
    }

    return { success: false, error: 'insert failed: ' + insertData.errors[0]?.message };

  } catch (error) {
    console.error('[hardcover bg] error adding book:', error);
    return { success: false, error: 'network error' };
  }
}

async function removeBookFromLibrary(bookId: string): Promise<boolean> {
  try {
    const result = await chrome.storage.sync.get(['hardcoverToken']);
    const token = result.hardcoverToken;

    if (!token) {
      console.log('[hardcover bg] no api token, cannot remove book');
      return false;
    }

    console.log('[hardcover bg] removing book from library:', bookId);

    const checkQuery = `
      query GetUserBookId($bookId: Int!) {
        user_books(
          where: {
            book_id: {_eq: $bookId}
          }
        ) {
          id
        }
      }
    `;

    const checkResponse = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: checkQuery,
        variables: { bookId: parseInt(bookId) }
      })
    });

    const checkData = await checkResponse.json();

    if (checkData.errors || !checkData.data.user_books || checkData.data.user_books.length === 0) {
      console.error('[hardcover bg] failed to find user book to delete');
      return false;
    }

    const userBooks = checkData.data.user_books;
    console.log('[hardcover bg] found user_books to delete:', userBooks);

    const deleteMutation = `
      mutation DeleteUserBook($id: Int!) {
        delete_user_book(id: $id) {
          id
        }
      }
    `;

    const deletePromises = userBooks.map((ub: any) => {
      return fetch('https://api.hardcover.app/v1/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: deleteMutation,
          variables: { id: ub.id }
        })
      }).then(res => res.json());
    });

    const results = await Promise.all(deletePromises);
    console.log('[hardcover bg] delete results:', results);

    const hasErrors = results.some(r => r.errors);
    if (hasErrors) {
      console.error('[hardcover bg] some deletions failed');
      return true;
    }

    return true;
  } catch (error) {
    console.error('[hardcover bg] error removing book:', error);
    return false;
  }
}

async function extractPDFFilename(tabId: number, url: string) {
  try {
    console.log('[hardcover bg] extracting title from pdf filename:', url);

    let metadata: { title?: string | null } | null = null;
    const filename = url.substring(url.lastIndexOf('/') + 1);
    let cleanName = decodeURIComponent(filename)
      .replace(/\.pdf$/i, '')
      .replace(/%20/g, ' ');

    const isbn13Match = cleanName.match(/\b(97[89]\d{10})\b/);
    const isbn10Match = cleanName.match(/\b(\d{9}[\dXx])\b/);

    if (isbn13Match) {
      metadata = { title: isbn13Match[1] };
      console.log('[hardcover bg] extracted ISBN-13 from filename:', metadata);
    } else if (isbn10Match) {
      metadata = { title: isbn10Match[1] };
      console.log('[hardcover bg] extracted ISBN-10 from filename:', metadata);
    } else {
      if (cleanName.includes(' -- ')) {
        cleanName = cleanName.split(' -- ')[0];
      } else if (cleanName.includes('--')) {
        cleanName = cleanName.split('--')[0];
      }

      cleanName = cleanName.replace(/\b[a-f0-9]{32,}\b/gi, '');

      cleanName = cleanName.replace(/Anna'?s Archive/gi, '');
      cleanName = cleanName.replace(/Library Genesis/gi, '');
      cleanName = cleanName.replace(/LibGen/gi, '');
      cleanName = cleanName.replace(/Z-Library/gi, '');

      cleanName = cleanName
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (wordSegmenter.isReady() && cleanName && !cleanName.includes(' ') && cleanName.length > 10) {
        try {
          const segmented = wordSegmenter.splitSentence(cleanName);
          if (segmented && segmented.length > 1) {
            cleanName = segmented.join(' ');
            console.log('[hardcover bg] split concatenated title:', cleanName);
          }
        } catch (error) {
          console.log('[hardcover bg] word splitting failed, using original:', error);
        }
      }

      if (cleanName && cleanName.length > 3) {
        metadata = { title: cleanName };
        console.log('[hardcover bg] extracted title from filename:', metadata);
      }
    }

    if (metadata && metadata.title) {
      console.log('[hardcover bg] saving pdf filename to storage:', metadata);
      await chrome.storage.local.set({ pdfMetadata: metadata });
    } else {
      console.log('[hardcover bg] could not extract title from filename');
    }
  } catch (error) {
    console.error('[hardcover bg] error extracting filename:', error);
  }
}
