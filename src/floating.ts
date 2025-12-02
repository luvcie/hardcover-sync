// sidebar script for the extension sidebar ui

(function() {
  interface Book {
    id: string;
    title: string;
    author: string;
    totalPages: number;
    coverUrl?: string;
    imageUrl?: string;
    cachedImage?: string;
  }

  interface Progress {
    bookId: string;
    currentPage: number;
    totalPages: number;
    lastUpdated: string;
    percentComplete: number;
  }

  interface BookStatus {
    inLibrary: boolean;
    progressPage: number | null;
  }

  let currentBookSection: HTMLElement;
  let selectBookSection: HTMLElement;
  let bookTitleEl: HTMLElement;
  let bookAuthorEl: HTMLElement;
  let currentPageInput: HTMLInputElement;
  let totalPagesDisplay: HTMLElement;
  let pageLabel: HTMLElement;
  let addText: HTMLElement;
  let updateBtn: HTMLElement;
  let addBookBtn: HTMLElement;
  let removeBookBtn: HTMLElement;
  let changeBookBtn: HTMLElement;
  let bookSearchInput: HTMLInputElement;
  let searchBtn: HTMLElement;
  let searchResults: HTMLElement;
  let statusMessage: HTMLElement;
  let keybindsEnabled = true;

document.addEventListener('DOMContentLoaded', async () => {
  currentBookSection = document.getElementById('current-book-section')!;
  selectBookSection = document.getElementById('select-book-section')!;
  bookTitleEl = document.getElementById('book-title')!;
  bookAuthorEl = document.getElementById('book-author')!;
  currentPageInput = document.getElementById('current-page') as HTMLInputElement;
  totalPagesDisplay = document.getElementById('total-pages-display')!;
  pageLabel = document.getElementById('page-label')!;
  addText = document.getElementById('add-text')!;
  updateBtn = document.getElementById('update-btn')!;
  addBookBtn = document.getElementById('add-book-btn')!;
  removeBookBtn = document.getElementById('remove-book-btn')!;
  changeBookBtn = document.getElementById('change-book-btn')!;
  bookSearchInput = document.getElementById('book-search') as HTMLInputElement;
  searchBtn = document.getElementById('search-btn')!;
  searchResults = document.getElementById('search-results')!;
  statusMessage = document.getElementById('status-message')!;

  chrome.storage.sync.get(['keybindsEnabled'], (result) => {
    keybindsEnabled = result.keybindsEnabled !== false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.keybindsEnabled) {
      keybindsEnabled = changes.keybindsEnabled.newValue !== false;
      console.log('[goodreads sidebar] keybinds preference updated:', keybindsEnabled);
    }
  });

  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'closeFloatingWindow' }, () => {
        window.close();
      });
    });
  }

  updateBtn.addEventListener('click', handleUpdateProgress);
  addBookBtn.addEventListener('click', handleAddBook);
  removeBookBtn.addEventListener('click', handleRemoveBook);
  changeBookBtn.addEventListener('click', showBookSelection);
  searchBtn.addEventListener('click', handleSearch);
  bookSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  currentPageInput.addEventListener('keydown', (e) => {
    if (!keybindsEnabled) {
      return; 
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentValue = parseInt(currentPageInput.value) || 0;
      currentPageInput.value = (currentValue + 1).toString();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentValue = parseInt(currentPageInput.value) || 0;
      if (currentValue > 0) {
        currentPageInput.value = (currentValue - 1).toString();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!addBookBtn.classList.contains('hidden')) {
        handleAddBook();
      } else {
        handleUpdateProgress();
      }
    }
  });

  setTimeout(() => {
    currentPageInput.focus();
  }, 100);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    const isPDF = tab.url.toLowerCase().endsWith('.pdf') ||
                  tab.url.toLowerCase().includes('.pdf?') ||
                  tab.url.includes('pdfjs.action=');

    if (isPDF) {
      console.log('[goodreads sidebar] opened on pdf page:', tab.url);
      const pdfIndicator = document.getElementById('pdf-indicator');
      if (pdfIndicator) {
        pdfIndicator.classList.remove('hidden');
      }
    }
  }

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, updatedTab) => {
    if (changeInfo.status === 'complete' && updatedTab.url) {
      const isPDF = updatedTab.url.toLowerCase().endsWith('.pdf') ||
                    updatedTab.url.toLowerCase().includes('.pdf?') ||
                    updatedTab.url.includes('pdfjs.action=');

      const pdfIndicator = document.getElementById('pdf-indicator');
      if (pdfIndicator) {
        if (isPDF) {
          pdfIndicator.classList.remove('hidden');
        } else {
          pdfIndicator.classList.add('hidden');
        }
      }
    }
  });

  loadCurrentBook();
  applyTheme();

  chrome.storage.local.get(['pdfMetadata'], (result) => {
    if (result.pdfMetadata && (result.pdfMetadata.title || result.pdfMetadata.author)) {
      console.log('[goodreads sidebar] found pdf metadata:', result.pdfMetadata);

      chrome.storage.sync.get(['currentBook'], (bookResult) => {
        if (!bookResult.currentBook) {
          const searchTerm = result.pdfMetadata.title || result.pdfMetadata.author || '';
          if (searchTerm) {
            bookSearchInput.value = searchTerm;
            showStatus('detected from pdf: ' + searchTerm, 'info');
          }
        }
      });
    }
  });
});

