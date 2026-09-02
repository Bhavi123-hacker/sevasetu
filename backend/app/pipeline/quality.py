"""
Deterministic Document Quality Engine.

Evaluates uploaded civic document scans and PDFs for:
- Resolution & Dimensions
- Blur estimation (Laplacian variance on pixel gradients)
- Contrast & Brightness distributions
- Blank / near-blank page detection
- Text density & readability

Produces structured, explainable quality ratings (GOOD | ACCEPTABLE | POOR | UNREADABLE | UNCERTAIN)
with clear, citizen-friendly guidance. Does NOT equate poor scans with fraud or legal authenticity.
"""
import io
import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from PIL import Image, ImageFilter, ImageStat

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False


@dataclass
class DocumentQualityResult:
    status: str  # GOOD | ACCEPTABLE | POOR | UNREADABLE | UNCERTAIN
    quality_score: float  # 0.0 to 1.0
    width: int = 0
    height: int = 0
    estimated_dpi: int = 150
    blur_score: float = 100.0  # Laplacian variance (higher = sharper)
    contrast_score: float = 50.0  # Std deviation of grayscale pixel intensities
    brightness_score: float = 200.0  # Mean grayscale pixel intensity (0-255)
    is_blank: bool = False
    text_density: int = 0  # OCR character count
    issues: List[str] = field(default_factory=list)
    recommendation: str = "Document quality is acceptable for processing."


def _render_first_page_image(raw_bytes: bytes, filename: Optional[str] = None) -> Optional[Image.Image]:
    """Extracts or renders the first page as a PIL RGB Image."""
    is_pdf = raw_bytes.startswith(b"%PDF-") or (filename and filename.lower().endswith(".pdf"))
    if is_pdf:
        if HAS_PDFPLUMBER:
            try:
                with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
                    if pdf.pages:
                        page_img = pdf.pages[0].to_image(resolution=150)
                        return page_img.original.convert("RGB")
            except Exception:
                pass
        return None

    try:
        img = Image.open(io.BytesIO(raw_bytes))
        return img.convert("RGB")
    except Exception:
        return None


def calculate_blur_variance(gray_img: Image.Image) -> float:
    """
    Computes Laplacian variance as an estimate of image sharpness.
    Low variance indicates blurry edges and lack of high-frequency detail.
    """
    sample = gray_img.copy()
    sample.thumbnail((600, 600))
    
    laplacian_kernel = ImageFilter.Kernel(
        (3, 3),
        [0, 1, 0, 1, -4, 1, 0, 1, 0],
        scale=1,
        offset=128
    )
    edges = sample.filter(laplacian_kernel)
    stat = ImageStat.Stat(edges)
    var = stat.var[0] if stat.var else 0.0
    return round(float(var), 2)


def assess_document_quality(
    raw_bytes: bytes,
    ocr_text: str = "",
    ocr_confidence: float = 0.0,
    filename: Optional[str] = None,
) -> DocumentQualityResult:
    """
    Analyzes raw document bytes and OCR output to assess visual and structural quality.
    """
    issues = []
    text_len = len(ocr_text.strip())
    
    img = _render_first_page_image(raw_bytes, filename)
    
    if img is None:
        if raw_bytes.startswith(b"%PDF-"):
            if text_len < 15:
                return DocumentQualityResult(
                    status="POOR",
                    quality_score=0.35,
                    text_density=text_len,
                    issues=["PDF contains very little readable text."],
                    recommendation="Ensure the PDF contains clear, scanned or typed document content.",
                )
            return DocumentQualityResult(
                status="GOOD",
                quality_score=0.90,
                text_density=text_len,
                recommendation="Digital document content extracted successfully.",
            )
        return DocumentQualityResult(
            status="UNCERTAIN",
            quality_score=0.40,
            issues=["Could not render image for visual quality inspection."],
            recommendation="Please verify scan readability manually.",
        )

    width, height = img.size
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    mean_brightness = stat.mean[0] if stat.mean else 128.0
    std_contrast = stat.stddev[0] if stat.stddev else 30.0
    blur_var = calculate_blur_variance(gray)

    # 1. Blank / Near-Blank Page Check
    is_blank = False
    if std_contrast < 8.0 and (mean_brightness > 240 or mean_brightness < 15):
        is_blank = True
        issues.append("Document image appears blank or completely solid.")
    elif text_len == 0 and std_contrast < 14.0:
        is_blank = True
        issues.append("No text or distinct document features detected on page.")

    # 2. Low Resolution / Dimension Check
    if width < 300 or height < 300:
        issues.append(f"Image resolution ({width}x{height}px) is below recommended standard.")

    # 3. Severe Blur Check
    if blur_var < 15.0 and not is_blank:
        issues.append("Image is heavily blurred or out of focus.")
    elif blur_var < 35.0 and not is_blank:
        issues.append("Moderate blur detected; fine text may be difficult to read.")

    # 4. Poor Contrast / Extreme Brightness Check
    if std_contrast < 18.0 and not is_blank:
        issues.append("Low contrast between text and background.")
    if mean_brightness > 248.0 and not is_blank:
        issues.append("Image appears overexposed / washed out.")
    elif mean_brightness < 30.0 and not is_blank:
        issues.append("Image appears underexposed / too dark.")

    # 5. Low OCR Confidence Signal
    if ocr_confidence > 0 and ocr_confidence < 45.0 and text_len > 0:
        issues.append("Low OCR character confidence across document text.")

    # Compute overall quality score (0.0 to 1.0)
    score = 1.0
    if is_blank:
        score = 0.05
    else:
        if blur_var < 15.0:
            score -= 0.35
        elif blur_var < 35.0:
            score -= 0.15

        if std_contrast < 18.0:
            score -= 0.20
        elif std_contrast < 28.0:
            score -= 0.10

        if width < 300 or height < 300:
            score -= 0.20

        if ocr_confidence > 0 and ocr_confidence < 45.0:
            score -= 0.25
        elif ocr_confidence > 0 and ocr_confidence < 60.0:
            score -= 0.10

    score = max(0.05, min(1.0, round(score, 2)))

    # Determine status rating
    if is_blank:
        status = "UNREADABLE"
        rec = "The uploaded file is blank or contains no visible content. Please upload a clear document scan."
    elif score >= 0.80:
        status = "GOOD"
        rec = "Document scan is clear and legible."
    elif score >= 0.65:
        status = "ACCEPTABLE"
        rec = "Document scan is legible for verification."
    elif score >= 0.35:
        status = "POOR"
        rec = "Scan has low clarity or blur. A higher-resolution scan is recommended if requested by an officer."
    else:
        status = "UNREADABLE"
        rec = "Document is unreadable due to severe blur, extreme exposure, or low resolution. Please provide a clearer copy."

    return DocumentQualityResult(
        status=status,
        quality_score=score,
        width=width,
        height=height,
        blur_score=blur_var,
        contrast_score=round(std_contrast, 1),
        brightness_score=round(mean_brightness, 1),
        is_blank=is_blank,
        text_density=text_len,
        issues=issues,
        recommendation=rec,
    )
