import { Stagehand } from "@browserbasehq/stagehand";
import { getApiKeyForModel } from "./tools/get-api-key";
import { Browserbase } from "@browserbasehq/sdk";
import fs from "fs";
import { defineEnvironment } from "./define-agent";

const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY,
});

// import the workflow scripts
import { agentWorkflow } from "./workflows/agent";
import { addToCartWorkflow } from "./workflows/add-to-cart";

const default_input_parameters = {
    advancedStealth: false,
    proxies: false,
    environment: "BROWSERBASE",
    modelName: "openai/gpt-4o-mini",
    experimental: false,
    deviceType: "desktop",
}

async function main() {

    const {stagehand, liveViewLink} = await defineEnvironment(default_input_parameters);
    console.log(liveViewLink);

    // AGENT TASK //
    const agent_user_input = {
            url: "https://www.example.com",
            taskInstruction: "Click learn more button",
        }

    const eval_input = {
        title:"Example Domains"
    }
    const result = await agentWorkflow(stagehand, agent_user_input, eval_input).catch(console.error);

    const atc_user_input = {
        url: "https://www.amazon.com",
        searchTerm: "shampoo",
    }
    // const result = await addToCartWorkflow(stagehand, atc_user_input).catch(console.error);

    // console.log(result?.aggregateMetrics);
    // console.log(result?.screenshots?.length || 0);


}

main().catch(console.error);