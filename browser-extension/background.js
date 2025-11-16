// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started');
  setupKeepAlive();
});

// Set up keep-alive mechanism to prevent service worker from stopping
function setupKeepAlive() {
  // Create an alarm that fires every 20 seconds
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.33 }); // 20 seconds
  console.log('⏰ Keep-alive alarm created');
}

// Listen to the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Check if we're actively tracking
    chrome.storage.local.get(['isTracking'], (result) => {
      if (result.isTracking) {
        console.log('💓 Service worker keep-alive ping - tracking active');
      }
    });
  }
});

// Store all tracking data in memory during session
let trackingData = {
  urls: [],
  clicks: [],
  domSnapshots: [],
  inputs: [],
  startTime: null,
  endTime: null
};

// Restore tracking data from storage when service worker starts/resumes
chrome.storage.local.get(['trackingData', 'isTracking'], (result) => {
  if (result.trackingData && result.isTracking) {
    trackingData = result.trackingData;
    console.log('🔄 Service worker resumed - restored tracking data:', {
      clicks: trackingData.clicks.length,
      urls: trackingData.urls.length,
      startTime: trackingData.startTime
    });
  }
});

// Helper function to persist tracking data
function persistTrackingData() {
  chrome.storage.local.set({ trackingData: trackingData }, () => {
    console.log('💾 Tracking data persisted to storage');
  });
}

// Server configuration
const SERVER_CONFIG = {
  baseUrl: 'http://localhost:3000',
  projectId: 'detective_dom',
  apiEndpoint: '/api/browser-extension/execute'
};

let sessionId = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  // Initialize tracking state
  chrome.storage.local.set({ isTracking: false, captureDOM: false, captureClicks: false, captureInputs: false, currentStep: 0 });

  // Set up keep-alive mechanism
  setupKeepAlive();

  // Data will be uploaded to server and executed
  console.log('📁 Data will be uploaded to: http://localhost:3000');
  console.log('🎬 Workflow endpoint: /api/browser-extension/execute');
});


// Session initialization is no longer needed - workflow handles it
// Keeping function stub for backwards compatibility
async function initializeSession() {
  console.log('ℹ️ Session initialization is handled by the workflow');
  return null;
}

