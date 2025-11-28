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
      const candidates = cost.slice(Math.max(0, i - this.maxWordLen), i).reverse();
      let minPair: [number, number] = [Number.MAX_SAFE_INTEGER, 0];

      candidates.forEach((c, k) => {
        const substr = s.substring(i - k - 1, i).toLowerCase();
        let cCost: number;

        if (this.wordCost[substr]) {
          cCost = c + this.wordCost[substr];
        } else {
          cCost = Number.MAX_SAFE_INTEGER;
        }

        if (cCost < minPair[0]) {
          minPair = [cCost, k + 1];
        }
      });

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

// initialize word segmentation dictionary
(async () => {
  await wordSegmenter.loadDictionary();
})();

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

      // wait a bit for pdf to load, then extract metadata
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

  // sync to hardcover api
  await syncToHardcover(bookId, currentPage);
}

async function syncToHardcover(bookId: string, currentPage: number) {
  try {
    // get api token from storage
    const result = await chrome.storage.sync.get(['hardcoverToken']);
    const token = result.hardcoverToken;

    if (!token) {
      console.log('[hardcover bg] no api token configured, skipping sync');
      return;
    }

    // check if user has this book with status "currently reading"
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

    console.log('[hardcover bg] check response:', checkData);

    if (checkData.errors) {
      console.error('[hardcover bg] api error checking user book:', checkData.errors);
      return;
    }

    let userBookId: number;

    if (!checkData.data.user_books || checkData.data.user_books.length === 0) {
      // add book to library
      console.log('[hardcover bg] book not in library, adding it');

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

      console.log('[hardcover bg] insert response:', insertData);

      if (insertData.errors) {
        console.error('[hardcover bg] failed to add book:', insertData.errors);
        return;
      }

      userBookId = insertData.data.insert_user_book.id;
      console.log('[hardcover bg] book added with user_book_id:', userBookId);
    } else {
      userBookId = checkData.data.user_books[0].id;
      console.log('[hardcover bg] book found with user_book_id:', userBookId);
    }

    // get existing read record to update it
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

    // include existing record id to update it, otherwise create new
    const existingRead = readData.data?.user_book_reads?.[0];
    const datesRead = existingRead
      ? [{ id: existingRead.id, progress_pages: currentPage }]
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
    console.log('[hardcover bg] response:', progressData.data);

  } catch (error) {
    console.error('[hardcover bg] sync failed:', error);
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

    // first, try to extract ISBN (best for exact matches)
    // ISBN-13: 13 digits starting with 978 or 979
    const isbn13Match = cleanName.match(/\b(97[89]\d{10})\b/);
    // ISBN-10: 9 digits + check digit (0-9 or X)
    const isbn10Match = cleanName.match(/\b(\d{9}[\dXx])\b/);

    if (isbn13Match) {
      metadata = { title: isbn13Match[1] };
      console.log('[hardcover bg] extracted ISBN-13 from filename:', metadata);
    } else if (isbn10Match) {
      metadata = { title: isbn10Match[1] };
      console.log('[hardcover bg] extracted ISBN-10 from filename:', metadata);
    } else {
      // no ISBN found, fall back to cleaning the title
      // split on common delimiters that separate title from metadata
      if (cleanName.includes(' -- ')) {
        cleanName = cleanName.split(' -- ')[0];
      } else if (cleanName.includes('--')) {
        cleanName = cleanName.split('--')[0];
      }

      // remove common metadata patterns
      // hex hashes (common in archive downloads)
      cleanName = cleanName.replace(/\b[a-f0-9]{32,}\b/gi, '');

      // common download sources
      cleanName = cleanName.replace(/Anna'?s Archive/gi, '');
      cleanName = cleanName.replace(/Library Genesis/gi, '');
      cleanName = cleanName.replace(/LibGen/gi, '');
      cleanName = cleanName.replace(/Z-Library/gi, '');

      // normalize spacing and underscores
      cleanName = cleanName
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // if it's a single concatenated word with no spaces, try to split it
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
