// Storage utility for managing projects and project runs
import type { TestType } from "../app/constants/constants";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRunConfiguration {
  searchTerm?: string;
  lastName?: string;
  taskInstruction?: string;
  scriptContent?: string;
  clickEvents?: any[];
  evalFields: Array<{
    key: string;
    value: string;
    type: "string" | "number" | "boolean";
    operator?: "<" | ">" | "=" | "<=" | ">="
  }>;
  parameters: Array<{
    model: string;
    environment: string;
    advancedStealth: boolean;
    deviceType?: string;
    proxies: boolean;
  }>;
}

export interface ProjectRun {
  id: string;
  projectId: string;
  timestamp: string;
  url: string;
  testType: TestType;
  configuration: ProjectRunConfiguration;
  results: any[];
  overallScore: number;
  sessionUrls: string[];
}

interface ProjectsStorageData {
  version: string;
  lastUpdated: string;
  projects: Project[];
  runs: ProjectRun[];
}

export class ProjectsStorage {
  private static readonly STORAGE_KEY = 'agent-projects-storage';
  private static readonly VERSION = '1.0';
  private static readonly CSV_EXPORT_PATH = '/logs/project-runs.csv';

  // Initialize storage with empty data if not exists
  private static initStorage(): void {
    if (typeof window === 'undefined') return;

    const existing = localStorage.getItem(this.STORAGE_KEY);
    if (!existing) {
      const initialData: ProjectsStorageData = {
        version: this.VERSION,
        lastUpdated: new Date().toISOString(),
        projects: [],
        runs: []
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
    }
  }

  // Get storage data
  private static getData(): ProjectsStorageData {
    if (typeof window === 'undefined') {
      return { version: this.VERSION, lastUpdated: new Date().toISOString(), projects: [], runs: [] };
    }

    this.initStorage();
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      return { version: this.VERSION, lastUpdated: new Date().toISOString(), projects: [], runs: [] };
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse projects storage:', error);
      return { version: this.VERSION, lastUpdated: new Date().toISOString(), projects: [], runs: [] };
    }
  }

