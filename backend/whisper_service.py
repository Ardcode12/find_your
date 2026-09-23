import os
import requests
import json
from typing import Optional, Dict, Any

from dotenv import load_dotenv

load_dotenv()

def get_whisper_config():
    return {
        "url": os.getenv("WHISPER_BASE_URL", "https://tapping-backward-sprite.ngrok-free.dev/whisper").rstrip("/"),
        "user": os.getenv("WHISPER_USERNAME", "ollama"),
        "pwd": os.getenv("WHISPER_PASSWORD", ""),
        "model": os.getenv("WHISPER_MODEL", "whisper-large-v3"),
        "gemini_key": os.getenv("GEMINI_API_KEY", "")
    }



def ensure_english_translation(raw_text: str, detected_language: str = "en") -> str:
    """Ensure transcribed text is in clean, well-formatted English."""
    if not raw_text or not raw_text.strip():
        return ""
    
    clean_text = raw_text.strip()
    
    # If already English and detected as en, return as is
    if detected_language.lower() in ["en", "english"] and all(ord(c) < 128 for c in clean_text):
        return clean_text

    cfg = get_whisper_config()
    gemini_key = cfg.get("gemini_key")

    # If it has non-English words or non-en language, translate to English using Gemini
    try:
        if gemini_key:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                "You are an assistant for a Campus Lost and Found system. "
                "Translate the following voice transcription into clear, natural English suitable for an item description. "
                "Preserve all specific details like colors, brand names, locations, numbers, or identifying marks. "
                "Return ONLY the plain English description text without any explanations, markdown quotes, or labels.\n\n"
                f"Transcript: {clean_text}"
            )
            response = model.generate_content(prompt)
            if response and response.text and response.text.strip():
                return response.text.strip()
    except Exception as e:
        print(f"[WHISPER] Translation fallback error: {e}")
    
    return clean_text


def transcribe_audio_bytes(
    audio_bytes: bytes,
    filename: str = "audio.m4a",
    content_type: str = "audio/m4a",
    target_language: str = "en"
) -> Dict[str, Any]:
    """
    Sends audio bytes to the Whisper Large V3 service and ensures English output.
    """
    if not audio_bytes or len(audio_bytes) == 0:
        return {"success": False, "error": "Empty audio data received", "text": ""}

    cfg = get_whisper_config()
    transcribe_url = f"{cfg['url']}/transcribe"
    auth = (cfg["user"], cfg["pwd"]) if cfg["user"] and cfg["pwd"] else None

    print(f"[WHISPER] Sending {len(audio_bytes)} bytes to {transcribe_url} as {filename} ({content_type})...")

    try:
        files = {
            "file": (filename, audio_bytes, content_type or "audio/m4a")
        }
        
        # Whisper Large V3 endpoint request
        resp = requests.post(
            transcribe_url,
            auth=auth,
            files=files,
            params={"language": "en"} if target_language == "en" else {},
            timeout=60
        )
        
        print(f"[WHISPER] Remote response: {resp.status_code} {resp.text[:150]}")

        if resp.status_code != 200:
            return {
                "success": False,
                "error": f"Whisper service returned {resp.status_code}: {resp.text[:100]}",
                "text": ""
            }

        data = resp.json()
        raw_text = data.get("text", "").strip()
        detected_lang = data.get("language", "en")
        
        # Format / guarantee English
        final_english_text = ensure_english_translation(raw_text, detected_lang)
        
        print(f"[WHISPER] Transcribed text: '{final_english_text}' (raw: '{raw_text}', lang: {detected_lang})")

        return {
            "success": True,
            "text": final_english_text,
            "raw_text": raw_text,
            "language": detected_lang,
            "model": cfg.get("model", "whisper-large-v3")
        }

    except requests.exceptions.Timeout:
        print("[WHISPER] Remote request timed out after 60s")
        return {"success": False, "error": "Whisper transcription service timed out", "text": ""}
    except Exception as e:
        print(f"[WHISPER] Transcription exception: {e}")
        return {"success": False, "error": str(e), "text": ""}


