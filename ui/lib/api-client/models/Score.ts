/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentSuccessMetrics } from './AgentSuccessMetrics';
export type Score = {
    run_id?: string;
    /**
     * Parsed robots.txt checks relevant to the task.
     */
    robots_txt_results?: Record<string, any>;
    agent_success_metrics?: AgentSuccessMetrics;
    /**
     * Result payload returned by the agent for the task.
     */
    task_response?: Record<string, any>;
    score_final?: number;
    artifacts?: Array<{
        kind?: 'screenshot' | 'dom' | 'log' | 'rrweb';
        url?: string;
    }>;
};
