import { NextRequest, NextResponse } from 'next/server'

// Simple pixel-based comparison function
function compareImages(img1Data: string, img2Data: string): number {
  try {
    // Remove data URL prefixes
    const base64_1 = img1Data.replace(/^data:image\/[a-z]+;base64,/, '')
    const base64_2 = img2Data.replace(/^data:image\/[a-z]+;base64,/, '')
    
    // For now, do a simple base64 string comparison
    // In production, you'd want to use image comparison libraries like pixelmatch
    if (base64_1 === base64_2) {
      return 100 // Perfect match
    }
    
    // Calculate similarity based on string similarity (rough approximation)
    const similarity = calculateStringSimilarity(base64_1, base64_2)
    
    // Return 100 if similarity is above threshold (e.g., 95%), otherwise 0
    return similarity > 0.95 ? 100 : 0
    
  } catch (error) {
    console.error('Image comparison error:', error)
    return 0
  }
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length)
  if (maxLength === 0) return 1.0
  
  let matches = 0
  const minLength = Math.min(str1.length, str2.length)
  
  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) {
      matches++
    }
  }
  
  return matches / maxLength
}

export async function POST(request: NextRequest) {
  try {
    const { manualScreenshot, agentScreenshot } = await request.json()
    
    if (!manualScreenshot || !agentScreenshot) {
      return NextResponse.json(
        { error: 'Both manual and agent screenshots are required' }, 
        { status: 400 }
      )
    }

    // Compare the screenshots
    const score = compareImages(manualScreenshot, agentScreenshot)
    
    return NextResponse.json({
      score,
      success: score === 100,
      message: score === 100 
        ? 'Agent successfully completed the task!' 
        : 'Agent did not match the expected result.'
    })
    
  } catch (error) {
    console.error('Comparison error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
