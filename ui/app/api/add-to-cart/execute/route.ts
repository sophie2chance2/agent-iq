import { NextRequest } from 'next/server';
import { defineEnvironment } from '@/agents/define-agent';
import { addToCartWorkflow } from '@/agents/workflows/add-to-cart';

export async function POST(request: NextRequest) {
  try {
    const { url, searchTerm, parameters } = await request.json();

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

    // Customer input for add-to-cart workflow
    const customerInput = { url, searchTerm };

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Initial message
          controller.enqueue(encoder.encode('data: {"status":"started"}\n\n'));

          // Execute all workflows in parallel
          const workflowPromises = workflowParametersArray.map(async (workflowParameters, index) => {
            try {
              console.log(`[API] Starting workflow ${index + 1}/${workflowParametersArray.length}`);

              // Set up environment
              const { stagehand, liveViewLink, sessionId } = await defineEnvironment(workflowParameters);

              console.log(`[API] Workflow ${index + 1} - Live view link: ${liveViewLink}`);
              console.log(`[API] Workflow ${index + 1} - Session ID: ${sessionId}`);

              // Send debug URL via SSE
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ debuggerUrl: liveViewLink })}\n\n`));

              // Run add-to-cart workflow
              const result = await addToCartWorkflow(stagehand, customerInput);

              console.log(`[API] Workflow ${index + 1} completed successfully`);

              // Transform metrics
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
                  cartCount: result?.eval_result?.cartCount
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

          // Send completion message
          const completionMessage = JSON.stringify({
            status: "completed",
            results: allResults
          });
          controller.enqueue(encoder.encode(`data: ${completionMessage}\n\n`));

          // Close stream
          await new Promise(resolve => setTimeout(resolve, 100));
          controller.close();
        } catch (error: any) {
          console.error('[API] Add-to-cart workflow error:', error);
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
    console.error('[API] Add-to-cart workflow setup error:', error);
    return new Response(JSON.stringify({ error: 'Failed to start add-to-cart workflow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
