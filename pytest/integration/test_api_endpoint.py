#!/usr/bin/env python3
"""
Test the robots.txt API endpoint directly
"""
import requests
import json
import time

def test_robots_api():
    """Test the /v1/robots/analyze endpoint"""
    
    print("Testing Robots.txt API Endpoint")
    print("=" * 40)
    
    # Test data
    test_payload = {
        "starting_url": "https://github.com",
        "visited_urls": [
            "https://github.com/",
            "https://github.com/explore",
            "https://github.com/login"
        ]
    }
    
    print(f"Testing URL: http://localhost:8000/v1/robots/analyze")
    print(f"Payload: {json.dumps(test_payload, indent=2)}")
    print("\nSending request...")
    
    try:
        # Make the API request
        response = requests.post(
            "http://localhost:8000/v1/robots/analyze",
            json=test_payload,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ SUCCESS!")
            print("\nResponse:")
            result = response.json()
            print(json.dumps(result, indent=2))
            
            # Parse and display key results
            print("\n--- SUMMARY ---")
            print(f"Robots.txt found: {result.get('robots_found', 'Unknown')}")
            print(f"Compliant pages: {result.get('num_okay_pages', 0)}")
            print(f"Non-compliant pages: {result.get('num_not_okay_pages', 0)}")
            print(f"Overall sentiment: {result.get('overall_sentiment', 'Unknown')}")
            
            if result.get('ai_rules'):
                ai_rules = result['ai_rules']
                print(f"AI access: {ai_rules.get('general_access', 'Unknown')}")
            
            if result.get('llm_suggestions'):
                print(f"\nLLM Suggestions available: ✅")
                print(result['llm_suggestions'][:200] + "..." if len(result['llm_suggestions']) > 200 else result['llm_suggestions'])
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - is the API server running?")
        print("Start the server with:")
        print("cd api && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_health_endpoint():
    """Test the health endpoint first"""
    print("Testing API Health...")
    try:
        response = requests.get("http://localhost:8000/v1/health", timeout=5)
        if response.status_code == 200:
            print("✅ API is healthy!")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except:
        print("❌ API server not reachable")
        return False

if __name__ == "__main__":
    print("🤖 Robots.txt API Test Script")
    print("=" * 50)
    
    # Test health first
    if test_health_endpoint():
        print()
        test_robots_api()
    else:
        print("\nPlease start the API server first:")
        print("cd api && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
