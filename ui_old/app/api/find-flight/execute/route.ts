import { NextRequest } from 'next/server';
import { defineEnvironment } from '../../../../../agents/define-agent';
import { findFlightWorkflow } from '../../../../../agents/workflows/find-flight';

export async function POST(request: NextRequest) {
  try {
    const { url, confirmationNumber, lastName, evalInput, parameters } = await request.json();

    if (!url || !confirmationNumber || !lastName) {
      return new Response(JSON.stringify({ error: 'URL, confirmation number, and last name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parameters can be either a single object or an array of objects
    const parametersArray = Array.isArray(parameters) ? parameters : [parameters || {}];

    // Transform each parameter set to include defaults
    const workflowParametersArray = parametersArray.map(params => ({
      modelName: params?.modelName || "openai/gpt-4o-mini",
      advancedStealth: params?.advancedStealth ?? false,
      proxies: params?.proxies ?? false,
      experimental: params?.experimental ?? false,
      environment: "BROWSERBASE",
      deviceType: params?.deviceType || "mac",
    }));

    // Customer input for find-flight workflow
    const customerInput = { url, confirmationNumber, lastName };

    // Create a readable stream for SSE to send debug URL and results to UI
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode('data: {"status":"started"}\n\n'));

          // Run all workflows in parallel
          const workflowPromises = workflowParametersArray.map(async (workflowParameters, index) => {
            try {
              console.log(`[API] Starting find-flight workflow ${index + 1}/${workflowParametersArray.length}`);

              // Initialize browser environment
              const { stagehand, liveViewLink, sessionId } = await defineEnvironment(workflowParameters);
              console.log(`[API] Workflow ${index + 1} - Live view: ${liveViewLink}`);

              // Send debug URL through SSE
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ debuggerUrl: liveViewLink })}\n\n`));

              // Execute the find-flight workflow
              const result = await findFlightWorkflow(stagehand, customerInput, evalInput);
              console.log(`[API] Workflow ${index + 1} completed successfully`);

              // Transform metrics to match frontend expectations
              const metrics = result?.aggregateMetrics ? {
                executionTime: result.aggregateMetrics.totalInferenceTimeMs,
                totalTokens: result.aggregateMetrics.totalPromptTokens + result.aggregateMetrics.totalCompletionTokens,
                promptTokens: result.aggregateMetrics.totalPromptTokens,
                completionTokens: result.aggregateMetrics.totalCompletionTokens,
                ...result.aggregateMetrics
              } : null;

              return {
                metrics,
                aggregateMetrics: result?.aggregateMetrics,
                screenshots: result?.screenshots,
                extractionResults: {
                  success: result?.success,
                  evalResult: result?.eval_result,
                },
                params: {
                  modelName: workflowParameters.modelName,
                  advancedStealth: workflowParameters.advancedStealth,
                  proxies: workflowParameters.proxies,
                  experimental: workflowParameters.experimental,
                  environment: workflowParameters.environment,
                  deviceType: workflowParameters.deviceType,
                },
              };
            } catch (error: any) {
              console.error(`[API] Find-flight workflow ${index + 1} error:`, error);
              return {
                error: error.message,
                params: workflowParameters,
              };
            }
          });

          // Wait for all workflows to complete
          const allResults = await Promise.all(workflowPromises);

          // Send final results
          const completionMessage = JSON.stringify({
            status: "completed",
            results: allResults,
          });
          console.log(`[API] Sending completion message with ${allResults.length} results`);
          controller.enqueue(encoder.encode(`data: ${completionMessage}\n\n`));

          // Give it a moment before closing
          await new Promise(resolve => setTimeout(resolve, 100));
          controller.close();
        } catch (error: any) {
          console.error('[API] Find-flight workflow error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[API] Find-flight workflow setup error:', error);
    return new Response(JSON.stringify({ error: 'Failed to start find-flight workflow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
