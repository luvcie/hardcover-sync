// content script that runs on all pages to detect pdfs and add the float button

function isPDF(): boolean {
  console.log('[goodreads] checking if page is pdf...');
  console.log('[goodreads] url:', window.location.href);
  console.log('[goodreads] content type:', document.contentType);

  const contentType = document.contentType;
  if (contentType === 'application/pdf') {
    console.log('[goodreads] detected pdf via content type');
    return true;
  }

  const url = window.location.href.toLowerCase();
  if (url.endsWith('.pdf')) {
    console.log('[goodreads] detected pdf via url extension');
    return true;
  }

  // check if we're in firefox's pdf viewer (pdf.js)
  // firefox uses viewer.html or embeds directly
  if (url.includes('pdfjs.action=') || url.includes('resource://pdf.js')) {
    console.log('[goodreads] detected firefox pdf.js viewer via url');
    return true;
  }

  // check for pdf.js viewer elements
  const viewerElement = document.querySelector('#viewer');
  const viewerContainer = document.querySelector('#viewerContainer');
  const pdfViewer = document.querySelector('.pdfViewer');

  if (viewerElement || viewerContainer || pdfViewer) {
    console.log('[goodreads] detected pdf.js viewer via dom elements');
    return true;
  }

  // check for embed/object tags with pdf
  const embeds = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
  if (embeds.length > 0) {
    console.log('[goodreads] detected pdf via embed/object tags');
    return true;
  }

  console.log('[goodreads] no pdf detected');
  return false;
}

function init() {
  console.log('[goodreads] content script initialized');

  if (!isPDF()) {
    console.log('[goodreads] not a pdf page, exiting');
    return;
  }

  console.log('[goodreads] pdf detected! initializing goodreads tracker');

  // wait a bit for the pdf viewer to fully load
  setTimeout(() => {
    createFloatButton();
  }, 1000);
}

function createFloatButton() {
  if (document.getElementById('goodreads-float-btn')) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'goodreads-float-btn';
  button.className = 'goodreads-float-button';
  button.setAttribute('aria-label', 'update goodreads progress');

  button.innerHTML = `
    <div class="goodreads-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  button.addEventListener('click', handleButtonClick);
  injectStyles();
  document.body.appendChild(button);
}

function handleButtonClick() {
  console.log('goodreads button clicked');
  // todo: show popup window for book selection and page update
  alert('goodreads tracker clicked! popup coming soon...');
}

function injectStyles() {
  if (document.getElementById('goodreads-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'goodreads-styles';
  style.textContent = `
    .goodreads-float-button {
      position: fixed;
      bottom: 40px;
      right: 40px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: rgba(56, 33, 19, 0.9);
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .goodreads-float-button:hover {
      background-color: rgba(56, 33, 19, 1);
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .goodreads-icon {
      color: #f4f1ea;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;

  document.head.appendChild(style);
}

console.log('[goodreads] content script loaded, document state:', document.readyState);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// also try after a delay in case pdf viewer loads slowly
setTimeout(() => {
  console.log('[goodreads] delayed check for pdf viewer');
  if (!document.getElementById('goodreads-float-btn') && isPDF()) {
    console.log('[goodreads] pdf detected on delayed check, creating button');
    createFloatButton();
  }
}, 2000);
