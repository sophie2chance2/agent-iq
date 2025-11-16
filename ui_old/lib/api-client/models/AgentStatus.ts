/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AgentStatus = {
    run_id: string;
    status: AgentStatus.status;
};
export namespace AgentStatus {
    export enum status {
        QUEUED = 'queued',
        RUNNING = 'running',
        SUCCEEDED = 'succeeded',
        FAILED = 'failed',
    }
}

