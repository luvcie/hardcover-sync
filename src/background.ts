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

      // user can open floating window from popup
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
