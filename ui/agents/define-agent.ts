import { Stagehand } from "@browserbasehq/stagehand";
import { getApiKeyForModel } from "./tools/get-api-key";
import { Browserbase } from "@browserbasehq/sdk";
import fs from "fs";

const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY,
});


export async function defineEnvironment(input_parameters: any) {
    const stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        model: {
            modelName: input_parameters.modelName,
            apiKey: getApiKeyForModel(input_parameters.modelName),
        },
        browserbaseSessionCreateParams: {
            projectId: process.env.BROWSERBASE_PROJECT_ID!,
            browserSettings: {
                advancedStealth: input_parameters.advancedStealth,
            },
            proxies: input_parameters.proxies,
        },
        experimental: input_parameters.experimental,
        verbose: 0,
        disableAPI: true,
    });

    await stagehand.init();

    // In Stagehand v3, the property is browserbaseSessionId (with lowercase 'd' in Id)
    const sessionId = (stagehand as any).browserbaseSessionId;

    if (!sessionId) {
        throw new Error("Failed to create Browserbase session - session ID is null. Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.");
    }

    console.log(`[defineEnvironment] Session ID: ${sessionId}`);

    const liveViewLinks = await bb.sessions.debug(sessionId);
    const liveViewLink = liveViewLinks.debuggerFullscreenUrl;

    return {stagehand, liveViewLink, sessionId};
}
