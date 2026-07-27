"""
OCR extraction — wraps pytesseract. Swap `extract_text` for a cloud OCR
call (e.g. Google Cloud Vision) later without touching any other module;
every downstream stage only depends on this function's return type
(plain text), not on how it was produced.
"""
from pathlib import Path
from PIL import Image
import pytesseract


def extract_text_from_image(image: Image.Image) -> str:
    """Runs OCR on an already-opened PIL image and returns the raw text."""
    return pytesseract.image_to_string(image)


def extract_text(image_path: Path) -> str:
    """Convenience wrapper for on-disk files (tests, the demo-doc generator)."""
    return extract_text_from_image(Image.open(image_path))
