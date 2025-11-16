// Cache utility for storing and retrieving metrics data
export interface MetricsCacheEntry {
  timestamp: string;
  modelName: string;
  searchTerm: string;
  executionTime: number;
  totalTokens: number;
  tokensPerSecond: number;
  browserbaseStatus: string;
  success: boolean;
  sessionId?: string;
  url?: string;
  extractionResults?: any;
}

export class MetricsCache {
  private static readonly CACHE_KEY = 'agent-metrics-cache';
  private static readonly MAX_ENTRIES = 1000; // Limit cache size
  private static readonly CACHE_VERSION = '1.0';

  // Get all cached metrics
  static getAll(): MetricsCacheEntry[] {
    try {
      if (typeof window === 'undefined') return [];
      
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return [];
      
      const data = JSON.parse(cached);
      
      // Check cache version and migrate if needed
      if (data.version !== this.CACHE_VERSION) {
        console.log('Cache version mismatch, clearing cache');
        this.clear();
        return [];
      }
      
      return data.entries || [];
    } catch (error) {
      console.warn('Failed to load metrics from cache:', error);
      return [];
    }
  }

  // Add new metrics to cache
  static add(entries: MetricsCacheEntry | MetricsCacheEntry[]): void {
    try {
      if (typeof window === 'undefined') return;
      
      const currentEntries = this.getAll();
      const newEntries = Array.isArray(entries) ? entries : [entries];
      
      // Add timestamps if not present
      const timestampedEntries = newEntries.map(entry => ({
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      }));
      
      // Combine and sort by timestamp (newest first)
      const allEntries = [...currentEntries, ...timestampedEntries]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Limit cache size
      const limitedEntries = allEntries.slice(0, this.MAX_ENTRIES);
      
      // Save to localStorage
      const cacheData = {
        version: this.CACHE_VERSION,
        lastUpdated: new Date().toISOString(),
        entries: limitedEntries
      };
      
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      console.log(`📦 Cached ${timestampedEntries.length} new metrics entries`);
    } catch (error) {
      console.error('Failed to cache metrics:', error);
    }
  }

  // Get metrics filtered by criteria
  static getFiltered(filters: {
    modelName?: string;
    searchTerm?: string;
    success?: boolean;
    dateRange?: { start: Date; end: Date };
    limit?: number;
  } = {}): MetricsCacheEntry[] {
    const allEntries = this.getAll();
    
    let filtered = allEntries;
    
    if (filters.modelName) {
      filtered = filtered.filter(entry => 
        entry.modelName.toLowerCase().includes(filters.modelName!.toLowerCase())
      );
    }
    
    if (filters.searchTerm) {
      filtered = filtered.filter(entry => 
        entry.searchTerm.toLowerCase().includes(filters.searchTerm!.toLowerCase())
      );
    }
    
    if (filters.success !== undefined) {
      filtered = filtered.filter(entry => entry.success === filters.success);
    }
    
    if (filters.dateRange) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= filters.dateRange!.start && entryDate <= filters.dateRange!.end;
      });
    }
    
    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }
    
    return filtered;
  }

  // Get summary statistics
  static getStats(): {
    totalRuns: number;
    successRate: number;
    avgExecutionTime: number;
    avgTokens: number;
    modelDistribution: Record<string, number>;
    recentActivity: { date: string; count: number }[];
  } {
    const entries = this.getAll();
    
    if (entries.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        avgExecutionTime: 0,
        avgTokens: 0,
        modelDistribution: {},
        recentActivity: []
      };
    }
    
    const successfulRuns = entries.filter(e => e.success).length;
    const totalExecutionTime = entries.reduce((sum, e) => sum + (e.executionTime || 0), 0);
    const totalTokens = entries.reduce((sum, e) => sum + (e.totalTokens || 0), 0);
    
    // Model distribution
    const modelDistribution: Record<string, number> = {};
    entries.forEach(entry => {
      const model = entry.modelName.split('/').pop() || entry.modelName;
      modelDistribution[model] = (modelDistribution[model] || 0) + 1;
    });
    
    // Recent activity (last 7 days)
    const now = new Date();
    const recentActivity: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = entries.filter(entry => 
        entry.timestamp.startsWith(dateStr)
      ).length;
      
      recentActivity.push({ date: dateStr, count });
    }
    
    return {
      totalRuns: entries.length,
      successRate: (successfulRuns / entries.length) * 100,
      avgExecutionTime: totalExecutionTime / entries.length,
      avgTokens: totalTokens / entries.length,
      modelDistribution,
      recentActivity
    };
  }

  // Clear all cached data
  static clear(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(this.CACHE_KEY);
      console.log('🗑️ Metrics cache cleared');
    } catch (error) {
      console.error('Failed to clear metrics cache:', error);
    }
  }

  // Export cache data (for backup/migration)
  static export(): string {
    return JSON.stringify({
      version: this.CACHE_VERSION,
      exportDate: new Date().toISOString(),
      entries: this.getAll()
    }, null, 2);
  }

  // Import cache data (from backup/migration)
  static import(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        const cacheData = {
          version: this.CACHE_VERSION,
          lastUpdated: new Date().toISOString(),
          entries: parsed.entries
        };
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
        console.log(`📥 Imported ${parsed.entries.length} metrics entries`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import metrics cache:', error);
      return false;
    }
  }

  // Migrate from CSV data (one-time migration) - DEPRECATED: CSV file removed
  static async migrateFromCSV(csvUrl: string = '/logs/workflow-runs.csv'): Promise<boolean> {
    try {
      console.log('⚠️ CSV migration attempted but CSV file has been removed - using cache-only storage');
      const response = await fetch(csvUrl);
      if (!response.ok) {
        console.log('📝 CSV file not found (expected) - continuing with cache-only mode');
        return false;
      }
      
      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      
      if (lines.length <= 1) return false;
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const entries: MetricsCacheEntry[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        if (row.timestamp) {
          const entry: MetricsCacheEntry = {
            timestamp: row.timestamp,
            modelName: row.modelName || 'unknown',
            searchTerm: row.searchTerm || 'unknown',
            executionTime: parseInt(row.executionTime?.replace('ms', '') || '0') || 0,
            totalTokens: parseInt(row.totalTokens || '0') || 0,
            tokensPerSecond: parseFloat(row.tokensPerSecond || '0') || 0,
            browserbaseStatus: row.browserbaseStatus || 'UNKNOWN',
            success: row.browserbaseStatus === 'COMPLETED',
            sessionId: row.browserbaseSessionId,
            url: row.url,
            extractionResults: row.extractionResults ? JSON.parse(row.extractionResults) : null
          };
          
          entries.push(entry);
        }
      }
      
      if (entries.length > 0) {
        this.add(entries);
        console.log(`🔄 Migrated ${entries.length} entries from CSV to cache`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to migrate from CSV:', error);
      return false;
    }
  }
}