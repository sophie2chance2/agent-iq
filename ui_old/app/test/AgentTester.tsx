"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateClickThroughScript, generateAgentTaskScript, generateAddToCartScript } from "@/lib/script-generators";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot, Loader2, ChevronDown, ArrowLeft } from "lucide-react";
import type { AgentResult } from "@browserbasehq/stagehand";
import {
    type Step,
    type TestType,
    type LLMModel,
    stepConfig,
    llmModelMap,
    llmProviders,
} from "../constants/constants";
import { apiClient } from "../../lib/api-client/apiClient";
import type { CreateSessionRequest, RobotsAnalysisRequest } from "../../lib/api-client/models";
import { compareDOMSimilarity, formatDOMForDisplay } from "../../lib/dom-similarity";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { MetricsCache, type MetricsCacheEntry } from "../../lib/metrics-cache";
import { ProjectsStorage } from "../../lib/projects-storage";

export default function AgentTester() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = searchParams.get("projectId");

    const [currentStep, setCurrentStep] = useState<Step>("input");
    const [url, setUrl] = useState("");
    const [testType, setTestType] = useState<TestType>("search");
    const [searchTerm, setSearchTerm] = useState("");
    const [lastName, setLastName] = useState("");
    const [taskInstruction, setTaskInstruction] = useState("");
    const [evalFields, setEvalFields] = useState<Array<{ key: string; value: string; type: "string" | "number" | "boolean"; operator?: "<" | ">" | "=" | "<=" | ">=" }>>([{ key: "", value: "", type: "string" }]);
    const [sessionId, setSessionId] = useState("");
    const [sessionUrls, setSessionUrls] = useState<string[]>([]);
    const [score, setScore] = useState<number>(0);
    const [results, setResults] = useState<any[]>();
    const [hasRobots, setHasRobots] = useState<boolean | null>(null);
    const [robotsAnalysis, setRobotsAnalysis] = useState<any>(null);
    const [robotsExpanded, setRobotsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [numRuns, setNumRuns] = useState(1)
    const [uploadedScript, setUploadedScript] = useState<File | null>(null);
    const [scriptContent, setScriptContent] = useState<string>("");
    const [clickEvents, setClickEvents] = useState<any[]>([]);
    const [showStepByStep, setShowStepByStep] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [showComparison, setShowComparison] = useState<{[key: number]: boolean}>({});
    const [showFailureExplanation, setShowFailureExplanation] = useState(false);
    const [comparisonStepIndex, setComparisonStepIndex] = useState<{[key: number]: number}>({});
    const [domComparisonExpanded, setDomComparisonExpanded] = useState<{[key: string]: boolean}>({});
    const [cachedMetrics, setCachedMetrics] = useState<MetricsCacheEntry[]>([]);
    const [projectName, setProjectName] = useState<string>("");


    // Load data from browser extension on mount
    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 20; // Try for 2 seconds (20 * 100ms)

        const loadExtensionData = () => {
            const extensionUrl = sessionStorage.getItem('extension_workflow_url');
            const extensionScript = sessionStorage.getItem('extension_workflow_script');
            const alreadyLoaded = sessionStorage.getItem('extension_workflow_loaded');

            // Load data if available (even if already loaded before - handles hot reloads)
            if (extensionUrl && extensionScript) {
                console.log('📝 Loading URL from extension:', extensionUrl);
                console.log('📝 Loading script from extension (length:', extensionScript.length, ')');

                setUrl(extensionUrl);
                setTestType('click-through');
                setTaskInstruction(extensionScript);

                // Load click events from sessionStorage
                const extensionClickEvents = sessionStorage.getItem('extension_workflow_click_events');
                if (extensionClickEvents) {
                    try {
                        const events = JSON.parse(extensionClickEvents);
                        console.log('📸 Loading click events from sessionStorage:', events.length, events);
                        setClickEvents(events);
                    } catch (e) {
                        console.error('❌ Failed to parse click events:', e);
                    }
                } else {
                    console.log('⚠️ No click events found in sessionStorage');
                }

                // Mark as loaded and set cleanup timer only on first load
                if (!alreadyLoaded) {
                    sessionStorage.setItem('extension_workflow_loaded', 'true');

                    // Set a timeout to clean up after 10 seconds
                    setTimeout(() => {
                        sessionStorage.removeItem('extension_workflow_url');
                        sessionStorage.removeItem('extension_workflow_script');
                        sessionStorage.removeItem('extension_workflow_click_events');
                        sessionStorage.removeItem('extension_workflow_loaded');
                        console.log('🧹 Cleaned up extension data from sessionStorage');
                    }, 10000);
                }

                return true; // Data loaded successfully
            }
            return false; // Data not found yet
        };

        // Try loading immediately
        if (loadExtensionData()) {
            return;
        }

        // Poll for data if not immediately available
        const pollInterval = setInterval(() => {
            attempts++;
            console.log(`🔍 Polling for extension data (attempt ${attempts}/${maxAttempts})...`);

            if (loadExtensionData() || attempts >= maxAttempts) {
                clearInterval(pollInterval);
                if (attempts >= maxAttempts) {
                    console.log('⏱️ Stopped polling - no extension data found');
                }
            }
        }, 100);

        // Also listen for custom event
        const handleDataReady = () => {
            console.log('📝 Received extension_workflow_data_ready event');
            if (loadExtensionData()) {
                clearInterval(pollInterval);
            }
        };

        window.addEventListener('extension_workflow_data_ready', handleDataReady);

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener('extension_workflow_data_ready', handleDataReady);
        };
    }, []);

    // Initialize metrics cache and migrate from CSV if needed
    const initializeMetricsCache = async () => {
        try {
            // Load cached metrics
            const cached = MetricsCache.getAll();
            setCachedMetrics(cached);
            console.log('📊 Loaded cached metrics:', cached.length, 'records');
            
            // CSV migration is no longer needed - we're using cache-only storage
            if (cached.length === 0) {
                console.log('� No cached data found - starting with empty cache');
            }
        } catch (error) {
            console.warn('Failed to initialize metrics cache:', error);
        }
    };

    // Initialize cache on component mount
    useEffect(() => {
        initializeMetricsCache();
    }, []);

    // Load project context and configuration from URL params
    useEffect(() => {
        if (projectId) {
            const project = ProjectsStorage.getProject(projectId);
            if (project) {
                setProjectName(project.name);
            }
        }

        // Load configuration if passed via URL params
        const urlParam = searchParams.get("url");
        const testTypeParam = searchParams.get("testType");
        const configParam = searchParams.get("config");

        if (urlParam) setUrl(urlParam);
        if (testTypeParam) setTestType(testTypeParam as TestType);

        if (configParam) {
            try {
                const config = JSON.parse(configParam);
                if (config.searchTerm) setSearchTerm(config.searchTerm);
                if (config.lastName) setLastName(config.lastName);
                if (config.taskInstruction) setTaskInstruction(config.taskInstruction);
                if (config.scriptContent) setScriptContent(config.scriptContent);
                if (config.evalFields) setEvalFields(config.evalFields);
                if (config.parameters) setParameters(config.parameters);
            } catch (error) {
                console.error("Failed to parse config from URL:", error);
            }
        }
    }, [projectId, searchParams]);

    // Function to save completed results to cache and project
    const saveResultsToCache = (completedResults: any[], calculatedScore?: number) => {
        try {
            const cacheEntries: MetricsCacheEntry[] = completedResults.map((run: any) => ({
                timestamp: new Date().toISOString(),
                modelName: run.params?.modelName || 'unknown',
                searchTerm: searchTerm || taskInstruction?.substring(0, 50) || "unknown",
                executionTime: run.metrics?.executionTime || run.browserbaseMetrics?.durationMs || 0,
                totalTokens: run.metrics?.totalTokens || 0,
                tokensPerSecond: run.metrics?.tokensPerSecond || 0,
                browserbaseStatus: run.extractionResults?.success ? "COMPLETED" : "FAILED",
                success: run.extractionResults?.success === true,
                sessionId: run.sessionId,
                url: url,
                extractionResults: run.extractionResults
            }));

            // Add to cache
            MetricsCache.add(cacheEntries);

            // Save to project if projectId exists
            if (projectId && completedResults.length > 0) {
                // Use the calculated score passed as parameter, or fall back to state
                const scoreToSave = calculatedScore !== undefined ? calculatedScore : score;

                // Debug: Check what we're actually saving
                console.log('💾 Saving run with:', {
                    scoreToSave,
                    calculatedScore,
                    stateScore: score,
                    numResults: completedResults.length,
                    successfulResults: completedResults.filter(r => r.extractionResults?.success === true).length
                });

                ProjectsStorage.addRun({
                    projectId: projectId,
                    url: url,
                    testType: testType,
                    configuration: {
                        searchTerm,
                        lastName,
                        taskInstruction,
                        scriptContent,
                        clickEvents,
                        evalFields,
                        parameters
                    },
                    results: completedResults,
                    overallScore: scoreToSave,
                    sessionUrls: sessionUrls
                });
                console.log('✅ Saved run to project:', projectName, 'with score:', scoreToSave);
            }

            // Refresh cached metrics state
            const updatedCache = MetricsCache.getAll();
            setCachedMetrics(updatedCache);
            
            console.log(`💾 Saved ${cacheEntries.length} results to metrics cache`);
        } catch (error) {
            console.error('Failed to save results to cache:', error);
        }
    };

    const [parameterSelection, setParameterSelection] = useState({
        modelNames: ["anthropic/claude-sonnet-4-5-20250929"] as string[], // Default to Claude Sonnet 4.5
        advancedStealth: [false] as boolean[],
        deviceTypes: ["windows"] as string[],
        proxies: [false] as boolean[],
    });

    const [parameters, setParameters] = useState<
        {
            model: string;
            environment: string;
            advancedStealth: boolean;
            deviceType?: string;
            proxies: boolean;
        }[]
    >([]);

    // Helper Functions
    const getModelDisplayName = (modelString: string) => {
        return Object.values(llmModelMap).find((m) => m.model === modelString)?.name || modelString;
    };

    const calculateIsSuccess = (run: any, testType: TestType) => {
        switch (testType) {
            case "search":
            case "add-to-cart":
            case "agent-task":
            case "click-through":
                return run.extractionResults?.success === true;
            case "find-flight":
                return run.extractionResults?.success === true || run.extractionResults?.flightInformation?.length > 0;
            case "custom-script":
                return run.extractionResults?.success === true || run.extractionResults?.clickResult?.success === true;
            default:
                return false;
        }
    };

    const calculateSuccessRate = (results: any[], testType: TestType) => {
        if (!results || results.length === 0) return 0;
        const successCount = results.filter((r: any) => calculateIsSuccess(r, testType)).length;
        return (successCount / results.length) * 100;
    };

    const createSession = async () => {
        if (!url) return;

        // Normalize URL: add https://www. if no protocol is specified
        let normalizedUrl = url.trim();
        if (normalizedUrl && !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://www.${normalizedUrl}`;
        }

        // Update the URL state with normalized value BEFORE starting anything
        setUrl(normalizedUrl);

        setError("");
        setIsLoading(true);

        try {
            checkRobotsTxt(normalizedUrl);

            // For search, add-to-cart, agent-task, and click-through tests, just validate and move to configure
            // Workflow will be started AFTER user selects parameters
            if (testType === "search" || testType === "add-to-cart" || testType === "agent-task" || testType === "click-through" || testType === "find-flight") {
                if ((testType === "search" || testType === "add-to-cart" || testType === "agent-task") && !searchTerm) {
                    setError(testType === "agent-task" ? "Task instruction is required" : "Search term is required");
                    return;
                }
                if (testType === "find-flight" && (!searchTerm || !lastName)) {
                    setError("Confirmation number and last name are required");
                    return;
                }
                // Just move to configure step - don't start workflow yet
                setCurrentStep("configure");
            } else {
                // For custom-script test, create a browserbase session
                const response = await fetch("/api/session/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: normalizedUrl }),
                });

                if (!response.ok) {
                    throw new Error("Failed to create session");
                }

                const data = await response.json();
                setSessionId(data.sessionId);
                setSessionUrls([data.debuggerFullscreenUrl]);
                setCurrentStep("configure");
            }
        } catch (error: any) {
            console.error(error);
            setError(error?.message || "Failed to create session");
        } finally {
            setIsLoading(false);
        }
    };

    const startAgentWorkflow = async (appendResults = false, overrideParameters?: typeof parameters) => {
        setIsLoading(true);

        if (!appendResults) {
            setSessionUrls([]);
            setResults(undefined);
            setScore(0);
        }

        setCurrentStep("watch");

        // Normalize URL before using it
        let normalizedUrl = url.trim();
        if (normalizedUrl && !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://www.${normalizedUrl}`;
        }

        try {
            const apiEndpoint =
                testType === "search"
                    ? "/api/search/execute"
                    : testType === "add-to-cart"
                        ? "/api/add-to-cart/execute"
                        : testType === "agent-task"
                            ? "/api/agent/execute"
                            : testType === "custom-script"
                                ? "/api/custom-script/execute"
                                : testType === "click-through"
                                    ? "/api/browser-extension/execute"
                                    : testType === "find-flight"
                                        ? "/api/find-flight/execute"
                                        : null;

            if (!apiEndpoint) {
                setError("Test type not supported");
                return;
            }

            const paramsToUse = (overrideParameters || parameters).map(p => ({
                modelName: p.model,
                environment: p.environment,
                advancedStealth: p.advancedStealth,
                deviceType: p.deviceType,
                proxies: p.proxies
            }));

            // Transform evalFields into a schema format for agent-task, search, custom-script, and click-through
            let evalInput = null;
            if (testType === "agent-task" || testType === "search" || testType === "custom-script" || testType === "click-through") {
                // Filter out empty fields and convert to schema format with types
                const validFields = evalFields.filter(f => f.key.trim() !== "");
                if (validFields.length > 0) {
                    evalInput = validFields.reduce((acc, field) => {
                        const key = field.key.trim();

                        // Create schema entry with type, expected value, and operator (for numbers)
                        acc[key] = {
                            type: field.type,
                            expectedValue: field.value,
                            ...(field.type === "number" && field.operator ? { operator: field.operator } : {})
                        };

                        return acc;
                    }, {} as Record<string, { type: string; expectedValue: string; operator?: string }>);
                }
            }

            const requestBody =
                testType === "find-flight"
                    ? { url: normalizedUrl, confirmationNumber: searchTerm, lastName, parameters: paramsToUse }
                    : testType === "custom-script"
                        ? { url: normalizedUrl, scriptContent, evalInput, parameters: paramsToUse }
                        : testType === "click-through"
                            ? { url: normalizedUrl, taskInstruction, parameters: paramsToUse }
                            : testType === "agent-task"
                                ? { url: normalizedUrl, taskInstruction: searchTerm, evalInput, parameters: paramsToUse }
                                : testType === "search"
                                    ? { url: normalizedUrl, searchTerm, evalInput, parameters: paramsToUse }
                                    : { url: normalizedUrl, searchTerm, parameters: paramsToUse };

            const response = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) throw new Error(`Failed to start ${testType} workflow`);

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    const lines = buffer.split("\n\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;

                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.debuggerUrl) setSessionUrls((prev) => [...prev, data.debuggerUrl]);

                            if (data.status === "completed" && data.results) {
                                setResults((prevResults: any) => {
                                    const prev = prevResults || [];
                                    const runIndex = appendResults ? prev.length + 1 : 1;

                                    const newResults = data.results.map((r: any, idx: number) => {
                                        const result = {
                                            ...r,
                                            runName: `Run ${runIndex}${data.results.length > 1 ? `.${idx + 1}` : ""}`,
                                        };

                                        // For click-through tests, transform screenshots into agentSteps format
                                        if (testType === "click-through" && r.screenshots && Array.isArray(r.screenshots)) {
                                            result.agentSteps = r.screenshots.map((screenshot: any, stepIdx: number) => ({
                                                screenshot: screenshot.screenshot,
                                                description: screenshot.step,
                                                step: screenshot.step,
                                                stepNumber: stepIdx,
                                                url: r.url || url,
                                                dom: screenshot.dom || '',
                                                duration: stepIdx > 0 ? 2000 : 0, // Placeholder duration
                                            }));
                                        }

                                        return result;
                                    });

                                    const startNumber = prev.length + 1;
                                    const numberedResults = newResults.map((r: any, i: number) => ({
                                        ...r,
                                        runNumber: startNumber + i,
                                    }));

                                    const allResults = [...prev, ...numberedResults];

                                    // Calculate success rate for the overall test session
                                    const overallSuccessRate = calculateSuccessRate(allResults, testType);
                                    setScore(overallSuccessRate);

                                    // Calculate success rate for just the new results being saved
                                    const newResultsSuccessRate = calculateSuccessRate(numberedResults, testType);

                                    console.log('🔍 About to save results:', {
                                        projectId,
                                        hasProjectId: !!projectId,
                                        numberedResultsLength: numberedResults.length,
                                        allResultsLength: allResults.length,
                                        newResultsSuccessRate,
                                        overallSuccessRate
                                    });

                                    // Remove screenshots before saving to avoid localStorage quota issues
                                    const resultsWithoutScreenshots = numberedResults.map((r: any) => {
                                        const { screenshots, agentSteps, ...rest } = r;
                                        return rest;
                                    });

                                    // Save new results to cache with their success rate (without screenshots)
                                    saveResultsToCache(resultsWithoutScreenshots, newResultsSuccessRate);

                                    return allResults;
                                });

                                setCurrentStep("results");
                            }

                            if (data.error) setError(data.error);
                        } catch (err) {
                            console.warn("Skipping incomplete or invalid JSON chunk", err);
                        }
                    }
                }
            }

            // Decode remaining buffer
            if (buffer.trim()) {
                try {
                    const data = JSON.parse(buffer.replace(/^data: /, ""));
                    if (data.results) setResults((prevResults: any) => {
                        const prev = prevResults || [];
                        return [...prev, ...data.results];
                    });
                } catch {
                    // ignore incomplete final chunk
                }
            }
        } catch (error: any) {
            console.error(error);
            setError(error?.message || "Failed to start workflow");
        } finally {
            setIsLoading(false);
        }
    };


    const checkRobotsTxt = async (siteUrl: string) => {
        try {
            const response = await fetch("/api/robots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: siteUrl }),
            });

            const data = await response.json();
            console.log('Robots analysis result:', data);
            setHasRobots(!!data.hasRobots);
            setRobotsAnalysis(data.analysis);
        } catch (err) {
            console.error("Error checking robots.txt:", err);
            setHasRobots(false);
            setRobotsAnalysis(null);
        }
    };

    const checkRobotsTxt2 = async (siteUrl: string) => {
        setIsLoading(true);
        try {
            const robotsAnalysisRequest: RobotsAnalysisRequest = {
                url: siteUrl,
            };

            const data = await apiClient.analyzeRobots(robotsAnalysisRequest);
            console.log('data', data);
            setHasRobots(data.hasRobotsTxt ?? null);
            setRobotsAnalysis(data);
        } catch (error: any) {
            console.error(error);
            setError(error?.message || "Failed to run robots");
        } finally {
            setIsLoading(false);
        }
    };

    const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedScript(file);

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setScriptContent(content);
            console.log("Uploaded Script Content:", content);
        };
        reader.readAsText(file);
    };

    const downloadExample = () => {
        const exampleScript = `/**
 * Example Custom Script for Stagehand Workflows
 *
 * This is a minimal working example of a user-uploaded script.
 * Users can modify this file to perform custom actions on web pages.
 *
 * Important:
 * 1. Your function must be named \`main\`.
 * 2. The function must be \`async\`.
 * 3. It receives \`page\` and \`stagehand\` as parameters.
 * 4. Return the data you want to capture as the script result.
 *
 * Available objects:
 * - page: Playwright page object for direct browser control
 * - stagehand: Stagehand instance with act(), extract(), and other methods
 * - z: Zod library for schema validation (available globally)
 *
 * Note: Import statements will be automatically stripped during execution.
 */

async function main(page, stagehand) {
    // Navigate to a page (optional - URL can be provided in the UI)
    // await page.goto("https://example.com");

    // Use stagehand to interact with the page
    await stagehand.act("Click the learn more button");

    // Extract structured data using Zod schemas
    const description = await stagehand.extract(
        "extract the page description",
        z.string()
    );

    console.log("Description:", description);

    // Return the data you want to capture
    return { description };
}
`;

        const blob = new Blob([exampleScript], { type: "text/typescript" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "custom-script-example.ts";
        a.click();

        URL.revokeObjectURL(url);
    };

    // Reusable Result Components
    const OverallScoreSection = ({ score, results }: { score: number; results: any[] }) => (
        <div className="text-center p-6 bg-gradient-to-r from-muted/50 to-accent/5 rounded-xl">
            <div className={`text-5xl font-bold mb-2 ${score === 100 ? "text-green-500" : "text-red-500"}`}>
                {Math.round(score)}
            </div>
            <Badge variant={score === 100 ? "default" : "destructive"} className="text-base px-6 py-2">
                {score === 100 ? "Success" : "Partial / Failed"}
            </Badge>
            <p className="text-muted-foreground mt-2">
                {results?.length
                    ? `${results.filter((r: any) => calculateIsSuccess(r, testType)).length} / ${results.length} runs completed successfully`
                    : "No runs executed"}
            </p>
        </div>
    );

    const ConfigurationTable = ({ results }: { results: any[] }) => (
        <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 p-3 border-b">
                <h3 className="font-semibold text-sm">Configuration Success Analysis</h3>
                <p className="text-xs text-muted-foreground mt-1">Compare which settings led to successful extractions</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                        <tr>
                            <th className="text-left p-2 font-medium">Run #</th>
                            <th className="text-left p-2 font-medium">Model</th>
                            <th className="text-center p-2 font-medium">Stealth</th>
                            <th className="text-center p-2 font-medium">OS</th>
                            <th className="text-center p-2 font-medium">Proxy</th>
                            <th className="text-right p-2 font-medium">Time</th>
                            <th className="text-right p-2 font-medium">Tokens</th>
                            <th className="text-center p-2 font-medium">Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results?.map((run: any, index: number) => {
                            const modelName = getModelDisplayName(run.params.modelName);
                            const isSuccess = calculateIsSuccess(run, testType);

                            return (
                                <tr key={index} className={`border-b ${isSuccess ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                                    <td className="p-2 font-medium">{run.runNumber}</td>
                                    <td className="p-2 font-medium">{modelName}</td>
                                    <td className="p-2 text-center">
                                        {run.params.advancedStealth ? (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-xs">✓</span>
                                        ) : (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-300 text-gray-600 text-xs">✗</span>
                                        )}
                                    </td>
                                    <td className="p-2 text-center">
                                        {run.params.deviceType ? (
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {run.params.deviceType}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="p-2 text-center">
                                        {run.params.proxies ? (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-xs">✓</span>
                                        ) : (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-300 text-gray-600 text-xs">✗</span>
                                        )}
                                    </td>
                                    <td className="p-2 text-right text-muted-foreground">
                                        {run.metrics?.executionTime || run.browserbaseMetrics?.durationMs
                                            ? `${((parseInt(run.metrics?.executionTime) || run.browserbaseMetrics?.durationMs) / 1000).toFixed(1)}s`
                                            : '—'}
                                    </td>
                                    <td className="p-2 text-right text-muted-foreground">
                                        {run.metrics?.totalTokens?.toLocaleString() || '—'}
                                    </td>
                                    <td className="p-2 text-center">
                                        <Badge variant={isSuccess ? "default" : "destructive"} className="text-xs">
                                            {isSuccess ? 'Success' : 'Failed'}
                                        </Badge>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const EvaluationResults = ({ run, isSuccess }: { run: any; isSuccess: boolean }) => {
        if (!isSuccess || !run.extractionResults) return null;

        return (
            <details className="mt-1">
                <summary className="cursor-pointer font-medium text-sm">
                    {(testType === "agent-task" || testType === "search" || testType === "custom-script")
                        ? "View Evaluation Results"
                        : "View Extraction Results"}
                </summary>
                <div className="mt-1 p-3 bg-gray-50 rounded space-y-3">
                    {(testType === "agent-task" || testType === "search" || testType === "custom-script") && run.extractionResults?.evalResult ? (
                        <>
                            {evalFields && evalFields.length > 0 && evalFields.some(f => f.key.trim() !== "") && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-gray-700 uppercase">Extracted Values</h4>
                                        <div className="bg-white p-2 rounded border">
                                            {Object.entries(run.extractionResults.evalResult).map(([key, value]: [string, any]) => (
                                                <div key={key} className="py-1 flex justify-between border-b last:border-b-0">
                                                    <span className="font-medium text-sm">{key}:</span>
                                                    <span className="text-sm text-gray-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-gray-700 uppercase">Expected Values</h4>
                                        <div className="bg-white p-2 rounded border">
                                            {evalFields.filter(f => f.key.trim() !== "").map((field, idx) => (
                                                <div key={idx} className="py-1 flex justify-between border-b last:border-b-0">
                                                    <span className="font-medium text-sm">{field.key}:</span>
                                                    <span className="text-sm text-gray-700">{field.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="pt-2 border-t">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-700 uppercase">Match Status:</span>
                                    <Badge variant={run.extractionResults.success ? "default" : "destructive"} className="text-xs">
                                        {run.extractionResults.success ? "✓ Values Match" : "✗ Values Don't Match"}
                                    </Badge>
                                </div>
                            </div>
                        </>
                    ) : (
                        <pre className="p-2 bg-white rounded overflow-x-auto text-sm border">
                            {JSON.stringify(run.extractionResults, null, 2)}
                        </pre>
                    )}
                </div>
            </details>
        );
    };

    const StepByStepScreenshots = ({ run, index }: { run: any; index: number }) => {
        if (!run.screenshots || run.screenshots.length === 0) return null;

        return (
            <div className="mt-2">
                <Button
                    type="button"
                    onClick={() => setShowComparison(prev => ({ ...prev, [index]: !prev[index] }))}
                    variant="outline"
                    size="sm"
                    className="w-full"
                >
                    {showComparison[index] ? "Hide" : "Show"} Step-by-Step Screenshots ({run.screenshots.length} steps)
                </Button>

                {showComparison[index] && (
                    <div className="mt-3 space-y-4 p-4 border rounded-lg bg-muted/20">
                        {/* Navigation Controls */}
                        <div className="flex items-center justify-between gap-4">
                            <Button
                                onClick={() => setComparisonStepIndex(prev => ({ ...prev, [index]: Math.max(0, (prev[index] || 0) - 1) }))}
                                disabled={(comparisonStepIndex[index] || 0) === 0}
                                variant="outline"
                                size="sm"
                            >
                                ← Previous
                            </Button>

                            <Badge variant="secondary">
                                Step {(comparisonStepIndex[index] || 0) + 1} of {run.screenshots.length}
                            </Badge>

                            <Button
                                onClick={() => setComparisonStepIndex(prev => ({ ...prev, [index]: Math.min(run.screenshots.length - 1, (prev[index] || 0) + 1) }))}
                                disabled={(comparisonStepIndex[index] || 0) === run.screenshots.length - 1}
                                variant="outline"
                                size="sm"
                            >
                                Next →
                            </Button>
                        </div>

                        {/* Current Step Info */}
                        <div className="bg-muted/50 p-2 rounded">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                    Step {(comparisonStepIndex[index] || 0) + 1}
                                </Badge>
                                <span className="text-sm font-medium">{run.screenshots?.[comparisonStepIndex[index] || 0]?.step || "Screenshot"}</span>
                            </div>
                        </div>

                        {/* Screenshot */}
                        <div className="border-2 rounded-lg overflow-hidden bg-white shadow">
                            <img
                                src={run.screenshots?.[comparisonStepIndex[index] || 0]?.screenshot || ""}
                                alt={`Step ${(comparisonStepIndex[index] || 0) + 1}`}
                                className="w-full h-auto"
                            />
                        </div>

                        {/* Step Progress Dots */}
                        <div className="flex justify-center gap-2">
                            {run.screenshots.map((_: any, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => setComparisonStepIndex(prev => ({ ...prev, [index]: idx }))}
                                    className={`h-2 rounded-full transition-all ${idx === (comparisonStepIndex[index] || 0)
                                        ? 'w-8 bg-primary'
                                        : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                                        }`}
                                    aria-label={`Go to step ${idx + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const DownloadScriptButton = ({ run }: { run: any }) => {
        if (testType === "add-to-cart") {
            return (
                <div className="mt-2">
                    <Button
                        type="button"
                        onClick={() => {
                            const script = generateAddToCartScript(url, searchTerm, run.params);
                            const blob = new Blob([script], { type: 'text/typescript' });
                            const downloadUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = `add-to-cart-${Date.now()}.ts`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(downloadUrl);
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full"
                    >
                        Download Script
                    </Button>
                </div>
            );
        }

        if (testType === "agent-task") {
            return (
                <div className="mt-2">
                    <Button
                        type="button"
                        onClick={() => {
                            const script = generateAgentTaskScript(url, searchTerm, run.params);
                            const blob = new Blob([script], { type: 'text/typescript' });
                            const downloadUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = `agent-task-${Date.now()}.ts`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(downloadUrl);
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full"
                    >
                        Download Script
                    </Button>
                </div>
            );
        }

        return null;
    };

    const resetTest = () => {
        setCurrentStep("input");
        setUrl("");
        setTestType("search");
        setSessionId("");
        setSessionUrls([]);
        setScore(0);
        setResults(undefined);
        setError("");
        setSearchTerm("")
        setHasRobots(null)
    };

    const runAgain = async () => {
        if (!url || parameters.length === 0) return;

        // Clear previous watch sessions only
        setSessionUrls([]);

        // Move directly to watch page
        setCurrentStep("watch");

        // Start workflow with appendResults = true
        await startAgentWorkflow(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
            {/* Header with Logo */}
            <div className="container mx-auto px-4 pt-6 pb-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="relative w-10 h-10 cursor-pointer" onClick={() => router.push("/")}>
                        <div className="absolute inset-0 bg-gradient-to-br from-[#51A687] to-[#06402B] rounded-lg shadow-md"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">IQ</span>
                        </div>
                    </div>
                    <span className="text-xl font-semibold text-[#06402B] cursor-pointer" onClick={() => router.push("/")}>Agent IQ</span>
                </div>

                {projectId && projectName && (
                    <Button
                        variant="ghost"
                        onClick={() => router.push(`/projects/${projectId}`)}
                        className="mb-6 text-gray-600 hover:text-[#06402B] hover:bg-[#E3FFF5]"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to {projectName}
                    </Button>
                )}

                <div className="mb-12">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold text-[#06402B] mb-3 tracking-tight">
                                Run a Test
                            </h1>
                            <p className="text-lg text-gray-600">
                                {projectName ? `Testing in ${projectName}` : "Compare manual task completion with AI agent execution"}
                            </p>
                        </div>
                        {!projectId && (
                            <Button
                                variant="outline"
                                onClick={() => router.push("/projects")}
                                className="border-2 border-[#51A687] text-[#06402B] hover:bg-[#E3FFF5] hover:border-[#51A687] rounded-lg transition-all"
                            >
                                View Projects
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 pb-12">
                {/* Progress Steps */}
                <div className="flex justify-center mb-12">
                    <div className="flex items-center space-x-4">
                        {Object.entries(stepConfig).map(([key, config], index) => {
                            const StepIcon = config.icon;
                            const isActive = currentStep === key;
                            const isCompleted =
                                Object.keys(stepConfig).indexOf(currentStep) > index;

                            return (
                                <div key={key} className="flex items-center">
                                    <div
                                        className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${isActive
                                            ? "border-[#06402B] bg-[#06402B] text-white"
                                            : isCompleted
                                                ? "border-[#51A687] bg-[#51A687] text-white"
                                                : "border-slate-300 bg-white text-gray-400"
                                            }`}
                                    >
                                        <StepIcon className="h-5 w-5" />
                                    </div>
                                    {index < Object.keys(stepConfig).length - 1 && (
                                        <div
                                            className={`w-16 h-0.5 mx-2 ${isCompleted ? "bg-[#51A687]" : "bg-slate-300"}`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {error && (
                    <Card className="mb-8 border-red-200 bg-red-50">
                        <CardContent className="p-4">
                            <p className="text-red-700">{error}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Step Content */}
                <Card className="max-w-4xl mx-auto border-slate-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[#06402B]">
                            {(() => {
                                const StepIcon = stepConfig[currentStep].icon;
                                return <StepIcon className="h-5 w-5" />;
                            })()}
                            {stepConfig[currentStep].title}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Step 1: Input URL */}
                        {currentStep === "input" && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label htmlFor="url" className="text-sm font-medium">
                                        Website URL
                                    </label>
                                    <Input
                                        id="url"
                                        type="url"
                                        placeholder="https://example.com"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="h-12"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium mb-3 block">
                                            Example Scripts
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setTestType("search")}
                                                className={`p-4 border-2 rounded-lg text-left transition-all ${testType === "search"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <div className="font-medium text-sm mb-1">Search</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Extract search results
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setTestType("add-to-cart")}
                                                className={`p-4 border-2 rounded-lg text-left transition-all ${testType === "add-to-cart"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <div className="font-medium text-sm mb-1">Add to Cart</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Test shopping cart flow
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setTestType("find-flight")}
                                                className={`p-4 border-2 rounded-lg text-left transition-all ${testType === "find-flight"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <div className="font-medium text-sm mb-1">Find Flight</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Extract flight details
                                                </div>
                                            </button>
                                        </div>
                                    </div>


                                    <div>
                                        <label className="text-sm font-medium mb-3 block">
                                            Advanced
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setTestType("agent-task")}
                                                className={`p-4 border-2 rounded-lg text-left transition-all ${testType === "agent-task"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <div className="font-medium text-sm mb-1">Agent</div>
                                                <div className="text-xs text-muted-foreground">Custom instructions</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTestType("custom-script")}
                                                className={`p-4 border-2 rounded-lg text-left transition-all ${testType === "custom-script"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <div className="font-medium text-sm mb-1">Upload Script</div>
                                                <div className="text-xs text-muted-foreground">Your own code</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTestType("click-through")}
                                                className={`p-4 border-2 rounded-lg text-left transition-all ${testType === "click-through"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <div className="font-medium text-sm mb-1">Click Through</div>
                                                <div className="text-xs text-muted-foreground">Browser recording</div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {["search", "add-to-cart", "agent-task"].includes(testType) && (
                                    <div className="space-y-2">
                                        <label htmlFor="searchTerm" className="text-sm font-medium">
                                            {testType === "search"
                                                ? "Search Term"
                                                : testType === "add-to-cart"
                                                    ? "Product to Add"
                                                    : "Task Instruction"}
                                        </label>
                                        <Input
                                            id="searchTerm"
                                            type="text"
                                            placeholder={
                                                testType === "search"
                                                    ? "e.g., gaming laptop"
                                                    : testType === "add-to-cart"
                                                        ? "e.g., wireless mouse"
                                                        : "e.g., Click on the support link"
                                            }
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="h-12"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {testType === "search"
                                                ? "What should the agent search for?"
                                                : testType === "add-to-cart"
                                                    ? "What product should the agent add to cart?"
                                                    : testType === "agent-task" ? "Provide your instructions for the agent task." : ''}
                                        </p>
                                    </div>
                                )}

                                {(testType === "agent-task" || testType === "search" || testType === "find-flight") && (
                                    <div className="space-y-3">
                                        {(testType === "agent-task" || testType === "search") && (
                                            <>
                                                <label className="text-sm font-medium">Evaluation Fields</label>
                                                {evalFields.map((field, index) => (
                                                    <div key={index} className="p-3 border rounded-md bg-gray-50">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-medium text-gray-600">
                                                                Evaluation Criteria {index + 1}
                                                            </span>
                                                            {evalFields.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setEvalFields(evalFields.filter((_, i) => i !== index));
                                                                    }}
                                                                    className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                                                >
                                                                    Remove
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-[1fr_120px_160px_1.5fr] gap-2">
                                                            <div>
                                                                <label className="text-xs text-gray-600 mb-1 block">Field Name</label>
                                                                <Input
                                                                    type="text"
                                                                    placeholder="e.g., title"
                                                                    value={field.key}
                                                                    onChange={(e) => {
                                                                        const newFields = [...evalFields];
                                                                        newFields[index].key = e.target.value;
                                                                        setEvalFields(newFields);
                                                                    }}
                                                                    className="h-10"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-gray-600 mb-1 block">Type</label>
                                                                <Select
                                                                    value={field.type}
                                                                    onValueChange={(value: "string" | "number" | "boolean") => {
                                                                        const newFields = [...evalFields];
                                                                        newFields[index].type = value;
                                                                        if (value === "boolean" && field.value !== "true" && field.value !== "false") {
                                                                            newFields[index].value = "true";
                                                                        }
                                                                        if (value === "number" && !newFields[index].operator) {
                                                                            newFields[index].operator = "=";
                                                                        }
                                                                        setEvalFields(newFields);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-10">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="string">String</SelectItem>
                                                                        <SelectItem value="number">Number</SelectItem>
                                                                        <SelectItem value="boolean">Boolean</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            {field.type === "number" && (
                                                                <div>
                                                                    <label className="text-xs text-gray-600 mb-1 block">Operator</label>
                                                                    <Select
                                                                        value={field.operator || "="}
                                                                        onValueChange={(value: "<" | ">" | "=" | "<=" | ">=") => {
                                                                            const newFields = [...evalFields];
                                                                            newFields[index].operator = value;
                                                                            setEvalFields(newFields);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-10">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="<">{"<"} Less than</SelectItem>
                                                                            <SelectItem value=">">{">"} Greater than</SelectItem>
                                                                            <SelectItem value="=">{"="} Equal to</SelectItem>
                                                                            <SelectItem value="<=">{"≤"} Less or equal</SelectItem>
                                                                            <SelectItem value=">=">{">="} Greater or equal</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                            <div className={field.type === "number" ? "" : "col-span-2"}>
                                                                <label className="text-xs text-gray-600 mb-1 block">Expected Value</label>
                                                                {field.type === "boolean" ? (
                                                                    <Select
                                                                        value={field.value}
                                                                        onValueChange={(value) => {
                                                                            const newFields = [...evalFields];
                                                                            newFields[index].value = value;
                                                                            setEvalFields(newFields);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-10">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="true">True</SelectItem>
                                                                            <SelectItem value="false">False</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                ) : (
                                                                    <Input
                                                                        type={field.type === "number" ? "number" : "text"}
                                                                        placeholder={field.type === "number" ? "e.g., 42" : "e.g., Example Domain"}
                                                                        value={field.value}
                                                                        onChange={(e) => {
                                                                            const newFields = [...evalFields];
                                                                            newFields[index].value = e.target.value;
                                                                            setEvalFields(newFields);
                                                                        }}
                                                                        className="h-10"
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setEvalFields([...evalFields, { key: "", value: "", type: "string" }])}
                                                    className="w-full"
                                                >
                                                    + Add Another Field
                                                </Button>
                                                <p className="text-xs text-muted-foreground">
                                                    Define the fields to extract and validate from the page after the task is completed.
                                                </p>
                                            </>
                                        )}

                                        {testType === "find-flight" && (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label htmlFor="confirmationNumber" className="text-sm font-medium">
                                                        Confirmation Number
                                                    </label>
                                                    <Input
                                                        id="confirmationNumber"
                                                        type="text"
                                                        placeholder="e.g., ABC123"
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="h-12"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="lastName" className="text-sm font-medium">
                                                        Last Name
                                                    </label>
                                                    <Input
                                                        id="lastName"
                                                        type="text"
                                                        placeholder="e.g., Smith"
                                                        value={lastName}
                                                        onChange={(e) => setLastName(e.target.value)}
                                                        className="h-12"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}


                                {testType === "click-through" && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label htmlFor="clickThroughScript" className="text-sm font-medium">
                                                    Click-Through Script
                                                </label>
                                                {clickEvents.length > 0 && (
                                                    <Badge variant="default" className="text-xs">
                                                        Generated from {clickEvents.length} recorded clicks
                                                    </Badge>
                                                )}
                                            </div>
                                            <textarea
                                                id="clickThroughScript"
                                                placeholder="Enter your click-through script or instructions..."
                                                value={taskInstruction}
                                                onChange={(e) => setTaskInstruction(e.target.value)}
                                                className="w-full min-h-[120px] p-3 border rounded-md text-sm font-mono resize-y"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {clickEvents.length > 0
                                                    ? "Script generated from browser extension recording. You can edit it before testing."
                                                    : "Describe the navigation flow or provide custom instructions for the click-through test."}
                                            </p>
                                        </div>

                                        {/* Step-by-Step Viewer Button */}
                                        {clickEvents.length > 0 && (
                                            <div className="space-y-3">
                                                <Button
                                                    type="button"
                                                    onClick={() => setShowStepByStep(!showStepByStep)}
                                                    variant="outline"
                                                    className="w-full"
                                                >
                                                    {showStepByStep ? "Hide" : "Show"} Step-by-Step Screenshots ({clickEvents.length} steps)
                                                </Button>

                                                {/* Step-by-Step Viewer */}
                                                {showStepByStep && (
                                                    <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                                                        {/* Navigation */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <Button
                                                                type="button"
                                                                onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                                                                disabled={currentStepIndex === 0}
                                                                variant="outline"
                                                                size="sm"
                                                            >
                                                                ← Previous
                                                            </Button>

                                                            <div className="flex gap-1 flex-wrap justify-center">
                                                                {clickEvents.map((_, index) => (
                                                                    <button
                                                                        key={index}
                                                                        type="button"
                                                                        onClick={() => setCurrentStepIndex(index)}
                                                                        className={`w-8 h-8 rounded-md text-sm font-medium transition ${currentStepIndex === index
                                                                            ? "bg-primary text-primary-foreground"
                                                                            : "bg-muted hover:bg-muted/70"
                                                                            }`}
                                                                    >
                                                                        {index + 1}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <Button
                                                                type="button"
                                                                onClick={() => setCurrentStepIndex(Math.min(clickEvents.length - 1, currentStepIndex + 1))}
                                                                disabled={currentStepIndex === clickEvents.length - 1}
                                                                variant="outline"
                                                                size="sm"
                                                            >
                                                                Next →
                                                            </Button>
                                                        </div>

                                                        {/* Current Step Display */}
                                                        {clickEvents[currentStepIndex] && (
                                                            <div className="space-y-3">
                                                                {/* Step Title */}
                                                                <div className="text-center py-2">
                                                                    <div className="text-sm text-muted-foreground mb-1">
                                                                        Step {clickEvents[currentStepIndex].stepNumber} of {clickEvents.length}
                                                                    </div>
                                                                    <div className="text-lg font-semibold">
                                                                        {clickEvents[currentStepIndex].elementText}
                                                                    </div>
                                                                </div>

                                                                {/* Screenshot */}
                                                                {clickEvents[currentStepIndex].screenshot ? (
                                                                    <div className="border-2 rounded-lg overflow-hidden bg-white shadow-lg">
                                                                        <img
                                                                            src={clickEvents[currentStepIndex].screenshot}
                                                                            alt={`Step ${clickEvents[currentStepIndex].stepNumber}`}
                                                                            className="w-full h-auto"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground border-2 border-dashed">
                                                                        No screenshot available
                                                                    </div>
                                                                )}

                                                                {/* Technical Details - Collapsed */}
                                                                {currentStepIndex > 0 && (
                                                                    <details className="group">
                                                                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 py-2">
                                                                            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                                                                            Technical Details
                                                                        </summary>
                                                                        <div className="mt-3 space-y-2 bg-muted/30 p-3 rounded-lg text-xs">
                                                                            <div className="space-y-2">
                                                                                <div className="break-all">
                                                                                    <span className="font-semibold">URL:</span> {clickEvents[currentStepIndex].url}
                                                                                </div>
                                                                                {clickEvents[currentStepIndex].xpath && (
                                                                                    <div className="break-all">
                                                                                        <span className="font-semibold">XPath:</span> <code className="bg-muted px-1 py-0.5 rounded ml-1">{clickEvents[currentStepIndex].xpath}</code>
                                                                                    </div>
                                                                                )}
                                                                                {clickEvents[currentStepIndex].duration !== undefined && (
                                                                                    <div>
                                                                                        <span className="font-semibold">Duration:</span> {(clickEvents[currentStepIndex].duration / 1000).toFixed(2)}s
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="pt-2 border-t">
                                                                                <div className="font-semibold mb-1">Code:</div>
                                                                                <div className="bg-gray-900 text-green-400 p-2 rounded font-mono text-xs overflow-auto">
                                                                                    <pre className="whitespace-pre-wrap">{clickEvents[currentStepIndex].code}</pre>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </details>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Evaluation Fields for Click-Through */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium">
                                                Evaluation Fields (Optional)
                                            </label>
                                            <p className="text-xs text-muted-foreground">
                                                Define criteria to validate the workflow results
                                            </p>
                                            {evalFields.map((field, index) => (
                                                <div key={index} className="p-3 border rounded-md bg-gray-50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-medium text-gray-600">Evaluation Criteria {index + 1}</span>
                                                        {evalFields.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setEvalFields(evalFields.filter((_, i) => i !== index));
                                                                }}
                                                                className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                                            >
                                                                Remove
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-[1fr_120px_160px_1.5fr] gap-2">
                                                        <div>
                                                            <label className="text-xs text-gray-600 mb-1 block">Field Name</label>
                                                            <Input
                                                                type="text"
                                                                placeholder="e.g., title"
                                                                value={field.key}
                                                                onChange={(e) => {
                                                                    const newFields = [...evalFields];
                                                                    newFields[index].key = e.target.value;
                                                                    setEvalFields(newFields);
                                                                }}
                                                                className="h-10"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-gray-600 mb-1 block">Type</label>
                                                            <Select
                                                                value={field.type}
                                                                onValueChange={(value: "string" | "number" | "boolean") => {
                                                                    const newFields = [...evalFields];
                                                                    newFields[index].type = value;
                                                                    if (value === "boolean" && field.value !== "true" && field.value !== "false") {
                                                                        newFields[index].value = "true";
                                                                    }
                                                                    if (value === "number" && !newFields[index].operator) {
                                                                        newFields[index].operator = "=";
                                                                    }
                                                                    setEvalFields(newFields);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-10">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="string">String</SelectItem>
                                                                    <SelectItem value="number">Number</SelectItem>
                                                                    <SelectItem value="boolean">Boolean</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {field.type === "number" && (
                                                            <div>
                                                                <label className="text-xs text-gray-600 mb-1 block">Operator</label>
                                                                <Select
                                                                    value={field.operator || "="}
                                                                    onValueChange={(value: "<" | ">" | "=" | "<=" | ">=") => {
                                                                        const newFields = [...evalFields];
                                                                        newFields[index].operator = value;
                                                                        setEvalFields(newFields);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-10">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="<">Less than (&lt;)</SelectItem>
                                                                        <SelectItem value=">">Greater than (&gt;)</SelectItem>
                                                                        <SelectItem value="=">Equal to (=)</SelectItem>
                                                                        <SelectItem value="<=">Less than or equal (&lt;=)</SelectItem>
                                                                        <SelectItem value=">=">Greater than or equal (&gt;=)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                        <div className={field.type === "number" ? "" : "col-span-2"}>
                                                            <label className="text-xs text-gray-600 mb-1 block">Expected Value</label>
                                                            {field.type === "boolean" ? (
                                                                <Select
                                                                    value={field.value}
                                                                    onValueChange={(value) => {
                                                                        const newFields = [...evalFields];
                                                                        newFields[index].value = value;
                                                                        setEvalFields(newFields);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-10">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="true">True</SelectItem>
                                                                        <SelectItem value="false">False</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <Input
                                                                    type={field.type === "number" ? "number" : "text"}
                                                                    placeholder="Expected value"
                                                                    value={field.value}
                                                                    onChange={(e) => {
                                                                        const newFields = [...evalFields];
                                                                        newFields[index].value = e.target.value;
                                                                        setEvalFields(newFields);
                                                                    }}
                                                                    className="h-10"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEvalFields([...evalFields, { key: "", value: "", type: "string" }]);
                                                }}
                                                className="w-full"
                                            >
                                                Add Evaluation Field
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {testType === "custom-script" && (
                                    <div className="space-y-4">
                                        {/* Upload label + download button in one row */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-medium">Upload Your File</label>
                                                <button
                                                    onClick={downloadExample}
                                                    className="px-2 py-1 rounded-lg bg-gray-200 text-gray-800 font-medium shadow-sm hover:shadow-md hover:bg-gray-300 transition text-xs"
                                                >
                                                    Download Example
                                                </button>
                                            </div>

                                            {/* File input */}
                                            <div>
                                                <input
                                                    id="script-upload"
                                                    type="file"
                                                    accept=".js,.ts,.py"
                                                    onChange={handleScriptUpload}
                                                    className="hidden"
                                                />
                                                <label
                                                    htmlFor="script-upload"
                                                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-md hover:shadow-lg hover:bg-primary/90 transition cursor-pointer text-sm"
                                                >
                                                    Choose File
                                                </label>
                                            </div>

                                            {uploadedScript && (
                                                <div className="mt-2 text-xs text-muted-foreground">
                                                    <p>
                                                        File: <strong>{uploadedScript.name}</strong>
                                                    </p>
                                                    <p>Size: {(uploadedScript.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                            )}

                                            {scriptContent && (
                                                <Card className="mt-3 bg-muted/40 border border-muted">
                                                    <CardContent className="max-h-48 overflow-y-auto p-3 text-xs font-mono">
                                                        <pre>
                                                            {scriptContent.slice(0, 10000)}
                                                            {scriptContent.length > 10000 ? "..." : ""}
                                                        </pre>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>

                                        {/* Evaluation Fields */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium">
                                                Evaluation Fields
                                            </label>
                                            {evalFields.map((field, index) => (
                                                <div key={index} className="p-3 border rounded-md bg-gray-50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-medium text-gray-600">Evaluation Criteria {index + 1}</span>
                                                        {evalFields.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setEvalFields(evalFields.filter((_, i) => i !== index));
                                                                }}
                                                                className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                                            >
                                                                Remove
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-[1fr_120px_160px_1.5fr] gap-2">
                                                        <div>
                                                            <label className="text-xs text-gray-600 mb-1 block">Field Name</label>
                                                            <Input
                                                                type="text"
                                                                placeholder="e.g., title"
                                                                value={field.key}
                                                                onChange={(e) => {
                                                                    const newFields = [...evalFields];
                                                                    newFields[index].key = e.target.value;
                                                                    setEvalFields(newFields);
                                                                }}
                                                                className="h-10"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-gray-600 mb-1 block">Type</label>
                                                            <Select
                                                                value={field.type}
                                                                onValueChange={(value: "string" | "number" | "boolean") => {
                                                                    const newFields = [...evalFields];
                                                                    newFields[index].type = value;
                                                                    // Reset value if switching to boolean
                                                                    if (value === "boolean" && field.value !== "true" && field.value !== "false") {
                                                                        newFields[index].value = "true";
                                                                    }
                                                                    // Set default operator for numbers
                                                                    if (value === "number" && !newFields[index].operator) {
                                                                        newFields[index].operator = "=";
                                                                    }
                                                                    setEvalFields(newFields);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-10">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="string">String</SelectItem>
                                                                    <SelectItem value="number">Number</SelectItem>
                                                                    <SelectItem value="boolean">Boolean</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {field.type === "number" && (
                                                            <div>
                                                                <label className="text-xs text-gray-600 mb-1 block">Operator</label>
                                                                <Select
                                                                    value={field.operator || "="}
                                                                    onValueChange={(value: "<" | ">" | "=" | "<=" | ">=") => {
                                                                        const newFields = [...evalFields];
                                                                        newFields[index].operator = value;
                                                                        setEvalFields(newFields);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-10">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="<">
                                                                            <span className="flex items-center gap-2">
                                                                                <span className="font-mono">{"<"}</span>
                                                                                <span className="text-xs">Less than</span>
                                                                            </span>
                                                                        </SelectItem>
                                                                        <SelectItem value=">">
                                                                            <span className="flex items-center gap-2">
                                                                                <span className="font-mono">{">"}</span>
                                                                                <span className="text-xs">Greater than</span>
                                                                            </span>
                                                                        </SelectItem>
                                                                        <SelectItem value="=">
                                                                            <span className="flex items-center gap-2">
                                                                                <span className="font-mono">{"="}</span>
                                                                                <span className="text-xs">Equal to</span>
                                                                            </span>
                                                                        </SelectItem>
                                                                        <SelectItem value="<=">
                                                                            <span className="flex items-center gap-2">
                                                                                <span className="font-mono">{"≤"}</span>
                                                                                <span className="text-xs">Less or equal</span>
                                                                            </span>
                                                                        </SelectItem>
                                                                        <SelectItem value=">=">
                                                                            <span className="flex items-center gap-2">
                                                                                <span className="font-mono">{"≥"}</span>
                                                                                <span className="text-xs">Greater or equal</span>
                                                                            </span>
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                        <div className={field.type === "number" ? "" : "col-span-2"}>
                                                            <label className="text-xs text-gray-600 mb-1 block">Expected Value</label>
                                                            {field.type === "boolean" ? (
                                                                <Select
                                                                    value={field.value}
                                                                    onValueChange={(value) => {
                                                                        const newFields = [...evalFields];
                                                                        newFields[index].value = value;
                                                                        setEvalFields(newFields);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-10">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="true">True</SelectItem>
                                                                        <SelectItem value="false">False</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <Input
                                                                    type={field.type === "number" ? "number" : "text"}
                                                                    placeholder={field.type === "number" ? "e.g., 42" : "e.g., Example Domains"}
                                                                    value={field.value}
                                                                    onChange={(e) => {
                                                                        const newFields = [...evalFields];
                                                                        newFields[index].value = e.target.value;
                                                                        setEvalFields(newFields);
                                                                    }}
                                                                    className="h-10"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEvalFields([...evalFields, { key: "", value: "", type: "string" }]);
                                                }}
                                                className="w-full"
                                            >
                                                + Add Another Field
                                            </Button>
                                            <p className="text-xs text-muted-foreground">
                                                Define the fields to extract and validate from the page after the script is executed.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <Button
                                    onClick={createSession}
                                    disabled={!url || isLoading || ((testType === "search" || testType === "add-to-cart" || testType === 'agent-task') && !searchTerm) || (testType === "find-flight" && (!searchTerm || !lastName)) || (testType === "custom-script" && !uploadedScript)}
                                    className="w-full h-12"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            {"Creating Session..."}
                                        </>
                                    ) : (
                                        <>
                                            Start {testType === "search" ? "Search" : testType === "find-flight" ? "Find Flight" : testType === "add-to-cart" ? "Add to Cart" : testType === "click-through" ? "Click Through" : "Custom"} Test
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Step 2: Configure Agent */}
                        {currentStep === "configure" && (
                            <div className="space-y-6">
                                {/* robots.txt analysis */}
                                {hasRobots && (
                                    <div className="border border-red-300 bg-red-50 text-red-700 rounded-lg">
                                        <div
                                            className="flex items-start justify-between gap-3 p-3 border-b border-red-200 cursor-pointer"
                                            onClick={() => setRobotsExpanded(!robotsExpanded)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl leading-none">!</span>
                                                <div className="text-left text-sm">
                                                    <strong className="font-semibold">robots.txt detected:</strong> This site specifies automation policies. Review them before deploying agents in production.
                                                </div>
                                            </div>
                                            <ChevronDown
                                                className={`h-5 w-5 transition-transform duration-200 ${robotsExpanded ? "rotate-180" : ""}`}
                                            />
                                        </div>

                                        {robotsExpanded && robotsAnalysis && (
                                            <div className="p-3 space-y-3">
                                                {/* AI Agent Rules */}
                                                {/* {(robotsAnalysis.aiRules.allowedAgents?.length || robotsAnalysis.aiRules.disallowedAgents?.length) && (
                                                    <div>
                                                        <h4 className="font-semibold text-xs mb-2">AI Agent Rules:</h4>
                                                        <ul className="text-xs space-y-1">
                                                            {robotsAnalysis.aiRules.allowedAgents?.map((agent, index) => (
                                                                <li key={`allowed-${index}`} className="flex items-start gap-1">
                                                                    <span className="text-green-500">•</span>
                                                                    <span><strong>{agent}</strong>: Allowed</span>
                                                                </li>
                                                            ))}
                                                            {robotsAnalysis.aiRules.disallowedAgents?.map((agent, index) => (
                                                                <li key={`disallowed-${index}`} className="flex items-start gap-1">
                                                                    <span className="text-red-500">•</span>
                                                                    <span><strong>{agent}</strong>: Blocked</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )} */}

                                                {/* Allowed / Disallowed Paths */}
                                                {/* {(robotsAnalysis.aiRules.allowedPaths?.length || robotsAnalysis.aiRules.disallowedPaths?.length) && (
                                                    <div>
                                                        <h4 className="font-semibold text-xs mb-2">Path Permissions:</h4>
                                                        <ul className="text-xs space-y-1">
                                                            {robotsAnalysis.aiRules.allowedPaths?.map((path, index) => (
                                                                <li key={`allowed-path-${index}`} className="flex items-start gap-1">
                                                                    <span className="text-green-500">•</span>
                                                                    <span>{path}</span>
                                                                </li>
                                                            ))}
                                                            {robotsAnalysis.aiRules.disallowedPaths?.map((path, index) => (
                                                                <li key={`disallowed-path-${index}`} className="flex items-start gap-1">
                                                                    <span className="text-red-500">•</span>
                                                                    <span>{path}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )} */}

                                                {/* LLM Suggestions */}
                                                {robotsAnalysis.llmSuggestions && (
                                                    <div>
                                                        <h4 className="font-semibold text-xs mb-2">AI Recommendations:</h4>
                                                        <ul className="text-xs space-y-1">
                                                            {robotsAnalysis.llmSuggestions.split('\n\n').map((suggestion: string, index: number) => (
                                                                <li key={index} className="flex items-start gap-1">
                                                                    <span className="text-blue-500">•</span>
                                                                    <span>{suggestion}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* LLM Models */}
                                <div className="space-y-3">
                                    <label className="text-sm font-medium">LLM Models</label>
                                    <div className="space-y-3">
                                        {llmProviders.map((provider) => {
                                            // Check if any model (regular or computer use) from this provider is selected
                                            const hasAnyModelSelected =
                                                parameterSelection.modelNames.some(
                                                    modelId => [...provider.regularModels, ...provider.computerUseModels].some(m => m.id === modelId)
                                                );

                                            return (
                                                <details key={provider.name} className="border rounded-lg bg-card group" open={provider.name === "Anthropic"}>
                                                    <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition">
                                                        <div className="flex items-center space-x-2">
                                                            {provider.regularModels.length > 0 && (
                                                                <Checkbox
                                                                    checked={hasAnyModelSelected}
                                                                    onCheckedChange={(checked) => {
                                                                        setParameterSelection((prev) => {
                                                                            if (checked) {
                                                                                // Add latest regular model from this provider
                                                                                const latestModel = provider.regularModels[0];
                                                                                return {
                                                                                    ...prev,
                                                                                    modelNames: [...prev.modelNames, latestModel.id]
                                                                                };
                                                                            } else {
                                                                                // Remove all regular models from this provider
                                                                                return {
                                                                                    ...prev,
                                                                                    modelNames: prev.modelNames.filter(
                                                                                        id => !provider.regularModels.some(m => m.id === id)
                                                                                    )
                                                                                };
                                                                            }
                                                                        });
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            )}
                                                            <h4 className="font-semibold text-sm">{provider.name}</h4>
                                                        </div>
                                                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                                                    </summary>

                                                    <div className="px-3 pb-3 pt-0">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {/* Models - Left Column */}
                                                            {provider.regularModels.length > 0 && (
                                                                <div>
                                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Models</div>
                                                                    <div className="space-y-2">
                                                                        {provider.regularModels.map((model) => (
                                                                            <label
                                                                                key={model.id}
                                                                                className="flex items-center space-x-2 cursor-pointer"
                                                                            >
                                                                                <Checkbox
                                                                                    checked={parameterSelection.modelNames.includes(model.id)}
                                                                                    onCheckedChange={(checked) =>
                                                                                        setParameterSelection((prev) => ({
                                                                                            ...prev,
                                                                                            modelNames: checked
                                                                                                ? [...prev.modelNames, model.id]
                                                                                                : prev.modelNames.filter((v) => v !== model.id),
                                                                                        }))
                                                                                    }
                                                                                />
                                                                                <span className="text-sm">{model.name}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Computer Use Models - Right Column */}
                                                            {provider.computerUseModels.length > 0 && (
                                                                <div>
                                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Computer Use Models</div>
                                                                    <div className="space-y-2">
                                                                        {provider.computerUseModels.map((model) => (
                                                                            <label
                                                                                key={model.id}
                                                                                className="flex items-center space-x-2 cursor-pointer"
                                                                            >
                                                                                <Checkbox
                                                                                    checked={parameterSelection.modelNames.includes(model.id)}
                                                                                    onCheckedChange={(checked) =>
                                                                                        setParameterSelection((prev) => ({
                                                                                            ...prev,
                                                                                            modelNames: checked
                                                                                                ? [...prev.modelNames, model.id]
                                                                                                : prev.modelNames.filter((v) => v !== model.id),
                                                                                        }))
                                                                                    }
                                                                                />
                                                                                <span className="text-sm">{model.name}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </details>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Advanced Stealth */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Advanced Stealth</label>
                                    <div className="flex flex-wrap gap-3 mt-2">
                                        {[true, false].map((val) => (
                                            <label
                                                key={val.toString()}
                                                className="flex items-center space-x-2"
                                            >
                                                <Checkbox
                                                    checked={parameterSelection.advancedStealth.includes(val)}
                                                    onCheckedChange={(checked) =>
                                                        setParameterSelection((prev) => ({
                                                            ...prev,
                                                            advancedStealth: checked
                                                                ? [...prev.advancedStealth, val]
                                                                : prev.advancedStealth.filter((v) => v !== val),
                                                        }))
                                                    }
                                                />
                                                <span className="text-sm">{val.toString()}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Device Types - only show if advancedStealth includes true */}
                                {parameterSelection.advancedStealth.includes(true) && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Device Types</label>
                                        <div className="flex flex-wrap gap-3 mt-2">
                                            {["linux", "windows", "mac", "mobile", "tablet"].map((device) => (
                                                <label key={device} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        checked={parameterSelection.deviceTypes.includes(device)}
                                                        onCheckedChange={(checked) =>
                                                            setParameterSelection((prev) => ({
                                                                ...prev,
                                                                deviceTypes: checked
                                                                    ? [...prev.deviceTypes, device]
                                                                    : prev.deviceTypes.filter((d) => d !== device),
                                                            }))
                                                        }
                                                    />
                                                    <span className="text-sm capitalize">{device}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Proxies */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Proxies</label>
                                    <div className="flex flex-wrap gap-3 mt-2">
                                        {[true, false].map((val) => (
                                            <label
                                                key={val.toString()}
                                                className="flex items-center space-x-2"
                                            >
                                                <Checkbox
                                                    checked={parameterSelection.proxies.includes(val)}
                                                    onCheckedChange={(checked) =>
                                                        setParameterSelection((prev) => ({
                                                            ...prev,
                                                            proxies: checked
                                                                ? [...prev.proxies, val]
                                                                : prev.proxies.filter((v) => v !== val),
                                                        }))
                                                    }
                                                />
                                                <span className="text-sm">{val.toString()}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Generate Cartesian & Continue */}
                                <Button
                                    onClick={async () => {
                                        const cartesian: typeof parameters = [];
                                        const {
                                            modelNames,
                                            advancedStealth,
                                            deviceTypes,
                                            proxies,
                                        } = parameterSelection;

                                        modelNames.forEach((modelName) =>
                                            advancedStealth.forEach((stealth) => {
                                                if (stealth && deviceTypes.length > 0) {
                                                    // Advanced Stealth = true AND device types selected
                                                    deviceTypes.forEach((deviceType) =>
                                                        proxies.forEach((proxy) => {
                                                            cartesian.push({
                                                                model: modelName,
                                                                environment: "BROWSERBASE",
                                                                advancedStealth: true,
                                                                deviceType: deviceType,
                                                                proxies: proxy,
                                                            });
                                                        })
                                                    );
                                                } else if (!stealth) {
                                                    // Advanced Stealth = false (no device type)
                                                    proxies.forEach((proxy) => {
                                                        cartesian.push({
                                                            model: modelName,
                                                            environment: "BROWSERBASE",
                                                            advancedStealth: false,
                                                            proxies: proxy,
                                                        });
                                                    });
                                                }
                                                // If stealth=true but no deviceTypes, don't create any runs
                                            })
                                        );

                                        setParameters(cartesian);

                                        // NOW start the workflow with the configured parameters
                                        await startAgentWorkflow(false, cartesian);
                                    }}
                                    disabled={
                                        parameterSelection.modelNames.length === 0 ||
                                        parameterSelection.advancedStealth.length === 0 ||
                                        parameterSelection.proxies.length === 0 ||
                                        (parameterSelection.advancedStealth.includes(true) && parameterSelection.deviceTypes.length === 0)
                                    }
                                    className="w-full h-12 mt-4"
                                >
                                    Start Agent & Watch Session
                                </Button>
                            </div>
                        )}

                        {/* Step 3: Watch Session */}
                        {currentStep === "watch" && (
                            <div className="space-y-6">
                                {/* Status Banner */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-blue-900">
                                                {sessionUrls.length > 0
                                                    ? `Watching ${sessionUrls.length} browser session${sessionUrls.length > 1 ? 's' : ''} live`
                                                    : "Waiting for sessions to start..."}
                                            </p>
                                            <p className="text-sm text-blue-700 mt-0.5">
                                                Running {parameters.length} test{parameters.length > 1 ? 's' : ''} in parallel
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {sessionUrls.length > 0 ? (
                                    <div className="space-y-4">
                                        {/* Grid layout - 2 columns for up to 4 sessions */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {sessionUrls.map((url, index) => {
                                                const param = parameters[index];
                                                const modelName = param ? Object.values(llmModelMap).find(
                                                    (m) => m.model === param.model
                                                )?.name || param.model : 'Unknown';

                                                const borderColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

                                                return (
                                                    <div key={index} className="flex flex-col">
                                                        {/* Compact session header */}
                                                        <div className="bg-white border-l-4 rounded-t-lg p-2.5 border-b" style={{
                                                            borderLeftColor: borderColors[index % 4]
                                                        }}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-sm" style={{ color: borderColors[index % 4] }}>
                                                                    Session {index + 1}
                                                                </span>
                                                                <Badge variant="outline" className="text-xs px-1.5 py-0" style={{ borderColor: borderColors[index % 4], color: borderColors[index % 4] }}>
                                                                    Live
                                                                </Badge>
                                                            </div>
                                                            {param && (
                                                                <div className="grid grid-cols-2 gap-1.5 text-xs">
                                                                    <div className="flex items-center gap-1 truncate">
                                                                        <Bot className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                                                        <span className="font-medium text-gray-900 truncate">{modelName}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 truncate">
                                                                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${param.environment === 'BROWSERBASE' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                                                                        <span className="text-gray-700 truncate">{param.environment}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-gray-500">S:</span>
                                                                        <Badge variant={param.advancedStealth ? "default" : "secondary"} className="text-xs px-1 py-0 h-4">
                                                                            {param.advancedStealth ? 'On' : 'Off'}
                                                                        </Badge>
                                                                    </div>
                                                                    {param.deviceType && (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-gray-500">OS:</span>
                                                                            <Badge variant="outline" className="text-xs px-1 py-0 h-4 capitalize">
                                                                                {param.deviceType}
                                                                            </Badge>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-gray-500">P:</span>
                                                                        <Badge variant={param.proxies ? "default" : "secondary"} className="text-xs px-1 py-0 h-4">
                                                                            {param.proxies ? 'On' : 'Off'}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Large session iframe */}
                                                        <div className="rounded-b-lg overflow-hidden shadow-lg" style={{
                                                            height: '300px'
                                                        }}>
                                                            <iframe
                                                                src={url}
                                                                className="w-full h-full bg-white"
                                                                sandbox="allow-same-origin allow-scripts"
                                                                allow="clipboard-read; clipboard-write"
                                                                style={{ pointerEvents: 'none' }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        Starting workflows and creating browser sessions...
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 4: Results */}
                        {currentStep === "results" && (
                            <div className="space-y-4"> {/* reduced spacing from 6 to 4 */}

                                {/* Overall Score */}
                                <OverallScoreSection score={score} results={results || []} />

                                {/* Feature Comparison Table */}
                                {results && results.length > 0 && <ConfigurationTable results={results} />}

                                {/* Executed Script Section - Only show for click-through tests */}

                                {/* Individual Run Breakdown */}
                                <div className="space-y-3">
                                    {results?.map((run, index) => {
                                        const modelName = getModelDisplayName(run.params.modelName);
                                        const isSuccess = calculateIsSuccess(run, testType);

                                        return (
                                            <div key={index} className="p-3 border rounded space-y-2">
                                                {/* Parameters & success/fail indicator */}
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm text-muted-foreground space-y-1">
                                                        <div><strong>Run #:</strong> {run.runNumber}</div>
                                                        <div><strong>Model Name:</strong> {modelName}</div>
                                                        <div><strong>Environment:</strong> {run.params.environment}</div>
                                                        <div><strong>Advanced Stealth:</strong> {run.params.advancedStealth ? "Yes" : "No"}</div>
                                                        <div><strong>Proxies:</strong> {run.params.proxies ? "Yes" : "No"}</div>
                                                        {run.metrics && (
                                                            <>
                                                                {testType === "add-to-cart" ? (
                                                                    <div><strong>Cart Status:</strong> {run.extractionResults?.success ? "Added to cart" : "Failed to add"}</div>
                                                                ) : null}
                                                            </>
                                                        )}
                                                        {run.sessionId && (
                                                            <div>
                                                                <strong>Session Replay:</strong>{' '}
                                                                <a
                                                                    href={`https://www.browserbase.com/sessions/${run.sessionId}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:text-blue-800 underline"
                                                                >
                                                                    View Recording
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div
                                                        className={`px-3 py-1 rounded-full font-semibold text-white ${isSuccess ? "bg-success" : "bg-destructive"}`}
                                                    >
                                                        {isSuccess ? "Success" : "Failed"}
                                                    </div>
                                                </div>

                                                {/* Extraction Results dropdown */}
                                                <EvaluationResults run={run} isSuccess={isSuccess} />

                                                {/* Explain Failure Button */}
                                                {(!isSuccess && testType !== "click-through") && (
                                                    <div className="mt-2">
                                                        <Button
                                                            type="button"
                                                            onClick={() => setShowFailureExplanation(prev => (!prev))}
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full"
                                                        >
                                                            {showFailureExplanation ? "Hide Explanation" : "Explain Failure"}
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* Step-by-Step Screenshots */}
                                                <StepByStepScreenshots run={run} index={index} />

                                                {/* Download Script Button */}
                                                <DownloadScriptButton run={run} />

                                                {/* Screenshot dropdown */}
                                                {(run.screenshot || run.screenshotSessionId) && (
                                                    <details className="mt-1">
                                                        <summary className="cursor-pointer font-medium text-sm">
                                                            View Screenshot
                                                        </summary>
                                                        <img
                                                            src={run.screenshot || `/api/screenshot?sessionId=${run.screenshotSessionId || run.sessionId}`}
                                                            alt={`Screenshot of run ${index + 1}`}
                                                            className="mt-1 w-full border rounded"
                                                        />
                                                    </details>
                                                )}

                                                {/* Error dropdown if failed */}
                                                {!run.success && run.error && (
                                                    <details className="mt-1">
                                                        <summary className="cursor-pointer font-medium text-red-600 text-sm">
                                                            View Error
                                                        </summary>
                                                        <pre className="mt-1 p-2 bg-red-50 rounded overflow-x-auto text-sm text-red-800">
                                                            {run.error}
                                                        </pre>
                                                    </details>
                                                )}

                                                {/* Agent vs Extension Comparison */}
                                                {run.agentSteps && clickEvents.length > 0 && (
                                                    <div className="mt-2 space-y-2">
                                                        {/* Summary Table - Always visible */}
                                                        {(() => {
                                                            // Calculate summary metrics
                                                            const summaryMetrics = (() => {
                                                                const metrics: { step: number; action: string; expectedDuration: number; actualDuration: number; domSimilarity: number | null }[] = [];
                                                                const minSteps = Math.min(run.agentSteps.length, clickEvents.length);

                                                                for (let i = 1; i < minSteps; i++) { // Start from 1 to skip landing page
                                                                    const agentStep = run.agentSteps[i];
                                                                    const clickEvent = clickEvents[i];

                                                                    if (agentStep && clickEvent) {
                                                                        let domSimilarity = null;
                                                                        if (agentStep.dom && clickEvent.dom) {
                                                                            const comparison = compareDOMSimilarity(clickEvent.dom, agentStep.dom);
                                                                            domSimilarity = comparison.similarity;
                                                                        }

                                                                        metrics.push({
                                                                            step: i,
                                                                            action: clickEvent.elementText || agentStep.description || 'Unknown',
                                                                            expectedDuration: clickEvent.duration || 0,
                                                                            actualDuration: agentStep.duration || 0,
                                                                            domSimilarity
                                                                        });
                                                                    }
                                                                }

                                                                return metrics;
                                                            })();

                                                            const totalExpected = summaryMetrics.reduce((sum, m) => sum + m.expectedDuration, 0);
                                                            const totalActual = summaryMetrics.reduce((sum, m) => sum + m.actualDuration, 0);
                                                            const avgDomSimilarity = summaryMetrics.length > 0
                                                                ? Math.round(summaryMetrics.reduce((sum, m) => sum + (m.domSimilarity || 0), 0) / summaryMetrics.length)
                                                                : 0;

                                                            return (
                                                                <div className="border rounded-lg overflow-hidden bg-card">
                                                                    <div className="bg-muted/50 p-3 border-b">
                                                                        <h4 className="font-semibold text-sm">Comparison Summary</h4>
                                                                    </div>
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-xs">
                                                                            <thead className="bg-muted/30">
                                                                                <tr>
                                                                                    <th className="p-2 text-left font-medium">Step</th>
                                                                                    <th className="p-2 text-left font-medium">Action</th>
                                                                                    <th className="p-2 text-right font-medium">Expected</th>
                                                                                    <th className="p-2 text-right font-medium">Actual</th>
                                                                                    <th className="p-2 text-right font-medium">Diff</th>
                                                                                    <th className="p-2 text-right font-medium">DOM Match</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y">
                                                                                {summaryMetrics.map((metric) => (
                                                                                    <tr key={metric.step} className="hover:bg-muted/20">
                                                                                        <td className="p-2 font-medium">{metric.step}</td>
                                                                                        <td className="p-2 truncate max-w-xs">{metric.action}</td>
                                                                                        <td className="p-2 text-right">{(metric.expectedDuration / 1000).toFixed(2)}s</td>
                                                                                        <td className="p-2 text-right">{(metric.actualDuration / 1000).toFixed(2)}s</td>
                                                                                        <td className={`p-2 text-right font-semibold ${metric.actualDuration < metric.expectedDuration ? 'text-green-600' : 'text-red-600'
                                                                                            }`}>
                                                                                            {metric.actualDuration < metric.expectedDuration ? '↓' : '↑'}
                                                                                            {Math.abs((metric.actualDuration - metric.expectedDuration) / 1000).toFixed(2)}s
                                                                                        </td>
                                                                                        <td className="p-2 text-right">
                                                                                            {metric.domSimilarity !== null ? (
                                                                                                <span className={`font-semibold ${metric.domSimilarity >= 80
                                                                                                    ? 'text-green-600'
                                                                                                    : metric.domSimilarity >= 60
                                                                                                        ? 'text-yellow-600'
                                                                                                        : 'text-red-600'
                                                                                                    }`}>
                                                                                                    {metric.domSimilarity}%
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-muted-foreground">-</span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                                {summaryMetrics.length > 0 && (
                                                                                    <tr className="bg-muted/30 font-semibold">
                                                                                        <td className="p-2" colSpan={2}>Total / Average</td>
                                                                                        <td className="p-2 text-right">{(totalExpected / 1000).toFixed(2)}s</td>
                                                                                        <td className="p-2 text-right">{(totalActual / 1000).toFixed(2)}s</td>
                                                                                        <td className={`p-2 text-right ${totalActual < totalExpected ? 'text-green-600' : 'text-red-600'
                                                                                            }`}>
                                                                                            {totalActual < totalExpected ? '↓' : '↑'}
                                                                                            {Math.abs((totalActual - totalExpected) / 1000).toFixed(2)}s
                                                                                        </td>
                                                                                        <td className={`p-2 text-right ${avgDomSimilarity >= 80
                                                                                            ? 'text-green-600'
                                                                                            : avgDomSimilarity >= 60
                                                                                                ? 'text-yellow-600'
                                                                                                : 'text-red-600'
                                                                                            }`}>
                                                                                            {avgDomSimilarity}%
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Step-by-Step Comparison Toggle */}
                                                        <Button
                                                            type="button"
                                                            onClick={() => setShowComparison(prev => ({ ...prev, [run.runNumber]: !prev[run.runNumber] }))}
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full"
                                                        >
                                                            {showComparison[run.runNumber] ? "Hide" : "Show"} Step-by-Step Comparison
                                                        </Button>

                                                        {/* Download Script Button for click-through */}
                                                        {testType === "click-through" && taskInstruction && (
                                                            <Button
                                                                type="button"
                                                                onClick={() => {
                                                                    const script = generateClickThroughScript(url, taskInstruction, run.params);
                                                                    const blob = new Blob([script], { type: 'text/typescript' });
                                                                    const downloadUrl = URL.createObjectURL(blob);
                                                                    const a = document.createElement('a');
                                                                    a.href = downloadUrl;
                                                                    a.download = `click-through-${Date.now()}.ts`;
                                                                    document.body.appendChild(a);
                                                                    a.click();
                                                                    document.body.removeChild(a);
                                                                    URL.revokeObjectURL(downloadUrl);
                                                                }}
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full"
                                                            >
                                                                Download Script
                                                            </Button>
                                                        )}

                                                        {showComparison[run.runNumber] && (() => {
                                                            // Debug logging
                                                            console.log('🔍 Comparison Debug:', {
                                                                runNumber: run.runNumber,
                                                                currentStepIndex: comparisonStepIndex[run.runNumber] || 0,
                                                                agentStepsLength: run.agentSteps?.length,
                                                                agentSteps: run.agentSteps?.map((s: any, i: number) => ({
                                                                    index: i,
                                                                    description: s.description,
                                                                    hasScreenshot: !!s.screenshot,
                                                                    screenshotLength: s.screenshot?.length
                                                                })),
                                                                clickEventsLength: clickEvents.length
                                                            });

                                                            return (
                                                                <div className="mt-3 border rounded-lg p-4 bg-muted/10 space-y-4">
                                                                    {/* Navigation */}
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <Button
                                                                            type="button"
                                                                            onClick={() => setComparisonStepIndex(prev => ({ ...prev, [run.runNumber]: Math.max(0, (prev[run.runNumber] || 0) - 1) }))}
                                                                            disabled={(comparisonStepIndex[run.runNumber] || 0) === 0}
                                                                            variant="outline"
                                                                            size="sm"
                                                                        >
                                                                            ← Previous
                                                                        </Button>

                                                                        <div className="text-sm font-medium">
                                                                            Step {(comparisonStepIndex[run.runNumber] || 0) + 1} of {Math.max(run.agentSteps.length, clickEvents.length)}
                                                                        </div>

                                                                        <Button
                                                                            type="button"
                                                                            onClick={() => setComparisonStepIndex(prev => ({ ...prev, [run.runNumber]: Math.min(Math.max(run.agentSteps.length, clickEvents.length) - 1, (prev[run.runNumber] || 0) + 1) }))}
                                                                            disabled={(comparisonStepIndex[run.runNumber] || 0) >= Math.max(run.agentSteps.length, clickEvents.length) - 1}
                                                                            variant="outline"
                                                                            size="sm"
                                                                        >
                                                                            Next →
                                                                        </Button>
                                                                    </div>

                                                                    {/* Large Screenshot Comparison - Primary Focus */}
                                                                    <div className="space-y-3">
                                                                        {/* Step Title - Minimal */}
                                                                        {clickEvents[comparisonStepIndex[run.runNumber] || 0] && run.agentSteps[comparisonStepIndex[run.runNumber] || 0] && (comparisonStepIndex[run.runNumber] || 0) > 0 && (
                                                                            <div className="text-center py-2">
                                                                                <div className="text-lg font-semibold">
                                                                                    {(() => {
                                                                                        const event = clickEvents[comparisonStepIndex[run.runNumber] || 0];
                                                                                        if (event.elementText === 'element' && event.code) {
                                                                                            const actionMatch = event.code.match(/action:\s*"([^"]+)"/);
                                                                                            if (actionMatch) return actionMatch[1];
                                                                                        }
                                                                                        return event.elementText;
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Screenshots - Large and Prominent */}
                                                                        <div className="grid grid-cols-2 gap-6">
                                                                            {/* Extension Step */}
                                                                            <div className="space-y-3">
                                                                                <div className="flex items-center justify-center gap-2 py-2 bg-blue-50 rounded-lg">
                                                                                    <span className="text-lg">📱</span>
                                                                                    <h4 className="font-semibold">Extension (Expected)</h4>
                                                                                </div>
                                                                                {clickEvents[comparisonStepIndex[run.runNumber] || 0] ? (
                                                                                    <div className="space-y-3">
                                                                                        {clickEvents[comparisonStepIndex[run.runNumber] || 0].screenshot ? (
                                                                                            <img
                                                                                                src={clickEvents[comparisonStepIndex[run.runNumber] || 0].screenshot}
                                                                                                alt="Extension step"
                                                                                                className="w-full border-2 border-blue-200 rounded-lg shadow-lg"
                                                                                            />
                                                                                        ) : (
                                                                                            <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground border-2 border-dashed">
                                                                                                No screenshot available
                                                                                            </div>
                                                                                        )}
                                                                                        {(comparisonStepIndex[run.runNumber] || 0) > 0 && clickEvents[comparisonStepIndex[run.runNumber] || 0].duration !== undefined && (
                                                                                            <div className="text-center py-2 bg-blue-50 rounded-lg">
                                                                                                <div className="text-sm text-muted-foreground">Duration</div>
                                                                                                <div className="text-2xl font-bold text-blue-600">
                                                                                                    {(clickEvents[comparisonStepIndex[run.runNumber] || 0].duration / 1000).toFixed(2)}s
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-muted-foreground p-8 bg-muted rounded-lg text-center">
                                                                                        No extension step at this index
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Agent Step */}
                                                                            <div className="space-y-3">
                                                                                <div className="flex items-center justify-center gap-2 py-2 bg-green-50 rounded-lg">
                                                                                    <span className="text-lg">🤖</span>
                                                                                    <h4 className="font-semibold">Agent (Actual)</h4>
                                                                                </div>
                                                                                {run.agentSteps[comparisonStepIndex[run.runNumber] || 0] ? (
                                                                                    <div className="space-y-3">
                                                                                        {run.agentSteps[comparisonStepIndex[run.runNumber] || 0].screenshot ? (
                                                                                            <img
                                                                                                src={run.agentSteps[comparisonStepIndex[run.runNumber] || 0].screenshot}
                                                                                                alt="Agent step"
                                                                                                className="w-full border-2 border-green-200 rounded-lg shadow-lg"
                                                                                            />
                                                                                        ) : (
                                                                                            <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground border-2 border-dashed">
                                                                                                No screenshot available
                                                                                            </div>
                                                                                        )}
                                                                                        {(comparisonStepIndex[run.runNumber] || 0) > 0 && run.agentSteps[comparisonStepIndex[run.runNumber] || 0].duration && (
                                                                                            <div className="text-center py-2 bg-green-50 rounded-lg">
                                                                                                <div className="text-sm text-muted-foreground">Duration</div>
                                                                                                <div className="text-2xl font-bold text-green-600">
                                                                                                    {(run.agentSteps[comparisonStepIndex[run.runNumber] || 0].duration / 1000).toFixed(2)}s
                                                                                                </div>
                                                                                                {clickEvents[comparisonStepIndex[run.runNumber] || 0]?.duration && (
                                                                                                    <div className={`text-xs font-semibold mt-1 ${run.agentSteps[comparisonStepIndex[run.runNumber] || 0].duration < clickEvents[comparisonStepIndex[run.runNumber] || 0].duration
                                                                                                        ? 'text-green-600'
                                                                                                        : 'text-red-600'
                                                                                                        }`}>
                                                                                                        {run.agentSteps[comparisonStepIndex[run.runNumber] || 0].duration < clickEvents[comparisonStepIndex[run.runNumber] || 0].duration ? '↓ ' : '↑ '}
                                                                                                        {Math.abs((run.agentSteps[comparisonStepIndex[run.runNumber] || 0].duration - clickEvents[comparisonStepIndex[run.runNumber] || 0].duration) / 1000).toFixed(2)}s
                                                                                                        {run.agentSteps[comparisonStepIndex[run.runNumber] || 0].duration < clickEvents[comparisonStepIndex[run.runNumber] || 0].duration ? ' faster' : ' slower'}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-muted-foreground p-8 bg-muted rounded-lg text-center">
                                                                                        No agent step at this index
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Compact Metrics Bar */}
                                                                        {clickEvents[comparisonStepIndex[run.runNumber] || 0] && run.agentSteps[comparisonStepIndex[run.runNumber] || 0] && (comparisonStepIndex[run.runNumber] || 0) > 0 && (() => {
                                                                            const extensionDOM = clickEvents[comparisonStepIndex[run.runNumber] || 0]?.dom;
                                                                            const agentDOM = run.agentSteps[comparisonStepIndex[run.runNumber] || 0]?.dom;
                                                                            if (extensionDOM && agentDOM) {
                                                                                const comparison = compareDOMSimilarity(extensionDOM, agentDOM);
                                                                                return (
                                                                                    <div className={`p-3 rounded-lg border-2 text-center ${comparison.similarity >= 80
                                                                                        ? 'bg-green-50 border-green-400'
                                                                                        : comparison.similarity >= 60
                                                                                            ? 'bg-yellow-50 border-yellow-400'
                                                                                            : 'bg-red-50 border-red-400'
                                                                                        }`}>
                                                                                        <span className="text-sm font-medium text-muted-foreground mr-2">DOM Match:</span>
                                                                                        <span className={`text-2xl font-bold ${comparison.similarity >= 80
                                                                                            ? 'text-green-600'
                                                                                            : comparison.similarity >= 60
                                                                                                ? 'text-yellow-600'
                                                                                                : 'text-red-600'
                                                                                            }`}>
                                                                                            {comparison.similarity}%
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}

                                                                        {/* Technical Details - Collapsed by Default */}
                                                                        {clickEvents[comparisonStepIndex[run.runNumber] || 0] && run.agentSteps[comparisonStepIndex[run.runNumber] || 0] && (comparisonStepIndex[run.runNumber] || 0) > 0 && (
                                                                            <details className="group mt-2">
                                                                                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 py-2">
                                                                                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                                                                                    Technical Details
                                                                                </summary>
                                                                                <div className="mt-3 space-y-3 bg-muted/30 p-3 rounded-lg text-xs">
                                                                                    {/* URL & XPath */}
                                                                                    <div className="space-y-2">
                                                                                        {run.agentSteps[comparisonStepIndex[run.runNumber] || 0].url && (
                                                                                            <div className="break-all">
                                                                                                <span className="font-semibold">URL:</span> {run.agentSteps[comparisonStepIndex[run.runNumber] || 0].url}
                                                                                            </div>
                                                                                        )}
                                                                                        {clickEvents[comparisonStepIndex[run.runNumber] || 0].xpath && (
                                                                                            <div className="break-all">
                                                                                                <span className="font-semibold">XPath:</span> <code className="bg-muted px-1 py-0.5 rounded ml-1">{clickEvents[comparisonStepIndex[run.runNumber] || 0].xpath}</code>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Code */}
                                                                                    <div className="pt-2 border-t">
                                                                                        <div className="font-semibold mb-1">Code:</div>
                                                                                        <div className="bg-gray-900 text-green-400 p-2 rounded font-mono text-xs overflow-auto">
                                                                                            <pre className="whitespace-pre-wrap break-all">{clickEvents[comparisonStepIndex[run.runNumber] || 0].code}</pre>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* DOM Comparison Details */}
                                                                                    {(() => {
                                                                                        const extensionDOM = clickEvents[comparisonStepIndex[run.runNumber] || 0]?.dom;
                                                                                        const agentDOM = run.agentSteps[comparisonStepIndex[run.runNumber] || 0]?.dom;
                                                                                        if (extensionDOM && agentDOM) {
                                                                                            const comparison = compareDOMSimilarity(extensionDOM, agentDOM);
                                                                                            const domKey = `${run.runNumber}-${comparisonStepIndex[run.runNumber] || 0}`;
                                                                                            const isDOMExpanded = domComparisonExpanded[domKey] || false;

                                                                                            return (
                                                                                                <div className="pt-2 border-t">
                                                                                                    <button
                                                                                                        onClick={() => setDomComparisonExpanded({
                                                                                                            ...domComparisonExpanded,
                                                                                                            [domKey]: !isDOMExpanded
                                                                                                        })}
                                                                                                        className="flex items-center justify-between w-full text-xs font-semibold mb-2 hover:text-foreground"
                                                                                                    >
                                                                                                        <span>🔍 DOM Comparison Details</span>
                                                                                                        <ChevronDown className={`h-3 w-3 transition-transform ${isDOMExpanded ? 'rotate-180' : ''}`} />
                                                                                                    </button>

                                                                                                    {isDOMExpanded && (
                                                                                                        <div className="space-y-3">
                                                                                                            {/* Similarity Metrics */}
                                                                                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                                                                                <div className="bg-card p-2 rounded border">
                                                                                                                    <div className="text-muted-foreground">Overall</div>
                                                                                                                    <div className="font-bold text-lg">{comparison.similarity}%</div>
                                                                                                                </div>
                                                                                                                <div className="bg-card p-2 rounded border">
                                                                                                                    <div className="text-muted-foreground">Content</div>
                                                                                                                    <div className="font-bold text-lg">{comparison.contentSimilarity}%</div>
                                                                                                                </div>
                                                                                                                <div className="bg-card p-2 rounded border">
                                                                                                                    <div className="text-muted-foreground">Structure</div>
                                                                                                                    <div className="font-bold text-lg">{comparison.structuralSimilarity}%</div>
                                                                                                                </div>
                                                                                                            </div>

                                                                                                            {/* Diff Information */}
                                                                                                            {comparison.diff && (comparison.diff.added.length > 0 || comparison.diff.removed.length > 0) && (
                                                                                                                <div className="space-y-2 text-xs">
                                                                                                                    {comparison.diff.removed.length > 0 && (
                                                                                                                        <div className="bg-red-50 border border-red-200 rounded p-2">
                                                                                                                            <div className="font-semibold text-red-700 mb-1">
                                                                                                                                Removed in Agent ({comparison.diff.removed.length} elements)
                                                                                                                            </div>
                                                                                                                            <div className="font-mono text-red-600 max-h-32 overflow-auto">
                                                                                                                                {comparison.diff.removed.slice(0, 5).map((line, i) => (
                                                                                                                                    <div key={i} className="truncate">- {line}</div>
                                                                                                                                ))}
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    )}

                                                                                                                    {comparison.diff.added.length > 0 && (
                                                                                                                        <div className="bg-green-50 border border-green-200 rounded p-2">
                                                                                                                            <div className="font-semibold text-green-700 mb-1">
                                                                                                                                Added in Agent ({comparison.diff.added.length} elements)
                                                                                                                            </div>
                                                                                                                            <div className="font-mono text-green-600 max-h-32 overflow-auto">
                                                                                                                                {comparison.diff.added.slice(0, 5).map((line, i) => (
                                                                                                                                    <div key={i} className="truncate">+ {line}</div>
                                                                                                                                ))}
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            )}

                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        }
                                                                                        return null;
                                                                                    })()}
                                                                                </div>
                                                                            </details>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex space-x-4 mt-4">
                                    <Button onClick={resetTest} className="flex-1 h-12 bg-[#06402B] hover:bg-[#06402B]/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all">
                                        Run Another Test
                                    </Button>
                                    <Button onClick={runAgain} className="flex-1 h-12 bg-[#06402B] hover:bg-[#06402B]/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all">
                                        Run Again
                                    </Button>
                                    <Button onClick={() => setCurrentStep("metrics")} className="flex-1 h-12 border-2 border-[#51A687] text-[#06402B] hover:bg-[#E3FFF5] hover:border-[#51A687] rounded-lg transition-all" variant="outline">
                                        View Metrics Dashboard
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Metrics Dashboard */}
                        {currentStep === "metrics" && (
                            <div className="space-y-4">
                                <MetricsDashboard
                                    defaultVisible={true}
                                    csvData={results?.map((run: any) => ({
                                        timestamp: new Date().toISOString(),
                                        modelName: run.params.modelName,
                                        searchTerm: searchTerm || taskInstruction || 'N/A',
                                        executionTime: run.metrics?.executionTime || run.browserbaseMetrics?.durationMs || '0ms',
                                        totalTokens: run.metrics?.totalTokens || 0,
                                        tokensPerSecond: run.metrics?.tokensPerSecond || 0,
                                        browserbaseStatus: calculateIsSuccess(run, testType) ? "COMPLETED" : "FAILED",
                                    }))}
                                />

                                <div className="flex space-x-4 mt-4">
                                    <Button onClick={() => setCurrentStep("results")} className="flex-1 h-12 border-2 border-[#51A687] text-[#06402B] hover:bg-[#E3FFF5] hover:border-[#51A687] rounded-lg transition-all" variant="outline">
                                        Back to Results
                                    </Button>
                                    <Button onClick={resetTest} className="flex-1 h-12 bg-[#06402B] hover:bg-[#06402B]/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all">
                                        Run Another Test
                                    </Button>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
