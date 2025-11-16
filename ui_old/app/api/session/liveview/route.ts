import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get debug/live view URLs from Browserbase
    const debugResponse = await fetch(
      `https://www.browserbase.com/v1/sessions/${sessionId}/debug`,
      {
        headers: {
          'X-BB-API-Key': process.env.BROWSERBASE_API_KEY || ''
        }
      }
    );

    if (!debugResponse.ok) {
      const error = await debugResponse.text();
      console.error('Fetching debug URLs failed:', error);
      return NextResponse.json({ error: 'Failed to get session debug URLs' }, { status: 500 });
    }

    const debugData = await debugResponse.json();

    return NextResponse.json({
      sessionId: sessionId,
      debuggerFullscreenUrl: debugData.debuggerFullscreenUrl,
      debuggerUrl: debugData.debuggerUrl,
      pages: debugData.pages || [],
    });

  } catch (error) {
    console.error('Live view error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
