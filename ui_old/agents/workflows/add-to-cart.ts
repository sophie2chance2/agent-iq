import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { getActionHistory, getThoughts } from "./utils";

export async function addToCartWorkflow(
  stagehand: Stagehand,
  user_input: { url: string; searchTerm: string }
) {
  const page = stagehand.context.pages()[0];
  const { url, searchTerm } = user_input;

  const screenshots: { step: string; screenshot: string }[] = [];

  // ------------------ NAVIGATE & SEARCH ------------------
  await page.goto(url);

  // Screenshot 1: Initial page
  let screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Initial page load",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  await stagehand.act(`Fill in the search bar with "${searchTerm}"`);

  // Screenshot 2: After filling search bar
  screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Filled search bar",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  await stagehand.act("Click the search button or press enter to search");

  // Screenshot 3: Search results displayed
  screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Search results displayed",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  // ------------------ ADD TO CART ------------------
  await stagehand.act("Click add to cart button for the first product");

  // Screenshot 4: After clicking add to cart
  screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Clicked add to cart button",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  await stagehand.act("Add the item to the cart");

  // Screenshot 5: After adding item to cart
  screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Added the item to the cart",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });


  // ------------------ EXTRACTION ------------------
  let eval_result: any = null;
  let success = false;

  try {
    eval_result = await stagehand.extract(
      `Extract the number of items in the cart from the page. Look for shopping cart icon with a number, or text showing cart quantity.`,
      z.object({
        cartCount: z.number().describe("The number of items in the cart"),
      })
    );

    if (eval_result.cartCount > 0) success = true;
  } catch (error) {
    console.error("[Workflow] Extraction failed:", error);
    eval_result = { cartCount: 0 };
    success = false;
  }

  // ------------------ METRICS ------------------
  const aggregateMetrics = await stagehand.metrics;

  // ------------------ ACTION HISTORY & THOUGHTS ------------------
  const action_history = await getActionHistory(stagehand);
  const thoughts = await getThoughts(stagehand);

  await stagehand.close();

  // ------------------ RETURN ------------------
  return {
    aggregateMetrics,
    screenshots,
    eval_result,
    success,
    inputToEval: {
      screenshots: screenshots.map((s) => s.screenshot),
      action_history,
      thoughts,
    },
  };
}