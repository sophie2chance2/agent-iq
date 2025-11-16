import os
print("Checking environment variables...")
api_key = os.getenv('OPENAI_API_KEY')
if api_key:
    print(f"API key found: {api_key[:20]}...")
else:
    print("No API key found")

# Test the script logic
try:
    from openai import OpenAI
    print("OpenAI library imported successfully")
    if api_key:
        client = OpenAI(api_key=api_key)
        print("OpenAI client created successfully")
    else:
        print("Cannot create client without API key")
except ImportError:
    print("OpenAI library not available")
except Exception as e:
    print(f"Error: {e}")
