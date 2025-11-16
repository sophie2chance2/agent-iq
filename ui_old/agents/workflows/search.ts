import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { getActionHistory, getThoughts } from "./utils";

export async function searchWorkflow(
  stagehand: Stagehand,
  user_input: { url: string; searchTerm: string },
  eval_input?: any
) {
  const page = stagehand.context.pages()[0];
  const { url, searchTerm } = user_input;

  const screenshots: { step: string; screenshot: string }[] = [];
  let eval_result: any = null;
  let success = false;

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

  // ------------------ EXTRACTION ------------------
  if (eval_input && Object.keys(eval_input).length > 0) {
    // --- Use eval_input schema ---
    const zodSchema: Record<string, any> = {};
    const expectedValues: Record<string, any> = {};
    const operators: Record<string, string> = {};

    for (const [key, config] of Object.entries(eval_input)) {
      const { type, expectedValue, operator } = config as {
        type: string;
        expectedValue: string;
        operator?: string;
      };
      if (type === "string") {
        zodSchema[key] = z.string();
        expectedValues[key] = expectedValue;
      } else if (type === "number") {
        zodSchema[key] = z.number();
        expectedValues[key] = Number(expectedValue);
        operators[key] = operator || "=";
      } else if (type === "boolean") {
        zodSchema[key] = z.boolean();
        expectedValues[key] = expectedValue.toLowerCase() === "true";
      }
    }

    const fieldNames = Object.keys(eval_input).join(", ");
    try {
      eval_result = await stagehand.extract(
        `Extract the following fields from the page: ${fieldNames}`,
        z.object(zodSchema)
      );

      success = Object.keys(expectedValues).every((key) => {
        const extracted = eval_result[key];
        const expected = expectedValues[key];
        if (typeof expected === "string" && typeof extracted === "string") {
          return extracted.toLowerCase().includes(expected.toLowerCase());
        }
        if (typeof expected === "number" && typeof extracted === "number") {
          const operator = operators[key] || "=";
          switch (operator) {
            case "<":
              return extracted < expected;
            case ">":
              return extracted > expected;
            case "<=":
              return extracted <= expected;
            case ">=":
              return extracted >= expected;
            case "=":
              return extracted === expected;
          }
        }
        return extracted === expected;
      });
    } catch (err) {
      console.error("Extraction using eval_input failed:", err);
      eval_result = {};
      success = false;
    }
  } else {
    // --- Default extraction logic when no eval_input ---
    try {
      eval_result = await stagehand.extract(`Extract ALL product listings for "${searchTerm}" from the search results page.`,
        z.object({
          products: z.array(
            z.object({
              name: z.string(),
              price: z.string().optional(),
              url: z.string().optional(),
            })
          ),
        }),
      );

      screenshotBuffer = await page.screenshot({ fullPage: false });
      screenshots.push({
        step: "Extraction complete",
        screenshot: `data:image/png;base64,${screenshotBuffer.toString(
          "base64"
        )}`,
      });

      success = true;
    } catch (err) {
      console.error("Default extraction failed:", err);
      eval_result = { products: [] };
      success = false;
    }
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
    screenshots, // original objects with data:image/png;base64 prefix
    eval_result,
    success,
    inputToEval: {
      screenshots: screenshots.map((s) => s.screenshot), // already prefixed
      action_history,
      thoughts,
    },
  };
}
