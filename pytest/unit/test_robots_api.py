#!/usr/bin/env python3
"""
Test script for the robots.txt API functionality
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

from app.services.robots_service import RobotsAnalysisService

def test_robots_service():
    """Test the robots analysis service directly"""
    print("Testing Robots Analysis Service")
    print("=" * 40)
    
    # Initialize the service
    service = RobotsAnalysisService()
    
    # Test with example.com
    starting_url = "https://example.com"
    visited_urls = [
        "https://example.com/",
        "https://example.com/about",
        "https://example.com/contact"
    ]
    
    print(f"Testing with: {starting_url}")
    print(f"Visited URLs: {visited_urls}")
    print("\nAnalyzing...")
    
    # Perform analysis
    result = service.analyze_multiple_urls(starting_url, visited_urls)
    
    # Print results
    print("\n--- RESULTS ---")
    print(f"Robots.txt found: {result['robots_found']}")
    if result['robots_found']:
        print(f"Robots URL: {result['robots_url']}")
        print(f"Compliant pages: {result['num_okay_pages']}")
        print(f"Non-compliant pages: {result['num_not_okay_pages']}")
        print(f"Overall sentiment: {result['overall_sentiment']}")
        
        if result['ai_rules']:
            ai_rules = result['ai_rules']
            print(f"AI access: {ai_rules['general_access']}")
            if ai_rules['disallowed_agents']:
                print(f"Blocked agents: {ai_rules['disallowed_agents']}")
            if ai_rules['allowed_agents']:
                print(f"Allowed agents: {ai_rules['allowed_agents']}")
        
        if result['url_compliance']:
            print("\nURL Compliance:")
            for url, compliant in result['url_compliance'].items():
                status = "✅ ALLOWED" if compliant else "❌ BLOCKED"
                print(f"  {url}: {status}")
        
        if result['llm_suggestions']:
            print(f"\nLLM Suggestions:")
            print(result['llm_suggestions'])
    else:
        print(f"No robots.txt found. Error: {result.get('error', 'Unknown')}")
    
    print("\nTest completed!")

if __name__ == "__main__":
    test_robots_service()
