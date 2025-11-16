"""
Pytest tests for the robots.txt analysis API
"""
import pytest
import requests
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
import sys
import os

# Add the api directory to the path so we can import the app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

from app.main import app
from app.services.robots_service import RobotsAnalysisService


class TestRobotsAnalysisService:
    """Test the RobotsAnalysisService class"""
    
    def setup_method(self):
        """Setup for each test method"""
        self.service = RobotsAnalysisService()
    
    def test_check_robots_txt_success(self):
        """Test successful robots.txt retrieval"""
        with patch('requests.get') as mock_get:
            # Mock successful response
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "User-agent: *\nDisallow: /admin"
            mock_get.return_value = mock_response
            
            result, url, content = self.service.check_robots_txt("https://example.com")
            
            assert result is True
            assert url == "https://example.com/robots.txt"
            assert "User-agent: *" in content
            assert "Disallow: /admin" in content
    
    def test_check_robots_txt_not_found(self):
        """Test robots.txt not found (404)"""
        with patch('requests.get') as mock_get:
            # Mock 404 response
            mock_response = Mock()
            mock_response.status_code = 404
            mock_get.return_value = mock_response
            
            result, url, status_code = self.service.check_robots_txt("https://example.com")
            
            assert result is False
            assert url == "https://example.com/robots.txt"
            assert status_code == 404
    
    def test_check_robots_txt_connection_error(self):
        """Test connection error handling"""
        with patch('requests.get') as mock_get:
            mock_get.side_effect = requests.exceptions.ConnectionError()
            
            result, url, error = self.service.check_robots_txt("https://unreachable.com")
            
            assert result == "unreachable"
            assert url == "https://unreachable.com/robots.txt"
            assert "Connection failed" in error
    
    def test_check_robots_txt_timeout(self):
        """Test timeout handling"""
        with patch('requests.get') as mock_get:
            mock_get.side_effect = requests.exceptions.Timeout()
            
            result, url, error = self.service.check_robots_txt("https://slow.com")
            
            assert result == "timeout"
            assert url == "https://slow.com/robots.txt"
            assert "Request timed out" in error
    
    def test_analyze_ai_permissions_basic(self):
        """Test basic AI permissions analysis"""
        robots_content = """
User-agent: *
Disallow: /admin

User-agent: gptbot
Disallow: /

User-agent: googlebot
Allow: /public
        """
        
        ai_rules = self.service.analyze_ai_permissions(robots_content)
        
        # The logic returns 'mixed' because we have both allowed and disallowed agents
        assert ai_rules['general_access'] == 'mixed'
        assert 'gptbot' in ai_rules['disallowed_agents']
        assert 'googlebot: /public' in ai_rules['allowed_paths']
    
    def test_analyze_ai_permissions_permissive(self):
        """Test permissive robots.txt"""
        robots_content = """
User-agent: *
Allow: /
        """
        
        ai_rules = self.service.analyze_ai_permissions(robots_content)
        
        assert ai_rules['general_access'] == 'allowed'
        assert '*' in ai_rules['allowed_agents']
    
    def test_check_url_compliance_allowed(self):
        """Test URL compliance check - allowed"""
        robots_content = """
User-agent: *
Disallow: /admin
Allow: /public
        """
        
        # Test allowed URL
        is_compliant = self.service.check_url_compliance(
            "https://example.com/public/page", 
            robots_content
        )
        assert is_compliant is True
        
        # Test disallowed URL
        is_compliant = self.service.check_url_compliance(
            "https://example.com/admin/users", 
            robots_content
        )
        assert is_compliant is False
    
    def test_analyze_multiple_urls_no_robots(self):
        """Test multiple URL analysis when no robots.txt exists"""
        with patch.object(self.service, 'check_robots_txt') as mock_check:
            mock_check.return_value = (False, "https://example.com/robots.txt", 404)
            
            result = self.service.analyze_multiple_urls(
                "https://example.com",
                ["https://example.com/page1", "https://example.com/page2"]
            )
            
            assert result['robots_found'] is False
            assert result['num_okay_pages'] == 2
            assert result['num_not_okay_pages'] == 0
            assert result['overall_sentiment'] == "permissive"
    
    def test_analyze_multiple_urls_with_robots(self):
        """Test multiple URL analysis with robots.txt"""
        robots_content = """
User-agent: *
Disallow: /admin
Allow: /public
        """
        
        with patch.object(self.service, 'check_robots_txt') as mock_check:
            mock_check.return_value = (True, "https://example.com/robots.txt", robots_content)
            
            result = self.service.analyze_multiple_urls(
                "https://example.com",
                [
                    "https://example.com/public/page",
                    "https://example.com/admin/page"
                ]
            )
            
            assert result['robots_found'] is True
            assert result['num_okay_pages'] == 1
            assert result['num_not_okay_pages'] == 1
            assert result['overall_sentiment'] == "mixed"
            assert result['url_compliance']['https://example.com/public/page'] is True
            assert result['url_compliance']['https://example.com/admin/page'] is False


