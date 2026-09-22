"""
Gemini Vision AI Helper — Campus Lost & Found
Analyzes item images to auto-suggest title, category, description, and value flag.
"""

import os
import base64
import json
import re
from typing import Optional

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

CATEGORY_MAP = [
    "electronics", "wallets", "id cards", "keys", "bags",
    "books", "shoes", "jewelry", "clothing", "others"
]

VALUABLE_CATEGORIES = {"electronics", "wallets", "id cards", "jewelry", "gold", "cash"}

SYSTEM_PROMPT = """You are an AI assistant for a campus Lost & Found system.
When given an image of a lost or found item, analyze it and respond ONLY with a JSON object in this exact format:
{
  "title": "Short descriptive item name (max 8 words)",
  "category": "One of: electronics, wallets, id cards, keys, bags, books, shoes, jewelry, clothing, others",
  "description": "Detailed description including color, brand, size, distinguishing features (2-3 sentences)",
  "is_valuable": true or false,
  "confidence": 0.0 to 1.0,
  "tags": ["tag1", "tag2", "tag3"]
}
Rules:
- is_valuable = true for: phones, laptops, earphones, wallets, jewelry, gold, ID cards, cash
- confidence = how confident you are in your identification (0.0 = uncertain, 1.0 = very certain)
- tags = 3-5 descriptive keywords
- Respond ONLY with the JSON, no other text."""


def _parse_gemini_response(text: str) -> dict:
    """Parse JSON from Gemini response text."""
    # Try direct parse
    try:
        return json.loads(text.strip())
    except Exception:
        pass
    # Try extracting JSON block
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    # Fallback
    return {
        "title": "Unknown Item",
        "category": "others",
        "description": "Item details could not be analyzed automatically. Please fill in manually.",
        "is_valuable": False,
        "confidence": 0.0,
        "tags": []
    }


async def analyze_item_image(
    image_url: Optional[str] = None,
    image_base64: Optional[str] = None
) -> dict:
    """
    Calls Gemini Vision API to analyze a found/lost item image.
    Returns dict with title, category, description, is_valuable, confidence, tags.
    Falls back gracefully if API key is missing.
    """
    api_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
    if not api_key:
        return {
            "title": "Item (AI unavailable)",
            "category": "others",
            "description": "Gemini API key not configured. Please describe the item manually.",
            "is_valuable": False,
            "confidence": 0.0,
            "tags": [],
            "error": "GEMINI_API_KEY not set"
        }

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        parts = [SYSTEM_PROMPT]

        if image_base64:
            # Strip data URI prefix if present
            if "," in image_base64:
                image_base64 = image_base64.split(",", 1)[1]
            img_bytes = base64.b64decode(image_base64)
            parts.append({
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64.b64encode(img_bytes).decode("utf-8")
                }
            })
        elif image_url:
            # Download the image
            import httpx
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
                img_bytes = resp.content
                mime = resp.headers.get("content-type", "image/jpeg").split(";")[0]
            parts.append({
                "inline_data": {
                    "mime_type": mime,
                    "data": base64.b64encode(img_bytes).decode("utf-8")
                }
            })
        else:
            return {
                "title": "Unknown Item",
                "category": "others",
                "description": "No image provided for analysis.",
                "is_valuable": False,
                "confidence": 0.0,
                "tags": []
            }

        response = model.generate_content(parts)
        result = _parse_gemini_response(response.text)

        # Normalize category
        cat = result.get("category", "others").lower().strip()
        if cat not in CATEGORY_MAP:
            cat = "others"
        result["category"] = cat

        # Force valuable flag for known valuable categories
        if cat in VALUABLE_CATEGORIES:
            result["is_valuable"] = True

        return result

    except ImportError:
        return {
            "title": "Item",
            "category": "others",
            "description": "google-generativeai package not installed. Run: pip install google-generativeai httpx",
            "is_valuable": False,
            "confidence": 0.0,
            "tags": [],
            "error": "google-generativeai not installed"
        }
    except Exception as e:
        return {
            "title": "Item",
            "category": "others",
            "description": "AI analysis failed. Please fill in details manually.",
            "is_valuable": False,
            "confidence": 0.0,
            "tags": [],
            "error": str(e)
        }
