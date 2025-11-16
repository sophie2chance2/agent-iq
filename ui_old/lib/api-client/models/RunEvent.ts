/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RunEvent = {
    ts?: string;
    step?: string;
    action?: string;
    status?: RunEvent.status;
    details?: Record<string, any>;
};
export namespace RunEvent {
    export enum status {
        OK = 'ok',
        RETRY = 'retry',
        FAIL = 'fail',
    }
}

