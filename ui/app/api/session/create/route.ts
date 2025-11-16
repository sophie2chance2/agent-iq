import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Step 1: Create session
    const createResponse = await fetch('https://www.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BB-API-Key': process.env.BROWSERBASE_API_KEY || '',
      },
      body: JSON.stringify({
        projectId: process.env.BROWSERBASE_PROJECT_ID || '',
        browserSettings: { viewport: { width: 1280, height: 720 } },
        proxies: false,
      }),
    })

    if (!createResponse.ok) {
      const error = await createResponse.text()
      console.error('Browserbase session creation failed:', error)
      return NextResponse.json({ error: 'Failed to create browser session' }, { status: 500 })
    }

    const sessionData = await createResponse.json()

    // Step 2: Get live session URLs
    const debugResponse = await fetch(
      `https://www.browserbase.com/v1/sessions/${sessionData.id}/debug`,
      { headers: { 'X-BB-API-Key': process.env.BROWSERBASE_API_KEY || '' } }
    )

    if (!debugResponse.ok) {
      const error = await debugResponse.text()
      console.error('Fetching debug URLs failed:', error)
      return NextResponse.json({ error: 'Failed to get session debug URLs' }, { status: 500 })
    }

    const debugData = await debugResponse.json()

    return NextResponse.json({
      sessionId: sessionData.id,
      sessionUrl: sessionData.sessionUrl,
      debuggerFullscreenUrl: debugData.debuggerFullscreenUrl,
      debuggerUrl: debugData.debuggerUrl,
      wsUrl: debugData.wsUrl,
    })

  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
