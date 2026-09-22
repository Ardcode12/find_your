import os
import io
import time
import httpx
from PIL import Image, ImageDraw
from dotenv import load_dotenv

load_dotenv()

CLIP_BASE_URL = os.getenv("CLIP_BASE_URL", "https://tapping-backward-sprite.ngrok-free.dev/clip")
CLIP_USERNAME = os.getenv("CLIP_USERNAME", "ollama")
CLIP_PASSWORD = os.getenv("CLIP_PASSWORD", "")

print("=" * 60)
print("TESTING OPENCLIP ViT-H/14 VIA NGROK")
print(f"URL: {CLIP_BASE_URL}")
print(f"User: {CLIP_USERNAME}")
print("=" * 60)

auth = (CLIP_USERNAME, CLIP_PASSWORD)

# 1. Test Text Embedding
print("\n[1/2] Testing Text Embedding ('Casio Calculator')...")
try:
    start = time.time()
    resp = httpx.post(
        f"{CLIP_BASE_URL.rstrip('/clip')}/clip/embed-text",
        params={"text": "Casio scientific calculator"},
        auth=auth,
        timeout=15.0
    )
    elapsed = time.time() - start
    if resp.status_code == 200:
        data = resp.json()
        print(f"SUCCESS! Received {data.get('dimensions')} dimensions in {elapsed:.2f}s")
    else:
        print(f"FAILED (Status {resp.status_code}): {resp.text}")
except Exception as e:
    print(f"ERROR: {e}")

# 2. Test Image Embedding
print("\n[2/2] Testing Image Embedding (Synthesizing test image in memory)...")
try:
    img = Image.new("RGB", (224, 224), color=(30, 80, 200))
    d = ImageDraw.Draw(img)
    d.rectangle([50, 50, 174, 174], fill=(240, 240, 240))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    start = time.time()
    files = {"file": ("test_image.jpg", img_bytes, "image/jpeg")}
    resp = httpx.post(
        f"{CLIP_BASE_URL.rstrip('/clip')}/clip/embed-image",
        files=files,
        auth=auth,
        timeout=20.0
    )
    elapsed = time.time() - start
    if resp.status_code == 200:
        data = resp.json()
        print(f"SUCCESS! Image embedded into {data.get('dimensions')} dimensions in {elapsed:.2f}s")
        print("\nAll systems operational! OpenCLIP ViT-H/14 is ready for campus matching.")
    else:
        print(f"FAILED (Status {resp.status_code}): {resp.text}")
except Exception as e:
    print(f"ERROR: {e}")

print("=" * 60)
