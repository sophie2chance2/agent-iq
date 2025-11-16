// Simplified Dashboard for Agent Navigation Metrics
// Three key visualizations: Execution Time, Tokens per Run, Success Rate

class MetricsDashboard {
    constructor() {
        this.data = [];
        this.filteredData = [];
        // Selected filters
        this.selectedSearchTerms = new Set();
        this.selectedModel = "all";
        this.parseDate = d3.timeParse("%Y-%m-%dT%H:%M:%S.%fZ");
        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px")
            .style("pointer-events", "none");
        
        // Chart dimensions
        this.margin = { top: 20, right: 120, bottom: 60, left: 80 };
        this.width = 500 - this.margin.left - this.margin.right;
        this.height = 350 - this.margin.bottom - this.margin.top;

        // Color scale for models - expanded palette to handle more models
        this.modelColorScale = d3.scaleOrdinal()
            .range([
                "#2196F3", "#FF9800", "#4CAF50", "#9C27B0", "#F44336",
                "#FF5722", "#795548", "#607D8B", "#E91E63", "#00BCD4",
                "#FFEB3B", "#8BC34A", "#9E9E9E", "#3F51B5", "#FF6F00"
            ]);
        
        this.init();
    }

    async init() {
        console.log("🚀 Initializing MetricsDashboard at", new Date().toLocaleTimeString());
        try {
            await this.loadData();
            console.log("📊 Data loaded, setting up filters...");
            this.setupFilters();
            this.setupModelFilter();
            console.log("🎨 Creating charts...");
            this.createCharts();
            console.log("🔄 Updating all charts with data...");
            this.updateAllCharts();
            console.log("✅ Dashboard initialization complete at", new Date().toLocaleTimeString());
        } catch (error) {
            console.error("❌ Dashboard initialization failed:", error);
        }
    }

    async loadData() {
        try {
            console.log("Loading CSV data...");
            // Try multiple CSV paths
            const csvPaths = [
                "workflow-runs.csv",
                "../ui/logs/workflow-runs.csv", 
                "ui/logs/workflow-runs.csv"
            ];
            
            let csvData = null;
            for (const path of csvPaths) {
                try {
                    console.log(`Trying to load CSV from: ${path}`);
                    csvData = await d3.csv(path);
                    console.log(`✅ Successfully loaded CSV from: ${path}`);
                    break;
                } catch (error) {
                    console.log(`Failed to load from ${path}:`, error.message);
                }
            }
            
            if (!csvData) {
                throw new Error("Could not load CSV data from any path");
            }
            
            console.log("Raw CSV data length:", csvData.length);
            
            this.data = csvData.map((d, index) => {
                try {
                    let extractionResults = null;
                    let productCount = 0;
                    let success = false;
                    
                    // Safely parse extraction results
                    try {
                        if (d.extractionResults && d.extractionResults.trim() !== '') {
                            extractionResults = JSON.parse(d.extractionResults);
                            if (extractionResults && extractionResults.products && Array.isArray(extractionResults.products)) {
                                productCount = extractionResults.products.length;
                            }
                        }
                    } catch (parseError) {
                        console.warn(`Could not parse extraction results for record ${index}:`, parseError);
                    }
                    
                    // Determine success: completed status and either has products or extraction results exist
                    success = d.browserbaseStatus === "COMPLETED" && (productCount > 0 || (d.extractionResults && d.extractionResults.trim() !== ''));
                    
                    if (index < 5) {
                        console.log(`Record ${index} success logic:`, {
                            browserbaseStatus: d.browserbaseStatus,
                            productCount,
                            hasExtractionResults: !!(d.extractionResults && d.extractionResults.trim() !== ''),
                            finalSuccess: success
                        });
                    }
                    
                    const processedRecord = {
                        timestamp: this.parseDate(d.timestamp),
                        modelName: d.modelName || 'unknown',
                        modelShortName: (d.modelName || 'unknown').split('/').pop(),
                        searchTerm: d.searchTerm || 'unknown',
                        executionTime: this.parseExecutionTime(d.executionTime),
                        totalTokens: +d.totalTokens || 0,
                        tokensPerSecond: +d.tokensPerSecond || 0,
                        browserbaseStatus: d.browserbaseStatus || 'UNKNOWN',
                        success: success,
                        productCount: productCount,
                        extractionResults: extractionResults
                    };
                    
                    if (index < 3) {
                        console.log(`Processed record ${index}:`, processedRecord);
                    }
                    
                    return processedRecord;
                } catch (error) {
                    console.error(`Error processing record ${index}:`, error);
                    return null;
                }
            }).filter(d => d !== null);

            this.filteredData = [...this.data];
            
            // Update color scale with actual models found
            const uniqueModels = [...new Set(this.data.map(d => d.modelShortName))];
            this.modelColorScale.domain(uniqueModels);
            
            console.log("✅ Data processing complete!");
            console.log("Total records:", this.data.length);
            console.log("Models found:", uniqueModels);
            console.log("Search terms found:", [...new Set(this.data.map(d => d.searchTerm))]);
            
            // Log sample data for debugging
            if (this.data.length > 0) {
                console.log("Sample execution times:", this.data.slice(0, 5).map(d => d.executionTime));
                console.log("Sample success rates:", this.data.slice(0, 5).map(d => d.success));
                console.log("Sample total tokens:", this.data.slice(0, 5).map(d => d.totalTokens));
                console.log("Sample complete records:", this.data.slice(0, 2));
            }
            
        } catch (error) {
            console.error("❌ Error loading data:", error);
            this.createSampleData();
        }
    }

