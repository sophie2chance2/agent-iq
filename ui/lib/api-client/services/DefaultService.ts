/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentStatus } from '../models/AgentStatus';
import type { CreateSessionRequest } from '../models/CreateSessionRequest';
import type { CreateSessionResponse } from '../models/CreateSessionResponse';
import type { ExecutionDetails } from '../models/ExecutionDetails';
import type { RobotsAnalysisRequest } from '../models/RobotsAnalysisRequest';
import type { RobotsAnalysisResponse } from '../models/RobotsAnalysisResponse';
import type { RunEvent } from '../models/RunEvent';
import type { RunRequest } from '../models/RunRequest';
import type { RunResponse } from '../models/RunResponse';
import type { RunSummary } from '../models/RunSummary';
import type { ScoreDetail } from '../models/ScoreDetail';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Health check
     * @returns any ok
     * @throws ApiError
     */
    public static health(): CancelablePromise<{
        status?: string;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/health',
        });
    }
    /**
     * Start a new run
     * @param requestBody
     * @returns RunResponse created
     * @throws ApiError
     */
    public static createRun(
        requestBody: RunRequest,
    ): CancelablePromise<RunResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/runs',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `invalid input`,
            },
        });
    }
    /**
     * Get run status and summary
     * @param runId
     * @returns RunSummary ok
     * @throws ApiError
     */
    public static getRun(
        runId: string,
    ): CancelablePromise<RunSummary> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/runs/{run_id}',
            path: {
                'run_id': runId,
            },
            errors: {
                404: `not found`,
            },
        });
    }
    /**
     * List step of events
     * @param runId
     * @param cursor
     * @param limit
     * @returns any ok
     * @throws ApiError
     */
    public static listEvents(
        runId: string,
        cursor?: string | null,
        limit: number = 100,
    ): CancelablePromise<{
        items?: Array<RunEvent>;
        next_cursor?: string | null;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/runs/{run_id}/events',
            path: {
                'run_id': runId,
            },
            query: {
                'cursor': cursor,
                'limit': limit,
            },
            errors: {
                404: `not found`,
            },
        });
    }
    /**
     * Get final score and detailed metrics
     * @param runId
     * @returns ScoreDetail ok
     * @throws ApiError
     */
    public static getScore(
        runId: string,
    ): CancelablePromise<ScoreDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/runs/{run_id}/score',
            path: {
                'run_id': runId,
            },
            errors: {
                404: `not found`,
            },
        });
    }
    /**
     * Get agent status for polling
     * @param runId
     * @returns AgentStatus ok
     * @throws ApiError
     */
    public static getRunStatus(
        runId: string,
    ): CancelablePromise<AgentStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/runs/{run_id}/status',
            path: {
                'run_id': runId,
            },
            errors: {
                404: `not found`,
            },
        });
    }
    /**
     * Get execution details (URLs, logs, rrweb, LLM steps, screenshots)
     * @param runId
     * @returns ExecutionDetails ok
     * @throws ApiError
     */
    public static getExecutionDetails(
        runId: string,
    ): CancelablePromise<ExecutionDetails> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/runs/{run_id}/execution_details',
            path: {
                'run_id': runId,
            },
            errors: {
                404: `not found`,
            },
        });
    }
    /**
     * Analyze robots.txt compliance for a set of visited URLs
     * @param requestBody
     * @returns RobotsAnalysisResponse ok
     * @throws ApiError
     */
    public static analyzeRobots(
        requestBody: RobotsAnalysisRequest,
    ): CancelablePromise<RobotsAnalysisResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/robots/analyze',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `invalid input`,
            },
        });
    }
    /**
     * Create Session
     * @param requestBody
     * @returns CreateSessionResponse Successful Response
     * @throws ApiError
     */
    public static createSession(
        requestBody: CreateSessionRequest,
    ): CancelablePromise<CreateSessionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/session/create',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `invalid input`,
            },
        });
    }
}
