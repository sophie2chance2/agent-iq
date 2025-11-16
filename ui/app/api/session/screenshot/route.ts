import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Get screenshot from Browserbase session
    const response = await fetch(`https://www.browserbase.com/v1/sessions/${sessionId}/screenshot`, {
      method: 'GET',
      headers: {
        'X-BB-API-Key': process.env.BROWSERBASE_API_KEY || '',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Screenshot capture failed:', error)
      return NextResponse.json(
        { error: 'Failed to capture screenshot' },
        { status: 500 }
      )
    }

    // Convert response to base64
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    
    return NextResponse.json({
      screenshot: `data:image/png;base64,${base64}`,
    })
    
  } catch (error) {
    console.error('Screenshot capture error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
