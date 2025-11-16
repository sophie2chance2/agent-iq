"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, PlayCircle, Clock, Trash2, MoreVertical } from "lucide-react";
import type { ProjectRun } from "@/lib/projects-storage";
import type { TestType } from "@/app/constants/constants";

interface ProjectRunCardProps {
  url: string;
  testType: TestType;
  runs: ProjectRun[];
  onRunAgain: (run: ProjectRun) => void;
  onDeleteRun: (runId: string) => void;
  onUpdateResultStatus?: (runId: string, resultIndex: number, newStatus: boolean) => void;
}

export function ProjectRunCard({ url, testType, runs, onRunAgain, onDeleteRun, onUpdateResultStatus }: ProjectRunCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showScreenshots, setShowScreenshots] = useState<Record<string, boolean>>({});
  const [screenshotStepIndex, setScreenshotStepIndex] = useState<Record<string, number>>({});
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

  if (runs.length === 0) return null;

  // Calculate overall score (average of all runs)
  const overallScore = runs.reduce((sum, run) => sum + run.overallScore, 0) / runs.length;

  // Get latest run
  const latestRun = runs[0];

  // Group individual test results by their parameter configuration
  const groupByParameters = () => {
    const groups = new Map<string, Array<{ run: ProjectRun; result: any; resultIndex: number }>>();

    runs.forEach((run) => {
      if (run.results && run.results.length > 0) {
        run.results.forEach((result: any, resultIndex: number) => {
          const params = result.params || run.configuration.parameters[resultIndex] || {};
          // Try multiple property names: params.modelName, params.model, or config.model
          const model = params.modelName || params.model || run.configuration.parameters[resultIndex]?.model || 'unknown';
          const deviceType = params.deviceType || run.configuration.parameters[resultIndex]?.deviceType || 'default';
          const advancedStealth = params.advancedStealth ?? run.configuration.parameters[resultIndex]?.advancedStealth ?? false;
          const proxies = params.proxies ?? run.configuration.parameters[resultIndex]?.proxies ?? false;

          const key = `${model}::${deviceType}::${advancedStealth}::${proxies}`;

          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push({ run, result, resultIndex });
        });
      }
    });

    return groups;
  };

  const parameterGroups = groupByParameters();

  // Clean up expanded groups when runs change to prevent stale state
  useEffect(() => {
    const validKeys = new Set(Array.from(parameterGroups.keys()));
    setExpandedGroups(prev => {
      const newSet = new Set<string>();
      prev.forEach(key => {
        if (validKeys.has(key)) {
          newSet.add(key);
        }
      });
      return newSet;
    });
  }, [runs]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTestTypeLabel = (type: TestType): string => {
    const labels: Record<TestType, string> = {
      "search": "Search",
      "add-to-cart": "Add to Cart",
      "find-flight": "Find Flight",
      "agent-task": "Agent Task",
      "custom-script": "Custom Script",
      "click-through": "Click Through"
    };
    return labels[type] || type;
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 50) return "secondary";
    return "destructive";
  };

  return (
    <Card className="mb-4">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-2 truncate" title={url}>
              {url}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {getTestTypeLabel(testType)}
              </Badge>
              <Badge variant={getScoreBadgeVariant(overallScore)} className="text-xs">
                {overallScore.toFixed(0)}% Success
              </Badge>
              <span className="text-xs text-gray-500">
                {runs.length} run{runs.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onRunAgain(latestRun);
              }}
              className="gap-1"
            >
              <PlayCircle className="h-4 w-4" />
              Run Again
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="border-t">
          <div className="space-y-6 pt-4">
            {Array.from(parameterGroups.entries()).map(([paramKey, tests]) => {
              const [model, deviceType, advancedStealth, proxies] = paramKey.split('::');
              const modelName = model.split('/').pop() || model;

              // Calculate success rate for this parameter group
              const successCount = tests.filter(t => t.result.extractionResults?.success === true).length;
              const successRate = (successCount / tests.length) * 100;

              const isGroupExpanded = expandedGroups.has(paramKey);

              const toggleGroup = () => {
                setExpandedGroups(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(paramKey)) {
                    newSet.delete(paramKey);
                  } else {
                    newSet.add(paramKey);
                  }
                  return newSet;
                });
              };

              return (
                <div key={paramKey} className="border rounded-lg p-4 bg-gray-50">
                  {/* Parameter Group Header */}
                  <div
                    className="cursor-pointer hover:bg-gray-100 -m-4 p-4 rounded-lg transition-colors"
                    onClick={toggleGroup}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold">
                        Model: {modelName}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getScoreBadgeVariant(successRate)} className="text-xs">
                          {successRate.toFixed(0)}% Success ({successCount}/{tests.length} runs)
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                        >
                          {isGroupExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">OS:</span> {deviceType}
                      </div>
                      <div>
                        <span className="font-medium">Advanced Stealth:</span> {advancedStealth === 'true' ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">Proxies:</span> {proxies === 'true' ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>

                  {/* Individual Tests with this parameter config */}
                  {isGroupExpanded && (
                    <div className="space-y-2 mt-3 pt-3 border-t">
                    {tests.map(({ run, result, resultIndex }, idx) => {
                      const isSuccess = result.extractionResults?.success === true;
                      // Calculate run number: newest run = highest number
                      const runIndex = runs.indexOf(run);
                      const runNumber = runs.length - runIndex;

                      return (
                        <div
                          key={`${run.id}-${resultIndex}`}
                          className="border rounded-lg p-3 bg-white text-xs"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                Run #{runNumber}
                              </Badge>
                              <Badge variant={isSuccess ? "default" : "destructive"} className="text-xs">
                                {isSuccess ? "✓ Success" : "✗ Failed"}
                              </Badge>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(run.timestamp)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="relative">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const menuKey = `${run.id}-${resultIndex}`;
                                    setOpenMenus(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(menuKey)) {
                                        newSet.delete(menuKey);
                                      } else {
                                        newSet.add(menuKey);
                                      }
                                      return newSet;
                                    });
                                  }}
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                                {openMenus.has(`${run.id}-${resultIndex}`) && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenus(new Set());
                                      }}
                                    />
                                    <div className="absolute right-0 mt-1 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white shadow-lg">
                                      <div
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-gray-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onUpdateResultStatus) {
                                            onUpdateResultStatus(run.id, resultIndex, !isSuccess);
                                          }
                                          setOpenMenus(new Set());
                                        }}
                                      >
                                        Mark as {isSuccess ? "Failed" : "Success"}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this test run?")) {
                                    onDeleteRun(run.id);
                                  }
                                }}
                                className="text-gray-400 hover:text-red-600 h-6 w-6 p-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Evaluation Results */}
                          {result.extractionResults?.evalResult && run.configuration.evalFields && run.configuration.evalFields.length > 0 && (
                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div>
                                <div className="text-xs font-semibold text-gray-500 mb-1">EXTRACTED</div>
                                <div className="space-y-1">
                                  {Object.entries(result.extractionResults.evalResult).map(([key, value]: [string, any]) => (
                                    <div key={key} className="text-gray-700">
                                      <span className="font-medium">{key}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-gray-500 mb-1">EXPECTED</div>
                                <div className="space-y-1">
                                  {run.configuration.evalFields
                                    .filter(f => f.key.trim())
                                    .map((field, idx) => (
                                      <div key={idx} className="text-gray-700">
                                        <span className="font-medium">{field.key}:</span> {field.value}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Screenshots */}
                          {(result.screenshots || result.agentSteps) && (() => {
                            const screenshots = result.screenshots || result.agentSteps || [];
                            if (screenshots.length === 0) return null;

                            const screenshotKey = `${run.id}-${resultIndex}`;
                            const isShowingScreenshots = showScreenshots[screenshotKey] || false;
                            const currentStepIndex = screenshotStepIndex[screenshotKey] || 0;

                            return (
                              <div className="pt-3 border-t">
                                <Button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowScreenshots(prev => ({ ...prev, [screenshotKey]: !prev[screenshotKey] }));
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs"
                                >
                                  {isShowingScreenshots ? "Hide" : "Show"} Step-by-Step Screenshots ({screenshots.length} steps)
                                </Button>

                                {isShowingScreenshots && (
                                  <div className="mt-3 space-y-3 p-3 border rounded-lg bg-gray-50">
                                    {/* Navigation Controls */}
                                    <div className="flex items-center justify-between gap-4">
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setScreenshotStepIndex(prev => ({ ...prev, [screenshotKey]: Math.max(0, currentStepIndex - 1) }));
                                        }}
                                        disabled={currentStepIndex === 0}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                      >
                                        ← Previous
                                      </Button>

                                      <Badge variant="secondary" className="text-xs">
                                        Step {currentStepIndex + 1} of {screenshots.length}
                                      </Badge>

                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setScreenshotStepIndex(prev => ({ ...prev, [screenshotKey]: Math.min(screenshots.length - 1, currentStepIndex + 1) }));
                                        }}
                                        disabled={currentStepIndex === screenshots.length - 1}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                      >
                                        Next →
                                      </Button>
                                    </div>

                                    {/* Current Step Info */}
                                    <div className="bg-white p-2 rounded border">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          Step {currentStepIndex + 1}
                                        </Badge>
                                        <span className="text-xs font-medium">
                                          {screenshots[currentStepIndex]?.step || screenshots[currentStepIndex]?.description || "Screenshot"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Screenshot */}
                                    <div className="border-2 rounded-lg overflow-hidden bg-white shadow-sm">
                                      <img
                                        src={screenshots[currentStepIndex]?.screenshot || ""}
                                        alt={`Step ${currentStepIndex + 1}`}
                                        className="w-full h-auto cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(screenshots[currentStepIndex]?.screenshot, '_blank');
                                        }}
                                      />
                                    </div>

                                    {/* Step Progress Dots */}
                                    <div className="flex justify-center gap-2">
                                      {screenshots.map((_: any, idx: number) => (
                                        <button
                                          key={idx}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setScreenshotStepIndex(prev => ({ ...prev, [screenshotKey]: idx }));
                                          }}
                                          className={`h-2 rounded-full transition-all ${
                                            idx === currentStepIndex
                                              ? 'w-8 bg-blue-600'
                                              : 'w-2 bg-gray-300 hover:bg-gray-400'
                                          }`}
                                          aria-label={`Go to step ${idx + 1}`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
