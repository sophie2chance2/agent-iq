import { NextRequest } from 'next/server';
// import { runParallelAgentTask } from '../../../../../agents/agent-task';

export async function POST(request: NextRequest) {
  try {
    const { url, taskInstruction, parameters } = await request.json();

    if (!url || !taskInstruction) {
      return new Response(JSON.stringify({ error: 'URL and taskInstruction are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'URL and taskInstruction are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

    // Use provided parameters or default
    const workflowParameters = parameters || [{
      advancedStealth: false,
      proxies: false,
      environment: "BROWSERBASE",
      modelName: "anthropic/claude-sonnet-4-20250514",
    }];

    // // Customer input matching agent-task pattern
    // const customerInput = { url, taskInstruction };

    // // Create a readable stream for SSE to send debug URL to UI
    // const encoder = new TextEncoder();
    // const stream = new ReadableStream({
    //   start(controller) {
    //     // Send initial message
    //     controller.enqueue(encoder.encode('data: {"status":"started"}\n\n'));

    //     // Run workflow with callback to capture debug URL
    //     runParallelAgentTask(customerInput, workflowParameters, (debuggerUrl) => {
    //       console.log(`[API] Received debug URL from workflow: ${debuggerUrl}`);
    //       // Send debug URL through SSE stream to UI
    //       controller.enqueue(encoder.encode(`data: ${JSON.stringify({ debuggerUrl })}\n\n`));
    //     }).then((result) => {
    //       console.log('[API] Workflow completed successfully');

    //       // Extract results from workflow execution
    //       const allResults = result.state?.allResults || [];

    //       // Send results through SSE stream
    //       controller.enqueue(encoder.encode(`data: ${JSON.stringify({
    //         status: "completed",
    //         results: allResults
    //       })}\n\n`));

    //       console.log(`[API] Sent ${allResults.length} results to UI`);
    //       controller.close();
    //     }).catch(error => {
    //       console.error('[API] Agent task workflow error:', error);
    //       controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    //       controller.close();
    //     });
    //   }
    // });

    // return new Response(stream, {
    //   headers: {
    //     'Content-Type': 'text/event-stream',
    //     'Cache-Control': 'no-cache',
    //     'Connection': 'keep-alive',
    //   },
    // });

  } catch (error: any) {
    console.error('[API] Agent task workflow setup error:', error);
    return new Response(JSON.stringify({ error: 'Failed to start agent task workflow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
