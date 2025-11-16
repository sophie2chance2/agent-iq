import { NextRequest } from 'next/server';
import { defineEnvironment } from '../../../../agents/define-agent';
import { searchWorkflow } from '../../../../agents/workflows/search';

export async function POST(request: NextRequest) {
  try {
    const { url, searchTerm, evalInput, parameters } = await request.json();

    if (!url || !searchTerm) {
      return new Response(JSON.stringify({ error: 'URL and searchTerm are required' }), {
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

    // Customer input for search workflow
    const customerInput = { url, searchTerm };

    // Create a readable stream for SSE to send debug URL to UI
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial message
          controller.enqueue(encoder.encode('data: {"status":"started"}\n\n'));

          // Execute all workflows in parallel
          const workflowPromises = workflowParametersArray.map(async (workflowParameters, index) => {
            try {
              console.log(`[API] Starting workflow ${index + 1}/${workflowParametersArray.length}`);

              // Set up environment and run workflow
              const { stagehand, liveViewLink, sessionId } = await defineEnvironment(workflowParameters);

              console.log(`[API] Workflow ${index + 1} - Live view link: ${liveViewLink}`);
              console.log(`[API] Workflow ${index + 1} - Session ID: ${sessionId}`);

              // Send debug URL through SSE stream to UI
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ debuggerUrl: liveViewLink })}\n\n`));

              // Run the search workflow
              const result = await searchWorkflow(stagehand, customerInput, evalInput);

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
                metrics: metrics,
                aggregateMetrics: result?.aggregateMetrics,
                screenshots: result?.screenshots,
                extractionResults: {
                  success: result?.success,
                  evalResult: result?.eval_result
                },
                params: {
                  modelName: workflowParameters.modelName,
                  advancedStealth: workflowParameters.advancedStealth,
                  proxies: workflowParameters.proxies,
                  experimental: workflowParameters.experimental,
                  environment: workflowParameters.environment,
                  deviceType: workflowParameters.deviceType,
                }
              };
            } catch (error: any) {
              console.error(`[API] Workflow ${index + 1} error:`, error);
              // Return error result for this workflow
              return {
                error: error.message,
                params: {
                  modelName: workflowParameters.modelName,
                  advancedStealth: workflowParameters.advancedStealth,
                  proxies: workflowParameters.proxies,
                  experimental: workflowParameters.experimental,
                  environment: workflowParameters.environment,
                  deviceType: workflowParameters.deviceType,
                }
              };
            }
          });

          // Wait for all workflows to complete
          const allResults = await Promise.all(workflowPromises);

          // Send completion message with all results
          const completionMessage = JSON.stringify({
            status: "completed",
            results: allResults
          });
          console.log(`[API] Sending completion message with ${allResults.length} results`);
          controller.enqueue(encoder.encode(`data: ${completionMessage}\n\n`));

          // Wait a bit to ensure the message is sent before closing
          await new Promise(resolve => setTimeout(resolve, 100));

          console.log('[API] Closing stream');
          controller.close();
        } catch (error: any) {
          console.error('[API] Search workflow error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('[API] Search workflow setup error:', error);
    return new Response(JSON.stringify({ error: 'Failed to start search workflow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
