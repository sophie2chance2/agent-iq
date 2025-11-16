"use server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const robotsUrl = new URL("/robots.txt", normalizedUrl).toString();

    const response = await fetch(robotsUrl, {
      method: "GET",
      redirect: "follow", // follow 301/302 redirects
    });

    const hasRobots = response.status === 200;

    return NextResponse.json({ hasRobots });
  } catch (err) {
    console.error("Error checking robots.txt:", err);
    return NextResponse.json({
      hasRobots: false,
      error: err instanceof Error ? err.message : "Unknown",
    });
  }
}