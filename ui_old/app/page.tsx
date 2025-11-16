"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header with Logo and Name */}
      <div className="container mx-auto px-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#51A687] to-[#06402B] rounded-lg shadow-md"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">IQ</span>
            </div>
          </div>
          <span className="text-xl font-semibold text-[#06402B]">Agent IQ</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 md:py-16 flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="max-w-5xl mx-auto w-full">

          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#06402B] mb-6 tracking-tight text-center">
            Agent Performance Testing
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-3xl mx-auto text-center leading-relaxed">
            Test, benchmark, and optimize AI agent navigation across real-world websites.
            Compare models, measure performance, and ensure reliability.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button
              onClick={() => router.push("/projects")}
              size="lg"
              className="text-base px-8 py-6 h-auto bg-[#06402B] hover:bg-[#06402B]/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              Create a Project
            </Button>
            <Button
              onClick={() => router.push("/test")}
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 h-auto border-2 border-[#51A687] text-[#06402B] hover:bg-[#E3FFF5] hover:border-[#51A687] rounded-lg transition-all"
            >
              Run a Test
            </Button>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 border-slate-200 hover:border-[#51A687] transition-all hover:shadow-lg">
              <div className="w-12 h-12 bg-[#E3FFF5] rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#06402B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#06402B] mb-2">Performance Metrics</h3>
              <p className="text-gray-600 text-sm">
                Track success rates, execution time, interaction costs, and system fragility across test runs.
              </p>
            </Card>

            <Card className="p-6 border-slate-200 hover:border-[#51A687] transition-all hover:shadow-lg">
              <div className="w-12 h-12 bg-[#E3FFF5] rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#06402B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#06402B] mb-2">Multi-Model Support</h3>
              <p className="text-gray-600 text-sm">
                Compare performance across different AI models and configurations in parallel test runs.
              </p>
            </Card>

            <Card className="p-6 border-slate-200 hover:border-[#51A687] transition-all hover:shadow-lg">
              <div className="w-12 h-12 bg-[#E3FFF5] rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#06402B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#06402B] mb-2">Real-World Testing</h3>
              <p className="text-gray-600 text-sm">
                Test agents on actual websites with automated task execution and detailed trace logging.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
