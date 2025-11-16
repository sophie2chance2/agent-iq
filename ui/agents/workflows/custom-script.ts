import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { getActionHistory, getThoughts } from "./utils";

export async function customScriptWorkflow(
  stagehand: Stagehand,
  user_input: { scriptContent: string; url?: string },
  eval_input: any
) {
  const startTime = Date.now();
  const page = stagehand.context.pages()[0];

  const { scriptContent, url } = user_input;
  const screenshots: { step: string; screenshot: string }[] = [];

  // Navigate to URL if provided
  if (url) {
    await page.goto(url);

    const buffer = await page.screenshot({ fullPage: false });
    screenshots.push({
      step: "Initial page load",
      screenshot: `data:image/png;base64,${buffer.toString("base64")}`,
    });
  }

  // Strip imports and standalone wrappers from user script
  const strippedScript = scriptContent
    .replace(/import\s+.*?;?\s*\n/g, '')
    .replace(/\/\/\s*Standalone execution wrapper[\s\S]*$/m, '')
    .replace(/\(\s*(\w+)\s*:\s*any\s*,\s*(\w+)\s*:\s*any\s*\)/g, '($1, $2)')
    .trim();

  console.log('[Custom Script] Stripped script preview:', strippedScript.substring(0, 200));

  let scriptResult: any = null;
  let scriptError: string | null = null;

  try {
    let stepNumber = 0;

    const stagehandWrapper = {
      ...stagehand,
      act: async function(actParams: any) {
        stepNumber++;
        const result = await stagehand.act(actParams);

        try {
          const buffer = await page.screenshot({ fullPage: false });
          const screenshot = `data:image/png;base64,${buffer.toString("base64")}`;

          const description = typeof actParams === 'object'
            ? (actParams.description || actParams.action || 'action')
            : actParams;

          screenshots.push({
            step: `Step ${stepNumber}: ${description}`,
            screenshot
          });
        } catch (e) {
          console.error(`[Custom Script] Failed to capture screenshot for step ${stepNumber}:`, e);
        }

        return result;
      },
      extract: stagehand.extract.bind(stagehand),
      observe: stagehand.observe?.bind(stagehand),
      agent: stagehand.agent?.bind(stagehand),
      close: stagehand.close.bind(stagehand),
      context: stagehand.context,
      metrics: stagehand.metrics
    };

    const wrappedScript = `
      ${strippedScript}
      if (typeof main !== 'function') {
        throw new Error('Script must define a main() function');
      }
      return main(page, stagehand);
    `;

    const userFunction = new Function('page', 'stagehand', 'z', wrappedScript);
    scriptResult = await userFunction(page, stagehandWrapper, z);

  } catch (error: any) {
    console.error('[Custom Script] Execution error:', error);
    scriptError = error.message;
  }

  // ------------------ EVAL EXTRACTION ------------------
  let eval_result: any = null;
  let success = false;

  if (eval_input && Object.keys(eval_input).length > 0) {
    const zodSchema: Record<string, any> = {};
    const expectedValues: Record<string, any> = {};
    const operators: Record<string, string> = {};

    for (const [key, config] of Object.entries(eval_input)) {
      const { type, expectedValue, operator } = config as { type: string; expectedValue: string; operator?: string };

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

      success = Object.keys(expectedValues).every(key => {
        const extracted = eval_result[key];
        const expected = expectedValues[key];

        if (typeof expected === "string" && typeof extracted === "string") {
          return extracted.toLowerCase().includes(expected.toLowerCase());
        }
        if (typeof expected === "number" && typeof extracted === "number") {
          const operator = operators[key] || "=";
          switch (operator) {
            case "<": return extracted < expected;
            case ">": return extracted > expected;
            case "<=": return extracted <= expected;
            case ">=": return extracted >= expected;
            case "=": return extracted === expected;
          }
        }
        return extracted === expected;
      });
    } catch (err) {
      console.error("[Custom Script] Eval extraction failed:", err);
      eval_result = {};
      success = false;
    }
  } else if (!scriptError) {
    success = true;
  }

  // ------------------ METRICS ------------------
  const aggregateMetrics = await stagehand.metrics;
  await stagehand.close();

  const executionTime = Date.now() - startTime;
  const customMetrics = {
    ...aggregateMetrics,
    totalInferenceTimeMs: executionTime,
    totalPromptTokens: aggregateMetrics.totalPromptTokens,
    totalCompletionTokens: aggregateMetrics.totalCompletionTokens,
  };

  // ------------------ ACTION HISTORY & THOUGHTS ------------------
  const action_history = await getActionHistory(stagehand);
  const thoughts = await getThoughts(stagehand);

  // ------------------ RETURN ------------------
  return {
    aggregateMetrics: customMetrics,
    screenshots,
    eval_result,
    success,
    scriptResult,
    scriptError,
    inputToEval: {
      screenshots: screenshots.map(s => s.screenshot),
      action_history,
      thoughts,
    }
  };
}