  // Save storage data
  private static saveData(data: ProjectsStorageData): void {
    if (typeof window === 'undefined') return;

    data.lastUpdated = new Date().toISOString();
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log('📦 Projects storage saved');
    } catch (error) {
      console.error('Failed to save projects storage:', error);
    }
  }

  // ===== PROJECT OPERATIONS =====

  // Get all projects
  static getAllProjects(): Project[] {
    return this.getData().projects;
  }

  // Get project by ID
  static getProject(projectId: string): Project | null {
    const data = this.getData();
    return data.projects.find(p => p.id === projectId) || null;
  }

  // Create new project
  static createProject(name: string): Project {
    const data = this.getData();

    const newProject: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.projects.push(newProject);
    this.saveData(data);

    console.log('✅ Created project:', newProject.name);
    return newProject;
  }

  // Update project
  static updateProject(projectId: string, updates: Partial<Pick<Project, 'name'>>): Project | null {
    const data = this.getData();
    const projectIndex = data.projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) return null;

    data.projects[projectIndex] = {
      ...data.projects[projectIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveData(data);
    return data.projects[projectIndex];
  }

  // Delete project and all its runs
  static deleteProject(projectId: string): boolean {
    const data = this.getData();
    const projectIndex = data.projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) return false;

    // Remove project
    data.projects.splice(projectIndex, 1);

    // Remove all runs for this project
    data.runs = data.runs.filter(r => r.projectId !== projectId);

    this.saveData(data);
    console.log('🗑️ Deleted project and its runs');
    return true;
  }

  // ===== RUN OPERATIONS =====

  // Get all runs for a project
  static getProjectRuns(projectId: string): ProjectRun[] {
    const data = this.getData();
    return data.runs.filter(r => r.projectId === projectId);
  }

  // Get run by ID
  static getRun(runId: string): ProjectRun | null {
    const data = this.getData();
    return data.runs.find(r => r.id === runId) || null;
  }

  // Add new run to project
  static addRun(run: Omit<ProjectRun, 'id' | 'timestamp'>): ProjectRun {
    const data = this.getData();

    const newRun: ProjectRun = {
      ...run,
      id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    data.runs.push(newRun);

    // Update project's updatedAt
    const projectIndex = data.projects.findIndex(p => p.id === run.projectId);
    if (projectIndex !== -1) {
      data.projects[projectIndex].updatedAt = new Date().toISOString();
    }

    this.saveData(data);

    // Export to CSV
    this.exportRunToCSV(newRun);

    console.log('✅ Added run to project');
    return newRun;
  }

  // Delete a run
  static deleteRun(runId: string): boolean {
    const data = this.getData();
    const runIndex = data.runs.findIndex(r => r.id === runId);

    if (runIndex === -1) return false;

    data.runs.splice(runIndex, 1);
    this.saveData(data);

    console.log('🗑️ Deleted run');
    return true;
  }

  // Update result status for a specific result in a run
  static updateResultStatus(runId: string, resultIndex: number, newStatus: boolean): boolean {
    const data = this.getData();
    const run = data.runs.find(r => r.id === runId);

    if (!run || !run.results || resultIndex >= run.results.length) return false;

    // Update the success status in the nested extractionResults
    if (run.results[resultIndex].extractionResults) {
      run.results[resultIndex].extractionResults.success = newStatus;
    }
    // Also update at the top level if it exists
    if ('success' in run.results[resultIndex]) {
      run.results[resultIndex].success = newStatus;
    }

    // Recalculate overall score based on extractionResults.success
    const successfulResults = run.results.filter(r => r.extractionResults?.success === true).length;
    run.overallScore = (successfulResults / run.results.length) * 100;

    this.saveData(data);
    console.log('✅ Updated result status');
    return true;
  }

  // Get runs grouped by URL and test type
  static getGroupedRuns(projectId: string): Map<string, ProjectRun[]> {
    const runs = this.getProjectRuns(projectId);
    const grouped = new Map<string, ProjectRun[]>();

    runs.forEach(run => {
      const key = `${run.url}::${run.testType}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(run);
    });

    // Sort runs within each group by timestamp (newest first)
    grouped.forEach(groupRuns => {
      groupRuns.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    return grouped;
  }

  // ===== STATISTICS =====

  // Get project statistics
  static getProjectStats(projectId: string): {
    totalRuns: number;
    avgScore: number;
    testTypeDistribution: Record<TestType, number>;
    recentActivity: { date: string; count: number }[];
  } {
    const runs = this.getProjectRuns(projectId);

    if (runs.length === 0) {
      return {
        totalRuns: 0,
        avgScore: 0,
        testTypeDistribution: {} as Record<TestType, number>,
        recentActivity: []
      };
    }

    const totalScore = runs.reduce((sum, r) => sum + r.overallScore, 0);
    const avgScore = totalScore / runs.length;

    // Test type distribution
    const testTypeDistribution: Record<string, number> = {};
    runs.forEach(run => {
      testTypeDistribution[run.testType] = (testTypeDistribution[run.testType] || 0) + 1;
    });

    // Recent activity (last 7 days)
    const now = new Date();
    const recentActivity: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const count = runs.filter(run =>
        run.timestamp.startsWith(dateStr)
      ).length;

      recentActivity.push({ date: dateStr, count });
    }

    return {
      totalRuns: runs.length,
      avgScore,
      testTypeDistribution: testTypeDistribution as Record<TestType, number>,
      recentActivity
    };
  }

  // ===== CSV EXPORT =====

  // Export run to CSV (append mode)
  private static exportRunToCSV(run: ProjectRun): void {
    if (typeof window === 'undefined') return;

    try {
      // Get project name
      const project = this.getProject(run.projectId);
      const projectName = project?.name || 'Unknown Project';

      // Flatten the run data for CSV
      const csvRow = {
        timestamp: run.timestamp,
        projectId: run.projectId,
        projectName: projectName,
        runId: run.id,
        url: run.url,
        testType: run.testType,
        overallScore: run.overallScore,
        modelNames: run.configuration.parameters.map(p => p.model).join(';'),
        environments: run.configuration.parameters.map(p => p.environment).join(';'),
        numResults: run.results.length,
        searchTerm: run.configuration.searchTerm || '',
        taskInstruction: run.configuration.taskInstruction || '',
        sessionUrls: run.sessionUrls.join(';')
      };

      // Store in a buffer for batch export
      const csvBuffer = localStorage.getItem('csv-export-buffer');
      const buffer = csvBuffer ? JSON.parse(csvBuffer) : [];
      buffer.push(csvRow);
      localStorage.setItem('csv-export-buffer', JSON.stringify(buffer));

      console.log('📝 Queued run for CSV export');
    } catch (error) {
      console.error('Failed to queue CSV export:', error);
    }
  }

  // Export all runs to CSV format (for download)
  static exportAllRunsToCSV(): string {
    const data = this.getData();

    if (data.runs.length === 0) {
      return 'No runs to export';
    }

    // CSV Header
    const headers = [
      'Timestamp',
      'Project ID',
      'Project Name',
      'Run ID',
      'URL',
      'Test Type',
      'Overall Score',
      'Model Names',
      'Environments',
      'Number of Results',
      'Search Term',
      'Task Instruction',
      'Session URLs'
    ];

    const csvLines = [headers.join(',')];

    // Add each run
    data.runs.forEach(run => {
      const project = this.getProject(run.projectId);
      const projectName = project?.name || 'Unknown Project';

      const row = [
        run.timestamp,
        run.projectId,
        `"${projectName}"`,
        run.id,
        `"${run.url}"`,
        run.testType,
        run.overallScore,
        `"${run.configuration.parameters.map(p => p.model).join(';')}"`,
        `"${run.configuration.parameters.map(p => p.environment).join(';')}"`,
        run.results.length,
        `"${run.configuration.searchTerm || ''}"`,
        `"${run.configuration.taskInstruction || ''}"`,
        `"${run.sessionUrls.join(';')}"`
      ];

      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  // ===== UTILITY =====

  // Clear all data
  static clearAll(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('csv-export-buffer');
    console.log('🗑️ Cleared all projects storage');
  }

  // Export all data (for backup)
  static exportAll(): string {
    return JSON.stringify(this.getData(), null, 2);
  }

  // Import data (from backup)
  static importAll(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (data.projects && data.runs) {
        this.saveData(data);
        console.log('📥 Imported projects data');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import projects data:', error);
      return false;
    }
  }
}
