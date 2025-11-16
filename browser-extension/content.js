console.log('Content script loaded on:', location.href);

// Debounce DOM capture to prevent multiple rapid captures
let domCaptureTimeout = null;

// Click tracking
let clickCount = 0;

// Input tracking
let inputVariables = {};
let inputCount = 0;

// Function to capture and clean DOM for comparison
function captureCleanedDOM() {
  try {
    const clone = document.documentElement.cloneNode(true);

    // Remove scripts, styles, and non-semantic elements
    const elementsToRemove = clone.querySelectorAll('script, style, link[rel="stylesheet"], noscript, iframe, svg, canvas, img, video, audio');
    elementsToRemove.forEach(el => el.remove());

    // Remove all attributes except semantic ones (id, class, role, aria-*, data-testid)
    const allElements = clone.querySelectorAll('*');
    allElements.forEach(el => {
      const attributesToKeep = ['id', 'class', 'role', 'data-testid', 'type', 'name', 'placeholder', 'value'];
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        if (!attributesToKeep.includes(attr.name) && !attr.name.startsWith('aria-')) {
          el.removeAttribute(attr.name);
        }
      });

      // Truncate text nodes to reasonable length to reduce size
      if (el.childNodes) {
        Array.from(el.childNodes).forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            const text = node.textContent.trim();
            if (text.length > 100) {
              node.textContent = text.substring(0, 100) + '...';
            }
          }
        });
      }
    });

    // Get the cleaned HTML
    let html = clone.outerHTML;

    // Normalize whitespace
    html = html.replace(/\s+/g, ' ').trim();

    // If still too large (> 200KB), truncate
    if (html.length > 200000) {
      console.warn('Content script: DOM too large, truncating from', html.length, 'to 200KB');
      html = html.substring(0, 200000) + '... [truncated]';
    }

    console.log('Content script: Cleaned DOM captured, size:', html.length, 'bytes');
    return html;
  } catch (error) {
    console.error('Content script: Failed to capture cleaned DOM:', error);
    return '';
  }
}

// XPath generation function
function getXPath(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  if (element === document.body) {
    return '/html/body';
  }
  
  if (element === document.documentElement) {
    return '/html';
  }
  
  let path = '';
  let current = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    const tagName = current.tagName.toLowerCase();
    const indexStr = index > 1 ? `[${index}]` : '';
    path = `/${tagName}${indexStr}${path}`;
    
    current = current.parentElement;
  }
  
  return path;
}

// Function to recursively find the most meaningful text content in an element
function findDeepestMeaningfulText(element) {
  // Priority order for meaningful elements
  const meaningfulTags = ['button', 'a', 'input', 'span', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
  const meaningfulElements = [];
  
  // Recursive function to collect all meaningful elements
  function collectMeaningfulElements(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    
    const tagName = el.tagName.toLowerCase();
    const text = el.textContent?.trim();
    
    // Check if this element has meaningful text and is a meaningful tag
    if (text && text.length > 0 && meaningfulTags.includes(tagName)) {
      meaningfulElements.push({
        element: el,
        tagName: tagName,
        text: text,
        textLength: text.length,
        depth: getElementDepth(el),
        priority: meaningfulTags.indexOf(tagName) // Lower index = higher priority
      });
    }
    
    // Recursively check children
    for (let child of el.children) {
      collectMeaningfulElements(child);
    }
  }
  
  // Helper function to get element depth
  function getElementDepth(el) {
    let depth = 0;
    let current = el;
    while (current.parentElement) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  }
  
  // Collect all meaningful elements
  collectMeaningfulElements(element);
  
  if (meaningfulElements.length === 0) {
    // No meaningful elements found, return the original element's text
    return {
      text: element.textContent?.trim().substring(0, 100) || '',
      tagName: element.tagName,
      xpath: getXPath(element),
      type: 'original'
    };
  }
  
  // Sort by priority (button > a > input > etc.) then by text length (shorter = more specific)
  meaningfulElements.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority; // Lower priority number = higher priority
    }
    return a.textLength - b.textLength; // Shorter text = more specific
  });
  
  const bestElement = meaningfulElements[0];
  
  return {
    text: bestElement.text.substring(0, 100),
    tagName: bestElement.tagName.toUpperCase(),
    xpath: getXPath(bestElement.element),
    type: 'meaningful',
    originalXpath: getXPath(element),
    depth: bestElement.depth,
    allCandidates: meaningfulElements.map(el => ({
      text: el.text.substring(0, 50),
      tag: el.tagName,
      priority: el.priority
    }))
  };
}

