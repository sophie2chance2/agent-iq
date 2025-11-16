//import "dotenv/config";

/**
 * Returns the appropriate API key based on the model name
 * @param modelName - The full model name (e.g., "anthropic/claude-3-5-sonnet-20240620", "gpt-4.1")
 * @returns The corresponding API key from environment variables
 */
export function getApiKeyForModel(modelName: string): string {
  console.log(`[getApiKeyForModel] Input modelName: "${modelName}"`);
  console.log(`[getApiKeyForModel] Available env keys:`, {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? '✓ Set' : '✗ Not set',
    MODEL_API_KEY: process.env.MODEL_API_KEY ? '✓ Set' : '✗ Not set',
  });

  if (!modelName) {
    throw new Error("Model name is required");
  }

  // Anthropic models
  if (modelName.includes("anthropic") || modelName.includes("claude")) {
    const key = process.env.ANTHROPIC_API_KEY;
    console.log(`[getApiKeyForModel] Matched Anthropic/Claude. Key available: ${!!key}`);
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
    }
    return key;
  }

  // OpenAI models
  if (modelName.includes("gpt") || modelName.includes("openai")) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error("OPENAI_API_KEY is not set in environment variables");
    }
    return key;
  }

  // Google models
  if (modelName.includes("gemini") || modelName.includes("google")) {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) {
      throw new Error("GOOGLE_API_KEY is not set in environment variables");
    }
    return key;
  }

  // Fallback to MODEL_API_KEY for custom or unknown models
  const fallbackKey = process.env.MODEL_API_KEY;
  if (!fallbackKey) {
    throw new Error(`No API key found for model: ${modelName}. Please set the appropriate API key in .env file`);
  }

  return fallbackKey;
}
