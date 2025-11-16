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

export function RunEventFromJSON(json: any): RunEvent {
    return RunEventFromJSONTyped(json, false);
}

export function RunEventFromJSONTyped(json: any, ignoreDiscriminator: boolean): RunEvent {
    if (json === undefined || json === null) {
        return json;
    }
    return {
        ts: json['ts'],
        step: json['step'],
        action: json['action'],
        status: json['status'],
        details: json['details'],
    };
}

export function RunEventToJSON(value?: RunEvent | null): any {
    return RunEventToJSONTyped(value, false);
}

export function RunEventToJSONTyped(value?: RunEvent | null, ignoreDiscriminator: boolean = false): any {
    if (value === undefined || value === null) {
        return value;
    }

    return {
        ts: value.ts,
        step: value.step,
        action: value.action,
        status: value.status,
        details: value.details,
    };
}
