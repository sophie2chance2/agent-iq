import { Globe, Bot, Play, CheckCircle, XCircle, Monitor, BarChart3 } from "lucide-react";

export type Step = "input" | "configure" | "watch" | "results" | "metrics";
export type TestType = "search" | "add-to-cart" | "find-flight" | "agent-task" | "custom-script" | "click-through";
// Config for stepper UI
export const stepConfig: Record<Step, { title: string; icon: typeof Globe }> = {
  input: { title: "Setup Test", icon: Globe },
  configure: { title: "Configure Agent", icon: Bot },
  watch: { title: "Watch Session", icon: Monitor },
  results: { title: "Results", icon: CheckCircle },
  metrics: { title: "Metrics Dashboard", icon: BarChart3 },
};

// Organized LLM models by provider and type
export interface ModelInfo {
  id: string;
  name: string;
  fullName: string;
}

export interface ModelProvider {
  name: string;
  regularModels: ModelInfo[];
  computerUseModels: ModelInfo[];
}

export const llmProviders: ModelProvider[] = [
  {
    name: "Anthropic",
    regularModels: [
      { id: "anthropic/claude-opus-4-1-20250805", name: "Claude Opus 4.1", fullName: "anthropic/claude-opus-4-1-20250805" },
      { id: "anthropic/claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", fullName: "anthropic/claude-haiku-4-5-20251001" },
    ],
    computerUseModels: [
      { id: "anthropic/claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", fullName: "anthropic/claude-sonnet-4-5-20250929" },
      { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", fullName: "anthropic/claude-sonnet-4-20250514" },
      { id: "anthropic/computer-use-preview-2025-03-11", name: "Computer Use Preview", fullName: "anthropic/computer-use-preview-2025-03-11" },
    ],
  },
  {
    name: "Google",
    regularModels: [
      { id: "google/gemini-flash-latest", name: "Gemini Flash Latest", fullName: "google/gemini-flash-latest" },
      { id: "google/gemini-flash-lite-latest", name: "Gemini Flash Lite Latest", fullName: "google/gemini-flash-lite-latest" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", fullName: "google/gemini-2.5-pro" },
      { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", fullName: "google/gemini-2.0-flash" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", fullName: "google/gemini-2.5-flash" },
    ],
    computerUseModels: [
      { id: "google/gemini-2.5-computer-use-preview-10-2025", name: "Gemini 2.5 Computer Use", fullName: "google/gemini-2.5-computer-use-preview-10-2025" },
    ],
  },
  {
    name: "OpenAI",
    regularModels: [
      { id: "openai/gpt-4o", name: "GPT-4o", fullName: "openai/gpt-4o" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", fullName: "openai/gpt-4o-mini" },
      { id: "openai/gpt-4.1", name: "GPT-4.1", fullName: "openai/gpt-4.1" },
      { id: "openai/gpt-5-2025-08-07", name: "GPT-5", fullName: "openai/gpt-5-2025-08-07" },
    ],
    computerUseModels: [],
  },
  {
    name: "xAI",
    regularModels: [
      { id: "xai/grok-4-0709", name: "Grok 4", fullName: "xai/grok-4-0709" },
    ],
    computerUseModels: [],
  },
];

// Legacy model map for backward compatibility
export type LLMModel = "gpt35" | "gpt41" | "claude1" | "claude3" | "custom";

export const llmModelMap: Record<LLMModel, { name: string; model: string }> = {
  gpt35: { name: "OpenAI GPT-3.5", model: "gpt-3.5-turbo" },
  gpt41: { name: "OpenAI GPT-4.1", model: "gpt-4.1" },
  claude1: { name: "Anthropic Claude 1", model: "anthropic/claude-1" },
  claude3: {
    name: "Anthropic Claude 3.5",
    model: "anthropic/claude-sonnet-4-20250514",
  },
};

export const getHumanReadableModelName = (modelStr: string) => {
  // First check new structure
  for (const provider of llmProviders) {
    const allModels = [...provider.regularModels, ...provider.computerUseModels];
    const found = allModels.find(m => m.id === modelStr || m.fullName === modelStr);
    if (found) return found.name;
  }

  // Fall back to legacy
  const entry = Object.values(llmModelMap).find((v) => v.model === modelStr);
  return entry?.name || modelStr;
};
