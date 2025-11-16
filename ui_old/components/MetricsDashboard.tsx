"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, BarChart3, Download, Upload, Trash2 } from "lucide-react";
import { MetricsCache } from "@/lib/metrics-cache";

interface MetricsDashboardProps {
    csvData?: any[];
    className?: string;
    defaultVisible?: boolean;
}

export function MetricsDashboard({ csvData, className, defaultVisible = true }: MetricsDashboardProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const dashboardRef = useRef<HTMLDivElement>(null);
    const initializingRef = useRef(false);
    const [allMetricsData, setAllMetricsData] = useState<any[]>([]);

    // Combine cached data with live data
    useEffect(() => {
        const cachedData = MetricsCache.getAll();
        const combinedData = [
            ...cachedData,
            ...(csvData || [])
        ];
        setAllMetricsData(combinedData);
    }, [csvData]);

    // Load dashboard whenever data changes and dashboard not loaded
    useEffect(() => {
        // Trigger dashboard load as soon as allMetricsData changes
        if (!initializingRef.current) {
            loadDashboard();
        }
    }, [allMetricsData]);

    // Cleanup dashboard on unmount
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && (window as any).d3 && dashboardRef.current) {
                const d3 = (window as any).d3;
                d3.selectAll(".dashboard-tooltip").remove();
                const d3Container = d3.select(dashboardRef.current);
                d3Container.selectAll("*").remove();
            }
        };
    }, []);

    const loadDashboard = async () => {
        // Prevent multiple simultaneous initializations
        if (initializingRef.current) {
            console.log('Dashboard load already in progress, skipping...');
            return;
        }

        console.log('Starting dashboard load...', { hasRef: !!dashboardRef.current, hasData: !!csvData?.length });
        initializingRef.current = true;

        try {
            // Dynamically load D3 if not already loaded
            if (!(window as any).d3) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://d3js.org/d3.v7.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            // Add dashboard styles
            if (!document.getElementById('dashboard-styles')) {
                const styleSheet = document.createElement('style');
                styleSheet.id = 'dashboard-styles';
                styleSheet.textContent = getDashboardStyles();
                document.head.appendChild(styleSheet);
            }

            // Initialize the dashboard with inline script
            if (dashboardRef.current && (window as any).d3) {
                console.log('Initializing dashboard with data:', allMetricsData?.length || 0, 'records');
                initializeDashboard(dashboardRef.current, allMetricsData);
                setIsLoaded(true);
                console.log('Dashboard loaded successfully');
            } else {
                console.warn('Cannot initialize dashboard:', { hasRef: !!dashboardRef.current, hasD3: !!(window as any).d3 });
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            // Set loading state to false even on error to prevent infinite loading
            setIsLoaded(false);
        } finally {
            initializingRef.current = false;
        }
    };

    const getDashboardStyles = () => `
    .dashboard-tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      z-index: 1000;
    }

    .dashboard-chart-container {
      background: white;
      border-radius: 8px;
      padding: 20px;
    }

    .dashboard-chart-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #333;
      text-align: center;
    }

    .dashboard-axis {
      font-size: 11px;
    }

    .dashboard-axis path,
    .dashboard-axis line {
      fill: none;
      stroke: #333;
      shape-rendering: crispEdges;
    }

    .dashboard-legend {
      font-size: 11px;
    }

    .dashboard-bar {
      transition: opacity 0.2s;
    }

    .dashboard-bar:hover {
      opacity: 0.8;
    }

    .dashboard-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .dashboard-stat-item {
      text-align: center;
      padding: 15px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
    }

    .dashboard-stat-value {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .dashboard-stat-label {
      font-size: 12px;
      opacity: 0.9;
    }

    .dashboard-charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 20px;
    }
  `;

    const initializeDashboard = (container: HTMLElement, data?: any[]) => {
        const d3 = (window as any).d3;

        if (!d3 || !container) {
            console.warn('D3 or container not available for dashboard initialization');
            return;
        }

        // Use D3 to safely clear content instead of DOM methods
        const d3Container = d3.select(container);
        d3Container.selectAll("*").remove();

        // Remove any existing dashboard tooltips specifically
        d3.selectAll(".dashboard-tooltip").remove();

        // Create tooltip with unique ID to avoid conflicts
        const tooltipId = `dashboard-tooltip-${Date.now()}`;
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "dashboard-tooltip")
            .attr("id", tooltipId);

        // Dashboard dimensions
        const margin = { top: 20, right: 100, bottom: 60, left: 80 };
        const width = 400 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        // Color scale
        const colorScale = d3.scaleOrdinal()
            .range([
                "#2196F3", "#FF9800", "#4CAF50", "#9C27B0", "#F44336",
                "#FF5722", "#795548", "#607D8B", "#E91E63", "#00BCD4"
            ]);

        // Process data or create sample data
        let processedData = data;

        // Transform CSV data if provided
        if (data && Array.isArray(data)) {
            processedData = data.map((d, index) => ({
                timestamp: new Date(d.timestamp || Date.now()),
                modelName: d.modelName || 'unknown',
                modelShortName: (d.modelName || 'unknown').split('/').pop(),
                searchTerm: d.searchTerm || 'unknown',
                executionTime: parseExecutionTime(d.executionTime),
                totalTokens: +d.totalTokens || 0,
                tokensPerSecond: +d.tokensPerSecond || 0,
                browserbaseStatus: d.browserbaseStatus || 'UNKNOWN',
                success: d.browserbaseStatus === "COMPLETED",
                productCount: 0
            }));
        }

        // Update color scale domain
        const uniqueModels = [...new Set(processedData.map((d: any) => d.modelShortName))];
        colorScale.domain(uniqueModels);

        // Create main container
        const dashboardContainer = d3.select(container);

        // Summary stats
        const stats = calculateSummaryStats(processedData);
        const statsContainer = dashboardContainer.append("div")
            .attr("class", "dashboard-stats-grid");

        statsContainer.selectAll(".dashboard-stat-item")
            .data(stats)
            .enter()
            .append("div")
            .attr("class", "dashboard-stat-item")
            .each(function (this: any, d: any) {
                const item = d3.select(this);
                item.append("div")
                    .attr("class", "dashboard-stat-value")
                    .text(d.value);
                item.append("div")
                    .attr("class", "dashboard-stat-label")
                    .text(d.label);
            });

        // Charts container
        const chartsContainer = dashboardContainer.append("div")
            .attr("class", "dashboard-charts-grid");

        // Create charts
        createExecutionTimeChart(chartsContainer, processedData, colorScale, margin, width, height, tooltip);
        createTokensChart(chartsContainer, processedData, colorScale, margin, width, height, tooltip);
        createSuccessRateChart(chartsContainer, processedData, colorScale, margin, width, height, tooltip);
    };

    const parseExecutionTime = (executionTimeStr: string) => {
        if (!executionTimeStr) return 0;
        const numStr = executionTimeStr.toString().replace(/ms$/i, '');
        const parsed = parseInt(numStr);
        return isNaN(parsed) ? 0 : parsed;
    };

    const createSampleData = () => {
        const models = ["claude-3-5-sonnet-20240620", "gpt-4-turbo-preview", "gpt-3.5-turbo"];
        const searchTerms = ["shoes", "laptop", "headphones"];
        const data = [];

        for (let i = 0; i < 20; i++) {
            const modelName = models[Math.floor(Math.random() * models.length)];
            data.push({
                timestamp: new Date(2024, 10, Math.floor(Math.random() * 30) + 1),
                modelName: modelName,
                modelShortName: modelName.split('/').pop(),
                searchTerm: searchTerms[Math.floor(Math.random() * searchTerms.length)],
                executionTime: Math.random() * 60000 + 20000,
                totalTokens: Math.random() * 30000 + 5000,
                tokensPerSecond: Math.random() * 800 + 200,
                browserbaseStatus: Math.random() > 0.2 ? "COMPLETED" : "FAILED",
                success: Math.random() > 0.2,
                productCount: Math.floor(Math.random() * 50)
            });
        }
        return data;
    };

    const calculateSummaryStats = (data: any[]) => {
        if (data.length === 0) {
            return [
                { label: "Total Runs", value: "0" },
                { label: "Avg Execution Time", value: "0s" },
                { label: "Avg Total Tokens", value: "0" },
                { label: "Success Rate", value: "0%" }
            ];
        }

        const d3 = (window as any).d3;
        const avgExecutionTime = d3.mean(data, (d: any) => d.executionTime);
        const avgTokens = d3.mean(data, (d: any) => d.totalTokens);
        const successCount = data.filter((d: any) => d.success).length;
        const successRate = successCount / data.length;

        return [
            { label: "Total Runs", value: data.length.toString() },
            { label: "Avg Execution Time", value: `${Math.round(avgExecutionTime / 1000)}s` },
            { label: "Avg Total Tokens", value: Math.round(avgTokens).toLocaleString() },
            { label: "Success Rate", value: `${Math.round(successRate * 100)}%` }
        ];
    };

    const createExecutionTimeChart = (container: any, data: any[], colorScale: any, margin: any, width: number, height: number, tooltip: any) => {
        const d3 = (window as any).d3;

        const chartContainer = container.append("div")
            .attr("class", "dashboard-chart-container")
            .attr("id", "exec-time-chart-container");
        chartContainer.append("div").attr("class", "dashboard-chart-title").text("Execution Time per Run");

        const svg = chartContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const dataWithRunNumbers = data.map((d, i) => ({ ...d, runNumber: i + 1 }));

        const xScale = d3.scaleLinear()
            .domain([1, dataWithRunNumbers.length])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(dataWithRunNumbers, (d: any) => d.executionTime / 1000)])
            .range([height, 0]);

        g.append("g")
            .attr("class", "dashboard-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        g.append("g")
            .attr("class", "dashboard-axis")
            .call(d3.axisLeft(yScale));

        g.selectAll(".exec-time-point")
            .data(dataWithRunNumbers)
            .enter()
            .append("circle")
            .attr("class", "exec-time-point")
            .attr("cx", (d: any) => xScale(d.runNumber))
            .attr("cy", (d: any) => yScale(d.executionTime / 1000))
            .attr("r", 4)
            .style("fill", (d: any) => colorScale(d.modelShortName))
            .style("opacity", 0.7)
            .on("mouseover", function (event: any, d: any) {
                tooltip
                    .style("opacity", 1)
                    .html(`
            <strong>Run ${d.runNumber}</strong><br/>
            <strong>Model:</strong> ${d.modelShortName}<br/>
            <strong>Search:</strong> ${d.searchTerm}<br/>
            <strong>Execution Time:</strong> ${(d.executionTime / 1000).toFixed(1)}s
          `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });

        // Add axis labels
        g.append("text")
            .style("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .text("Run Number");

        g.append("text")
            .style("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -50)
            .text("Execution Time (seconds)");
    };

    const createTokensChart = (container: any, data: any[], colorScale: any, margin: any, width: number, height: number, tooltip: any) => {
        const d3 = (window as any).d3;

        const chartContainer = container.append("div")
            .attr("class", "dashboard-chart-container")
            .attr("id", "tokens-chart-container");
        chartContainer.append("div").attr("class", "dashboard-chart-title").text("Total Tokens per Run");

        const svg = chartContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const dataWithRunNumbers = data.map((d, i) => ({ ...d, runNumber: i + 1 }));

        const xScale = d3.scaleLinear()
            .domain([1, dataWithRunNumbers.length])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(dataWithRunNumbers, (d: any) => d.totalTokens)])
            .range([height, 0]);

        g.append("g")
            .attr("class", "dashboard-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        g.append("g")
            .attr("class", "dashboard-axis")
            .call(d3.axisLeft(yScale).tickFormat(d3.format(".2s")));

        g.selectAll(".tokens-point")
            .data(dataWithRunNumbers)
            .enter()
            .append("circle")
            .attr("class", "tokens-point")
            .attr("cx", (d: any) => xScale(d.runNumber))
            .attr("cy", (d: any) => yScale(d.totalTokens))
            .attr("r", 4)
            .style("fill", (d: any) => colorScale(d.modelShortName))
            .style("opacity", 0.7)
            .on("mouseover", function (event: any, d: any) {
                tooltip
                    .style("opacity", 1)
                    .html(`
            <strong>Run ${d.runNumber}</strong><br/>
            <strong>Model:</strong> ${d.modelShortName}<br/>
            <strong>Search:</strong> ${d.searchTerm}<br/>
            <strong>Total Tokens:</strong> ${d.totalTokens.toLocaleString()}
          `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });

        // Add axis labels
        g.append("text")
            .style("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .text("Run Number");

        g.append("text")
            .style("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -50)
            .text("Total Tokens");
    };

    const createSuccessRateChart = (container: any, data: any[], colorScale: any, margin: any, width: number, height: number, tooltip: any) => {
        const d3 = (window as any).d3;

        const chartContainer = container.append("div")
            .attr("class", "dashboard-chart-container")
            .attr("id", "success-rate-chart-container");
        chartContainer.append("div").attr("class", "dashboard-chart-title").text("Success Rate by Model");

        const svg = chartContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Calculate success rate by model
        const modelStats = d3.rollups(
            data,
            (v: any[]) => ({
                successRate: d3.mean(v, (d: any) => d.success ? 1 : 0) * 100,
                totalRuns: v.length,
                successfulRuns: v.filter((d: any) => d.success).length
            }),
            (d: any) => d.modelShortName
        ).map(([key, value]: [string, any]) => ({
            model: key,
            ...value
        }));

        const xScale = d3.scaleBand()
            .domain(modelStats.map((d: any) => d.model))
            .range([0, width])
            .padding(0.3);

        const yScale = d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);

        g.append("g")
            .attr("class", "dashboard-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        g.append("g")
            .attr("class", "dashboard-axis")
            .call(d3.axisLeft(yScale).tickFormat((d: any) => d + "%"));

        g.selectAll(".success-bar")
            .data(modelStats)
            .enter()
            .append("rect")
            .attr("class", "success-bar dashboard-bar")
            .attr("x", (d: any) => xScale(d.model) || 0)
            .attr("y", (d: any) => yScale(d.successRate))
            .attr("width", xScale.bandwidth())
            .attr("height", (d: any) => height - yScale(d.successRate))
            .style("fill", (d: any) => colorScale(d.model))
            .on("mouseover", function (event: any, d: any) {
                tooltip
                    .style("opacity", 1)
                    .html(`
            <strong>Model:</strong> ${d.model}<br/>
            <strong>Success Rate:</strong> ${d.successRate.toFixed(1)}%<br/>
            <strong>Successful Runs:</strong> ${d.successfulRuns}<br/>
            <strong>Total Runs:</strong> ${d.totalRuns}
          `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });

        // Add percentage labels on bars
        g.selectAll(".success-label")
            .data(modelStats)
            .enter()
            .append("text")
            .attr("class", "success-label")
            .style("text-anchor", "middle")
            .style("font-size", "11px")
            .style("fill", "white")
            .attr("x", (d: any) => (xScale(d.model) || 0) + xScale.bandwidth() / 2)
            .attr("y", (d: any) => yScale(d.successRate) + 15)
            .text((d: any) => `${d.successRate.toFixed(1)}%`);

        // Add axis labels
        g.append("text")
            .style("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .text("Model");

        g.append("text")
            .style("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -50)
            .text("Success Rate (%)");
    };

    return (
        <div className={className}>
            {/* Action Buttons */}
            <div className="flex flex-row items-center justify-end mb-6">
                <div className="flex items-center gap-2">
                    {allMetricsData && allMetricsData.length > 0 && (
                        <Badge variant="secondary">
                            {MetricsCache.getAll().length} cached + {(csvData?.length || 0)} live = {allMetricsData.length} total runs
                        </Badge>
                    )}
                    {MetricsCache.getAll().length === 0 && (
                        <Badge variant="outline">
                            No cached data
                        </Badge>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            // Clean up before refresh
                            if ((window as any).d3 && dashboardRef.current) {
                                const d3 = (window as any).d3;
                                d3.selectAll(".dashboard-tooltip").remove();
                                const d3Container = d3.select(dashboardRef.current);
                                d3Container.selectAll("*").remove();
                            }
                            setIsLoaded(false);
                            setTimeout(() => loadDashboard(), 200);
                        }}
                        title="Refresh dashboard"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const data = MetricsCache.export();
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `metrics-cache-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        title="Export cache data"
                    >
                        <Download className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.json';
                            input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        const data = e.target?.result as string;
                                        if (MetricsCache.import(data)) {
                                            // Refresh data and dashboard
                                            const cachedData = MetricsCache.getAll();
                                            const combinedData = [
                                                ...cachedData,
                                                ...(csvData || [])
                                            ];
                                            setAllMetricsData(combinedData);
                                            setIsLoaded(false);
                                            setTimeout(() => loadDashboard(), 100);
                                        }
                                    };
                                    reader.readAsText(file);
                                }
                            };
                            input.click();
                        }}
                        title="Import cache data"
                    >
                        <Upload className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (MetricsCache.getAll().length === 0) return; // Safety check
                            if (confirm('Are you sure you want to clear all cached metrics data?')) {
                                MetricsCache.clear();
                                // Refresh data to show only live data
                                setAllMetricsData(csvData || []);
                                setIsLoaded(false);
                                setTimeout(() => loadDashboard(), 100);
                            }
                        }}
                        disabled={MetricsCache.getAll().length === 0}
                        title={MetricsCache.getAll().length === 0 ? "No cached data to clear" : "Clear cache"}
                        className={`text-red-600 hover:text-red-700 ${MetricsCache.getAll().length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content - Always visible */}
            <div className="space-y-6">
                {/* Data Sources & Cache Statistics */}
                {/* <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm font-medium mb-2">Data Sources</div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>🗄️ Cache: {MetricsCache.getAll().length} runs</span>
                        <span>⚡ Live: {csvData?.length || 0} runs</span>
                        <span>📊 Total: {allMetricsData.length} runs</span>
                    </div>
                </div> */}

                {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="p-3 border rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Cached Runs</div>
            <div className="text-2xl font-bold">{MetricsCache.getAll().length}</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Live Session</div>
            <div className="text-2xl font-bold">{csvData?.length || 0}</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Success Rate</div>
            <div className="text-2xl font-bold">{Math.round(MetricsCache.getStats().successRate)}%</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Avg Tokens</div>
            <div className="text-2xl font-bold">{Math.round(MetricsCache.getStats().avgTokens)}</div>
          </div>
        </div> */}

                <div
                    ref={dashboardRef}
                    key={`dashboard-${allMetricsData?.length || 0}-${Date.now()}`}
                    className="min-h-[400px]"
                >
                    {!isLoaded && (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-muted-foreground">Loading dashboard...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}