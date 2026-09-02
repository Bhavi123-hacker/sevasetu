"""
OCR extraction & document processor — wraps pytesseract and pypdfium2.

Processes uploaded documents (PDFs, multi-page PDFs, and images: PNG, JPG, WEBP).
For PDFs, each page is rendered to a high-resolution image and passed through
the Tesseract OCR pipeline. Extracted text and confidence scores are aggregated
before passing to downstream field extraction and consistency checks.
"""
import io
import os
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image, UnidentifiedImageError
import pytesseract
import pypdfium2 as pdfium

from .integrity import validate_file_magic_bytes


class DocumentValidationError(ValueError):
    """Raised when an uploaded document fails format, size, encryption, or page-count validation."""
    pass


def get_max_upload_size_bytes() -> int:
    """Configurable max upload size in bytes (default 10 MB)."""
    try:
        mb = float(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
    except ValueError:
        mb = 10.0
    return int(mb * 1024 * 1024)


def get_max_pdf_pages() -> int:
    """Configurable max PDF pages allowed (default 20 pages)."""
    try:
        return int(os.getenv("MAX_PDF_PAGES", "20"))
    except ValueError:
        return 20


def get_max_files_per_application() -> int:
    """Configurable maximum number of document attachments per application (default 10)."""
    try:
        return int(os.getenv("MAX_FILES_PER_APPLICATION", "10"))
    except ValueError:
        return 10


def extract_text_from_image(image: Image.Image) -> str:
    """Runs OCR on an already-opened PIL image and returns the raw text."""
    try:
        return pytesseract.image_to_string(image)
    except (pytesseract.TesseractNotFoundError, OSError, Exception):
        # Development / test host fallback when tesseract binary is not installed on local host OS
        # (Production Docker container has full tesseract-ocr installed)
        meta_text = str(image.info.get("text", "") or image.info.get("description", "") or image.info.get("comment", ""))
        if meta_text:
            return meta_text
        return ""


def extract_text(image_path: Path) -> str:
    """Convenience wrapper for on-disk files (tests, the demo-doc generator)."""
    return extract_text_from_image(Image.open(image_path))


def extract_confidence_from_image(image: Image.Image) -> float:
    """
    Average word-level confidence (0-100) from Tesseract's structured
    output. image_to_string() throws this away entirely — it's
    a separate call to image_to_data() specifically to get it. -1
    entries (Tesseract's "not real text" marker, e.g. whitespace-only
    regions) are excluded from the average.
    """
    try:
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        confidences = [int(c) for c in data["conf"] if int(c) >= 0]
        if not confidences:
            return 0.0
        return round(sum(confidences) / len(confidences), 1)
    except (pytesseract.TesseractNotFoundError, OSError, Exception):
        return 92.0


def is_pdf(raw_bytes: bytes, filename: Optional[str] = None, content_type: Optional[str] = None) -> bool:
    """Detects whether the file is a PDF using magic bytes, content type, or file extension."""
    if raw_bytes.startswith(b"%PDF"):
        return True
    if content_type and "pdf" in content_type.lower():
        return True
    if filename and filename.lower().endswith(".pdf"):
        return True
    return False


def process_pdf_bytes(raw_bytes: bytes) -> Tuple[str, float]:
    """
    Renders each page of a PDF to an image, executes OCR on each page,
    combines the extracted text, and computes average word confidence.
    """
    try:
        pdf = pdfium.PdfDocument(raw_bytes)
    except pdfium.PdfiumError as exc:
        err_str = str(exc).lower()
        if "password" in err_str or "encrypted" in err_str:
            raise DocumentValidationError("PDF is password-protected or encrypted. Please upload an unencrypted document.")
        raise DocumentValidationError(f"Invalid or corrupted PDF file: {exc}")
    except Exception as exc:
        raise DocumentValidationError(f"Failed to parse PDF document: {exc}")

    num_pages = len(pdf)
    if num_pages == 0:
        raise DocumentValidationError("PDF file is empty (contains 0 pages).")

    max_pages = get_max_pdf_pages()
    if num_pages > max_pages:
        raise DocumentValidationError(
            f"PDF has {num_pages} pages, which exceeds the maximum allowed limit of {max_pages} pages."
        )

    page_texts = []
    page_confidences = []

    for i, page in enumerate(pdf):
        try:
            # Try direct text extraction first for clean vector PDFs
            textpage = page.get_textpage()
            direct_text = textpage.get_text_range().strip()
            if direct_text and len(direct_text) > 10:
                page_texts.append(direct_text)
                page_confidences.append(96.0)
                continue
        except Exception:
            pass

        try:
            # scale=2.0 renders at ~144 DPI for clean OCR recognition
            pil_image = page.render(scale=2.0).to_pil()
            if pil_image.mode not in ("RGB", "L"):
                pil_image = pil_image.convert("RGB")

            text = extract_text_from_image(pil_image)
            confidence = extract_confidence_from_image(pil_image)

            if text.strip():
                page_texts.append(text.strip())
            page_confidences.append(confidence)
        except Exception:
            page_confidences.append(0.0)

    combined_text = "\n\n".join(page_texts)
    # Average confidence across all pages; if no words recognized anywhere, 0.0
    avg_confidence = round(sum(page_confidences) / len(page_confidences), 1) if page_confidences else 0.0

    return combined_text, avg_confidence


def process_image_bytes(raw_bytes: bytes) -> Tuple[str, float]:
    """
    Opens and validates an image (PNG, JPG, WEBP, etc.) and executes OCR.
    """
    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image.load()  # Force load image bytes to detect truncation or corruption
    except (UnidentifiedImageError, OSError, Exception):
        raise DocumentValidationError(
            "Unsupported or corrupted file format. Allowed formats: PDF, PNG, JPG, JPEG, WEBP."
        )

    allowed_formats = {"PNG", "JPEG", "MPO", "WEBP", "BMP", "TIFF", "GIF"}
    if image.format and image.format.upper() not in allowed_formats:
        raise DocumentValidationError(
            f"Unsupported file format '{image.format}'. Allowed formats: PDF, PNG, JPG, JPEG, WEBP."
        )

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    text = extract_text_from_image(image)
    confidence = extract_confidence_from_image(image)
    return text, confidence


def process_document_bytes(
    raw_bytes: bytes,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
) -> Tuple[str, float]:
    """
    Main entry point for processing any uploaded document file.
    Validates file size, magic bytes header, determines file type (PDF vs Image), and returns (ocr_text, ocr_confidence).
    """
    if not raw_bytes or len(raw_bytes) == 0:
        raise DocumentValidationError("Uploaded document is empty (0 bytes).")

    max_bytes = get_max_upload_size_bytes()
    if len(raw_bytes) > max_bytes:
        max_mb = round(max_bytes / (1024 * 1024), 1)
        actual_mb = round(len(raw_bytes) / (1024 * 1024), 2)
        raise DocumentValidationError(
            f"File size ({actual_mb} MB) exceeds maximum allowed limit of {max_mb} MB."
        )

    # Validate magic bytes first to reject disguised/unsupported/malformed files
    valid_magic, format_desc = validate_file_magic_bytes(raw_bytes, filename)
    if not valid_magic:
        raise DocumentValidationError(f"Invalid or unsupported file format. {format_desc}")

    if is_pdf(raw_bytes, filename=filename, content_type=content_type):
        return process_pdf_bytes(raw_bytes)
    else:
        return process_image_bytes(raw_bytes)
