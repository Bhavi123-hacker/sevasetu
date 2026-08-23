"""
Generates a handful of synthetic "document" images to test and demo the
pipeline with. These are NOT real documents — they're plain images with
printed text laid out like an Aadhaar card / ration card / electricity
bill, built specifically to exercise OCR + the consistency engine.

One mismatch is deliberately injected (the address on the electricity
bill differs from the Aadhaar) so the consistency engine has something
real to catch. Run this once to populate app/test_documents/.

    python -m app.generate_test_documents
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).parent / "test_documents"
OUT_DIR.mkdir(exist_ok=True)


def _font(size: int):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf",
        "arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_document(filename: str, header: str, lines: list[str]) -> Path:
    width, height = 700, 420
    img = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, width - 1, height - 1], outline="black", width=3)
    draw.text((30, 25), header, fill="black", font=_font(26))
    draw.line([(30, 65), (width - 30, 65)], fill="black", width=2)

    y = 100
    for line in lines:
        draw.text((30, y), line, fill="black", font=_font(20))
        y += 45

    path = OUT_DIR / filename
    img.save(path)
    return path


def make_pdf_document(filename: str, pages_data: list[tuple[str, list[str]]]) -> Path:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    path = OUT_DIR / filename
    c = canvas.Canvas(str(path), pagesize=letter)
    width, height = letter

    for header, lines in pages_data:
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, height - 50, header)
        c.setLineWidth(1)
        c.line(50, height - 60, width - 50, height - 60)

        c.setFont("Helvetica", 12)
        y = height - 100
        for line in lines:
            c.drawString(50, y, line)
            y -= 30
        c.showPage()

    c.save()
    return path


def generate_clean_bundle_with_one_mismatch():
    """
    A single citizen's document bundle for an income-certificate
    application. Name and DOB agree everywhere. Address deliberately
    disagrees between the Aadhaar and the electricity bill.
    """
    make_document(
        "aadhaar.png",
        "GOVERNMENT OF INDIA — AADHAAR",
        [
            "Name: Rahul Kumar",
            "DOB: 12-05-1998",
            "Address: 12 MG Road, Vellore",
            "Aadhaar No: XXXX XXXX 4821",
        ],
    )

    make_document(
        "ration_card.png",
        "STATE RATION CARD",
        [
            "Name: Rahul Kumar",
            "DOB: 12-05-1998",
            "Address: 12 MG Road, Vellore",
            "Card No: RC-88213",
        ],
    )

    make_document(
        "electricity_bill.png",
        "ELECTRICITY BILL — PROOF OF RESIDENCE",
        [
            "Name: Rahul Kumar",
            "DOB: 12-05-1998",
            "Address: 14 MG Road, Vellore",  # <-- deliberate mismatch
            "Consumer No: EB-55210",
        ],
    )

    # Generate single-page PDF
    make_pdf_document(
        "aadhaar.pdf",
        [
            (
                "GOVERNMENT OF INDIA — AADHAAR",
                [
                    "Name: Rahul Kumar",
                    "DOB: 12-05-1998",
                    "Address: 12 MG Road, Vellore",
                    "Aadhaar No: XXXX XXXX 4821",
                ],
            )
        ],
    )

    # Generate multi-page PDF (Page 1: Identity & DOB, Page 2: Address & Residence)
    make_pdf_document(
        "multipage_aadhaar.pdf",
        [
            (
                "GOVERNMENT OF INDIA — AADHAAR (PAGE 1)",
                [
                    "Name: Rahul Kumar",
                    "DOB: 12-05-1998",
                    "Aadhaar No: XXXX XXXX 4821",
                ],
            ),
            (
                "GOVERNMENT OF INDIA — RESIDENCE DETAILS (PAGE 2)",
                [
                    "Address: 12 MG Road, Vellore",
                    "Issued by: UIDAI Regional Office",
                ],
            ),
        ],
    )

    make_document(
        "birth_certificate.png",
        "MUNICIPAL CORPORATION — BIRTH CERTIFICATE",
        [
            "REGISTRATION OF BIRTHS AND DEATHS (FORM NO. 5)",
            "Name: Rahul Kumar",
            "DOB: 12-05-1998",
            "Place of Birth: Vellore General Hospital",
            "Father: Suresh Kumar",
            "Mother: Sunita Devi",
            "Registration No: B-992140",
        ],
    )

    make_document(
        "caste_certificate.png",
        "REVENUE DEPARTMENT — CASTE CERTIFICATE",
        [
            "COMMUNITY CERTIFICATE",
            "Name: Rahul Kumar",
            "DOB: 12-05-1998",
            "Caste: Scheduled Caste",
            "Sub-caste: Adi Dravida",
            "Resolution No: 12/1950",
        ],
    )

    print(f"Generated synthetic documents (PNG and PDF) in {OUT_DIR}")


if __name__ == "__main__":
    generate_clean_bundle_with_one_mismatch()