    parseExecutionTime(executionTimeStr) {
        if (!executionTimeStr) return 0;
        // Handle formats like "42386ms" or just numbers
        const numStr = executionTimeStr.toString().replace(/ms$/i, '');
        const parsed = parseInt(numStr);
        return isNaN(parsed) ? 0 : parsed;
    }

    createSampleData() {
        console.log("Creating sample data...");
        const sampleData = [];
        // Extended test data with more models and search terms
        const models = [
            "claude-3-5-sonnet-20240620", 
            "claude-sonnet-4-20250514", 
            "gpt-4-turbo-preview",
            "gpt-3.5-turbo-16k",
            "palm-2-chat-bison",
            "llama-2-70b-chat"
        ];
        const searchTerms = [
            "socks", "shoes", "gaming laptop", "coffee maker", 
            "wireless headphones", "backpack", "smartphone", 
            "tablet", "monitor", "keyboard"
        ];
        
        for (let i = 0; i < 50; i++) {
            const modelName = models[Math.floor(Math.random() * models.length)];
            sampleData.push({
                timestamp: new Date(2025, 9, Math.floor(Math.random() * 30) + 1),
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
        
        this.data = sampleData;
        this.filteredData = [...this.data];
        
        // Update color scale
        const uniqueModels = [...new Set(this.data.map(d => d.modelShortName))];
        this.modelColorScale.domain(uniqueModels);
        
        console.log("Sample data created:", this.data.length, "records");
        console.log("Sample models:", uniqueModels);
    }

    setupFilters() {
        if (!this.data || this.data.length === 0) {
            console.warn("No data available for filter setup");
            return;
        }
        
        // Get unique search terms
        const searchTerms = [...new Set(this.data.map(d => d.searchTerm))].filter(term => term && term !== 'unknown');
        this.selectedSearchTerms = new Set(searchTerms);
        
        console.log("Setting up filters for search terms:", searchTerms);
        
        // Setup search filter dropdown
        const dropdown = d3.select("#searchFilterDropdown");
        const button = dropdown.select("#searchFilterButton");
        const optionsContainer = dropdown.select("#searchFilterOptions");
        
        // Clear existing options
        optionsContainer.selectAll("*").remove();
        
        if (searchTerms.length === 0) {
            console.warn("No valid search terms found");
            return;
        }
        
        // Add checkboxes for each search term
        const options = optionsContainer.selectAll(".search-option")
            .data(searchTerms)
            .enter()
            .append("div")
            .attr("class", "search-option")
            .style("padding", "5px")
            .style("cursor", "pointer");
            
        options.append("input")
            .attr("type", "checkbox")
            .attr("value", d => d)
            .property("checked", true)
            .style("margin-right", "5px")
            .on("change", (event, d) => {
                if (event.target.checked) {
                    this.selectedSearchTerms.add(d);
                } else {
                    this.selectedSearchTerms.delete(d);
                }
                this.filterData();
                this.updateAllCharts();
            });
            
        options.append("label")
            .text(d => d)
            .style("cursor", "pointer")
            .on("click", function(event, d) {
                const checkbox = d3.select(this.parentNode).select("input");
                const isChecked = checkbox.property("checked");
                checkbox.property("checked", !isChecked);
                checkbox.dispatch("change");
            });
            
        // Add filter actions container
        const filterActions = optionsContainer.append("div")
            .attr("class", "filter-actions");
            
        // Add Apply All button
        const applyAllBtn = filterActions.append("button")
            .attr("class", "apply-all-button")
            .text("Select All")
            .style("margin-bottom", "4px")
            .on("click", (event) => {
                event.stopPropagation();
                
                // Select all checkboxes
                optionsContainer.selectAll(".search-option input")
                    .property("checked", true);
                    
                // Update selected search terms
                this.selectedSearchTerms = new Set(searchTerms);
                
                // Update charts and UI
                this.filterData();
                this.updateAllCharts();
                this.updateFilterButtonText();
            });
            
        // Add Clear All button
        const clearAllBtn = filterActions.append("button")
            .attr("class", "apply-all-button")
            .style("background", "#F44336")
            .style("margin-bottom", "4px")
            .text("Clear All")
            .on("mouseover", function() {
                d3.select(this).style("background", "#D32F2F");
            })
            .on("mouseout", function() {
                d3.select(this).style("background", "#F44336");
            })
            .on("click", (event) => {
                event.stopPropagation();
                
                // Uncheck all checkboxes
                optionsContainer.selectAll(".search-option input")
                    .property("checked", false);
                    
                // Clear selected search terms
                this.selectedSearchTerms.clear();
                
                // Update charts and UI
                this.filterData();
                this.updateAllCharts();
                this.updateFilterButtonText();
            });
            
        // Toggle dropdown
        button.on("click", () => {
            const isVisible = optionsContainer.style("display") === "block";
            optionsContainer.style("display", isVisible ? "none" : "block");
        });
        
        // Close dropdown when clicking outside
        d3.select("body").on("click.dropdown", (event) => {
            if (!dropdown.node().contains(event.target)) {
                optionsContainer.style("display", "none");
            }
        });
        
        // Update button text
        this.updateFilterButtonText();
    }

    updateFilterButtonText() {
        if (!this.data || this.data.length === 0) {
            d3.select("#searchFilterText").text("No Data");
            return;
        }
        
        const selected = this.selectedSearchTerms.size;
        const allTerms = [...new Set(this.data.map(d => d.searchTerm))].filter(term => term && term !== 'unknown');
        const total = allTerms.length;
        
        if (total === 0) {
            d3.select("#searchFilterText").text("No Search Terms");
            return;
        }
        
        let text;
        if (selected === total) {
            text = `All Search Terms (${total})`;
        } else if (selected === 0) {
            text = "No Terms Selected";
        } else {
            text = `${selected} of ${total} selected`;
        }
        
        d3.select("#searchFilterText").text(text);
    }

    setupModelFilter() {
        if (!this.data || this.data.length === 0) {
            console.warn("No data available for model filter setup");
            return;
        }

        const models = [...new Set(this.data.map(d => d.modelShortName))].filter(model => model && model !== 'unknown');
        console.log("Setting up model filter for models:", models);

        const modelSelect = d3.select("#modelFilter");
        
        // Clear existing options except "All Models"
        modelSelect.selectAll("option:not([value='all'])").remove();
        
        // Add individual model options
        modelSelect.selectAll(".model-option")
            .data(models)
            .enter()
            .append("option")
            .attr("class", "model-option")
            .attr("value", d => d)
            .text(d => d);
        
        // Add event listener for model filter changes
        modelSelect.on("change", (event) => {
            this.selectedModel = event.target.value;
            console.log("Model filter changed to:", this.selectedModel);
            this.filterData();
            this.updateAllCharts();
        });
    }

    filterData() {
        // If no search terms are selected, show no data (to avoid confusion)
        if (this.selectedSearchTerms.size === 0) {
            this.filteredData = [];
            console.log("No search terms selected - showing no data");
            this.updateFilterButtonText();
            return;
        }
        
        this.filteredData = this.data.filter(d => {
            const matchesSearchTerm = this.selectedSearchTerms.has(d.searchTerm);
            const matchesModel = this.selectedModel === "all" || d.modelShortName === this.selectedModel;
            return matchesSearchTerm && matchesModel;
        });
        console.log("Filtered to", this.filteredData.length, "records");
        this.updateFilterButtonText();
    }

    createCharts() {
        this.createSummaryStats();
        this.createExecutionTimeChart();
        this.createTokensPerRunChart();
        this.createSuccessRateChart();
    }

    updateAllCharts() {
        this.updateSummaryStats();
        this.updateExecutionTimeChart();
        this.updateTokensPerRunChart();
        this.updateSuccessRateChart();
    }

    createSummaryStats() {
        const container = d3.select("#summaryStats");
        const stats = this.calculateSummaryStats();
        
        const statItems = container.selectAll(".stat-item")
            .data(stats)
            .enter()
            .append("div")
            .attr("class", "stat-item");
            
        statItems.append("div")
            .attr("class", "stat-label")
            .text(d => d.label);
            
        statItems.append("div")
            .attr("class", "stat-value")
            .text(d => d.value);
    }

    updateSummaryStats() {
        const stats = this.calculateSummaryStats();
        d3.select("#summaryStats").selectAll(".stat-item")
            .data(stats)
            .select(".stat-value")
            .text(d => d.value);
    }

    calculateSummaryStats() {
        if (this.filteredData.length === 0) {
            return [
                { label: "Total Runs", value: 0 },
                { label: "Avg Execution Time", value: "0s" },
                { label: "Avg Total Tokens", value: "0" },
                { label: "Success Rate", value: "0%" }
            ];
        }

        const avgExecutionTime = d3.mean(this.filteredData, d => d.executionTime);
        const avgTokens = d3.mean(this.filteredData, d => d.totalTokens);
        const successCount = this.filteredData.filter(d => d.success).length;
        const successRate = successCount / this.filteredData.length;
        const totalRuns = this.filteredData.length;
        
        console.log("Summary stats calculation:", {
            totalRuns,
            successCount,
            successRate,
            sampleSuccessValues: this.filteredData.slice(0, 5).map(d => d.success)
        });

        return [
            { label: "Total Runs", value: totalRuns },
            { label: "Avg Execution Time", value: `${Math.round(avgExecutionTime / 1000)}s` },
            { label: "Avg Total Tokens", value: Math.round(avgTokens).toLocaleString() },
            { label: "Success Rate", value: `${Math.round(successRate * 100)}%` }
        ];
    }

    // Chart 1: Execution Time per Run by Model
    createExecutionTimeChart() {
        const svg = d3.select("#executionTimeChart")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${this.height})`);
        g.append("g").attr("class", "y-axis");
        
        // Add axis labels
        g.append("text")
            .attr("class", "x-label")
            .style("text-anchor", "middle")
            .attr("x", this.width / 2)
            .attr("y", this.height + 50)
            .text("Run Number");

        g.append("text")
            .attr("class", "y-label")
            .style("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -this.height / 2)
            .attr("y", -60)
            .text("Execution Time (seconds)");
    }

    updateExecutionTimeChart() {
        const svg = d3.select("#executionTimeChart");
        const g = svg.select("g");

        // Add run numbers to data
        const dataWithRunNumbers = this.filteredData.map((d, i) => ({
            ...d,
            runNumber: i + 1
        }));

        const xScale = d3.scaleLinear()
            .domain([1, dataWithRunNumbers.length])
            .range([0, this.width]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(dataWithRunNumbers, d => d.executionTime / 1000)])
            .range([this.height, 0]);

        g.select(".x-axis").call(d3.axisBottom(xScale));
        g.select(".y-axis").call(d3.axisLeft(yScale));

        const circles = g.selectAll(".exec-time-point")
            .data(dataWithRunNumbers);

        circles.enter()
            .append("circle")
            .attr("class", "exec-time-point")
            .attr("r", 4)
            .style("fill", d => this.modelColorScale(d.modelShortName))
            .style("opacity", 0.7)
            .merge(circles)
            .on("mouseover", (event, d) => {
                this.tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>Run ${d.runNumber}</strong><br/>
                        <strong>Model:</strong> ${d.modelShortName}<br/>
                        <strong>Search:</strong> ${d.searchTerm}<br/>
                        <strong>Execution Time:</strong> ${(d.executionTime / 1000).toFixed(1)}s<br/>
                        <strong>Status:</strong> ${d.success ? 'Success' : 'Failed'}
                    `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => {
                this.tooltip.style("opacity", 0);
            })
            .transition()
            .duration(500)
            .attr("cx", d => xScale(d.runNumber))
            .attr("cy", d => yScale(d.executionTime / 1000));

        circles.exit().remove();

        // Add legend
        this.addModelLegend(g, [...new Set(dataWithRunNumbers.map(d => d.modelShortName))]);
    }

    // Chart 2: Total Tokens per Run by Model
    createTokensPerRunChart() {
        const svg = d3.select("#tokensPerRunChart")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${this.height})`);
        g.append("g").attr("class", "y-axis");
        
        // Add axis labels
        g.append("text")
            .attr("class", "x-label")
            .style("text-anchor", "middle")
            .attr("x", this.width / 2)
            .attr("y", this.height + 50)
            .text("Run Number");

        g.append("text")
            .attr("class", "y-label")
            .style("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -this.height / 2)
            .attr("y", -60)
            .text("Total Tokens");
    }

    updateTokensPerRunChart() {
        const svg = d3.select("#tokensPerRunChart");
        const g = svg.select("g");

        const dataWithRunNumbers = this.filteredData.map((d, i) => ({
            ...d,
            runNumber: i + 1
        }));

        const xScale = d3.scaleLinear()
            .domain([1, dataWithRunNumbers.length])
            .range([0, this.width]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(dataWithRunNumbers, d => d.totalTokens)])
            .range([this.height, 0]);

        g.select(".x-axis").call(d3.axisBottom(xScale));
        g.select(".y-axis").call(d3.axisLeft(yScale).tickFormat(d3.format(".2s")));

        const circles = g.selectAll(".tokens-point")
            .data(dataWithRunNumbers);

        circles.enter()
            .append("circle")
            .attr("class", "tokens-point")
            .attr("r", 4)
            .style("fill", d => this.modelColorScale(d.modelShortName))
            .style("opacity", 0.7)
            .merge(circles)
            .on("mouseover", (event, d) => {
                this.tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>Run ${d.runNumber}</strong><br/>
                        <strong>Model:</strong> ${d.modelShortName}<br/>
                        <strong>Search:</strong> ${d.searchTerm}<br/>
                        <strong>Total Tokens:</strong> ${d.totalTokens.toLocaleString()}<br/>
                        <strong>Tokens/Sec:</strong> ${Math.round(d.tokensPerSecond)}
                    `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => {
                this.tooltip.style("opacity", 0);
            })
            .transition()
            .duration(500)
            .attr("cx", d => xScale(d.runNumber))
            .attr("cy", d => yScale(d.totalTokens));

