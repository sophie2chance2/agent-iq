// Get DOM elements
const testBtn = document.getElementById('testBtn');
const testFlowBtn = document.getElementById('testFlowBtn');
const downloadScriptBtn = document.getElementById('downloadScriptBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');

// Check if tracking is currently active
chrome.storage.local.get(['isTracking'], (result) => {
  const isTracking = result.isTracking || false;
  updateUI(isTracking);
  if (isTracking) {
    loadStoredUrls();
    loadStoredDOM();
    loadStoredClicks();
  }
});

// Test server connection
testBtn.addEventListener('click', () => {
  status.textContent = 'Testing server connection...';
  chrome.runtime.sendMessage({ type: 'TEST_SERVER' }, (response) => {
    if (chrome.runtime.lastError) {
      status.textContent = 'Test failed: ' + chrome.runtime.lastError.message;
      console.error('Test error:', chrome.runtime.lastError);
    } else if (response && response.success) {
      status.textContent = '✅ Server connection successful!';
      console.log('Server test passed:', response.message);
    } else {
      status.textContent = '❌ Server connection failed!';
      console.log('Server test failed:', response?.message);
    }
  });
});

// Test Flow - Navigate to localhost:3000 and fill in form
testFlowBtn.addEventListener('click', () => {
  status.textContent = 'Opening Test Flow...';

  // Get current tab URL as fallback, but background script will prefer first tracked URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const fallbackUrl = tabs[0]?.url || 'https://example.com';

    chrome.runtime.sendMessage({
      type: 'TEST_FLOW',
      fallbackUrl: fallbackUrl
    }, (response) => {
      if (chrome.runtime.lastError) {
        status.textContent = 'Test Flow failed: ' + chrome.runtime.lastError.message;
        console.error('Test Flow error:', chrome.runtime.lastError);
      } else if (response && response.success) {
        status.textContent = '✅ Test Flow opened!';
        console.log('Test Flow opened:', response.message);
      } else {
        status.textContent = '❌ Test Flow failed!';
        console.log('Test Flow failed:', response?.message);
      }
    });
  });
});

// Download Script - Download the generated click script
downloadScriptBtn.addEventListener('click', () => {
  status.textContent = 'Generating script...';

  chrome.runtime.sendMessage({
    type: 'DOWNLOAD_SCRIPT'
  }, (response) => {
    if (chrome.runtime.lastError) {
      status.textContent = 'Download failed: ' + chrome.runtime.lastError.message;
      console.error('Download error:', chrome.runtime.lastError);
    } else if (response && response.success) {
      status.textContent = '✅ Script downloaded!';
      console.log('Script downloaded:', response.message);
    } else {
      status.textContent = '❌ Download failed!';
      console.log('Download failed:', response?.message);
    }
  });
});

// Start tracking
startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'START_TRACKING' });
  updateUI(true);
  status.textContent = 'Tracking started! All features enabled.';
  console.log('Started tracking URLs, DOM, and clicks');
});

// Stop tracking
stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_TRACKING' });
  updateUI(false);
  status.textContent = 'Uploading to server...';
  console.log('Stopped all tracking - uploading to server');
  
  // Update status after a delay
  setTimeout(() => {
    status.textContent = 'Workflow executing on localhost:3000';
  }, 3000);
});


// Update UI based on tracking state
function updateUI(isTracking) {
  startBtn.disabled = isTracking;
  stopBtn.disabled = !isTracking;
  if (isTracking) {
    status.textContent = '🟢 Currently tracking...';
    status.classList.add('active');
  } else {
    status.textContent = 'Ready to start';
    status.classList.remove('active');
  }
}

// Load and display stored URLs
function loadStoredUrls() {
  chrome.storage.session.get({ urls: [] }, (result) => {
    if (result.urls && result.urls.length > 0) {
      displayUrls(result.urls);
    }
  });
}

// Display URLs in the popup
function displayUrls(urlArray) {
  // No-op: URL display UI has been removed
}

// Load and display stored DOM data
function loadStoredDOM() {
  chrome.storage.session.get({ domData: [] }, (result) => {
    if (result.domData && result.domData.length > 0) {
      displayDOMData(result.domData);
    }
  });
}

// Display DOM data in the popup
function displayDOMData(domArray) {
  // No-op: DOM display UI has been removed
}

// Load and display stored click data
function loadStoredClicks() {
  chrome.storage.session.get({ clickData: [] }, (result) => {
    if (result.clickData && result.clickData.length > 0) {
      displayClickData(result.clickData);
    }
  });
}

// Display click data in the popup
function displayClickData(clickArray) {
  // No-op: Click display UI has been removed
}

// Listen for new URLs from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_URL') {
    loadStoredUrls();
    status.textContent = `Tracking... (${message.count} URLs logged)`;
  }
});
