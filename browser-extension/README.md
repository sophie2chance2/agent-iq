# Browser Extension - Click Recorder & Script Generator

A Chrome extension that records your browser interactions and automatically generates executable scripts. This extension integrates with the w210-fall25-agent-nav-sim ecosystem to replay your actions through AI-powered browser automation.

## 🚀 Features

- **🖱️ Click Recording**: Captures every click with precise XPath selectors and meaningful content analysis
- **📸 Screenshot Capture**: Automatically takes screenshots for each interaction
- **🌐 Navigation Tracking**: Monitors page visits and URL changes (including SPA navigation)
- **📊 DOM Analysis**: Captures detailed page structure and metadata
- **🎬 Automatic Script Generation**: Converts your recorded actions into executable Stagehand scripts
- **☁️ Workflow Integration**: Executes generated scripts through Browserbase with AI-powered automation
- **📈 Real-time Visualization**: Popup interface showing all captured interactions

## 📋 Prerequisites

- **Google Chrome** (version 88 or higher)
- **Node.js** and **npm** installed
- **The main application** running on `localhost:3000`
  - Navigate to the `ui` folder and run `npm run dev`
- **Browserbase account** (for workflow execution)
- Required environment variables configured in the main application

## 🛠️ Installation

### Step 1: Set Up the Main Application

\`\`\`bash
# Clone the repository
git clone <repository-url>
cd w210-fall25-agent-nav-sim

# Install dependencies
cd ui
npm install

# Configure environment variables
# Create a .env file with required keys:
# - MODEL_API_KEY (Anthropic API key)
# - BROWSERBASE_PROJECT_ID
# - BROWSERBASE_API_KEY

# Start the development server
npm run dev
\`\`\`

Verify the server is running at `http://localhost:3000`

### Step 2: Install the Chrome Extension

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Toggle **"Developer mode"** ON (top-right corner)
4. Click **"Load unpacked"**
5. Navigate to and select the `browser-extension` folder in this repository
6. The extension should now appear in your extensions list

### Step 3: Pin the Extension (Recommended)

1. Click the **puzzle piece icon** (🧩) in Chrome's toolbar
2. Find the extension in the list
3. Click the **pin icon** (📌) to keep it visible in your toolbar

## 🎯 How to Use

### Quick Start

1. **Ensure the server is running** at `http://localhost:3000`
2. **Click the extension icon** in your Chrome toolbar
3. **Test connection**: Click "Test Server" to verify connectivity
4. **Start recording**: Click "Start Tracking"
5. **Perform your workflow**: Browse and click on elements as you normally would
6. **Stop recording**: Click "Stop Tracking" to generate and execute the script

### Recording Session

When tracking is active, the extension captures:

- **🌐 Navigation Events**: Every page visit and URL change
- **🖱️ Click Events**:
  - Element XPath (both original and meaningful)
  - Element text content
  - Click coordinates
  - Target element details (tag, id, class)
  - Surrounding DOM context
- **📸 Screenshots**: Captured at each click interaction
- **📊 DOM Snapshots**: Complete page structure at key moments

### Script Generation & Execution

When you click "Stop Tracking":

