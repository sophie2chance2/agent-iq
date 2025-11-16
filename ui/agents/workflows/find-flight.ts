import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { getActionHistory, getThoughts } from "./utils";

export async function findFlightWorkflow(
  stagehand: Stagehand,
  user_input: { url: string; confirmationNumber: string; lastName: string }
) {
  const page = stagehand.context.pages()[0];
  const { url, confirmationNumber, lastName } = user_input;
  const screenshots: { step: string; screenshot: string }[] = [];

  console.log(`[Workflow] Starting flight search on ${url}...`);
  await page.goto(url);

  // Screenshot 1: Initial page
  let screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Initial page load",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  // Step 1: Fill in confirmation number
  await stagehand.act(`Fill in the Confirmation Number field with "${confirmationNumber}"`);

  // Step 2: Fill in last name
  await stagehand.act(`Fill in the Last Name field with "${lastName}"`);

  // Screenshot 2: After filling fields
  screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Filled confirmation and last name",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  // Step 3: Submit form
  await stagehand.act("Click the next or search button to find the flight");

  // Screenshot 3: After search
  screenshotBuffer = await page.screenshot({ fullPage: false });
  screenshots.push({
    step: "Search results page",
    screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
  });

  // Step 4: Extract flight info
  console.log(`[Workflow] Extracting flight information...`);
  const extractionSchema = z.object({
    success: z.boolean().describe("Whether flight info was found successfully"),
    message: z.string().optional(),
    flightInformation: z
      .array(
        z.object({
          flightNumber: z.string().optional(),
          departureDate: z.string().optional(),
          arrivalDate: z.string().optional(),
          departureAirport: z.string().optional(),
          arrivalAirport: z.string().optional(),
        })
      )
      .optional(),
  });

  const extractionResults = await stagehand.extract(
    `Extract the flight information shown on the page (flight number, airports, and dates).`,
    extractionSchema
  );

  // Step 5: Gather metrics
  const aggregateMetrics = await stagehand.metrics;
  console.log("[Workflow] Resolved metrics:", aggregateMetrics);

  // Step 6: Gather action history and thoughts
  const action_history = await getActionHistory(stagehand);
  const thoughts = await getThoughts(stagehand);

  await stagehand.close();

  return {
    aggregateMetrics,
    screenshots,
    extractionResults,
    success: extractionResults?.success ?? false,
    inputToEval: {
      screenshots: screenshots.map((s) => s.screenshot), // only base64
      action_history,
      thoughts,
    },
  };
}