async function loadCurrentBook() {
  console.log('[goodreads sidebar] loading current book from storage');

  chrome.storage.sync.get(['currentBook'], async (result) => {
    if (chrome.runtime.lastError) {
      console.error('[goodreads sidebar] storage error:', chrome.runtime.lastError);
      showBookSelection();
      return;
    }

    console.log('[goodreads sidebar] storage result:', result);

    if (result.currentBook) {
      console.log('[goodreads sidebar] found current book:', result.currentBook);

      const status = await fetchCurrentProgress(result.currentBook.id);
      console.log('[goodreads sidebar] fetched status from hardcover:', status);

      showCurrentBook(result.currentBook, status);
    } else {
      console.log('[goodreads sidebar] no current book found');
      showBookSelection();
    }
  });
}

function showCurrentBook(book: Book, status: BookStatus | null) {
  currentBookSection.classList.remove('hidden');
  selectBookSection.classList.add('hidden');

  bookTitleEl.textContent = book.title;
  bookAuthorEl.textContent = book.author;
  totalPagesDisplay.textContent = `/ ${book.totalPages}`;

  if (status) {
    if (status.progressPage !== null) {
      currentPageInput.value = status.progressPage.toString();
    }
    
    if (status.inLibrary) {
      addBookBtn.classList.add('hidden');
      removeBookBtn.classList.remove('hidden');
      updateBtn.classList.remove('hidden');
      currentPageInput.classList.remove('hidden');
      totalPagesDisplay.classList.remove('hidden');
      pageLabel.classList.remove('hidden');
      addText.classList.add('hidden');
    } else {
      addBookBtn.classList.remove('hidden');
      removeBookBtn.classList.add('hidden');
      updateBtn.classList.add('hidden');
      currentPageInput.classList.add('hidden');
      totalPagesDisplay.classList.add('hidden');
      pageLabel.classList.add('hidden');
      addText.classList.remove('hidden');
      showStatus('book not in library. click + to add.', 'info');
    }
  } else {
    addBookBtn.classList.remove('hidden');
    removeBookBtn.classList.add('hidden');
    updateBtn.classList.add('hidden');
    currentPageInput.classList.add('hidden');
    totalPagesDisplay.classList.add('hidden');
    pageLabel.classList.add('hidden');
    addText.classList.remove('hidden');
    showStatus('could not check library status', 'error');
  }

  currentPageInput.max = book.totalPages.toString();
}

function handleAddBook() {
  chrome.storage.sync.get(['currentBook'], (result) => {
    if (chrome.runtime.lastError || !result.currentBook) {
      showStatus('error: no book selected', 'error');
      return;
    }

    const book = result.currentBook as Book;
    console.log('[goodreads sidebar] adding book to library:', book.id);
    showStatus('adding to library...', 'info');

    chrome.runtime.sendMessage(
      {
        action: 'addBook',
        bookId: book.id
      },
      (response) => {
        if (response && response.success) {
          showStatus('book added to library', 'success');
          // optimistically update ui to avoid read-after-write race conditions
          showCurrentBook(book, { inLibrary: true, progressPage: null });
          
          // if user entered a page number (though input is hidden usually), update
          if (currentPageInput.value && parseInt(currentPageInput.value) > 0) {
             handleUpdateProgress();
          }
        } else {
          const errorMsg = response?.error || 'unknown error';
          console.error('[goodreads sidebar] failed to add book:', errorMsg);
          showStatus('failed to add: ' + errorMsg, 'error');
        }
      }
    );
  });
}

