/**
 * Script generation utilities for creating downloadable Stagehand workflow scripts
 */

interface WorkflowParams {
  environment: string;
  modelName: string;
  proxies: boolean;
  advancedStealth: boolean;
  deviceType: string;
}

/**
 * Generates the runStagehand wrapper function that initializes Stagehand
 * and calls the main workflow function
 */
function generateRunStagehandWrapper(params: WorkflowParams): string {
  return `// Standalone execution wrapper
async function runStagehand() {
  const stagehand = new Stagehand({
    env: "${params.environment}",
    browserbaseSessionCreateParams: {
      proxies: ${params.proxies},
      browserSettings: {
        advancedStealth: ${params.advancedStealth},
      },
      os: "${params.deviceType}",
    },
    model: "${params.modelName}",
  });

  await stagehand.init();
  const page = stagehand.context.pages()[0];

  await main(page, stagehand);

  await stagehand.close();
}

// Run standalone if executed directly
if (require.main === module) {
  runStagehand().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}`;
}

export function generateClickThroughScript(url: string, scriptContent: string, params: WorkflowParams): string {
  // Escape special characters in strings
  const escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // Extract just the main function body from the scriptContent
  const mainFunctionMatch = scriptContent.match(/async function main\([^)]*\)\s*\{([\s\S]*)\}/);
  let mainBody = mainFunctionMatch ? mainFunctionMatch[1].trim() : scriptContent;

  // Remove any return statements and completion console.log from the body
  mainBody = mainBody
    .replace(/console\.log\(["']All.*action.*completed["']\);?\s*/gi, '')
    .replace(/return\s+\{[^}]*\};?\s*$/gi, '')
    .trim();

  return `import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";

// Main workflow function that can be used standalone or with custom script workflow
async function main(page: any, stagehand: any) {
  const url = "${escapedUrl}";

  await page.goto(url);

  ${mainBody}

  console.log("Click-through workflow completed successfully");
}

${generateRunStagehandWrapper(params)}`;
}

export function generateAgentTaskScript(url: string, taskInstruction: string, params: WorkflowParams): string {
  // Escape special characters in strings
  const escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedTaskInstruction = taskInstruction.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

  return `import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";

// Main workflow function that can be used standalone or with custom script workflow
async function main(page: any, stagehand: any) {
  const url = "${escapedUrl}";
  const taskInstruction = "${escapedTaskInstruction}";
  const systemPrompt = "You are a helpful assistant that can use a web browser. Please complete the tasks to the best of your ability.";

  const agent = stagehand.agent({
    systemPrompt: systemPrompt,
  });

  await page.goto(url);

  await agent.execute({
    instruction: taskInstruction,
  });

  console.log("Task completed successfully");
}

${generateRunStagehandWrapper(params)}`;
}

export function generateAddToCartScript(url: string, searchTerm: string, params: WorkflowParams): string {
  // Escape special characters in strings
  const escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedSearchTerm = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

  return `import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

// Main workflow function that can be used standalone or with custom script workflow
async function main(page: any, stagehand: any) {
  const url = "${escapedUrl}";
  const searchTerm = "${escapedSearchTerm}";

  await page.goto(url);

  await stagehand.act(\`Fill in the search bar with "\${searchTerm}"\`);

  await stagehand.act("Click the search button or press enter to search");

  await stagehand.act("Click add to cart button for the first product");

  await stagehand.act("add the item to the cart");

  await new Promise(resolve => setTimeout(resolve, 1000));

  let evalResult;
  let success = false;

  try {
    evalResult = await stagehand.extract(\`Extract the number of items in the cart from the page. Look for shopping cart icon with a number, or text showing cart quantity.\`, z.object({
      cartCount: z.number().describe("The number of items in the cart")
    }));

    if (evalResult.cartCount > 0) {
      success = true;
    }

    console.log(\`Cart count: \${evalResult.cartCount}\`);
    console.log(\`Success: \${success}\`);
  } catch (error) {
    console.error("Evaluation failed:", error);
  }

  console.log("Add to cart workflow completed");
}

${generateRunStagehandWrapper(params)}`;
}
