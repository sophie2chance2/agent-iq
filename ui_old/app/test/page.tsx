"use client";

import { Suspense } from "react";
import AgentTester from "./AgentTester";

export default function TestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AgentTester />
    </Suspense>
  );
}
