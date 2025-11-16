"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectsStorage, type Project, type ProjectRun } from "@/lib/projects-storage";
import { ProjectRunCard } from "@/components/ProjectRunCard";
import { ArrowLeft, Plus, Download, FolderOpen } from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [groupedRuns, setGroupedRuns] = useState<Map<string, ProjectRun[]>>(new Map());
  const [stats, setStats] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  // Reload data periodically to catch new runs
  useEffect(() => {
    const interval = setInterval(() => {
      loadProjectData();
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [projectId]);

  const loadProjectData = () => {
    const proj = ProjectsStorage.getProject(projectId);
    if (!proj) {
      router.push("/projects");
      return;
    }

    const grouped = ProjectsStorage.getGroupedRuns(projectId);
    const projectStats = ProjectsStorage.getProjectStats(projectId);

    console.log('📊 Loading project data:', {
      projectId,
      projectName: proj.name,
      groupedRunsSize: grouped.size,
      groupKeys: Array.from(grouped.keys()),
      totalRuns: projectStats.totalRuns
    });

    setProject(proj);
    setGroupedRuns(new Map(grouped)); // Create new Map instance to force re-render
    setStats(projectStats);
    setRefreshKey(prev => prev + 1); // Force component refresh
  };

  const handleRunAgain = (run: ProjectRun) => {
    // Navigate to test page with configuration loaded
    const queryParams = new URLSearchParams({
      projectId: projectId,
      url: run.url,
      testType: run.testType,
      config: JSON.stringify({
        searchTerm: run.configuration.searchTerm,
        lastName: run.configuration.lastName,
        taskInstruction: run.configuration.taskInstruction,
        scriptContent: run.configuration.scriptContent,
        evalFields: run.configuration.evalFields,
        parameters: run.configuration.parameters,
      }),
    });

    router.push(`/test?${queryParams.toString()}`);
  };

  const handleDeleteRun = (runId: string) => {
    const success = ProjectsStorage.deleteRun(runId);
    if (success) {
      // Reload project data to update UI
      loadProjectData();
    }
  };

  const handleUpdateResultStatus = (runId: string, resultIndex: number, newStatus: boolean) => {
    const success = ProjectsStorage.updateResultStatus(runId, resultIndex, newStatus);
    if (success) {
      // Reload project data to update UI
      loadProjectData();
    }
  };

  const handleNewTest = () => {
    router.push(`/test?projectId=${projectId}`);
  };

  const handleExportCSV = () => {
    const csv = ProjectsStorage.exportAllRunsToCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name.replace(/\s+/g, "-")}-runs.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

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

        {/* Navigation */}
        <Button
          variant="ghost"
          onClick={() => router.push("/projects")}
          className="mb-6 text-gray-600 hover:text-[#06402B] hover:bg-[#E3FFF5]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#06402B] mb-3 tracking-tight">
                {project.name}
              </h1>
              <p className="text-lg text-gray-600">
                View and manage test runs for this project
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="gap-2 border-2 border-[#51A687] text-[#06402B] hover:bg-[#E3FFF5] hover:border-[#51A687] rounded-lg transition-all"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                onClick={handleNewTest}
                className="gap-2 bg-[#06402B] hover:bg-[#06402B]/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="h-4 w-4" />
                New Test
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && stats.totalRuns > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-[#06402B]">
                  {stats.totalRuns}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total Runs</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-[#06402B]">
                  {stats.avgScore.toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600 mt-1">Average Score</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-[#06402B]">
                  {Object.keys(stats.testTypeDistribution || {}).length}
                </div>
                <div className="text-sm text-gray-600 mt-1">Test Types</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-2">Test Distribution</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.testTypeDistribution || {}).map(([type, count]: [string, any]) => (
                    <Badge key={type} variant="outline" className="text-xs border-[#51A687]/30 text-[#06402B]">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Runs */}
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold text-[#06402B] mb-6">Test Runs</h2>
          {/* Debug info */}
          <div className="text-xs text-gray-500 mb-2">
            Debug: groupedRuns.size = {groupedRuns.size}, keys = {Array.from(groupedRuns.keys()).join(', ')}, refreshKey = {refreshKey}
          </div>

          {groupedRuns.size === 0 ? (
            <Card className="text-center py-16 border-slate-200">
              <CardContent>
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-[#E3FFF5] to-[#96D9C0]/30 rounded-xl flex items-center justify-center">
                  <FolderOpen className="h-8 w-8 text-[#06402B]" />
                </div>
                <h3 className="text-2xl font-semibold text-[#06402B] mb-3">No runs yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Start your first test run for this project
                </p>
                <Button
                  onClick={handleNewTest}
                  className="bg-[#06402B] hover:bg-[#06402B]/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start Testing
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedRuns.entries()).map(([key, runs]) => {
                const [url, testType] = key.split("::");
                return (
                  <ProjectRunCard
                    key={key}
                    url={url}
                    testType={testType as any}
                    runs={runs}
                    onRunAgain={handleRunAgain}
                    onDeleteRun={handleDeleteRun}
                    onUpdateResultStatus={handleUpdateResultStatus}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
