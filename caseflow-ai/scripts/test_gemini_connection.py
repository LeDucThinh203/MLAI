import os
import sys
from dotenv import load_dotenv

# Load env from backend/.env
backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
load_dotenv(backend_env)

api_key = os.getenv("GEMINI_API_KEY")
print(f"Checking Gemini Key: Present={bool(api_key)}, Length={len(api_key) if api_key else 0}")

try:
    from google import genai
    client = genai.Client(api_key=api_key)
    
    # Test text generation
    model_name = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash")
    print(f"Testing model: {model_name}...")
    
    response = client.models.generate_content(
        model=model_name,
        contents="Say 'CaseFlow AI Online' in exactly 3 words."
    )
    print("Response from Gemini:")
    print(response.text)
    print("Gemini API connection SUCCESSFUL!")
except Exception as e:
    print(f"Error connecting to Gemini API: {e}")
    # Try gemini-2.0-flash as fallback check
    try:
        print("Testing fallback model: gemini-2.0-flash...")
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say 'CaseFlow AI Online' in exactly 3 words."
        )
        print("Response from fallback model:")
        print(response.text)
        print("Fallback model connection SUCCESSFUL!")
    except Exception as e2:
        print(f"Error with fallback model: {e2}")
