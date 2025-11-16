"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectsStorage, type Project } from "@/lib/projects-storage";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Calendar, Activity, Trash2, PlayCircle } from "lucide-react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projectStats, setProjectStats] = useState<Record<string, any>>({});
  const router = useRouter();

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    const allProjects = ProjectsStorage.getAllProjects();
    setProjects(allProjects);

    // Load stats for each project
    const stats: Record<string, any> = {};
    allProjects.forEach(project => {
      stats[project.id] = ProjectsStorage.getProjectStats(project.id);
    });
    setProjectStats(stats);
  };

  const handleDeleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    if (confirm("Are you sure you want to delete this project and all its runs?")) {
      ProjectsStorage.deleteProject(projectId);
      loadProjects();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
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

        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#06402B] mb-3 tracking-tight">Projects</h1>
              <p className="text-lg text-gray-600">
                Manage your agent testing projects and view run history
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push("/test")}
                size="lg"
                variant="outline"
                className="gap-2 border-2 border-[#51A687] text-[#06402B] hover:bg-[#E3FFF5] hover:border-[#51A687] rounded-lg transition-all"
              >
                <PlayCircle className="h-5 w-5" />
                Run a Test
              </Button>
              <Button
                onClick={() => setShowCreateDialog(true)}
                size="lg"
                className="gap-2 bg-[#06402B] hover:bg-[#06402B]/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="h-5 w-5" />
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card className="text-center py-16 border-slate-200">
            <CardContent>
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-[#E3FFF5] to-[#96D9C0]/30 rounded-xl flex items-center justify-center">
                <FolderOpen className="h-8 w-8 text-[#06402B]" />
              </div>
              <h3 className="text-2xl font-semibold text-[#06402B] mb-3">No projects yet</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Create your first project to start testing AI agents
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-[#06402B] hover:bg-[#06402B]/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => {
              const stats = projectStats[project.id] || { totalRuns: 0, avgScore: 0 };

              return (
                <Card
                  key={project.id}
                  className="border-slate-200 hover:border-[#51A687] hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1 text-[#06402B]">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          Created {formatDate(project.createdAt)}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-[#E3FFF5] to-[#96D9C0]/20 rounded-lg p-3">
                        <div className="text-2xl font-bold text-[#06402B]">
                          {stats.totalRuns}
                        </div>
                        <div className="text-xs text-gray-600">Total Runs</div>
                      </div>
                      <div className="bg-gradient-to-br from-[#E3FFF5] to-[#96D9C0]/20 rounded-lg p-3">
                        <div className="text-2xl font-bold text-[#06402B]">
                          {stats.avgScore.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-600">Avg Score</div>
                      </div>
                    </div>

                    {/* Test Types */}
                    {stats.testTypeDistribution && Object.keys(stats.testTypeDistribution).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(stats.testTypeDistribution).map(([type, count]: [string, any]) => (
                          <Badge key={type} variant="outline" className="text-xs border-[#51A687]/30 text-[#06402B]">
                            {type}: {count}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Last Updated */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 pt-2 border-t border-slate-200">
                      <Activity className="h-3 w-3" />
                      Updated {formatDate(project.updatedAt)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Project Dialog */}
        {showCreateDialog && (
          <CreateProjectDialog
            onClose={() => setShowCreateDialog(false)}
            onProjectCreated={(projectId) => {
              setShowCreateDialog(false);
              router.push(`/test?projectId=${projectId}`);
            }}
          />
        )}
      </div>
    </div>
  );
}