function captureDOM() {
  const domData = {
    url: location.href,
    title: document.title,
    timestamp: Date.now(),
    elements: {
      total: document.querySelectorAll('*').length,
      tags: {},
      classes: {},
      ids: {},
      links: [],
      images: [],
      forms: [],
      inputs: []
    },
    structure: {
      depth: getMaxDepth(document.documentElement),
      bodyHTML: document.body ? document.body.innerHTML.length : 0,
      headHTML: document.head ? document.head.innerHTML.length : 0
    },
    metadata: {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      userAgent: navigator.userAgent,
      language: navigator.language
    }
  };

  // Count different tag types
  document.querySelectorAll('*').forEach(el => {
    const tagName = el.tagName.toLowerCase();
    domData.elements.tags[tagName] = (domData.elements.tags[tagName] || 0) + 1;
    
    // Count classes
    if (el.className && typeof el.className === 'string') {
      el.className.split(' ').forEach(cls => {
        if (cls.trim()) {
          domData.elements.classes[cls.trim()] = (domData.elements.classes[cls.trim()] || 0) + 1;
        }
      });
    }
    
    // Count IDs
    if (el.id) {
      domData.elements.ids[el.id] = (domData.elements.ids[el.id] || 0) + 1;
    }
  });

  // Capture links
  document.querySelectorAll('a[href]').forEach(link => {
    domData.elements.links.push({
      href: link.href,
      text: link.textContent.trim().substring(0, 100),
      title: link.title || null
    });
  });

  // Capture images
  document.querySelectorAll('img').forEach(img => {
    domData.elements.images.push({
      src: img.src,
      alt: img.alt || null,
      width: img.width,
      height: img.height
    });
  });

  // Capture forms
  document.querySelectorAll('form').forEach(form => {
    const formData = {
      action: form.action,
      method: form.method,
      inputs: []
    };
    
    form.querySelectorAll('input, select, textarea').forEach(input => {
      formData.inputs.push({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder || null
      });
    });
    
    domData.elements.forms.push(formData);
  });

  return domData;
}

function getMaxDepth(element, depth = 0) {
  let maxDepth = depth;
  for (let child of element.children) {
    maxDepth = Math.max(maxDepth, getMaxDepth(child, depth + 1));
  }
  return maxDepth;
}

function reportUrl() {
    console.log('Content script: Reporting URL:', location.href);
    try {
      chrome.runtime.sendMessage({
        type: 'PAGE_URL',
        url: location.href,
        title: document.title
      });
    } catch (error) {
      console.log('Content script: Extension context invalidated, stopping tracking');
      // Remove event listeners to prevent further errors
      document.removeEventListener('click', checkAndReportClick, true);
    }
  }

function reportDOM() {
    console.log('Content script: Capturing DOM data');
    const domData = captureDOM();
    try {
      chrome.runtime.sendMessage({
        type: 'DOM_DATA',
        data: domData
      });
    } catch (error) {
      console.log('Content script: Extension context invalidated, stopping tracking');
      document.removeEventListener('click', checkAndReportClick, true);
    }
  }

function captureClickData(event) {
  // Find the most meaningful text content within the clicked element
  const meaningfulContent = findDeepestMeaningfulText(event.target);
  
  const clickData = {
    url: location.href,
    title: document.title,
    timestamp: Date.now(),
    clickCount: ++clickCount,
    clickInfo: {
      x: event.clientX,
      y: event.clientY,
      target: {
        // Original clicked element info
        tagName: event.target.tagName,
        id: event.target.id || null,
        className: event.target.className || null,
        textContent: event.target.textContent?.trim().substring(0, 100) || null,
        xpath: getXPath(event.target),
        
        // Enhanced meaningful content
        meaningfulText: meaningfulContent.text,
        meaningfulTagName: meaningfulContent.tagName,
        meaningfulXpath: meaningfulContent.xpath,
        meaningfulType: meaningfulContent.type,
        meaningfulDepth: meaningfulContent.depth || null,
        
        // Include original xpath if different from meaningful xpath
        originalXpath: meaningfulContent.originalXpath || getXPath(event.target),
        
        // All candidates for debugging
        allMeaningfulCandidates: meaningfulContent.allCandidates || []
      },
      button: event.button, // 0=left, 1=middle, 2=right
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey
    },
    domSnapshot: captureDOM()
  };

  return clickData;
}

