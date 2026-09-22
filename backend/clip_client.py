"""
Client helper to connect to remote OpenCLIP ViT-H/14 service via ngrok.
"""
import os
import json
import httpx
import numpy as np
from typing import Optional, List, Tuple
from dotenv import load_dotenv

load_dotenv()

CLIP_BASE_URL = os.getenv("CLIP_BASE_URL", "https://tapping-backward-sprite.ngrok-free.dev/clip")
CLIP_USERNAME = os.getenv("CLIP_USERNAME", "ollama")
CLIP_PASSWORD = os.getenv("CLIP_PASSWORD", "")

def get_auth() -> Tuple[str, str]:
    return (CLIP_USERNAME, CLIP_PASSWORD)

def get_clean_base_url() -> str:
    url = CLIP_BASE_URL.strip()
    if url.endswith("/clip"):
        return url[:-5]
    return url

async def embed_image_bytes(image_bytes: bytes) -> Optional[List[float]]:
    """Generate 1024-dim embedding from raw image bytes."""
    try:
        url = f"{get_clean_base_url()}/clip/embed-image"
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": ("image.jpg", image_bytes, "image/jpeg")}
            resp = await client.post(url, files=files, auth=get_auth())
            if resp.status_code == 200:
                return resp.json().get("embedding")
            print(f"[CLIP embed-image failed] {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[CLIP embed-image exception] {e}")
    return None

async def embed_text(text: str) -> Optional[List[float]]:
    """Generate 1024-dim embedding from text description."""
    try:
        url = f"{get_clean_base_url()}/clip/embed-text"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, params={"text": text}, auth=get_auth())
            if resp.status_code == 200:
                return resp.json().get("embedding")
            print(f"[CLIP embed-text failed] {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[CLIP embed-text exception] {e}")
    return None

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculate cosine similarity between two normalized embedding vectors."""
    try:
        a = np.array(v1, dtype=np.float32)
        b = np.array(v2, dtype=np.float32)
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))
    except Exception:
        return 0.0


async def embed_item(image_url: Optional[str] = None, text: Optional[str] = None) -> Optional[List[float]]:
    """
    Generate OpenCLIP ViT-H/14 embedding for an item.
    Prefers image (from base64 or URL). Falls back to text if image is unavailable.
    """
    import base64

    # 1. Attempt image embedding if image_url is present
    if image_url:
        try:
            # Handle Data URI (e.g. data:image/jpeg;base64,...)
            if image_url.startswith("data:image"):
                b64_str = image_url.split(",", 1)[1] if "," in image_url else image_url
                img_bytes = base64.b64decode(b64_str)
                emb = await embed_image_bytes(img_bytes)
                if emb:
                    return emb

            # Handle HTTP/HTTPS URL
            elif image_url.startswith("http://") or image_url.startswith("https://"):
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.get(image_url)
                    if resp.status_code == 200:
                        emb = await embed_image_bytes(resp.content)
                        if emb:
                            return emb

            # Handle local file path
            elif os.path.isfile(image_url):
                with open(image_url, "rb") as f:
                    emb = await embed_image_bytes(f.read())
                    if emb:
                        return emb
        except Exception as e:
            print(f"[CLIP embed_item image error] {e}")

    # 2. Fall back to text description embedding
    if text and text.strip():
        return await embed_text(text.strip())

    return None

