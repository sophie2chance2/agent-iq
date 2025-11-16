"""
Pytest configuration and fixtures
"""
import pytest
import sys
import os

# Add the api directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

@pytest.fixture
def robots_service():
    """Fixture to provide a RobotsAnalysisService instance"""
    from app.services.robots_service import RobotsAnalysisService
    return RobotsAnalysisService()

@pytest.fixture
def sample_robots_txt():
    """Fixture with sample robots.txt content"""
    return """User-agent: *
Disallow: /admin
Disallow: /private
Allow: /public

User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

Crawl-delay: 1
Sitemap: https://example.com/sitemap.xml"""

@pytest.fixture
def test_urls():
    """Fixture with test URLs"""
    return [
        "https://example.com",
        "https://github.com",
        "https://httpbin.org",
        "https://python.org"
    ]
