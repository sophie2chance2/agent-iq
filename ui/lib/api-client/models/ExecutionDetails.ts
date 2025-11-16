/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RunEvent } from './RunEvent';
export type ExecutionDetails = {
    run_id?: string;
    urls?: Array<string>;
    logs?: Array<string> | null;
    /**
     * Link to rrweb JSON/NDJSON in object storage.
     */
    rrweb_events?: string | null;
    llm_steps?: Array<RunEvent> | null;
    screenshots?: Array<string> | null;
};
