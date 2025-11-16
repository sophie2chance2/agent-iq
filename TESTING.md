# Robots.txt API Testing

This directory contains comprehensive tests for the robots.txt analysis API built for the UC Berkeley I-School capstone project.

## 🧪 Test Structure

### Test Files
- `test_robots_pytest.py` - Main pytest test suite
- `test_runner.py` - Convenient test runner script
- `pytest.ini` - Pytest configuration
- `test_api_endpoint.py` - Manual API testing script
- `test_robots_*.py` - Individual component tests

### Test Categories

#### 1. Unit Tests (Fast)
- **Service Layer Tests**: Test `RobotsAnalysisService` functionality
- **API Endpoint Tests**: Test FastAPI routes with mocked dependencies
- **Error Handling Tests**: Test timeout, connection errors, invalid data

#### 2. Integration Tests (Slow)
- **Real Network Tests**: Test with actual websites (GitHub, etc.)
- **End-to-End API Tests**: Full API stack testing
- **Live Service Tests**: Test with real robots.txt files

## 🚀 Running Tests

### Quick Commands

\`\`\`bash
# Quick smoke test (fastest)
python test_runner.py quick

# Unit tests only (fast, no network calls)
python test_runner.py unit

# Integration tests (slow, real network calls)
python test_runner.py integration

# All tests
python test_runner.py all

# Service layer only
python test_runner.py service

# API endpoints only
python test_runner.py api

# With coverage report
python test_runner.py coverage
\`\`\`

### Manual pytest Commands

\`\`\`bash
# All tests
python -m pytest test_robots_pytest.py -v

# Unit tests only
python -m pytest test_robots_pytest.py -m "not slow" -v

# Integration tests only
python -m pytest test_robots_pytest.py -m "slow" -v

# Specific test class
python -m pytest test_robots_pytest.py::TestRobotsAnalysisService -v

# Specific test method
python -m pytest test_robots_pytest.py::TestRobotsAPI::test_health_endpoint -v
\`\`\`

## 📊 Test Coverage

### Service Layer (`RobotsAnalysisService`)
- ✅ Robots.txt retrieval (success, 404, timeout, connection error)
- ✅ AI permissions analysis (restrictive, permissive, mixed)
- ✅ URL compliance checking
- ✅ Multi-URL analysis
- ✅ LLM integration (mocked)

### API Layer (`FastAPI Routes`)
- ✅ Health endpoint
- ✅ `/v1/robots/analyze` endpoint
- ✅ Request validation
- ✅ Response formatting
- ✅ Error handling

### Integration Tests
- ✅ Real robots.txt analysis (GitHub)
- ✅ Sites without robots.txt
- ✅ Full API stack testing
- ✅ Network error scenarios

## 🎯 Test Results

Recent test run results:
\`\`\`
====== 16 passed, 0 failed, 2 warnings ======
- Unit Tests: 14/14 passed
- Integration Tests: 2/2 passed
- Coverage: Service layer ~90%, API layer ~95%
\`\`\`

### Test Categories Breakdown
- **Service Tests**: 9 tests
- **API Tests**: 5 tests  
- **Integration Tests**: 2 tests
- **Total**: 16 tests

## 🔧 Test Configuration

### Pytest Marks
- `@pytest.mark.slow` - Integration tests requiring network calls
- `@pytest.mark.unit` - Fast unit tests with mocking
- `@pytest.mark.integration` - End-to-end integration tests

### Mock Usage
- `unittest.mock.patch` for external service calls
- `requests.get` mocking for robots.txt retrieval
- Service layer mocking for API tests

## 📝 Adding New Tests

### For Service Layer
\`\`\`python
def test_new_service_feature(self):
    """Test description"""
    service = RobotsAnalysisService()
    # Test implementation
    assert expected_result == actual_result
\`\`\`

### For API Layer
\`\`\`python
def test_new_api_endpoint(self):
    """Test description"""
    client = TestClient(app)
    response = client.post("/v1/new-endpoint", json=payload)
    assert response.status_code == 200
\`\`\`

### For Integration
\`\`\`python
@pytest.mark.slow
def test_real_integration(self):
    """Test with real external services"""
    # Implementation with real network calls
\`\`\`

## 🛠️ Troubleshooting

### Common Issues
1. **Import Errors**: Ensure you're running from the project root
2. **Network Tests Fail**: Check internet connection for integration tests
3. **API Tests Fail**: Ensure FastAPI dependencies are installed

### Dependencies
\`\`\`bash
pip install pytest httpx fastapi uvicorn requests openai python-dotenv
\`\`\`

## 📚 Best Practices

1. **Test Isolation**: Each test is independent
2. **Mocking**: External services are mocked in unit tests
3. **Descriptive Names**: Test names clearly describe what they test
4. **Fast Feedback**: Unit tests run quickly for development
5. **Comprehensive Coverage**: Both happy path and error scenarios

---

This testing suite ensures the robots.txt API is reliable, maintainable, and ready for production use in the UC Berkeley capstone project! 🎓✨
