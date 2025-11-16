import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { getActionHistory, getThoughts } from "./utils";

export async function agentWorkflow(
  stagehand: Stagehand,
  user_input: { url: string; taskInstruction: string },
  eval_input: any
) {
  const page = stagehand.context.pages()[0];
  const { url, taskInstruction } = user_input;

  const agent = stagehand.agent({
    systemPrompt:
      "You are a helpful assistant that can use a web browser. Please complete the tasks to the best of your ability.",
  });

  const screenshots: { step: string; screenshot: string }[] = [];

  await page.goto(url);

  // Screenshot 1: Initial page
  let screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Initial page load",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  await agent.execute({
    instruction: taskInstruction,
  });

  // Screenshot 2: After task completion
  screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Task completion",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  // ------------------ EXTRACTION ------------------
  let eval_result: any = null;
  let success = false;

  if (eval_input && Object.keys(eval_input).length > 0) {
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
            default:
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
    screenshots, // full objects with step + base64 screenshot
    eval_result,
    success,
    inputToEval: {
      screenshots: screenshots.map((s) => s.screenshot), // only base64
      action_history,
      thoughts,
    },
  };
}
