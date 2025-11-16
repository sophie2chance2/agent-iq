"""
Robots.txt analysis service for the Agent Navigability Simulator API
Analyzes robots.txt files for AI agent permissions and compliance
"""
import requests
import os
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urljoin, urlparse

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


class RobotsAnalysisService:
    """Service for analyzing robots.txt files and AI agent permissions"""
    
    def __init__(self):
        self.ai_agents = [
            'gptbot', 'chatgpt-user', 'openai', 'gpt-3', 'gpt-4',
            'claudebot', 'anthropic-ai', 'anthropicbot',
            'googlebot',
            'copilot',
            'huggingfacebot', 'ai2bot',
            'llm', 'bot', '*'
        ]
    
    def load_api_key(self) -> Optional[str]:
        """Load OpenAI API key from environment variable or .env file"""
        # First try environment variable
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key:
            return api_key
        
        # Then try .env file
        env_file_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env')
        if os.path.exists(env_file_path):
            try:
                with open(env_file_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('OPENAI_API_KEY=') and not line.startswith('#'):
                            return line.split('=', 1)[1]
            except Exception as e:
                print(f"Warning: Could not read .env file: {e}")
        
        return None

    def check_robots_txt(self, website: str) -> Tuple[Any, str, Any]:
        """Check if a website has a robots.txt file and return content"""
        # Add https:// if no protocol is specified
        if not website.startswith(('http://', 'https://')):
            website = f'https://{website}'

        robots_url = f"{website.rstrip('/')}/robots.txt"
        
        try:
            response = requests.get(robots_url, timeout=10)
            
            if response.status_code == 200:
                return True, robots_url, response.text
            else:
                return False, robots_url, response.status_code
        except requests.exceptions.ConnectionError:
            return "unreachable", robots_url, "Connection failed - site can't be reached"
        except requests.exceptions.Timeout:
            return "timeout", robots_url, "Request timed out - site may be slow or unreachable"
        except requests.exceptions.RequestException as e:
            return "error", robots_url, str(e)
        except Exception as e:
            return "error", robots_url, str(e)

    def analyze_ai_permissions(self, robots_content: str) -> Dict[str, Any]:
        """Analyze robots.txt content for AI agent permissions"""
        lines = robots_content.split('\n')
        
        
        ai_rules = {
            'disallowed_agents': [],
            'allowed_agents': [],
            'disallowed_paths': [],
            'allowed_paths': [],
            'general_access': 'unknown'
        }
        
        current_user_agent = None
        
        for line in lines:
            line = line.strip().lower()
            
            # Skip comments and empty lines
            if line.startswith('#') or not line or ':' not in line:
                continue
            
            directive, value = line.split(':', 1)
            directive = directive.strip()
            value = value.strip()
            
            if directive == 'user-agent':
                current_user_agent = value
                
            elif directive == 'disallow' and current_user_agent:
                # Check if current user agent is AI-related
                for ai_agent in self.ai_agents:
                    if ai_agent in current_user_agent:
                        if value == '/' or value == '':  # Complete disallow
                            if current_user_agent not in ai_rules['disallowed_agents']:
                                ai_rules['disallowed_agents'].append(current_user_agent)
                        else:  # Specific path disallow
                            ai_rules['disallowed_paths'].append(f"{current_user_agent}: {value}")
                        break
                        
            elif directive == 'allow' and current_user_agent:
                # Check if current user agent is AI-related
                for ai_agent in self.ai_agents:
                    if ai_agent in current_user_agent:
                        ai_rules['allowed_paths'].append(f"{current_user_agent}: {value}")
                        if current_user_agent not in ai_rules['allowed_agents']:
                            ai_rules['allowed_agents'].append(current_user_agent)
                        break
        
        # Determine general AI access
        if ai_rules['disallowed_agents'] and not ai_rules['allowed_agents']:
            ai_rules['general_access'] = 'restricted'
        elif ai_rules['allowed_agents'] and not ai_rules['disallowed_agents']:
            ai_rules['general_access'] = 'allowed'
        elif ai_rules['disallowed_agents'] and ai_rules['allowed_agents']:
            ai_rules['general_access'] = 'mixed'
        else:
            ai_rules['general_access'] = 'unknown'
        
        return ai_rules

    def check_url_compliance(self, url: str, robots_content: str, user_agent: str = "*") -> bool:
        """Check if a specific URL is allowed for a given user agent"""
        # Parse robots.txt for the specific user agent
        lines = robots_content.split('\n')
        current_user_agent = None
        disallowed_paths = []
        allowed_paths = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('#') or not line or ':' not in line:
                continue
            
            directive, value = line.split(':', 1)
            directive = directive.strip().lower()
            value = value.strip()
            
            if directive == 'user-agent':
                current_user_agent = value.lower()
            elif directive == 'disallow' and current_user_agent:
                if current_user_agent == user_agent.lower() or current_user_agent == '*':
                    disallowed_paths.append(value)
            elif directive == 'allow' and current_user_agent:
                if current_user_agent == user_agent.lower() or current_user_agent == '*':
                    allowed_paths.append(value)
        
        # Extract path from URL
        parsed_url = urlparse(url)
        path = parsed_url.path
        
        # Check if path is explicitly allowed
        for allowed_path in allowed_paths:
            if path.startswith(allowed_path):
                return True
        
        # Check if path is disallowed
        for disallowed_path in disallowed_paths:
            if disallowed_path == '/':  # Complete disallow
                return False
            elif path.startswith(disallowed_path):
                return False
        
        # If no specific rules, assume allowed
        return True

    def suggest_agent_tasks_with_llm(self, website: str, ai_rules: Dict[str, Any], robots_content: str) -> Optional[str]:
        """Use LLM to suggest potential agent tasks based on robots.txt analysis"""
        
        if not OPENAI_AVAILABLE:
            return None
        
        # Check if API key is available
        api_key = self.load_api_key()
        if not api_key:
            return None
        
        try:
            client = OpenAI(api_key=api_key)
            
            # Prepare context for the LLM
            context = f"""
Website: {website}
AI Access Status: {ai_rules['general_access']}
Blocked AI Agents: {', '.join(ai_rules['disallowed_agents']) if ai_rules['disallowed_agents'] else 'None'}
Allowed AI Agents: {', '.join(ai_rules['allowed_agents']) if ai_rules['allowed_agents'] else 'None'}
Restricted Paths: {', '.join(ai_rules['disallowed_paths']) if ai_rules['disallowed_paths'] else 'None'}

Robots.txt content snippet:
{robots_content[:500]}...
"""
            
            prompt = f"""Based on this robots.txt analysis for {website}, provide task suggestions for AI agents:

Context:
{context}

Provide 3-4 practical task suggestions that respect the robots.txt rules. For each task, include:
- Task name and brief description
- Why it's compliant with robots.txt
- Specific paths that can be accessed

Keep suggestions concise and practical."""

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an AI assistant specializing in web scraping ethics and robots.txt compliance."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            return f"Error generating suggestions: {str(e)}"