function handleRemoveBook() {
  if (!removeBookBtn.classList.contains('confirming')) {
    removeBookBtn.classList.add('confirming');
    removeBookBtn.textContent = 'sure?';
    
    setTimeout(() => {
      if (removeBookBtn.classList.contains('confirming')) {
        removeBookBtn.classList.remove('confirming');
        removeBookBtn.textContent = '-';
      }
    }, 3000);
    return;
  }

  chrome.storage.sync.get(['currentBook'], (result) => {
    if (chrome.runtime.lastError || !result.currentBook) {
      return;
    }

    const book = result.currentBook as Book;
    
    console.log('[goodreads sidebar] removing book from library:', book.id);
    showStatus('removing from library...', 'info');
    
    removeBookBtn.classList.remove('confirming');
    removeBookBtn.textContent = '-';

    chrome.runtime.sendMessage(
      {
        action: 'removeBook',
        bookId: book.id
      },
      (response) => {
        if (response && response.success) {
          showStatus('book removed from library', 'success');
          chrome.storage.sync.remove(['currentBook'], () => {
            showBookSelection();
          });
        } else {
          showStatus('failed to remove book', 'error');
        }
      }
    );
  });
}

function showBookSelection() {
  currentBookSection.classList.add('hidden');
  selectBookSection.classList.remove('hidden');
  searchResults.classList.add('hidden');
  bookSearchInput.value = '';
}

function handleUpdateProgress() {
  const currentPage = parseInt(currentPageInput.value);

  console.log('[goodreads sidebar] updating progress to page:', currentPage);

  if (isNaN(currentPage) || currentPage < 1) {
    showStatus('please enter a valid page number', 'error');
    return;
  }

  chrome.storage.sync.get(['currentBook'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('[goodreads sidebar] storage error:', chrome.runtime.lastError);
      showStatus('storage error', 'error');
      return;
    }

    const book = result.currentBook as Book;

    if (!book) {
      console.error('[goodreads sidebar] no book found in storage');
      showStatus('no book selected', 'error');
      return;
    }

    if (currentPage > book.totalPages) {
      showStatus('page number exceeds total pages', 'error');
      return;
    }

    console.log('[goodreads sidebar] sending update to background script');

    chrome.runtime.sendMessage(
      {
        action: 'updateProgress',
        bookId: book.id,
        page: currentPage,
        totalPages: book.totalPages,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[goodreads sidebar] message error:', chrome.runtime.lastError);
          showStatus('failed to communicate with background', 'error');
          return;
        }

        console.log('[goodreads sidebar] update response:', response);

        if (response && response.success) {
          showStatus('progress updated successfully', 'success');
        } else {
          showStatus('failed to update progress', 'error');
        }
      }
    );
  });
}

async function handleSearch() {
  const query = bookSearchInput.value.trim();

  if (!query) {
    showStatus('please enter a search term', 'error');
    return;
  }

  showStatus('searching...', 'info');

  try {
    const result = await chrome.storage.sync.get(['hardcoverToken']);
    const token = result.hardcoverToken;

    if (!token) {
      showStatus('please configure your api token in settings', 'error');
      return;
    }

    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `
          query SearchBooks($query: String!) {
            search(
              query: $query,
              query_type: "Book",
              per_page: 10
            ) {
              results
            }
          }
        `,
        variables: {
          query: query
        }
      })
    });

    const data = await response.json();
    console.log('[hardcover sidebar] search response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error('[hardcover sidebar] api error:', data.errors);
      showStatus('search failed - check your api token', 'error');
      return;
    }

    if (data.data && data.data.search && data.data.search.results) {
      const hits = data.data.search.results.hits || [];
      if (hits.length === 0) {
        showStatus('no results found', 'error');
        searchResults.textContent = '';
        const noResults = document.createElement('p');
        noResults.className = 'no-results';
        noResults.textContent = 'no books found';
        searchResults.appendChild(noResults);
        searchResults.classList.remove('hidden');
      } else {
        displaySearchResults(hits);
      }
    } else {
      showStatus('no results found', 'error');
    }
  } catch (error) {
    console.error('[hardcover sidebar] search failed:', error);
    showStatus('failed to search - network error', 'error');
  }
}

