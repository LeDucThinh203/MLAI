import asyncio
import os
import sys

# Ensure backend path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", ".env")))

from app.ai.vision.gemini_vlm_provider import GeminiVLMProvider

async def main():
    provider = GeminiVLMProvider()
    evidence_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test-data", "evidence"))
    
    files_to_test = [
        ("receipt_clear.png", "image/png", "RECEIPT"),
        ("receipt_conflict.png", "image/png", "RECEIPT"),
        ("receipt_blurry.png", "image/png", "RECEIPT"),
        ("sis_screenshot.png", "image/png", "SCREENSHOT")
    ]
    
    for fname, mime, ev_type in files_to_test:
        fpath = os.path.join(evidence_dir, fname)
        print(f"\n=======================================================")
        print(f"TESTING LIVE VLM ON: {fname} ({ev_type})")
        print(f"=======================================================")
        try:
            result = await provider.extract_structured_evidence(fpath, mime, ev_type)
            print(f"Document Type: {result.document_type}")
            print(f"Student ID:    {result.student_identifier}")
            print(f"Transaction:   {result.transaction_id}")
            print(f"Amount:        {result.amount} {result.currency}")
            print(f"Payment Status:{result.payment_status}")
            print(f"Visual Quality:{result.visual_quality}")
            print(f"Uncertain:     {result.uncertain_fields}")
            print(f"Notes:         {result.notes}")
        except Exception as e:
            print(f"Error testing {fname}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
