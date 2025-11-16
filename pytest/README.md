# Pytest Test Suite

This directory contains all pytest tests for the robots.txt analysis functionality.

## Structure

\`\`\`
pytest/
├── conftest.py              # Pytest configuration and fixtures
├── test_runner.py           # Test runner utility
├── unit/                    # Unit tests
│   ├── test_robots_service.py    # Main comprehensive service tests
│   ├── test_robots_api.py        # Direct service API tests  
│   ├── test_robots_github.py     # Real robots.txt tests
│   ├── test_robots_simple.py     # Simple service tests
│   └── test_env.py               # Environment tests
├── integration/             # Integration tests
│   └── test_api_endpoint.py      # Full API endpoint tests
└── fixtures/                # Test data and fixtures
\`\`\`

## Running Tests

### All Tests
\`\`\`bash
pytest
\`\`\`

### Unit Tests Only
\`\`\`bash
pytest pytest/unit/
\`\`\`

### Integration Tests Only
\`\`\`bash
pytest pytest/integration/
\`\`\`

### Specific Test File
\`\`\`bash
pytest pytest/unit/test_robots_service.py
\`\`\`

### With Markers
\`\`\`bash
# Run only unit tests
pytest -m unit

# Run only integration tests  
pytest -m integration

# Skip slow tests
pytest -m "not slow"

# Run only tests that require network
pytest -m requires_network
\`\`\`

### Verbose Output
\`\`\`bash
pytest -v
\`\`\`

### Using the Test Runner
\`\`\`bash
# Run all tests
python pytest/test_runner.py all

# Run only unit tests
python pytest/test_runner.py unit

# Run only integration tests
python pytest/test_runner.py integration
\`\`\`

## Test Categories

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test full API endpoints and workflows
- **Network Tests**: Tests requiring internet connectivity (marked with `requires_network`)
- **API Key Tests**: Tests requiring OpenAI API key (marked with `requires_api_key`)

## Fixtures Available

- `robots_service`: RobotsAnalysisService instance
- `sample_robots_txt`: Sample robots.txt content for testing
- `test_urls`: List of test URLs for testing

## Environment Variables

Some tests require environment variables:
- `OPENAI_API_KEY`: For LLM analysis tests