function displaySearchResults(hits: any[]) {
  searchResults.textContent = '';
  searchResults.classList.remove('hidden');
  statusMessage.classList.add('hidden');

  if (hits.length === 0) {
    const noResults = document.createElement('p');
    noResults.className = 'no-results';
    noResults.textContent = 'no books found';
    searchResults.appendChild(noResults);
    return;
  }

  hits.forEach((hit) => {
    const doc = hit.document;

    console.log('[hardcover sidebar] processing hit:', JSON.stringify(doc, null, 2));

    const authorName = doc.author_names && doc.author_names.length > 0
      ? doc.author_names[0]
      : 'unknown author';

    // extract book cover image
    let coverUrl = null;
    if (doc.cached_image) {
      coverUrl = doc.cached_image;
    } else if (doc.image && doc.image.url) {
      coverUrl = doc.image.url;
    } else if (doc.image_url) {
      coverUrl = doc.image_url;
    }

    const book: Book = {
      id: doc.id.toString(),
      title: doc.title || 'untitled',
      author: authorName,
      totalPages: doc.pages || doc.pages_count || 0,
      imageUrl: coverUrl,
      cachedImage: coverUrl,
    };

    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';

    const displayCoverUrl = book.cachedImage || book.imageUrl;
    if (displayCoverUrl) {
      const img = document.createElement('img');
      img.src = displayCoverUrl;
      img.alt = book.title;
      img.className = 'result-cover';
      resultItem.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'result-cover-placeholder';
      placeholder.textContent = '📖';
      resultItem.appendChild(placeholder);
    }

    const infoDiv = document.createElement('div');
    infoDiv.className = 'result-info';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'result-title';
    titleDiv.textContent = book.title;

    const authorDiv = document.createElement('div');
    authorDiv.className = 'result-author';
    authorDiv.textContent = book.author;

    const pagesDiv = document.createElement('div');
    pagesDiv.className = 'result-pages';
    pagesDiv.textContent = book.totalPages > 0 ? book.totalPages + ' pages' : 'pages unknown';

    infoDiv.appendChild(titleDiv);
    infoDiv.appendChild(authorDiv);
    infoDiv.appendChild(pagesDiv);
    resultItem.appendChild(infoDiv);

    resultItem.addEventListener('click', () => selectBook(book));
    searchResults.appendChild(resultItem);
  });
}

async function selectBook(book: Book) {
  console.log('[goodreads sidebar] selecting book:', book);

  // fetch current progress from hardcover
  const status = await fetchCurrentProgress(book.id);

  if (status && status.progressPage !== null) {
    console.log('[goodreads sidebar] fetched current progress from hardcover:', status.progressPage);
    showStatus(`synced from hardcover: page ${status.progressPage}`, 'info');
  }

  chrome.storage.sync.set({ currentBook: book }, () => {
    if (chrome.runtime.lastError) {
      console.error('[goodreads sidebar] failed to save book:', chrome.runtime.lastError);
      showStatus('failed to save book', 'error');
      return;
    }

    console.log('[goodreads sidebar] book saved successfully');
    showCurrentBook(book, status);
    if (status && !status.inLibrary) {
      showStatus('book selected. click + to add to library.', 'info');
    } else if (status && status.progressPage === null) {
      showStatus('book selected', 'success');
    }
  });
}

async function fetchCurrentProgress(bookId: string): Promise<BookStatus | null> {
  try {
    const result = await chrome.storage.sync.get(['hardcoverToken']);
    const token = result.hardcoverToken;

    if (!token) {
      console.log('[goodreads sidebar] no api token, skipping progress fetch');
      return null;
    }

    // query for user_book and its progress
    const query = `
      query GetBookProgress($bookId: Int!) {
        user_books(
          where: {
            book_id: {_eq: $bookId},
            status_id: {_eq: 2}
          },
          limit: 1
        ) {
          id
          user_book_reads(order_by: {id: desc}, limit: 1) {
            progress_pages
          }
        }
      }
    `;

    const response = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: query,
        variables: { bookId: parseInt(bookId) }
      })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('[goodreads sidebar] failed to fetch progress:', data.errors);
      return null;
    }

    const userBooks = data.data?.user_books || [];
    const inLibrary = userBooks.length > 0;
    
    let progressPage: number | null = null;

    if (inLibrary && userBooks[0].user_book_reads?.length > 0) {
      progressPage = userBooks[0].user_book_reads[0].progress_pages || null;
    }

    return { inLibrary, progressPage };
  } catch (error) {
    console.error('[goodreads sidebar] failed to fetch progress:', error);
    return null;
  }
}

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');

  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 3000);
}

function applyTheme() {
  chrome.storage.local.get(['theme'], (result) => {
    const theme = result.theme || 'auto';
    console.log('[hardcover sidebar] applying theme:', theme);

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
    console.log('[hardcover sidebar] theme changed in storage, reapplying');
    applyTheme();
  }
});

// listen for system theme changes when in auto mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  chrome.storage.local.get(['theme'], (result) => {
    if (result.theme === 'auto' || !result.theme) {
      console.log('[hardcover sidebar] system theme changed, reapplying');
      applyTheme();
    }
  });
});

})(); // end of iife