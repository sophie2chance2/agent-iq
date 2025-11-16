import { Stagehand } from "@browserbasehq/stagehand";

// Utility to extract action history from Stagehand
export async function getActionHistory(stagehand: Stagehand): Promise<string[]> {
  const history = await stagehand.history;
  return history.map((entry) => {
    if (entry.result && typeof entry.result === "object") {
      if ("actions" in entry.result && Array.isArray(entry.result.actions)) {
        return entry.result.actions.map((a) => a.description).join("; ");
      }
      if ("message" in entry.result) return entry.result.message;
    }
    return entry.method;
  });
}

// Utility to extract "thoughts" from Stagehand
export async function getThoughts(stagehand: Stagehand): Promise<string[]> {
  const history = await stagehand.history;
  return history.map((entry) => {
    if (entry.result && typeof entry.result === "object" && "message" in entry.result) {
      return entry.result.message;
    }
    return `Performed ${entry.method}`;
  });
}