1. **Data Upload**: All captured interactions are sent to `/api/browser-extension/execute`
2. **Script Generation**: The workflow automatically converts your clicks into a Stagehand script:
   \`\`\`javascript
   // Example generated script
   async function customScript(ctx) {
     const { page, logger } = ctx;

     // Step 1: Click on BUTTON with text "Sign In"
     await page.act({
       action: "click",
       xpath: "//button[contains(text(), 'Sign In')]",
       description: "Click BUTTON: Sign In"
     });
     await page.waitForTimeout(1000);

     // Step 2: Click on INPUT
     await page.act({
       action: "click",
       xpath: "//input[@id='email']",
       description: "Click INPUT: "
     });
     // ... more steps
   }
   \`\`\`
3. **Workflow Execution**: Script runs through Stagehand/Browserbase
4. **Results**: View execution logs, debug URLs, and screenshots in:
   - Browser extension console (right-click extension → Inspect)
   - Server console output
   - Browserbase dashboard

### Viewing Results

**Browser Console:**
\`\`\`bash
# Open extension console
Right-click extension icon → Inspect → Console tab

# Look for:
✅ Data uploaded successfully to workflow!
🎬 Workflow execution started...
🔗 Debug URL: https://browserbase.com/sessions/...
✅ Workflow completed successfully!
\`\`\`

**Server Logs:**
\`\`\`bash
# In your ui folder terminal
📝 Running browser extension workflow...
📊 Processing 5 recorded clicks
🌐 Navigated to https://example.com
✅ Script executed successfully
\`\`\`

## 🏗️ Architecture

### Data Flow

\`\`\`
Browser Extension → Content Script → Background Script → API Endpoint → Workflow Agent → Stagehand → Browserbase
     (Captures)      (Analyzes)       (Uploads)      (/api/browser-    (Generates    (Executes)  (Runs in
                                                      extension/        Script)                    Cloud)
                                                      execute)
\`\`\`

### Key Components

- **`content.js`**: Injected into web pages, captures clicks and DOM
- **`background.js`**: Service worker, manages data collection and upload
- **`popup.js`**: UI for starting/stopping recording
- **`/api/browser-extension/execute/route.ts`**: API endpoint handler
- **`/agents/browser-extension.ts`**: Workflow that generates and executes scripts

## 🔧 Configuration

### Server Configuration (background.js)

\`\`\`javascript
const SERVER_CONFIG = {
  baseUrl: 'http://localhost:3000',
  projectId: 'detective_dom',
  apiEndpoint: '/api/browser-extension/execute'
};
\`\`\`

### Workflow Parameters

Default parameters sent to the workflow:

\`\`\`javascript
{
  advancedStealth: false,      // Browserbase stealth mode
  proxies: false,              // Use proxies
  environment: "BROWSERBASE",  // Execution environment
  modelName: "anthropic/claude-3-5-sonnet-20240620",
  experimental: false
}
\`\`\`

## 🐛 Troubleshooting

### Extension Not Recording

1. Check extension is enabled: `chrome://extensions/`
2. Reload the extension after code changes
3. Verify "Start Tracking" button was clicked
4. Check browser console for errors

### Server Connection Failed

1. Verify server is running: `curl http://localhost:3000`
2. Check `npm run dev` is running in `ui` folder
3. Verify no port conflicts (port 3000 must be available)
4. Check for CORS errors in browser console

### Workflow Execution Failed

1. Verify environment variables are set in `ui/.env`:
   - `MODEL_API_KEY`
   - `BROWSERBASE_PROJECT_ID`
   - `BROWSERBASE_API_KEY`
2. Check Browserbase account has active subscription
3. Review server console logs for detailed errors
4. Verify Stagehand dependencies are installed

### No Data Being Captured

1. Ensure tracking is started before browsing
2. Check that you're clicking on actual interactive elements
3. Open extension console to view real-time logs
4. Verify content script is injected (check page source)

## 💡 Tips & Best Practices

1. **Start Simple**: Record 2-3 clicks first to test the workflow
2. **Wait Between Actions**: Let pages fully load before clicking
3. **Use Meaningful Elements**: Click on buttons/links with clear text
4. **Check Debug URLs**: Use Browserbase debug URLs to see live execution
5. **Clear Old Sessions**: Stop tracking before starting a new session
6. **Monitor Console**: Keep extension console open to see real-time feedback

## 🔐 Security & Privacy

- All data is processed locally and sent only to your configured server
- Screenshots are temporary and not persisted (unless configured)
- No data is sent to third parties except Browserbase (for execution)
- Extension requires minimal permissions for operation

## 📚 Related Documentation

- [Main Project README](../README.md)
- [API Documentation](../ui/app/api/README.md)
- [Agent Workflows](../agents/README.md)
- [Stagehand Documentation](https://docs.stagehand.dev)
- [Browserbase Documentation](https://docs.browserbase.com)
