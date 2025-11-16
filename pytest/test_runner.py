#!/usr/bin/env python3
"""
Test runner for the robots.txt API
Provides easy commands to run different test suites in the new pytest structure
"""
import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and display results"""
    print(f"\n{'='*60}")
    print(f"🧪 {description}")
    print(f"{'='*60}")
    print(f"Command: {command}")
    print("-" * 60)
    
    result = subprocess.run(command, shell=True, capture_output=False)
    
    if result.returncode == 0:
        print(f"\n✅ {description} - PASSED")
    else:
        print(f"\n❌ {description} - FAILED")
    
    return result.returncode

def main():
    """Main test runner"""
    if len(sys.argv) < 2:
        print("🤖 Robots.txt API Test Runner")
        print("=" * 40)
        print("\nUsage:")
        print("  python pytest/test_runner.py <command>")
        print("\nCommands:")
        print("  all          - Run all tests")
        print("  unit         - Run unit tests only")
        print("  integration  - Run integration tests only") 
        print("  service      - Run service tests only")
        print("  network      - Run tests that require network")
        print("  fast         - Run fast tests (skip slow ones)")
        print("  verbose      - Run with verbose output")
        print("\nExamples:")
        print("  python pytest/test_runner.py all")
        print("  python pytest/test_runner.py unit")
        print("  python pytest/test_runner.py integration")
        return 1
    
    command = sys.argv[1].lower()
    
    # Change to project root directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)  # Go up one level from pytest/ folder
    os.chdir(project_dir)
    
    # Define test commands - updated for new structure
    python_cmd = "python"  # Use system python
    
    if command == "unit":
        return run_command(
            f'{python_cmd} -m pytest pytest/unit/ -m "not slow" -v',
            "Unit Tests (fast, mocked)"
        )
    
    elif command == "integration":
        return run_command(
            f'{python_cmd} -m pytest pytest/integration/ -v',
            "Integration Tests (API endpoints)"
        )
    
    elif command == "all":
        return_codes = []
        return_codes.append(run_command(
            f'{python_cmd} -m pytest pytest/unit/ -v',
            "All Unit Tests"
        ))
        return_codes.append(run_command(
            f'{python_cmd} -m pytest pytest/integration/ -v', 
            "All Integration Tests"
        ))
        return max(return_codes) if return_codes else 0
    
    elif command == "service":
        return run_command(
            f'{python_cmd} -m pytest pytest/unit/test_robots_service.py -v',
            "Service Layer Tests"
        )
    
    elif command == "network":
        return run_command(
            f'{python_cmd} -m pytest -m requires_network -v',
            "Network-dependent Tests"
        )
    
    elif command == "fast":
        return run_command(
            f'{python_cmd} -m pytest -m "not slow" -v',
            "Fast Tests Only"
        )
    
    elif command == "verbose":
        return run_command(
            f'{python_cmd} -m pytest pytest/ -v -s',
            "All Tests (Verbose Output)"
        )
    
    elif command == "coverage":
        return run_command(
            f'{python_cmd} -m pytest pytest/ --cov=api.app --cov-report=html --cov-report=term',
            "Tests with Coverage Report"
        )
    
    else:
        print(f"❌ Unknown command: {command}")
        print("Run 'python pytest/test_runner.py' for usage help")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