function reportClick(event) {
  console.log('Content script: Click detected at', event.clientX, event.clientY);
  const clickData = captureClickData(event);

  try {
    // Send click data immediately (without screenshot first) to ensure it's captured even if page navigates
    chrome.runtime.sendMessage({
      type: 'CLICK_DATA',
      data: clickData
    });
    console.log('Content script: Click data sent immediately');

    // Then delay screenshot AND DOM capture to get the state AFTER the click is processed
    // This ensures we capture the result of the action, not the state before it
    setTimeout(() => {
      try {
        // Capture cleaned DOM
        const cleanedDom = captureCleanedDOM();

        // Request screenshot AFTER the click has been processed
        chrome.runtime.sendMessage({
          type: 'TAKE_SCREENSHOT',
          tabId: null // Will be filled by background script
        }, (response) => {
          if (response && response.screenshot) {
            // Update the already-stored click data with the screenshot AND DOM
            chrome.runtime.sendMessage({
              type: 'UPDATE_LAST_SCREENSHOT',
              screenshot: response.screenshot,
              filename: response.filename,
              dom: cleanedDom
            });
            console.log('Content script: Screenshot and DOM captured AFTER action, saved as', response.filename);
          } else {
            console.warn('Content script: Screenshot response empty or invalid');
            // Still try to send DOM even if screenshot failed
            chrome.runtime.sendMessage({
              type: 'UPDATE_LAST_SCREENSHOT',
              screenshot: null,
              filename: null,
              dom: cleanedDom
            });
          }
        });
      } catch (error) {
        console.error('Content script: Screenshot/DOM capture failed:', error);
      }
    }, 800); // Wait 800ms for page to update after click (increased from 500ms)
  } catch (error) {
    console.log('Content script: Extension context invalidated, stopping tracking');
    document.removeEventListener('click', checkAndReportClick, true);
  }
}
  
  // Always report URL - let background script handle filtering
  function checkAndReportUrl() {
    console.log('Content script: Checking and reporting URL');
    reportUrl();
  }

function checkAndReportDOM() {
    // Clear any existing timeout
    if (domCaptureTimeout) {
      clearTimeout(domCaptureTimeout);
    }

    // Debounce DOM capture by 2 seconds
    domCaptureTimeout = setTimeout(() => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Content script: Extension context invalidated');
          return;
        }

        chrome.storage.local.get(['isTracking', 'captureDOM'], (result) => {
          if (chrome.runtime.lastError) {
            console.log('Content script: Extension context invalidated');
            return;
          }

          if (result.isTracking && result.captureDOM) {
            console.log('Content script: Capturing DOM data for', location.href);
            console.log('Content script: Document ready state:', document.readyState);
            console.log('Content script: Document title:', document.title);
            reportDOM();
          } else {
            console.log('Content script: DOM capture skipped - tracking:', result.isTracking, 'captureDOM:', result.captureDOM);
          }
        });
      } catch (error) {
        console.log('Content script: Extension context invalidated');
      }
    }, 2000);
  }

function checkAndReportClick(event) {
  console.log('🔍 Content script: Click event fired on', event.target.tagName);

  try {
    if (!chrome.runtime?.id) {
      // Extension context invalidated, remove listener
      console.log('❌ Content script: Extension context invalidated, removing click listener');
      document.removeEventListener('click', checkAndReportClick, true);
      return;
    }

    console.log('✅ Content script: Chrome runtime available, checking tracking status');
    chrome.storage.local.get(['isTracking', 'captureClicks'], (result) => {
      if (chrome.runtime.lastError) {
        console.log('❌ Content script: Storage error:', chrome.runtime.lastError);
        document.removeEventListener('click', checkAndReportClick, true);
        return;
      }

      console.log('📊 Content script: Storage result -', 'isTracking:', result.isTracking, 'captureClicks:', result.captureClicks);

      if (result.isTracking && result.captureClicks) {
        console.log('✅ Content script: Click tracking enabled, capturing click');
        reportClick(event);
      } else {
        console.log('⚠️ Content script: Click tracking disabled - isTracking:', result.isTracking, 'captureClicks:', result.captureClicks);
      }
    });
  } catch (error) {
    console.log('❌ Content script: Exception:', error);
    document.removeEventListener('click', checkAndReportClick, true);
  }
}

