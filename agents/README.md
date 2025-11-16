# Agents Directory Structure

This directory contains all browser automation agents and related tools for the w210-fall25-agent-nav-sim project.

## Directory Organization

\`\`\`
agents/
├── workflows/          # Main workflow files (e.g., add-to-cart, search, etc.)
├── tools/             # Utility tools (metrics, logging, API keys)
├── utils/             # Helper utilities (replay, execution)
├── tests/             # Test scripts
├── v1/                # Version 1 implementations
├── v2/                # Version 2 implementations
├── downloads/         # Downloaded artifacts
├── inference_summary/ # AI inference logs
└── logs/              # Runtime logs
\`\`\`

## Folder Descriptions

### `workflows/`
Main automation workflows that perform specific tasks:
- `add-to-cart.ts` - E-commerce add-to-cart automation
- `search.ts` - Search functionality testing
- `find-flight.ts` - Flight search automation
- `agent-task.ts` - General agent tasks
- `browser-extension.ts` - Browser extension testing
- `custom-script.ts` - Custom automation scripts

### `tools/`
Reusable tools and utilities:
- `logger.ts` - Custom logging utility for all agents
- `workflow-logger.ts` - CSV workflow logging
- `browserbase-metrics.ts` - Browserbase session metrics collection
- `get-api-key.ts` - API key management
- `debug-metrics.ts` - Debug metrics utilities
- `simple-metrics.ts` - Simple metrics collection

### `utils/`
Helper utilities:
- `replay-agent.ts` - Replay agent functionality
- `execute.ts` - Execution helpers
- `custom.ts` - Custom utilities
- `single_agent.ts` - Single agent utilities

### `tests/`
Test scripts for development:
- `test-stagehand-v3.ts` - Stagehand v3 feature tests
- `test-session-id.ts` - Session ID testing
- `test.ts` - General tests
- `testbrowser.ts` - Browser testing
- `testorca.ts` - Orca testing

## Import Paths

When importing from other directories, use relative paths:

\`\`\`typescript
// From workflows/ to tools/
import { createLogger } from "../tools/logger";
import { workflowLogger } from "../tools/workflow-logger";
import { getBrowserbaseSessionMetrics } from "../tools/browserbase-metrics";

// From workflows/ to utils/
import { convertHistoryToScript } from "../utils/replay-agent";

// From tests/ to tools/
import { createLogger } from "../tools/logger";
\`\`\`

## Running Workflows

Execute workflows from the project root:

\`\`\`bash
# Run a workflow
npx ts-node agents/workflows/add-to-cart.ts

# Run a test
npx ts-node agents/tests/test-stagehand-v3.ts
\`\`\`

## Environment Variables

Workflows require environment variables in `.env`:
- `BROWSERBASE_API_KEY` - Browserbase API key
- `BROWSERBASE_PROJECT_ID` - Browserbase project ID
- `ANTHROPIC_API_KEY` - Anthropic API key (for Claude models)
- `OPENAI_API_KEY` - OpenAI API key (for GPT models)