class TestRobotsAPI:
    """Test the FastAPI robots endpoints"""
    
    def setup_method(self):
        """Setup for each test method"""
        self.client = TestClient(app)
    
    def test_health_endpoint(self):
        """Test the health endpoint"""
        response = self.client.get("/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
    
    @patch('app.services.robots_service.RobotsAnalysisService.analyze_multiple_urls')
    def test_robots_analyze_endpoint_success(self, mock_analyze):
        """Test successful robots analysis endpoint"""
        # Mock the service response
        mock_analyze.return_value = {
            "robots_found": True,
            "robots_url": "https://example.com/robots.txt",
            "num_okay_pages": 2,
            "num_not_okay_pages": 1,
            "overall_sentiment": "mixed",
            "ai_rules": {
                "disallowed_agents": ["gptbot"],
                "allowed_agents": ["*"],
                "disallowed_paths": ["*: /admin"],
                "allowed_paths": ["*: /public"],
                "general_access": "mixed"
            },
            "url_compliance": {
                "https://example.com/page1": True,
                "https://example.com/page2": True,
                "https://example.com/admin": False
            },
            "llm_suggestions": "Test suggestions from LLM"
        }
        
        # Test data
        test_payload = {
            "starting_url": "https://example.com",
            "visited_urls": [
                "https://example.com/page1",
                "https://example.com/page2", 
                "https://example.com/admin"
            ]
        }
        
        # Make request
        response = self.client.post("/v1/robots/analyze", json=test_payload)
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        
        assert data["robots_found"] is True
        assert data["robots_url"] == "https://example.com/robots.txt"
        assert data["num_okay_pages"] == 2
        assert data["num_not_okay_pages"] == 1
        assert data["overall_sentiment"] == "mixed"
        assert data["ai_rules"]["general_access"] == "mixed"
        assert len(data["url_compliance"]) == 3
        assert data["llm_suggestions"] is not None
    
    @patch('app.services.robots_service.RobotsAnalysisService.analyze_multiple_urls')
    def test_robots_analyze_endpoint_no_robots(self, mock_analyze):
        """Test robots analysis when no robots.txt exists"""
        # Mock the service response for no robots.txt
        mock_analyze.return_value = {
            "robots_found": False,
            "robots_url": "https://example.com/robots.txt",
            "num_okay_pages": 2,
            "num_not_okay_pages": 0,
            "overall_sentiment": "permissive",
            "ai_rules": {},
            "url_compliance": {
                "https://example.com/page1": True,
                "https://example.com/page2": True
            },
            "llm_suggestions": None,
            "error": None
        }
        
        test_payload = {
            "starting_url": "https://example.com",
            "visited_urls": [
                "https://example.com/page1",
                "https://example.com/page2"
            ]
        }
        
        response = self.client.post("/v1/robots/analyze", json=test_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["robots_found"] is False
        assert data["num_okay_pages"] == 2
        assert data["num_not_okay_pages"] == 0
        assert data["overall_sentiment"] == "permissive"
    
    def test_robots_analyze_endpoint_invalid_payload(self):
        """Test robots analysis with invalid payload"""
        # Missing required fields
        invalid_payload = {
            "starting_url": "https://example.com"
            # missing visited_urls
        }
        
        response = self.client.post("/v1/robots/analyze", json=invalid_payload)
        assert response.status_code == 422  # Validation error
    
    def test_robots_analyze_endpoint_invalid_url(self):
        """Test robots analysis with invalid URL format"""
        invalid_payload = {
            "starting_url": "not-a-valid-url",
            "visited_urls": ["also-not-valid"]
        }
        
        response = self.client.post("/v1/robots/analyze", json=invalid_payload)
        assert response.status_code == 422  # Validation error


class TestRobotsAPIIntegration:
    """Integration tests that test the full stack"""
    
    def setup_method(self):
        """Setup for each test method"""
        self.client = TestClient(app)
    
    @pytest.mark.slow
    def test_real_robots_analysis_github(self):
        """Integration test with real GitHub robots.txt"""
        test_payload = {
            "starting_url": "https://github.com",
            "visited_urls": [
                "https://github.com/",
                "https://github.com/explore"
            ]
        }
        
        response = self.client.post("/v1/robots/analyze", json=test_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # GitHub should have robots.txt
        assert data["robots_found"] is True
        assert "github.com/robots.txt" in data["robots_url"]
        assert data["overall_sentiment"] in ["permissive", "mixed", "restrictive"]
        assert isinstance(data["num_okay_pages"], int)
        assert isinstance(data["num_not_okay_pages"], int)
    
    @pytest.mark.slow  
    def test_real_robots_analysis_no_robots(self):
        """Integration test with a site that likely has no robots.txt"""
        test_payload = {
            "starting_url": "https://httpbin.org",
            "visited_urls": [
                "https://httpbin.org/",
                "https://httpbin.org/get"
            ]
        }
        
        response = self.client.post("/v1/robots/analyze", json=test_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Most simple sites don't have robots.txt
        if not data["robots_found"]:
            assert data["overall_sentiment"] == "permissive"
            assert data["num_okay_pages"] == 2
            assert data["num_not_okay_pages"] == 0


# Pytest configuration
def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line("markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')")


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])
