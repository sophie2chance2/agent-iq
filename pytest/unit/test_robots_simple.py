#!/usr/bin/env python3
"""
Simple test script to verify robots functionality works
"""

import sys
import os
sys.path.append('.')

try:
    from app.services.robots_service import RobotsAnalysisService
    print("✅ Successfully imported RobotsAnalysisService")
    
    # Test the service
    service = RobotsAnalysisService()
    result = service.check_robots_txt("https://github.com")
    
    print("✅ Test successful!")
    print(f"Result: {result}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