// Generate a variable name for an input element
function generateInputVariableName(element) {
  // Priority order for generating meaningful variable names
  if (element.name) {
    return element.name.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  if (element.id) {
    return element.id.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  if (element.placeholder) {
    return element.placeholder.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 30);
  }

  // Find associated label
  const label = element.labels?.[0] || document.querySelector(`label[for="${element.id}"]`);
  if (label && label.textContent) {
    return label.textContent.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 30);
  }

  // Fall back to generic name with counter
  const type = element.type || 'input';
  return `${type}_${++inputCount}`;
}

// Capture input data
function captureInputData(event) {
  const element = event.target;
  const xpath = getXPath(element);

  // Generate or retrieve variable name for this input
  if (!inputVariables[xpath]) {
    inputVariables[xpath] = {
      variableName: generateInputVariableName(element),
      xpath: xpath,
      elementInfo: {
        tagName: element.tagName,
        type: element.type || null,
        name: element.name || null,
        id: element.id || null,
        placeholder: element.placeholder || null,
        className: element.className || null
      },
      firstCaptured: Date.now(),
      updateCount: 0
    };
  }

  // Update the value
  inputVariables[xpath].value = element.value;
  inputVariables[xpath].lastUpdated = Date.now();
  inputVariables[xpath].updateCount++;

  console.log(`Input captured: ${inputVariables[xpath].variableName} = "${element.value}"`);

  // Report input data
  reportInputData(xpath);
}

function reportInputData(xpath) {
  const inputData = {
    url: location.href,
    title: document.title,
    timestamp: Date.now(),
    input: inputVariables[xpath],
    allInputVariables: Object.values(inputVariables).map(input => ({
      variableName: input.variableName,
      value: input.value,
      xpath: input.xpath
    }))
  };

  try {
    chrome.runtime.sendMessage({
      type: 'INPUT_DATA',
      data: inputData
    });
  } catch (error) {
    console.log('Content script: Extension context invalidated, stopping tracking');
    document.removeEventListener('input', checkAndReportInput, true);
    document.removeEventListener('change', checkAndReportInput, true);
  }
}

function checkAndReportInput(event) {
  try {
    if (!chrome.runtime?.id) {
      console.log('Content script: Extension context invalidated, removing input listener');
      document.removeEventListener('input', checkAndReportInput, true);
      document.removeEventListener('change', checkAndReportInput, true);
      return;
    }

    chrome.storage.local.get(['isTracking', 'captureInputs'], (result) => {
      if (chrome.runtime.lastError) {
        console.log('Content script: Extension context invalidated');
        document.removeEventListener('input', checkAndReportInput, true);
        document.removeEventListener('change', checkAndReportInput, true);
        return;
      }

      if (result.isTracking && result.captureInputs !== false) {
        console.log('Content script: Input tracking enabled, capturing input');
        captureInputData(event);
      } else {
        console.log('Content script: Input tracking disabled - tracking:', result.isTracking, 'captureInputs:', result.captureInputs);
      }
    });
  } catch (error) {
    console.log('Content script: Extension context invalidated, removing input listener');
    document.removeEventListener('input', checkAndReportInput, true);
    document.removeEventListener('change', checkAndReportInput, true);
  }
}
  
  // On initial load
  checkAndReportUrl();
  checkAndReportDOM();
  
  // Detect SPA navigations (URL changes without full reload)
  let last = location.href;
  const obs = new MutationObserver(() => {
    if (location.href !== last) {
      last = location.href;
      console.log('Content script: URL changed to:', location.href);
      checkAndReportUrl();
      // Use debounced DOM capture
      checkAndReportDOM();
    }
  });
  obs.observe(document, { subtree: true, childList: true });
  
  // Also listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', () => {
    console.log('Content script: Popstate event, URL:', location.href);
    checkAndReportUrl();
    checkAndReportDOM();
  });
  
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    console.log('Content script: Hash change, URL:', location.href);
    checkAndReportUrl();
    checkAndReportDOM();
  });

  // Add click event listener for click tracking
  document.addEventListener('click', (event) => {
    checkAndReportClick(event);
  }, true); // Use capture phase to catch all clicks

  // Add input event listeners for input tracking
  document.addEventListener('input', (event) => {
    // Only track input, textarea, and select elements
    if (event.target.matches('input, textarea, select')) {
      checkAndReportInput(event);
    }
  }, true);

  // Also listen for change events (for checkboxes, radio buttons, etc.)
  document.addEventListener('change', (event) => {
    if (event.target.matches('input, textarea, select')) {
      checkAndReportInput(event);
    }
  }, true);
