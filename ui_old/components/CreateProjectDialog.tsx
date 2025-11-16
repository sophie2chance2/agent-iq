"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectsStorage } from "@/lib/projects-storage";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface CreateProjectDialogProps {
  onClose: () => void;
  onProjectCreated?: (projectId: string) => void;
}

export function CreateProjectDialog({ onClose, onProjectCreated }: CreateProjectDialogProps) {
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreate = () => {
    if (!projectName.trim()) return;

    setIsCreating(true);
    try {
      const newProject = ProjectsStorage.createProject(projectName.trim());

      if (onProjectCreated) {
        onProjectCreated(newProject.id);
      } else {
        // Navigate to test page with project context
        router.push(`/test?projectId=${newProject.id}`);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreate();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Create New Project</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="projectName" className="text-sm font-medium">
              Project Name
            </label>
            <Input
              id="projectName"
              placeholder="e.g., E-commerce Testing"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!projectName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create & Start Testing"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