        circles.exit().remove();

        // Add legend
        this.addModelLegend(g, [...new Set(dataWithRunNumbers.map(d => d.modelShortName))]);
    }

    // Chart 3: Success Rate by Model
    createSuccessRateChart() {
        const svg = d3.select("#successRateChart")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${this.height})`);
        g.append("g").attr("class", "y-axis");
        
        // Add axis labels
        g.append("text")
            .attr("class", "x-label")
            .style("text-anchor", "middle")
            .attr("x", this.width / 2)
            .attr("y", this.height + 50)
            .text("Model");

        g.append("text")
            .attr("class", "y-label")
            .style("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -this.height / 2)
            .attr("y", -60)
            .text("Success Rate (%)");
    }

    updateSuccessRateChart() {
        const svg = d3.select("#successRateChart");
        const g = svg.select("g");

        if (!this.filteredData || this.filteredData.length === 0) {
            console.warn("No filtered data available for success rate chart");
            g.selectAll(".success-bar").remove();
            g.selectAll(".success-label").remove();
            return;
        }

        // Calculate success rate by model
        const modelStats = d3.rollups(
            this.filteredData,
            v => ({
                successRate: d3.mean(v, d => d.success ? 1 : 0) * 100,
                totalRuns: v.length,
                successfulRuns: v.filter(d => d.success).length
            }),
            d => d.modelShortName
        ).map(([key, value]) => ({
            model: key,
            ...value
        }));

        console.log("Success rate model stats:", modelStats);

        const xScale = d3.scaleBand()
            .domain(modelStats.map(d => d.model))
            .range([0, this.width])
            .padding(0.3);

        const yScale = d3.scaleLinear()
            .domain([0, 100])
            .range([this.height, 0]);

        g.select(".x-axis").call(d3.axisBottom(xScale));
        g.select(".y-axis").call(d3.axisLeft(yScale).tickFormat(d => d + "%"));

        const bars = g.selectAll(".success-bar")
            .data(modelStats);

        bars.enter()
            .append("rect")
            .attr("class", "success-bar")
            .style("fill", d => this.modelColorScale(d.model))
            .merge(bars)
            .on("mouseover", (event, d) => {
                this.tooltip
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
                this.tooltip.style("opacity", 0);
            })
            .transition()
            .duration(500)
            .attr("x", d => xScale(d.model))
            .attr("y", d => yScale(d.successRate))
            .attr("width", xScale.bandwidth())
            .attr("height", d => this.height - yScale(d.successRate));

        bars.exit().remove();

        // Add percentage labels on bars
        const labels = g.selectAll(".success-label")
            .data(modelStats);

        labels.enter()
            .append("text")
            .attr("class", "success-label")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .style("fill", "white")
            .merge(labels)
            .transition()
            .duration(500)
            .attr("x", d => xScale(d.model) + xScale.bandwidth() / 2)
            .attr("y", d => yScale(d.successRate) + 20)
            .text(d => `${d.successRate.toFixed(1)}%`);

        labels.exit().remove();
    }

    addModelLegend(g, models) {
        // Remove existing legend
        g.selectAll(".legend").remove();
        
        if (models.length === 0) return;
        
        const legend = g.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${this.width + 10}, 20)`);

        // Calculate layout for multiple columns if many models
        const itemsPerColumn = 8;
        const columnWidth = 120;
        const itemHeight = 18;

        const legendItems = legend.selectAll(".legend-item")
            .data(models)
            .enter()
            .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => {
                const col = Math.floor(i / itemsPerColumn);
                const row = i % itemsPerColumn;
                return `translate(${col * columnWidth}, ${row * itemHeight})`;
            });

        legendItems.append("circle")
            .attr("r", 5)
            .style("fill", d => this.modelColorScale(d));

        legendItems.append("text")
            .attr("x", 10)
            .attr("y", 4)
            .style("font-size", "11px")
            .style("font-family", "Arial, sans-serif")
            .text(d => {
                // Truncate very long model names
                return d.length > 15 ? d.substring(0, 15) + '...' : d;
            })
            .append("title")
            .text(d => d); // Full name on hover
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, creating dashboard...");
    new MetricsDashboard();
});