// Function to check server connectivity
async function checkServerConnectivity() {
  try {
    console.log('🔍 Checking server connectivity...');
    console.log('🌐 Attempting to fetch:', `${SERVER_CONFIG.baseUrl}`);

    const response = await fetch(`${SERVER_CONFIG.baseUrl}`, {
      method: 'GET',
    });

    console.log('📡 Response status:', response.status);

    if (response.ok) {
      console.log('✅ Server is reachable');
      return true;
    } else {
      console.error('❌ Server responded with status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Server connectivity check failed:', error);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    return false;
  }
}

// Function to generate Stagehand v3 script from tracking data
function generateScriptFromClicks(clicks, inputs = []) {
  if (!clicks || clicks.length === 0) {
    return `/**
 * Browser Extension Generated Script
 * No actions were recorded
 */

async function main(page, stagehand) {
  console.log("No actions to replay");
  return { message: "No actions recorded" };
}`;
  }

  // Build a map of xpaths to input variables for quick lookup
  const inputVariableMap = {};
  if (inputs && inputs.length > 0) {
    inputs.forEach(inputData => {
      if (inputData.input && inputData.input.xpath) {
        inputVariableMap[inputData.input.xpath] = {
          variableName: inputData.input.variableName,
          value: inputData.input.value
        };
      }
    });
  }

  const lines = [];

  // Add JSDoc header comment
  lines.push(`/**`);
  lines.push(` * Browser Extension Generated Script`);
  lines.push(` * Generated from ${clicks.length} recorded action(s)`);
  lines.push(` *`);
  lines.push(` * This script was automatically generated from browser extension recordings.`);
  lines.push(` * You can modify it before execution.`);
  lines.push(` */`);
  lines.push(``);

  // Start main function
  lines.push(`async function main(page, stagehand) {`);

  clicks.forEach((click, index) => {
    const target = click.clickInfo?.target;
    const meaningfulText = target?.meaningfulText || target?.textContent || 'element';
    const xpath = target?.meaningfulXpath || target?.xpath || '';
    const escapedXpath = xpath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    // Check if this click has associated input data
    const inputVar = inputVariableMap[xpath];

    if (inputVar && inputVar.value) {
      // This is a typed input - generate with variables
      const escapedValue = inputVar.value.replace(/"/g, '\\"');

      lines.push(`  // Step ${index + 1}: Type into ${meaningfulText}`);
      lines.push(`  await stagehand.act({`);
      lines.push(`    selector: "${escapedXpath}",`);
      lines.push(`    description: "type ${escapedValue} into ${meaningfulText}",`);
      lines.push(`    method: "type",`);
      lines.push(`    arguments: ["${escapedValue}"]`);
      lines.push(`  });`);
    } else {
      // Regular click action
      lines.push(`  // Step ${index + 1}: ${meaningfulText}`);
      lines.push(`  await stagehand.act({`);
      lines.push(`    selector: "${escapedXpath}",`);
      lines.push(`    description: "${meaningfulText}",`);
      lines.push(`    method: "click",`);
      lines.push(`    arguments: []`);
      lines.push(`  });`);
    }
    lines.push(``);
  });

  lines.push(`  console.log("All ${clicks.length} action(s) completed");`);
  lines.push(`  return { actionsCompleted: ${clicks.length} };`);
  lines.push(`}`);

  return lines.join('\n');
}

// Function to fill in the Test Flow form on localhost:3000
function fillTestFlowForm(currentUrl, generatedScript) {
  console.log('📝 Filling Test Flow form with URL:', currentUrl);
  console.log('📝 Generated Script:', generatedScript);

  // Helper function to trigger React's onChange
  function setReactValue(element, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

    if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(element, value);
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Wait for page to be fully loaded and stable (after hot reload)
  function waitForStablePage(callback, maxAttempts = 10) {
    let attempts = 0;

    function checkPage() {
      attempts++;
      const urlInput = document.querySelector('input[type="url"]');

      if (urlInput && document.readyState === 'complete') {
        console.log('✅ Page is stable and ready');
        callback();
      } else if (attempts < maxAttempts) {
        console.log(`⏳ Waiting for page to stabilize... (attempt ${attempts}/${maxAttempts})`);
        setTimeout(checkPage, 500);
      } else {
        console.log('❌ Page did not stabilize in time');
      }
    }

    checkPage();
  }

  // Start after page is stable
  waitForStablePage(() => {
    console.log('⏰ Starting form fill');

    // Step 1: Fill URL
    const urlInput = document.querySelector('input[type="url"]');
    if (urlInput) {
      setReactValue(urlInput, currentUrl);
      console.log('✅ URL filled:', currentUrl);
    } else {
      console.log('❌ URL input not found');
      return;
    }

    // Step 2: Find and click the test type dropdown
    setTimeout(() => {
      console.log('⏰ Step 2: Looking for select trigger...');
      const selectTrigger = document.querySelector('button[id="testType"]');
      console.log('🔍 Found select trigger:', selectTrigger);

      if (selectTrigger) {
        selectTrigger.click();
        console.log('👆 Clicked select trigger');

        // Step 3: Wait for dropdown to open and select option
        setTimeout(() => {
          console.log('⏰ Step 3: Looking for dropdown options...');
          const allOptions = document.querySelectorAll('[role="option"]');
          console.log('🔍 Found options:', allOptions.length, Array.from(allOptions).map(el => el.textContent));

          const clickThroughOption = Array.from(allOptions)
            .find(el => el.textContent === 'Click Through Test');

          console.log('🔍 Click Through option:', clickThroughOption);

          if (clickThroughOption) {
            clickThroughOption.click();
            console.log('✅ Test type set to: Click Through Test');

            // Step 4: Wait for the click-through script textarea to appear
            setTimeout(() => {
              console.log('⏰ Step 4: Looking for textarea...');
              const scriptTextarea = document.querySelector('textarea#clickThroughScript');
              console.log('🔍 Found textarea:', scriptTextarea);

              if (scriptTextarea) {
                setReactValue(scriptTextarea, generatedScript);
                console.log('✅ Click-through script filled');
                console.log('🎉 Form filling completed!');
              } else {
                console.log('❌ Textarea not found. Available textareas:', document.querySelectorAll('textarea').length);
              }
            }, 800);
          } else {
            console.log('❌ Click Through Test option not found in dropdown');
          }
        }, 600);
      } else {
        console.log('❌ Select trigger not found. Trying alternative selector...');
        const altSelectTrigger = document.querySelector('[id="testType"]');
        console.log('🔍 Alternative selector found:', altSelectTrigger);
      }
    }, 500);
  });
}

// Function to upload all tracking data to server and execute the workflow
async function uploadAllTrackingData() {
  console.log('📦 Starting server upload of all tracking data...');

  // Ensure trackingData exists
  if (!trackingData.urls) trackingData.urls = [];
  if (!trackingData.clicks) trackingData.clicks = [];
  if (!trackingData.domSnapshots) trackingData.domSnapshots = [];
  if (!trackingData.inputs) trackingData.inputs = [];

  // Add end time
  trackingData.endTime = Date.now();

  console.log('📊 Session Summary:');
  console.log('⏱️ Duration:', Math.round((trackingData.endTime - trackingData.startTime) / 1000), 'seconds');
  console.log('🌐 URLs visited:', trackingData.urls.length);
  console.log('🖱️ Clicks captured:', trackingData.clicks.length);
  console.log('⌨️ Inputs captured:', trackingData.inputs.length);
  console.log('🌐 DOM snapshots:', trackingData.domSnapshots.length);

  // Check if there's any click data to upload
  if (trackingData.clicks.length === 0) {
    console.error('❌ No clicks captured. Please capture at least one click before stopping tracking.');
    console.error('💡 Tip: Make sure "Click capture" is enabled and click on elements while tracking is active.');
    return;
  }

  try {
    // Check server connectivity first
    const isServerReachable = await checkServerConnectivity();
    if (!isServerReachable) {
      throw new Error('Server is not reachable. Make sure it\'s running on localhost:3000');
    }

    // Clean click data to ensure className is always a string
    const cleanedClicks = trackingData.clicks.map(clickData => ({
      ...clickData,
      clickInfo: {
        ...clickData.clickInfo,
        target: {
          ...clickData.clickInfo.target,
          className: typeof clickData.clickInfo.target.className === 'string'
            ? clickData.clickInfo.target.className
            : ''
        }
      }
    }));

    // Create comprehensive upload payload for the browser-extension workflow
    const uploadData = {
      clicks: cleanedClicks,
      urls: trackingData.urls,
      domSnapshots: trackingData.domSnapshots,
      inputs: trackingData.inputs,
      session: {
        startTime: trackingData.startTime,
        endTime: trackingData.endTime,
        duration: trackingData.endTime - trackingData.startTime,
        totalUrls: trackingData.urls.length,
        totalClicks: trackingData.clicks.length,
        totalInputs: trackingData.inputs.length,
        totalDomSnapshots: trackingData.domSnapshots.length
      },
      parameters: [{
        advancedStealth: false,
        proxies: false,
        environment: "BROWSERBASE",
        modelName: "anthropic/claude-3-5-sonnet-20240620",
        experimental: false
      }]
    };

    console.log('📤 Sending data to browser extension workflow endpoint...');
    console.log('📊 Clicks:', cleanedClicks.length);
    console.log('📊 Inputs:', trackingData.inputs.length);
    console.log('📊 URLs:', trackingData.urls.length);
    console.log('📊 DOM Snapshots:', trackingData.domSnapshots.length);
    console.log('📦 Total payload size:', JSON.stringify(uploadData).length, 'characters');

    const response = await fetch(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.apiEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uploadData)
    });

    if (response.ok) {
      console.log('✅ Data uploaded successfully to workflow!');
      console.log('🎬 Workflow execution started...');

      // Read the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            if (data.status === 'started') {
              console.log('🚀 Workflow started');
            } else if (data.debuggerUrl) {
              console.log('🔗 Debug URL:', data.debuggerUrl);
            } else if (data.status === 'completed') {
              console.log('✅ Workflow completed successfully!');
              console.log('📊 Results:', data.results);
            } else if (data.error) {
              console.error('❌ Workflow error:', data.error);
            }
          }
        }
      }
    } else {
      const errorText = await response.text();
      throw new Error(`Server responded with status: ${response.status} - ${errorText}`);
    }

  } catch (error) {
    console.error('❌ Failed to upload data to server:', error);
    console.error('❌ Troubleshooting steps:');
    console.error('   1. Make sure your server is running: npm run dev (in the ui folder)');
    console.error('   2. Check server is accessible: http://localhost:3000');
    console.error('   3. Verify the browser extension API endpoint exists');
    console.error('   4. Check browser console for network errors');
    console.log('❌ Server upload failed');
  }
}



chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'TEST_SERVER') {
      console.log('🧪 Testing server connection...');
      checkServerConnectivity().then(isReachable => {
        if (isReachable) {
          console.log('✅ Server test passed!');
          sendResponse({ success: true, message: 'Server is reachable' });
        } else {
          console.log('❌ Server test failed!');
          sendResponse({ success: false, message: 'Server is not reachable' });
        }
      });
      return true; // Keep message channel open for async response
    }

    if (msg.type === 'DOWNLOAD_SCRIPT') {
      console.log('📥 Downloading script...');

      // Generate script from tracking data
      const generatedScript = generateScriptFromClicks(trackingData.clicks || [], trackingData.inputs || []);
      console.log('📝 Generated script from', (trackingData.clicks || []).length, 'clicks and', (trackingData.inputs || []).length, 'inputs');

      if (!trackingData.clicks || trackingData.clicks.length === 0) {
        sendResponse({ success: false, message: 'No clicks recorded yet' });
        return false;
      }

      // Create a data URL and download it
      const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(generatedScript);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `click-through-script-${timestamp}.txt`;

      chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Download failed:', chrome.runtime.lastError);
          sendResponse({ success: false, message: chrome.runtime.lastError.message });
        } else {
          console.log('✅ Script downloaded:', filename);
          sendResponse({ success: true, message: `Script downloaded as ${filename}` });
        }
      });

      return true; // Keep message channel open for async response
    }

    if (msg.type === 'TEST_FLOW') {
      console.log('🧪 Opening Test Flow...');
      console.log('📊 trackingData exists:', !!trackingData);
      console.log('📊 trackingData:', JSON.stringify({
        hasUrls: !!trackingData.urls,
        urlsLength: trackingData.urls?.length || 0,
        hasClicks: !!trackingData.clicks,
        clicksLength: trackingData.clicks?.length || 0,
        hasInputs: !!trackingData.inputs,
        inputsLength: trackingData.inputs?.length || 0,
        startUrl: trackingData.startUrl || 'not set',
        hasInitialScreenshot: !!trackingData.initialScreenshot
      }));

      // Use the captured start URL, fall back to first tracked URL or provided fallback
      const firstUrl = trackingData.startUrl
        || (trackingData.urls && trackingData.urls.length > 0 ? trackingData.urls[0].url : null)
        || msg.fallbackUrl
        || 'https://example.com';

      console.log('📍 Using URL:', firstUrl);
      console.log('📍 Source:', trackingData.startUrl ? 'captured start URL' : (trackingData.urls?.length > 0 ? 'first tracked URL' : 'fallback URL'));

      // Generate script from tracking data
      const generatedScript = generateScriptFromClicks(trackingData.clicks || [], trackingData.inputs || []);
      console.log('📝 Generated script from', (trackingData.clicks || []).length, 'clicks and', (trackingData.inputs || []).length, 'inputs');
      console.log('📜 Generated script preview:', generatedScript.substring(0, 200));

      // Prepare click events data with initial screenshot as Step 0
      console.log('🔍 Preparing click events data. Total clicks:', (trackingData.clicks || []).length);

      // Create Step 0 - Initial landing page (no code, just screenshot and DOM)
      const initialStep = {
        stepNumber: 0,
        screenshot: trackingData.initialScreenshot || null,
        dom: trackingData.initialDom || '',
        code: '// Step 0: Initial landing page',
        url: firstUrl,
        xpath: '',
        timestamp: trackingData.startTime || Date.now(),
        duration: 0,
        elementText: 'Landing page',
        elementTag: ''
      };

      const clickEventsData = [initialStep].concat((trackingData.clicks || []).map((click, index, allClicks) => {
        console.log(`📸 Processing click ${index + 1}:`, {
          hasScreenshotDataUrl: !!click.screenshotDataUrl,
          hasScreenshot: !!click.screenshot,
          screenshotLength: click.screenshot ? click.screenshot.length : 0,
          screenshotDataUrlLength: click.screenshotDataUrl ? click.screenshotDataUrl.length : 0,
          hasDom: !!click.dom,
          domLength: click.dom ? click.dom.length : 0,
          url: click.url
        });

        const target = click.clickInfo?.target;
        const xpath = target?.meaningfulXpath || target?.xpath || '';

        // Check if this is an input action
        const inputVar = (trackingData.inputs || []).find(input =>
          input.input?.xpath === xpath
        );

        // Generate the code for this specific step
        let stepCode = '';
        let actionDescription = '';
        const escapedXpath = xpath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        if (inputVar && inputVar.input.value) {
          const varValue = inputVar.input.value.replace(/"/g, '\\"');
          const meaningfulText = target?.meaningfulText || 'element';
          stepCode = `await stagehand.act({
    selector: "${escapedXpath}",
    description: "type ${varValue} into ${meaningfulText}",
    method: "type",
    arguments: ["${varValue}"]
  });`;
          actionDescription = 'Type ' + varValue + ' into ' + meaningfulText;
        } else {
          const meaningfulText = target?.meaningfulText || target?.textContent || 'element';
          stepCode = `await stagehand.act({
    selector: "${escapedXpath}",
    description: "${meaningfulText}",
    method: "click",
    arguments: []
  });`;
          actionDescription = 'Click ' + meaningfulText;
        }

        // Calculate duration as time between this step and the next step
        let duration = 0;
        if (index < allClicks.length - 1) {
          duration = allClicks[index + 1].timestamp - click.timestamp;
        } else if (index > 0) {
          // For the last step, use the average duration of previous steps
          const previousDurations = [];
          for (let i = 0; i < index; i++) {
            previousDurations.push(allClicks[i + 1].timestamp - allClicks[i].timestamp);
          }
          duration = Math.round(previousDurations.reduce((a, b) => a + b, 0) / previousDurations.length);
        }

        // Include all screenshots and DOM
        const elementTag = (target && target.meaningfulTagName) || (target && target.tagName);
        const screenshot = click.screenshotDataUrl || click.screenshot;
        const dom = click.dom || '';

        if (!screenshot) {
          console.warn(`⚠️ Click ${index + 1} is missing screenshot!`);
        }

        return {
          stepNumber: index + 1,
          screenshot: screenshot,
          dom: dom,
          code: stepCode,
          url: click.url,
          xpath: xpath,
          timestamp: click.timestamp,
          duration: duration,
          elementText: actionDescription,
          elementTag: elementTag
        };
      }));

      // Store these values in variables that will be captured in the closure
      const urlToInject = firstUrl;
      const scriptToInject = generatedScript;

      console.log('✅ Click events data prepared:', clickEventsData.length, 'events');

      // Split click events into chunks to avoid size limits (break screenshots into separate injections)
      const CHUNK_SIZE = 1; // Inject one event at a time

      // Create a new tab with localhost:3000
      chrome.tabs.create({ url: 'http://localhost:3000' }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Failed to create tab:', chrome.runtime.lastError);
          sendResponse({ success: false, message: chrome.runtime.lastError.message });
          return;
        }

        console.log('✅ Tab created, waiting for page to load...');

        // Function to inject data in chunks
        const injectData = async () => {
          console.log('🔄 Starting chunked data injection');

          try {
            // First, inject URL and script (these are small)
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (url, script) => {
                console.log('💉 Injecting URL and script');
                sessionStorage.setItem('extension_workflow_url', url);
                sessionStorage.setItem('extension_workflow_script', script);
                sessionStorage.setItem('extension_workflow_click_events', '[]'); // Initialize empty array
                return { success: true };
              },
              args: [urlToInject, scriptToInject]
            });

            // Then, inject click events one at a time, splitting large screenshots
            for (let i = 0; i < clickEventsData.length; i++) {
              const event = clickEventsData[i];
              console.log(`📦 Injecting click event ${i + 1}/${clickEventsData.length}`);

              // Check if screenshot is too large (>50KB) and needs to be chunked
              const screenshot = event.screenshot;
              const SCREENSHOT_CHUNK_SIZE = 50000; // 50KB chunks

              if (screenshot && screenshot.length > SCREENSHOT_CHUNK_SIZE) {
                console.log(`📸 Screenshot is large (${screenshot.length} bytes), splitting into chunks`);

                // Split screenshot into chunks
                const chunks = [];
                for (let offset = 0; offset < screenshot.length; offset += SCREENSHOT_CHUNK_SIZE) {
                  chunks.push(screenshot.substring(offset, offset + SCREENSHOT_CHUNK_SIZE));
                }

                console.log(`📦 Split into ${chunks.length} chunks`);

                // Send event without screenshot first
                const eventWithoutScreenshot = { ...event, screenshot: null };
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: (eventData, index) => {
                    const existing = sessionStorage.getItem('extension_workflow_click_events');
                    const events = existing ? JSON.parse(existing) : [];
                    events.push(eventData);
                    sessionStorage.setItem('extension_workflow_click_events', JSON.stringify(events));
                    console.log(`✅ Stored event ${index + 1} (without screenshot)`);
                    return { success: true };
                  },
                  args: [eventWithoutScreenshot, i]
                });

                // Send screenshot chunks
                for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                  await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (eventIndex, chunk, isLast) => {
                      const existing = sessionStorage.getItem('extension_workflow_click_events');
                      const events = existing ? JSON.parse(existing) : [];

                      // Initialize or append to screenshot
                      if (!events[eventIndex].screenshot) {
                        events[eventIndex].screenshot = '';
                      }
                      events[eventIndex].screenshot += chunk;

                      sessionStorage.setItem('extension_workflow_click_events', JSON.stringify(events));

                      if (isLast) {
                        console.log(`✅ Completed screenshot for event ${eventIndex + 1}`);
                      }
                      return { success: true };
                    },
                    args: [i, chunks[chunkIndex], chunkIndex === chunks.length - 1]
                  });
                }
              } else {
                // Screenshot is small enough, send normally
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: (eventData, index) => {
                    try {
                      // Get existing events array
                      const existing = sessionStorage.getItem('extension_workflow_click_events');
                      const events = existing ? JSON.parse(existing) : [];

                      // Add this event
                      events.push(eventData);

                      // Store back
                      sessionStorage.setItem('extension_workflow_click_events', JSON.stringify(events));
                      console.log(`✅ Stored event ${index + 1}, total events: ${events.length}`);

                      return { success: true, index: index };
                    } catch (e) {
                      console.error('❌ Failed to store event:', e);
                      return { success: false, error: e.message };
                    }
                  },
                  args: [event, i]
                });
              }
            }

            // Finally, trigger the ready event
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                console.log('📢 All data loaded, dispatching ready event');
                window.dispatchEvent(new CustomEvent('extension_workflow_data_ready'));
                return { success: true };
              }
            });

            console.log('✅ All form data stored successfully!');
          } catch (error) {
            console.error('❌ Failed to store data:', error);
            console.error('❌ Error details:', error.message, error.stack);
          }
        };

        // Wait for the page to load before storing data for the page to read
        const listener = (tabId, info) => {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            console.log('✅ Page loaded (status: complete), storing form data...');

            // Reduced delay for faster form population
            setTimeout(injectData, 300);
          }
        };

        chrome.tabs.onUpdated.addListener(listener);

        // Send immediate response to prevent port closing
        sendResponse({ success: true, message: 'Test Flow tab opened with script data' });
      });

      return true; // Keep message channel open for async response
    }
    
    if (msg.type === 'START_TRACKING') {
      console.log('🚀 URL tracking started!');
      chrome.storage.local.set({ isTracking: true, captureDOM: true, captureClicks: true, captureInputs: true });

      // Initialize tracking data
      trackingData = {
        urls: [],
        clicks: [],
        domSnapshots: [],
        inputs: [],
        startTime: Date.now(),
        endTime: null
      };

      // Capture initial screenshot, DOM, and URL (Step 0 - landing page)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // Store initial URL (start URL)
          trackingData.startUrl = tabs[0].url;
          console.log('📍 Start URL captured:', tabs[0].url);

          // Capture initial screenshot
          chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, (dataUrl) => {
            if (!chrome.runtime.lastError && dataUrl) {
              // Store initial screenshot as Step 0
              trackingData.initialScreenshot = dataUrl;
              console.log('📸 Initial screenshot captured (Step 0 - landing page)');
            }
          });

          // Capture initial DOM
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              try {
                const clone = document.documentElement.cloneNode(true);
                const elementsToRemove = clone.querySelectorAll('script, style, link[rel="stylesheet"], noscript, iframe, svg, canvas, img, video, audio');
                elementsToRemove.forEach(el => el.remove());
                const allElements = clone.querySelectorAll('*');
                allElements.forEach(el => {
                  const attributesToKeep = ['id', 'class', 'role', 'data-testid', 'type', 'name', 'placeholder', 'value'];
                  const attrs = Array.from(el.attributes);
                  attrs.forEach(attr => {
                    if (!attributesToKeep.includes(attr.name) && !attr.name.startsWith('aria-')) {
                      el.removeAttribute(attr.name);
                    }
                  });
                  if (el.childNodes) {
                    Array.from(el.childNodes).forEach(node => {
                      if (node.nodeType === 3 && node.textContent) {
                        const text = node.textContent.trim();
                        if (text.length > 100) {
                          node.textContent = text.substring(0, 100) + '...';
                        }
                      }
                    });
                  }
                });
                let html = clone.outerHTML;
                html = html.replace(/\s+/g, ' ').trim();
                if (html.length > 200000) {
                  html = html.substring(0, 200000) + '... [truncated]';
                }
                return html;
              } catch (e) {
                return '';
              }
            }
          }).then((results) => {
            if (results && results[0] && results[0].result) {
              trackingData.initialDom = results[0].result;
              console.log('📄 Initial DOM captured (Step 0 - landing page), size:', results[0].result.length, 'bytes');
            }
          }).catch((error) => {
            console.warn('⚠️ Failed to capture initial DOM:', error);
          });
        }
      });

      // Initialize session with server
      initializeSession();

      console.log('📊 Tracking data initialized');

      // Persist initial tracking state
      persistTrackingData();

      return;
    }
    
    if (msg.type === 'STOP_TRACKING') {
      console.log('⏹️ URL tracking stopped!');
      chrome.storage.local.set({ isTracking: false, captureDOM: false, captureClicks: false, captureInputs: false, trackingData: null });

      // Capture final screenshot and URL
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // Store final URL
          trackingData.finalUrl = tabs[0].url;
          console.log('📍 Final URL captured:', tabs[0].url);

          // Capture final screenshot
          chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, (dataUrl) => {
            if (!chrome.runtime.lastError && dataUrl) {
              trackingData.finalScreenshot = dataUrl;
              trackingData.endTime = Date.now();
              console.log('📸 Final screenshot captured');
            }

            // Upload all collected data to server
            uploadAllTrackingData();
          });
        } else {
          // If no active tab, just upload without final screenshot
          trackingData.endTime = Date.now();
          uploadAllTrackingData();
        }
      });

      return;
    }

    if (msg.type === 'TOGGLE_DOM_CAPTURE') {
      chrome.storage.local.get(['captureDOM'], (result) => {
        const newState = !result.captureDOM;
        chrome.storage.local.set({ captureDOM: newState });
        console.log('🔍 DOM capture:', newState ? 'enabled' : 'disabled');
      });
      return;
    }

    if (msg.type === 'TOGGLE_CLICK_CAPTURE') {
      chrome.storage.local.get(['captureClicks'], (result) => {
        const newState = !result.captureClicks;
        chrome.storage.local.set({ captureClicks: newState });
        console.log('🖱️ Click capture:', newState ? 'enabled' : 'disabled');
      });
      return;
    }
    
    if (msg.type === 'PAGE_URL') {
      // Check if tracking is active
      chrome.storage.local.get(['isTracking'], (result) => {
        if (result.isTracking) {
          console.log('📍', msg.url);
          
          // Store the URL in tracking data
          trackingData.urls.push({ 
            timestamp: Date.now(), 
            url: msg.url, 
            title: msg.title 
          });
          
          // Also store in session storage for popup display
          chrome.storage.session.get({ urls: [] }, ({ urls }) => {
            urls.push({ t: Date.now(), url: msg.url, title: msg.title });
            if (urls.length > 500) urls = urls.slice(-500);
            chrome.storage.session.set({ urls });
            
            // Notify popup of new URL
            chrome.runtime.sendMessage({
              type: 'NEW_URL',
              count: urls.length
            }).catch(() => {
              // Ignore errors if popup is not open
            });
          });
        }
      });
    }

    if (msg.type === 'DOM_DATA') {
      // Check if tracking is active
      chrome.storage.local.get(['isTracking', 'captureDOM'], (result) => {
        if (result.isTracking && result.captureDOM) {
          console.log('🌐 DOM captured for:', msg.data.url);
          console.log('📊 Elements:', msg.data.elements.total);
          console.log('🏷️ Tags:', Object.keys(msg.data.elements.tags).length, 'types');
          console.log('🔗 Links:', msg.data.elements.links.length);
          console.log('🖼️ Images:', msg.data.elements.images.length);
          console.log('📝 Forms:', msg.data.elements.forms.length);
          console.log('📏 Depth:', msg.data.structure.depth, 'levels');
          
          // Store DOM data in tracking data
          trackingData.domSnapshots.push(msg.data);
          
          // Also store in session storage for popup display
          chrome.storage.session.get({ domData: [] }, ({ domData }) => {
            domData.push(msg.data);
            if (domData.length > 50) domData = domData.slice(-50); // Keep last 50 DOM captures
            chrome.storage.session.set({ domData });
          });
        }
      });
    }

    if (msg.type === 'TAKE_SCREENSHOT') {
      // Take screenshot of the current tab for immediate display
      console.log('📸 Starting screenshot capture...');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          console.log('📱 Active tab found:', tabs[0].url);
          
          // Capture screenshot
          chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Screenshot error:', chrome.runtime.lastError.message);
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              console.log('✅ Screenshot captured successfully');
              console.log('📏 Data URL length:', dataUrl ? dataUrl.length : 'null');
              
              // Generate filename for reference
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const currentUrl = new URL(tabs[0].url);
              const domain = currentUrl.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
              const filename = `screenshot_${domain}_${timestamp}.png`;
              
              sendResponse({ 
                screenshot: dataUrl, 
                filename: filename,
                saved: false // Will be saved in batch
              });
            }
          });
        } else {
          console.error('❌ No active tab found');
          sendResponse({ error: 'No active tab found' });
        }
      });
      return true; // Keep message channel open for async response
    }

    if (msg.type === 'UPDATE_LAST_SCREENSHOT') {
      // Update the last click's screenshot and DOM with the delayed capture
      console.log('📥 Received UPDATE_LAST_SCREENSHOT message');
      console.log('   - Has screenshot:', !!msg.screenshot);
      console.log('   - Screenshot length:', msg.screenshot ? msg.screenshot.length : 0);
      console.log('   - Has DOM:', !!msg.dom);
      console.log('   - DOM length:', msg.dom ? msg.dom.length : 0);
      console.log('   - Filename:', msg.filename);

      if (trackingData.clicks && trackingData.clicks.length > 0) {
        const lastClick = trackingData.clicks[trackingData.clicks.length - 1];
        console.log('   - Updating click #', trackingData.clicks.length);
        console.log('   - Click was at:', lastClick.url);

        lastClick.screenshot = msg.screenshot;
        lastClick.screenshotDataUrl = msg.screenshot;
        lastClick.screenshotFilename = msg.filename;
        lastClick.dom = msg.dom;
        console.log('📸 Updated last click with screenshot and DOM:', msg.filename, 'DOM size:', msg.dom ? msg.dom.length : 0, 'bytes');

        // Persist to storage
        persistTrackingData();
      } else {
        console.warn('⚠️ No clicks in trackingData to update!');
      }
    }

    if (msg.type === 'CLICK_DATA') {
      // Check if tracking is active
      chrome.storage.local.get(['isTracking', 'captureClicks'], (result) => {
        if (result.isTracking && result.captureClicks) {
          console.log('🖱️ Click captured!');

          // Immediately schedule a screenshot capture with retry
          // This ensures we capture it even if content script loses context
          setTimeout(() => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0] && trackingData.clicks && trackingData.clicks.length > 0) {
                const lastClick = trackingData.clicks[trackingData.clicks.length - 1];

                // Only capture if screenshot is missing
                if (!lastClick.screenshot && !lastClick.screenshotDataUrl) {
                  console.log('⚠️ Screenshot missing for click, capturing now...');

                  // Capture screenshot
                  chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, (dataUrl) => {
                    if (!chrome.runtime.lastError && dataUrl) {
                      lastClick.screenshot = dataUrl;
                      lastClick.screenshotDataUrl = dataUrl;
                      console.log('✅ Fallback screenshot captured');

                      // Try to capture DOM via executeScript
                      chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        func: () => {
                          try {
                            const clone = document.documentElement.cloneNode(true);
                            const elementsToRemove = clone.querySelectorAll('script, style, link[rel="stylesheet"], noscript, iframe, svg, canvas, img, video, audio');
                            elementsToRemove.forEach(el => el.remove());
                            const allElements = clone.querySelectorAll('*');
                            allElements.forEach(el => {
                              const attributesToKeep = ['id', 'class', 'role', 'data-testid', 'type', 'name', 'placeholder', 'value'];
                              const attrs = Array.from(el.attributes);
                              attrs.forEach(attr => {
                                if (!attributesToKeep.includes(attr.name) && !attr.name.startsWith('aria-')) {
                                  el.removeAttribute(attr.name);
                                }
                              });
                              if (el.childNodes) {
                                Array.from(el.childNodes).forEach(node => {
                                  if (node.nodeType === 3 && node.textContent) {
                                    const text = node.textContent.trim();
                                    if (text.length > 100) {
                                      node.textContent = text.substring(0, 100) + '...';
                                    }
                                  }
                                });
                              }
                            });
                            let html = clone.outerHTML;
                            html = html.replace(/\s+/g, ' ').trim();
                            if (html.length > 200000) {
                              html = html.substring(0, 200000) + '... [truncated]';
                            }
                            return html;
                          } catch (e) {
                            return '';
                          }
                        }
                      }).then((results) => {
                        if (results && results[0] && results[0].result) {
                          lastClick.dom = results[0].result;
                          console.log('✅ Fallback DOM captured');
                        }
                        persistTrackingData();
                      }).catch(() => {
                        persistTrackingData();
                      });
                    }
                  });
                }
              }
            });
          }, 1200); // Wait 1.2 seconds for content script to try first

          console.log('📍 URL:', msg.data.url);
          console.log('🎯 Target:', msg.data.clickInfo.target.tagName, msg.data.clickInfo.target.id || msg.data.clickInfo.target.className);
          console.log('📍 Position:', msg.data.clickInfo.x, msg.data.clickInfo.y);
          console.log('🔢 Click #:', msg.data.clickCount);
          console.log('🛤️ XPath:', msg.data.clickInfo.target.xpath);
          console.log('📊 DOM Elements:', msg.data.domSnapshot.elements.total);
          
          // Enhanced meaningful content logging
          console.log('🎯 === MEANINGFUL CONTENT ANALYSIS ===');
          console.log('📝 Original Text:', msg.data.clickInfo.target.textContent);
          console.log('🎯 Meaningful Text:', msg.data.clickInfo.target.meaningfulText);
          console.log('🏷️ Meaningful Tag:', msg.data.clickInfo.target.meaningfulTagName);
          console.log('🛤️ Meaningful XPath:', msg.data.clickInfo.target.meaningfulXpath);
          console.log('🔍 Analysis Type:', msg.data.clickInfo.target.meaningfulType);
          console.log('📏 Element Depth:', msg.data.clickInfo.target.meaningfulDepth);
          
          if (msg.data.clickInfo.target.allMeaningfulCandidates && msg.data.clickInfo.target.allMeaningfulCandidates.length > 0) {
            console.log('🎯 All Candidates Found:');
            msg.data.clickInfo.target.allMeaningfulCandidates.forEach((candidate, index) => {
              console.log(`  ${index + 1}. ${candidate.tag.toUpperCase()}: "${candidate.text}" (priority: ${candidate.priority})`);
            });
          }
          
          // Show the complete click data structure
          console.log('📋 === COMPLETE CLICK DATA ===');
          console.log(JSON.stringify({
            meaningfulText: msg.data.clickInfo.target.meaningfulText,
            meaningfulTagName: msg.data.clickInfo.target.meaningfulTagName,
            meaningfulXpath: msg.data.clickInfo.target.meaningfulXpath,
            meaningfulType: msg.data.clickInfo.target.meaningfulType,
            originalXpath: msg.data.clickInfo.target.originalXpath || msg.data.clickInfo.target.xpath,
            originalText: msg.data.clickInfo.target.textContent,
            originalTag: msg.data.clickInfo.target.tagName
          }, null, 2));
          if (msg.data.screenshot) {
            console.log('📸 Screenshot included');
            if (msg.data.screenshotFilename) {
              console.log('💾 Will be saved in batch:', msg.data.screenshotFilename);
            }
          }
          
          // Store click data in tracking data (keep screenshot for later use)
          const clickDataForStorage = Object.assign({}, msg.data, {
            screenshot: msg.data.screenshot || null,
            screenshotDataUrl: msg.data.screenshot || null
          });
          trackingData.clicks.push(clickDataForStorage);

          // Persist to storage so service worker can recover
          persistTrackingData();
          
          // Also store in session storage for popup display
          chrome.storage.session.get({ clickData: [] }, ({ clickData }) => {
            clickData.push(msg.data);
            if (clickData.length > 100) clickData = clickData.slice(-100); // Keep last 100 clicks
            chrome.storage.session.set({ clickData });
          });
        }
      });
    }

    if (msg.type === 'INPUT_DATA') {
      // Check if tracking is active
      chrome.storage.local.get(['isTracking', 'captureInputs'], (result) => {
        if (result.isTracking && result.captureInputs !== false) {
          console.log('⌨️ Input captured!');
          console.log('📍 URL:', msg.data.url);
          console.log('🏷️ Variable Name:', msg.data.input.variableName);
          console.log('💾 Value:', msg.data.input.value);
          console.log('🛤️ XPath:', msg.data.input.xpath);
          console.log('🔢 Update Count:', msg.data.input.updateCount);

          // Store input data in tracking data
          trackingData.inputs.push(msg.data);

          // Also store in session storage for popup display
          chrome.storage.session.get({ inputData: [] }, ({ inputData }) => {
            inputData.push(msg.data);
            if (inputData.length > 100) inputData = inputData.slice(-100); // Keep last 100 inputs
            chrome.storage.session.set({ inputData });
          });
        }
      });
    }
  });
