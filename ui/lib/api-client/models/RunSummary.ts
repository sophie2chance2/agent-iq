/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RunSummary = {
    run_id?: string;
    site?: string;
    task_id?: string;
    status?: RunSummary.status;
    started_at?: string;
    finished_at?: string | null;
    links?: {
        score?: string;
        events?: string;
    };
    session_id?: string | null;
    session_live_view_url?: string | null;
};
export namespace RunSummary {
    export enum status {
        QUEUED = 'queued',
        RUNNING = 'running',
        SUCCEEDED = 'succeeded',
        FAILED = 'failed',
    }
}
