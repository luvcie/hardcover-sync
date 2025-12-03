// nano sidebar script

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

  interface BookStatus {
    inLibrary: boolean;
    progressPage: number | null;
  }

  // dom elements
  let bookTitleEl: HTMLElement;
  let bookAuthorEl: HTMLElement;
  let currentPageInput: HTMLInputElement;
  let totalPagesDisplay: HTMLElement;
  let progressFill: HTMLElement;
  
  let updateBtn: HTMLElement;
  let addBookBtn: HTMLElement;
  let removeBookBtn: HTMLElement;
  let prevPageBtn: HTMLElement;
  let nextPageBtn: HTMLElement;
  
  let addText: HTMLElement;
  let statusMessage: HTMLElement;
  
  let keybindsEnabled = true;

document.addEventListener('DOMContentLoaded', async () => {
  bookTitleEl = document.getElementById('book-title')!;
  bookAuthorEl = document.getElementById('book-author')!;
  currentPageInput = document.getElementById('current-page') as HTMLInputElement;
  totalPagesDisplay = document.getElementById('total-pages-display')!;
  progressFill = document.getElementById('progress-fill')!;
  
  updateBtn = document.getElementById('update-btn')!;
  addBookBtn = document.getElementById('add-book-btn')!;
  removeBookBtn = document.getElementById('remove-book-btn')!;
  prevPageBtn = document.getElementById('prev-page-btn')!;
  nextPageBtn = document.getElementById('next-page-btn')!;
  
  addText = document.getElementById('add-text')!;
  statusMessage = document.getElementById('status-message')!;

  chrome.storage.sync.get(['keybindsEnabled'], (result) => {
    keybindsEnabled = result.keybindsEnabled !== false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.keybindsEnabled) {
      keybindsEnabled = changes.keybindsEnabled.newValue !== false;
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
  
  prevPageBtn.addEventListener('click', () => {
    const val = parseInt(currentPageInput.value) || 0;
    if (val > 0) currentPageInput.value = (val - 1).toString();
  });

  nextPageBtn.addEventListener('click', () => {
    const val = parseInt(currentPageInput.value) || 0;
    currentPageInput.value = (val + 1).toString();
  });

  currentPageInput.addEventListener('keydown', (e) => {
    if (!keybindsEnabled) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const val = parseInt(currentPageInput.value) || 0;
      currentPageInput.value = (val + 1).toString();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const val = parseInt(currentPageInput.value) || 0;
      if (val > 0) currentPageInput.value = (val - 1).toString();
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

  loadCurrentBook();
  applyTheme();
});

async function loadCurrentBook() {
  chrome.storage.sync.get(['currentBook'], async (result) => {
    if (chrome.runtime.lastError || !result.currentBook) {
      bookTitleEl.textContent = 'no book selected';
      bookAuthorEl.textContent = '';
      return;
    }

    const book = result.currentBook;
    const status = await fetchCurrentProgress(book.id);
    showCurrentBook(book, status);
  });
}

function showCurrentBook(book: Book, status: BookStatus | null) {
  bookTitleEl.textContent = book.title;
  bookAuthorEl.textContent = book.author;
  totalPagesDisplay.textContent = `/ ${book.totalPages}`;

  let current = 0;
  
  if (status) {
    if (status.progressPage !== null) {
      current = status.progressPage;
      currentPageInput.value = current.toString();
    }
    
    let percent = 0;
    if (book.totalPages > 0) {
      percent = Math.min(100, Math.round((current / book.totalPages) * 100));
    }
    progressFill.style.width = `${percent}%`;

    if (status.inLibrary) {
      // In Library
      addBookBtn.classList.add('hidden');
      if (addText) addText.classList.add('hidden');
      
      removeBookBtn.classList.remove('hidden');
      updateBtn.classList.remove('hidden');
      prevPageBtn.classList.remove('hidden');
      nextPageBtn.classList.remove('hidden');
      
      document.querySelector('.page-input-group')?.classList.remove('hidden');
    } else {
      // Not In Library
      addBookBtn.classList.remove('hidden');
      if (addText) addText.classList.remove('hidden');
      
      removeBookBtn.classList.add('hidden');
      updateBtn.classList.add('hidden');
      prevPageBtn.classList.add('hidden');
      nextPageBtn.classList.add('hidden');
      
      document.querySelector('.page-input-group')?.classList.add('hidden');
    }
  } else {
    // Error
    addBookBtn.classList.remove('hidden');
    if (addText) addText.classList.remove('hidden');
    removeBookBtn.classList.add('hidden');
    updateBtn.classList.add('hidden');
    prevPageBtn.classList.add('hidden');
    nextPageBtn.classList.add('hidden');
    document.querySelector('.page-input-group')?.classList.add('hidden');
    showStatus('status check failed', 'error');
  }
}

async function fetchCurrentProgress(bookId: string): Promise<BookStatus | null> {
  try {
    const result = await chrome.storage.sync.get(['hardcoverToken']);
    const token = result.hardcoverToken;
    if (!token) return null;

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
    if (data.errors) return null;

    const userBooks = data.data?.user_books || [];
    const inLibrary = userBooks.length > 0;
    let progressPage = null;

    if (inLibrary && userBooks[0].user_book_reads?.length > 0) {
      progressPage = userBooks[0].user_book_reads[0].progress_pages || null;
    }

    return { inLibrary, progressPage };
  } catch (error) {
    return null;
  }
}

function handleAddBook() {
  chrome.storage.sync.get(['currentBook'], (result) => {
    if (!result.currentBook) return;
    const book = result.currentBook;

    showStatus('adding...', 'info');
    chrome.runtime.sendMessage({ action: 'addBook', bookId: book.id }, (response) => {
      if (response && response.success) {
        showStatus('added', 'success');
        showCurrentBook(book, { inLibrary: true, progressPage: null });
      } else {
        showStatus('failed to add', 'error');
      }
    });
  });
}

function handleRemoveBook() {
  if (!removeBookBtn.classList.contains('confirming')) {
    removeBookBtn.classList.add('confirming');
    removeBookBtn.textContent = '?';
    setTimeout(() => {
      removeBookBtn.classList.remove('confirming');
      removeBookBtn.textContent = '-';
    }, 3000);
    return;
  }

  chrome.storage.sync.get(['currentBook'], (result) => {
    if (!result.currentBook) return;
    const book = result.currentBook;

    removeBookBtn.classList.remove('confirming');
    removeBookBtn.textContent = '-';
    showStatus('removing...', 'info');

    chrome.runtime.sendMessage({ action: 'removeBook', bookId: book.id }, (response) => {
      if (response && response.success) {
        showStatus('removed', 'success');
        chrome.storage.sync.remove(['currentBook'], () => {
           bookTitleEl.textContent = 'no book selected';
           bookAuthorEl.textContent = '';
           progressFill.style.width = '0%';
           addBookBtn.classList.add('hidden');
           removeBookBtn.classList.add('hidden');
           updateBtn.classList.add('hidden');
           prevPageBtn.classList.add('hidden');
           nextPageBtn.classList.add('hidden');
           document.querySelector('.page-input-group')?.classList.add('hidden');
        });
      } else {
        showStatus('failed', 'error');
      }
    });
  });
}

function handleUpdateProgress() {
  const page = parseInt(currentPageInput.value);
  if (isNaN(page)) return;

  chrome.storage.sync.get(['currentBook'], (result) => {
    const book = result.currentBook;
    if (!book) return;

    const percent = Math.min(100, Math.round((page / book.totalPages) * 100));
    progressFill.style.width = `${percent}%`;

    chrome.runtime.sendMessage({
      action: 'updateProgress',
      bookId: book.id,
      page: page,
      totalPages: book.totalPages
    }, (response) => {
      if (response && response.success) {
        showStatus('updated', 'success');
      } else {
        showStatus('failed', 'error');
      }
    });
  });
}

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
  setTimeout(() => statusMessage.classList.add('hidden'), 2000);
}

function applyTheme() {
  chrome.storage.local.get(['theme'], (result) => {
    const theme = result.theme || 'auto';
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
    applyTheme();
  }
});

})();