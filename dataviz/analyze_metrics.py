#!/usr/bin/env python3
"""
Data processing and visualization script for Agent Navigation Metrics
Complements the D3 dashboard with Python-based analysis
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import json
import os
import sys

class MetricsAnalyzer:
    def __init__(self, csv_path="../ui/logs/workflow-runs.csv"):
        """Initialize with path to CSV file"""
        self.csv_path = csv_path
        self.df = None
        self.load_data()
    
    def load_data(self):
        """Load and preprocess the CSV data"""
        try:
            self.df = pd.read_csv(self.csv_path)
            print(f"Loaded {len(self.df)} records from {self.csv_path}")
            
            # Parse timestamps
            self.df['timestamp'] = pd.to_datetime(self.df['timestamp'])
            
            # Parse execution time (remove 'ms' suffix and convert to int)
            self.df['executionTimeMs'] = self.df['executionTime'].str.replace('ms', '').astype(int)
            self.df['executionTimeSeconds'] = self.df['executionTimeMs'] / 1000
            
            # Convert boolean columns
            bool_columns = ['advancedStealth', 'proxies']
            for col in bool_columns:
                if col in self.df.columns:
                    self.df[col] = self.df[col].map({'true': True, 'false': False})
            
            # Parse extraction results JSON
            self.df['productCount'] = 0
            for idx, row in self.df.iterrows():
                try:
                    if pd.notna(row['extractionResults']):
                        results = json.loads(row['extractionResults'])
                        if 'products' in results:
                            self.df.loc[idx, 'productCount'] = len(results['products'])
                except:
                    pass
            
            print("Data preprocessing completed")
            print(f"Date range: {self.df['timestamp'].min()} to {self.df['timestamp'].max()}")
            print(f"Models: {self.df['modelName'].unique()}")
            print(f"Search terms: {self.df['searchTerm'].unique()}")
            
        except FileNotFoundError:
            print(f"CSV file not found at {self.csv_path}")
            self.create_sample_data()
    
    def create_sample_data(self):
        """Create sample data for demonstration"""
        print("Creating sample data for demonstration...")
        
        np.random.seed(42)
        n_records = 50
        
        models = [
            "anthropic/claude-3-5-sonnet-20240620", 
            "anthropic/claude-sonnet-4-20250514"
        ]
        search_terms = ["socks", "shoes", "gaming laptop", "pants", "shampoo"]
        
        data = []
        base_date = datetime.now()
        
        for i in range(n_records):
            execution_time = np.random.gamma(2, 15000)  # Gamma distribution for realistic timing
            total_tokens = np.random.gamma(2, 8000) + 5000
            
            record = {
                'timestamp': base_date - pd.Timedelta(days=np.random.randint(0, 30)),
                'modelName': np.random.choice(models),
                'searchTerm': np.random.choice(search_terms),
                'executionTimeMs': int(execution_time),
                'executionTimeSeconds': execution_time / 1000,
                'totalPromptTokens': int(total_tokens * 0.7),
                'totalCompletionTokens': int(total_tokens * 0.3),
                'totalTokens': int(total_tokens),
                'tokensPerSecond': total_tokens / (execution_time / 1000),
                'totalInferenceTimeMs': int(execution_time * 0.8),
                'browserbaseAvgCpuUsage': np.random.uniform(10, 90),
                'browserbaseMemoryUsage': np.random.uniform(512, 2048),
                'browserbaseProxyBytes': np.random.randint(1000000, 50000000),
                'productCount': np.random.randint(20, 80),
                'environment': 'BROWSERBASE',
                'proxies': np.random.choice([True, False]),
                'advancedStealth': np.random.choice([True, False])
            }
            data.append(record)
        
        self.df = pd.DataFrame(data)
        print(f"Created {len(self.df)} sample records")
    
    def generate_summary_stats(self):
        """Generate summary statistics"""
        print("\n=== SUMMARY STATISTICS ===")
        
        print(f"Total workflow runs: {len(self.df)}")
        print(f"Date range: {self.df['timestamp'].min()} to {self.df['timestamp'].max()}")
        
        print(f"\nExecution Time:")
        print(f"  Mean: {self.df['executionTimeSeconds'].mean():.1f}s")
        print(f"  Median: {self.df['executionTimeSeconds'].median():.1f}s")
        print(f"  Min: {self.df['executionTimeSeconds'].min():.1f}s")
        print(f"  Max: {self.df['executionTimeSeconds'].max():.1f}s")
        
        print(f"\nToken Usage:")
        print(f"  Mean total tokens: {self.df['totalTokens'].mean():.0f}")
        print(f"  Mean tokens/second: {self.df['tokensPerSecond'].mean():.1f}")
        
        print(f"\nBy Model:")
        model_stats = self.df.groupby('modelName').agg({
            'executionTimeSeconds': ['mean', 'count'],
            'totalTokens': 'mean',
            'tokensPerSecond': 'mean'
        }).round(2)
        print(model_stats)
        
        print(f"\nBy Search Term:")
        search_stats = self.df.groupby('searchTerm').agg({
            'executionTimeSeconds': ['mean', 'count'],
            'productCount': 'mean'
        }).round(2)
        print(search_stats)
    
    def create_visualizations(self):
        """Create matplotlib/seaborn visualizations"""
        print("\nCreating visualizations...")
        
        # Set style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
        # Create figure with subplots
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle('Agent Navigation Metrics Analysis', fontsize=16, y=0.98)
        
        # 1. Execution time distribution
        axes[0,0].hist(self.df['executionTimeSeconds'], bins=20, alpha=0.7, edgecolor='black')
        axes[0,0].set_title('Execution Time Distribution')
        axes[0,0].set_xlabel('Execution Time (seconds)')
        axes[0,0].set_ylabel('Frequency')
        axes[0,0].axvline(self.df['executionTimeSeconds'].mean(), color='red', linestyle='--', 
                         label=f'Mean: {self.df["executionTimeSeconds"].mean():.1f}s')
        axes[0,0].legend()
        
        # 2. Tokens vs Execution Time scatter
        scatter = axes[0,1].scatter(self.df['totalTokens'], self.df['executionTimeSeconds'], 
                                  c=self.df['tokensPerSecond'], cmap='viridis', alpha=0.7)
        axes[0,1].set_title('Tokens vs Execution Time')
        axes[0,1].set_xlabel('Total Tokens')
        axes[0,1].set_ylabel('Execution Time (seconds)')
        plt.colorbar(scatter, ax=axes[0,1], label='Tokens/Second')
        
        # 3. Model performance comparison
        model_data = self.df.groupby('modelName')['executionTimeSeconds'].mean().sort_values()
        model_names = [name.split('/')[-1] for name in model_data.index]
        axes[0,2].bar(range(len(model_names)), model_data.values)
        axes[0,2].set_title('Average Execution Time by Model')
        axes[0,2].set_xlabel('Model')
        axes[0,2].set_ylabel('Avg Execution Time (seconds)')
        axes[0,2].set_xticks(range(len(model_names)))
        axes[0,2].set_xticklabels(model_names, rotation=45)
        
        # 4. Search term performance
        search_data = self.df.groupby('searchTerm')['executionTimeSeconds'].mean().sort_values()
        axes[1,0].bar(range(len(search_data)), search_data.values)
        axes[1,0].set_title('Average Execution Time by Search Term')
        axes[1,0].set_xlabel('Search Term')
        axes[1,0].set_ylabel('Avg Execution Time (seconds)')
        axes[1,0].set_xticks(range(len(search_data)))
        axes[1,0].set_xticklabels(search_data.index, rotation=45)
        
        # 5. Tokens per second over time
        if len(self.df) > 1:
            time_sorted = self.df.sort_values('timestamp')
            axes[1,1].plot(time_sorted['timestamp'], time_sorted['tokensPerSecond'], 
                          marker='o', alpha=0.7)
            axes[1,1].set_title('Tokens/Second Over Time')
            axes[1,1].set_xlabel('Date')
            axes[1,1].set_ylabel('Tokens per Second')
            axes[1,1].tick_params(axis='x', rotation=45)
        
        # 6. Resource usage (if available)
        if 'browserbaseAvgCpuUsage' in self.df.columns and self.df['browserbaseAvgCpuUsage'].notna().any():
            axes[1,2].scatter(self.df['browserbaseAvgCpuUsage'], self.df['browserbaseMemoryUsage'], 
                            c=self.df['executionTimeSeconds'], cmap='plasma', alpha=0.7)
            axes[1,2].set_title('Resource Usage')
            axes[1,2].set_xlabel('CPU Usage (%)')
            axes[1,2].set_ylabel('Memory Usage (MB)')
        else:
            axes[1,2].text(0.5, 0.5, 'No Browserbase\nResource Data', 
                          ha='center', va='center', transform=axes[1,2].transAxes)
            axes[1,2].set_title('Resource Usage (No Data)')
        
        plt.tight_layout()
        plt.savefig('metrics_analysis.png', dpi=300, bbox_inches='tight')
        print("Saved visualization to 'metrics_analysis.png'")
        plt.show()
    
    def generate_insights(self):
        """Generate insights and recommendations"""
        print("\n=== INSIGHTS AND RECOMMENDATIONS ===")
        
        # Performance insights
        print("🚀 PERFORMANCE INSIGHTS:")
        
        # Model comparison
        model_perf = self.df.groupby('modelName').agg({
            'executionTimeSeconds': 'mean',
            'tokensPerSecond': 'mean',
            'totalTokens': 'mean'
        }).round(2)
        
        fastest_model = model_perf['executionTimeSeconds'].idxmin()
        fastest_time = model_perf.loc[fastest_model, 'executionTimeSeconds']
        print(f"  • Fastest model: {fastest_model.split('/')[-1]} ({fastest_time:.1f}s avg)")
        
        most_efficient = model_perf['tokensPerSecond'].idxmax()
        efficiency = model_perf.loc[most_efficient, 'tokensPerSecond']
        print(f"  • Most efficient: {most_efficient.split('/')[-1]} ({efficiency:.1f} tokens/sec)")
        
        # Search term insights
        search_perf = self.df.groupby('searchTerm').agg({
            'executionTimeSeconds': 'mean',
            'productCount': 'mean'
        }).round(2)
        
        fastest_search = search_perf['executionTimeSeconds'].idxmin()
        fastest_search_time = search_perf.loc[fastest_search, 'executionTimeSeconds']
        print(f"  • Fastest search term: '{fastest_search}' ({fastest_search_time:.1f}s avg)")
        
        most_products = search_perf['productCount'].idxmax()
        product_count = search_perf.loc[most_products, 'productCount']
        print(f"  • Best product extraction: '{most_products}' ({product_count:.0f} products avg)")
        
        # Correlation insights
        correlations = self.df[['executionTimeSeconds', 'totalTokens', 'tokensPerSecond', 'productCount']].corr()
        print(f"\n📊 CORRELATIONS:")
        print(f"  • Execution time vs Total tokens: {correlations.loc['executionTimeSeconds', 'totalTokens']:.3f}")
        print(f"  • Execution time vs Tokens/sec: {correlations.loc['executionTimeSeconds', 'tokensPerSecond']:.3f}")
        print(f"  • Product count vs Execution time: {correlations.loc['productCount', 'executionTimeSeconds']:.3f}")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        
        if fastest_model != most_efficient:
            print(f"  • Consider using {fastest_model.split('/')[-1]} for speed or {most_efficient.split('/')[-1]} for efficiency")
        
        # Find outliers
        exec_q75 = self.df['executionTimeSeconds'].quantile(0.75)
        exec_q25 = self.df['executionTimeSeconds'].quantile(0.25)
        iqr = exec_q75 - exec_q25
        outlier_threshold = exec_q75 + 1.5 * iqr
        outliers = self.df[self.df['executionTimeSeconds'] > outlier_threshold]
        
        if len(outliers) > 0:
            print(f"  • {len(outliers)} runs took significantly longer than average (>{outlier_threshold:.1f}s)")
            print(f"    Investigate: {', '.join(outliers['searchTerm'].unique())}")
        
        # Efficiency recommendations
        low_efficiency = self.df[self.df['tokensPerSecond'] < self.df['tokensPerSecond'].quantile(0.25)]
        if len(low_efficiency) > 0:
            print(f"  • {len(low_efficiency)} runs had low token efficiency")
            print(f"    Common factors: {', '.join(low_efficiency['searchTerm'].value_counts().head(3).index)}")
    
    def export_for_d3(self, output_path="processed_data.json"):
        """Export processed data for D3 visualization"""
        # Create summary data for D3
        summary_data = {
            'totalRuns': len(self.df),
            'dateRange': {
                'start': self.df['timestamp'].min().isoformat(),
                'end': self.df['timestamp'].max().isoformat()
            },
            'modelStats': self.df.groupby('modelName').agg({
                'executionTimeSeconds': ['mean', 'count'],
                'totalTokens': 'mean',
                'tokensPerSecond': 'mean'
            }).round(2).to_dict(),
            'searchStats': self.df.groupby('searchTerm').agg({
                'executionTimeSeconds': ['mean', 'count'],
                'productCount': 'mean'
            }).round(2).to_dict(),
            'topInsights': {
                'fastestModel': self.df.groupby('modelName')['executionTimeSeconds'].mean().idxmin(),
                'mostEfficientModel': self.df.groupby('modelName')['tokensPerSecond'].mean().idxmax(),
                'bestSearchTerm': self.df.groupby('searchTerm')['productCount'].mean().idxmax()
            }
        }
        
        with open(output_path, 'w') as f:
            json.dump(summary_data, f, indent=2)
        
        print(f"Exported summary data to {output_path}")
    
    def run_full_analysis(self):
        """Run complete analysis pipeline"""
        print("Running full analysis...")
        self.generate_summary_stats()
        self.generate_insights()
        self.create_visualizations()
        self.export_for_d3()
        print("\n✅ Analysis complete!")

def main():
    """Main function"""
    print("Agent Navigation Metrics Analyzer")
    print("=" * 40)
    
    analyzer = MetricsAnalyzer()
    analyzer.run_full_analysis()

if __name__ == "__main__":
    main()
