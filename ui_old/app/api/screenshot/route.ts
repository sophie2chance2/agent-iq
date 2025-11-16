import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    const screenshotUrl = `https://www.browserbase.com/v1/sessions/${sessionId}/screenshot`;
    const response = await fetch(screenshotUrl, {
      headers: {
        'X-BB-API-Key': process.env.BROWSERBASE_API_KEY || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch screenshot: ${response.status}` },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error fetching screenshot:', error);
    return NextResponse.json(
      { error: 'Failed to fetch screenshot' },
      { status: 500 }
    );
  }
}
