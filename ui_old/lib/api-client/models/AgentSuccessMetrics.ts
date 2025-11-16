/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AgentSuccessMetrics = {
    num_steps?: number;
    time_to_completion_ms?: number;
    /**
     * Retries when LLM-as-judge flags wrong metric/step.
     */
    num_retries?: number;
    success?: boolean;
    llm_tokens?: number;
    cpu_usage_pct?: number;
};

