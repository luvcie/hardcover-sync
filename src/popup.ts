// popup script for the extension popup ui

(function() {
  interface Book {
    id: string;
    title: string;
    author: string;
    totalPages: number;
    coverUrl?: string;
  }

  interface Progress {
    bookId: string;
    currentPage: number;
    totalPages: number;
    lastUpdated: string;
    percentComplete: number;
  }

  // dom elements
  let currentBookSection: HTMLElement;
  let selectBookSection: HTMLElement;
  let bookTitleEl: HTMLElement;
  let bookAuthorEl: HTMLElement;
  let currentPageInput: HTMLInputElement;
  let totalPagesDisplay: HTMLElement;
  let updateBtn: HTMLElement;
  let changeBookBtn: HTMLElement;
  let bookSearchInput: HTMLInputElement;
  let searchBtn: HTMLElement;
  let searchResults: HTMLElement;
  let statusMessage: HTMLElement;

document.addEventListener('DOMContentLoaded', async () => {
  currentBookSection = document.getElementById('current-book-section')!;
  selectBookSection = document.getElementById('select-book-section')!;
  bookTitleEl = document.getElementById('book-title')!;
  bookAuthorEl = document.getElementById('book-author')!;
  currentPageInput = document.getElementById('current-page') as HTMLInputElement;
  totalPagesDisplay = document.getElementById('total-pages-display')!;
  updateBtn = document.getElementById('update-btn')!;
  changeBookBtn = document.getElementById('change-book-btn')!;
  bookSearchInput = document.getElementById('book-search') as HTMLInputElement;
  searchBtn = document.getElementById('search-btn')!;
  searchResults = document.getElementById('search-results')!;
  statusMessage = document.getElementById('status-message')!;

  const openFloatingBtn = document.getElementById('open-floating-btn');
  if (openFloatingBtn) {
    openFloatingBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openFloatingWindow' }, () => {
        window.close();
      });
    });
  }

  const settingsLink = document.getElementById('settings-link');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  updateBtn.addEventListener('click', handleUpdateProgress);
  changeBookBtn.addEventListener('click', showBookSelection);
  searchBtn.addEventListener('click', handleSearch);
  bookSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    const isPDF = tab.url.toLowerCase().endsWith('.pdf') ||
                  tab.url.toLowerCase().includes('.pdf?') ||
                  tab.url.includes('pdfjs.action=');

    if (isPDF) {
      console.log('[goodreads popup] opened on pdf page:', tab.url);
      showStatus('pdf detected - use this popup to track your progress', 'info');
    }
  }

  loadCurrentBook();
});

function loadCurrentBook() {
  console.log('[goodreads popup] loading current book from storage');

  chrome.storage.sync.get(['currentBook', 'currentProgress'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('[goodreads popup] storage error:', chrome.runtime.lastError);
      showBookSelection();
      return;
    }

    console.log('[goodreads popup] storage result:', result);

    if (result.currentBook) {
      console.log('[goodreads popup] found current book:', result.currentBook);
      showCurrentBook(result.currentBook, result.currentProgress);
    } else {
      console.log('[goodreads popup] no current book found');
      showBookSelection();
    }
  });
}

function showCurrentBook(book: Book, progress?: Progress) {
  currentBookSection.classList.remove('hidden');
  selectBookSection.classList.add('hidden');

  bookTitleEl.textContent = book.title;
  bookAuthorEl.textContent = book.author;
  totalPagesDisplay.textContent = `/ ${book.totalPages}`;

  if (progress) {
    currentPageInput.value = progress.currentPage.toString();
  }

  currentPageInput.max = book.totalPages.toString();
}

function showBookSelection() {
  currentBookSection.classList.add('hidden');
  selectBookSection.classList.remove('hidden');
  searchResults.classList.add('hidden');
  bookSearchInput.value = '';
}

function handleUpdateProgress() {
  const currentPage = parseInt(currentPageInput.value);

  console.log('[goodreads popup] updating progress to page:', currentPage);

  if (isNaN(currentPage) || currentPage < 1) {
    showStatus('please enter a valid page number', 'error');
    return;
  }

  chrome.storage.sync.get(['currentBook'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('[goodreads popup] storage error:', chrome.runtime.lastError);
      showStatus('storage error', 'error');
      return;
    }

    const book = result.currentBook as Book;

    if (!book) {
      console.error('[goodreads popup] no book found in storage');
      showStatus('no book selected', 'error');
      return;
    }

    if (currentPage > book.totalPages) {
      showStatus('page number exceeds total pages', 'error');
      return;
    }

    console.log('[goodreads popup] sending update to background script');

    chrome.runtime.sendMessage(
      {
        action: 'updateProgress',
        bookId: book.id,
        page: currentPage,
        totalPages: book.totalPages,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[goodreads popup] message error:', chrome.runtime.lastError);
          showStatus('failed to communicate with background', 'error');
          return;
        }

        console.log('[goodreads popup] update response:', response);

        if (response && response.success) {
          showStatus('progress updated successfully', 'success');
        } else {
          showStatus('failed to update progress', 'error');
        }
      }
    );
  });
}

function handleSearch() {
  const query = bookSearchInput.value.trim();

  if (!query) {
    showStatus('please enter a search term', 'error');
    return;
  }

  showStatus('searching...', 'info');

  // todo: implement actual goodreads api search
  // for now, show mock results
  setTimeout(() => {
    displayMockResults(query);
  }, 500);
}

function displayMockResults(query: string) {
  const mockResults: Book[] = [
    {
      id: '1',
      title: 'the lord of the rings',
      author: 'j.r.r. tolkien',
      totalPages: 1178,
    },
    {
      id: '2',
      title: 'the hobbit',
      author: 'j.r.r. tolkien',
      totalPages: 366,
    },
  ];

  searchResults.innerHTML = '';
  searchResults.classList.remove('hidden');
  statusMessage.classList.add('hidden');

  if (mockResults.length === 0) {
    searchResults.innerHTML = '<p class="no-results">no books found</p>';
    return;
  }

  mockResults.forEach((book) => {
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    resultItem.innerHTML = `
      <div class="result-info">
        <div class="result-title">${book.title}</div>
        <div class="result-author">${book.author}</div>
        <div class="result-pages">${book.totalPages} pages</div>
      </div>
    `;

    resultItem.addEventListener('click', () => selectBook(book));
    searchResults.appendChild(resultItem);
  });
}

function selectBook(book: Book) {
  console.log('[goodreads popup] selecting book:', book);

  chrome.storage.sync.set({ currentBook: book }, () => {
    if (chrome.runtime.lastError) {
      console.error('[goodreads popup] failed to save book:', chrome.runtime.lastError);
      showStatus('failed to save book', 'error');
      return;
    }

    console.log('[goodreads popup] book saved successfully');
    showCurrentBook(book);
    showStatus('book selected', 'success');
  });
}

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');

  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 3000);
}

})(); // end of iife
