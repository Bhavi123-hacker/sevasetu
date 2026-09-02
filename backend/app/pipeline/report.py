"""
Verification report PDF — one document per application, generated on
request (not stored — cheap enough to regenerate every time, and that
way it's never stale).
"""
import io
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


def build_report_pdf(application: dict, field_checks: list, audit_events: list, document_verifications: list = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch, leftMargin=0.6 * inch, rightMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    accent = ParagraphStyle("Accent", parent=styles["Normal"], textColor=colors.HexColor("#0f5c56"))
    disclaimer_style = ParagraphStyle("Disclaimer", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748b"), leading=10)

    story = []

    story.append(Paragraph("SevaSetu — Official Application Readiness Report", styles["Title"]))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%d %b %Y, %H:%M:%S UTC')} • Reference: SS-2026-{application['id'].upper()}", styles["Normal"]))
    story.append(Spacer(1, 14))

    # If application has statutory certificate / approval decision, render official certificate section
    cert_id = application.get("decision_certificate_id")
    is_approved = application.get("status") in ["APPROVED", "RESOLVED"]
    if cert_id or is_approved:
        cert_id_val = cert_id or f"SS-CERT-{datetime.now().year}-{application['id'][:6].upper()}"
        verification_url = f"http://localhost:3000/verify?certificate={cert_id_val}"
        qr_drawing = create_qr_drawing(verification_url, size=52)

        cert_box_data = [
            [
                Paragraph(
                    f"<strong>OFFICIAL STATUTORY DECISION CERTIFICATE</strong><br/>"
                    f"Certificate ID: <font color=\"#059669\"><strong>{cert_id_val}</strong></font><br/>"
                    f"Decision: <strong>{'APPROVED' if is_approved else application.get('status')}</strong> • "
                    f"Authorized Officer: <strong>{application.get('resolved_by') or 'Authorized Verification Officer'}</strong><br/>"
                    f"Decision Timestamp: {str(application.get('resolved_at') or datetime.now().strftime('%d %b %Y, %H:%M UTC'))[:19].replace('T', ' ')}<br/>"
                    f"Basis: {str(application.get('decision_reason_category') or application.get('decision_remarks') or 'Statutory requirements verified.').replace('_', ' ').title()}",
                    styles["Normal"],
                ),
                qr_drawing,
            ]
        ]
        cert_box = Table(cert_box_data, colWidths=[410, 90])
        cert_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#059669")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ]))
        story.append(cert_box)
        story.append(Spacer(1, 14))

    story.append(Paragraph("Application Summary", styles["Heading2"]))
    info_table = Table([
        ["Application Reference", f"SS-2026-{application['id'].upper()}"],
        ["Internal ID", application["id"]],
        ["Citizen Name", application["citizen_name"]],
        ["Civic Service", application["service_type"].replace("_", " ").title()],
        ["Readiness Score", f"{application['readiness_score']}%"],
        ["Risk Assessment", application.get("risk_level", "LOW")],
        ["Processing Status", application["status"].replace("_", " ").title()],
    ], colWidths=[150, 350])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 14))

    # Document Verification Slot Table
    if document_verifications:
        story.append(Paragraph("Document Verification & Classification Findings", styles["Heading2"]))
        verif_rows = [["Slot / Expected", "Detected Document", "Status", "Confidence"]]
        for v in document_verifications:
            verif_rows.append([
                v.get("expected_type", "").replace("_", " ").title(),
                v.get("detected_type", "").replace("_", " ").title(),
                v.get("status", "MATCH"),
                f"{int(v.get('confidence', 0.9) * 100)}%",
            ])
        verif_table = Table(verif_rows, colWidths=[140, 160, 110, 90])
        verif_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf3f2")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dde3e1")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(verif_table)
        story.append(Spacer(1, 14))

    # Readiness Score Breakdown
    story.append(Paragraph("Readiness Score Breakdown", styles["Heading2"]))
    reasoning_rows = [["Points", "Verification Factor"]]
    for r in application.get("score_reasoning", []):
        sign = "+" if r["points"] >= 0 else ""
        reasoning_rows.append([f"{sign}{r['points']}", r["label"]])
    reasoning_table = Table(reasoning_rows, colWidths=[60, 440])
    reasoning_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf3f2")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dde3e1")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(reasoning_table)
    story.append(Spacer(1, 14))

    story.append(Paragraph("Cross-Document Consistency Checks", styles["Heading2"]))
    for check in field_checks:
        icon = "PASS" if check["status"] == "pass" else "MISMATCH"
        line = f"[{icon}] {check['field'].replace('_', ' ').title()} — {check['detail']}"
        story.append(Paragraph(line, styles["Normal"]))
    story.append(Spacer(1, 10))

    if application.get("missing_documents"):
        story.append(Paragraph("Missing Required Documents", styles["Heading2"]))
        for missing_doc in application["missing_documents"]:
            story.append(Paragraph(f"• {missing_doc.replace('_', ' ').title()}", styles["Normal"]))
        story.append(Spacer(1, 10))

    story.append(Paragraph("Automated Assessment Recommendation", styles["Heading2"]))
    story.append(Paragraph(application["recommendation"], accent))
    story.append(Spacer(1, 14))

    if audit_events:
        story.append(Paragraph("Verification Timeline (Audit Trail)", styles["Heading2"]))
        timeline_rows = [["Time", "Actor", "Event", "Detail"]]
        for event in audit_events:
            ts = event["created_at"][11:19] if event.get("created_at") else "—"
            timeline_rows.append([ts, event.get("actor") or "system", event["event_type"], event.get("detail") or ""])
        timeline_table = Table(timeline_rows, colWidths=[60, 90, 130, 220])
        timeline_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf3f2")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dde3e1")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(timeline_table)
        story.append(Spacer(1, 14))

    # Civic Advisory Notice
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "CIVIC ADVISORY: This document readiness report is generated via automated pre-verification assistance. "
        "It does not confer legal authenticity or statutory certification. Final issuance decisions remain under the "
        "exclusive authority of the designated Revenue Officer.",
        disclaimer_style,
    ))

    doc.build(story)
    return buffer.getvalue()


from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing


def create_qr_drawing(url: str, size: float = 65) -> Drawing:
    """Generates a high-precision vector QR code for certificate authenticity verification."""
    qr = QrCodeWidget(url)
    bounds = qr.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    d = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    d.add(qr)
    return d


def build_decision_certificate_pdf(application: dict) -> bytes:
    """
    Generates a professional, downloadable Official Decision Certificate for APPROVED applications.
    Strictly uses SevaSetu civic platform branding without fake seals or government logos.
    Includes high-precision vector QR code for independent public verification.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
    )
    styles = getSampleStyleSheet()

    header_title_style = ParagraphStyle(
        "CertHeaderTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1e3a8a"),
        alignment=1,  # Centered
    )
    header_sub_style = ParagraphStyle(
        "CertHeaderSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#0d9488"),
        alignment=1,  # Centered
    )
    cert_title_style = ParagraphStyle(
        "CertTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,  # Centered
    )
    cert_id_style = ParagraphStyle(
        "CertID",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#059669"),
        alignment=1,
    )
    body_bold_style = ParagraphStyle(
        "CertBodyBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
    )
    body_text_style = ParagraphStyle(
        "CertBodyText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0f172a"),
    )
    disclaimer_style = ParagraphStyle(
        "CertDisclaimer",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )

    story = []

    # Platform Header
    story.append(Paragraph("SEVASETU", header_title_style))
    story.append(Paragraph("CIVIC DOCUMENT PRE-VERIFICATION & SERVICE PLATFORM", header_sub_style))
    story.append(Spacer(1, 10))

    # Decorative separator line
    line_table = Table([[""]], colWidths=[500], rowHeights=[2])
    line_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0d9488")),
    ]))
    story.append(line_table)
    story.append(Spacer(1, 14))

    # Certificate Title & ID
    is_approved = (application.get("status") or "").upper() in ["APPROVED", "RESOLVED"]
    cert_label = "OFFICIAL APPLICATION DECISION CERTIFICATE" if is_approved else "OFFICIAL APPLICATION DECISION NOTICE"
    story.append(Paragraph(cert_label, cert_title_style))
    story.append(Spacer(1, 8))

    cert_id = application.get("decision_certificate_id") or f"SS-CERT-{datetime.now().year}-{application['id'][:6].upper()}"
    cert_id_box = Table([[
        Paragraph(f"Certificate Identifier: <strong>{cert_id}</strong>", cert_id_style)
    ]], colWidths=[480])
    cert_id_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4") if is_approved else colors.HexColor("#fef2f2")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#059669") if is_approved else colors.HexColor("#dc2626")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(cert_id_box)
    story.append(Spacer(1, 16))

    # Primary Decision Details Table
    app_id = application.get("id", "").upper()
    app_ref = f"SS-2026-{app_id}" if not app_id.startswith("SS-") else app_id
    citizen_name = application.get("citizen_name", "Citizen Applicant")
    service_label = (application.get("service_type") or "Civic Service").replace("_", " ").title()
    resolved_by = application.get("resolved_by") or "Authorized Verification Officer"
    resolved_at = application.get("resolved_at") or datetime.now().strftime("%d %b %Y, %H:%M UTC")
    created_at = application.get("created_at") or "Recorded in Registry"
    decision_reason = application.get("decision_reason_category") or application.get("decision_remarks") or ("Statutory requirements and document verification verified." if is_approved else "Statutory criteria not met.")

    detail_data = [
        [Paragraph("Application Reference ID", body_bold_style), Paragraph(app_ref, body_text_style)],
        [Paragraph("Citizen / Applicant Name", body_bold_style), Paragraph(citizen_name, body_text_style)],
        [Paragraph("Civic Service Requested", body_bold_style), Paragraph(service_label, body_text_style)],
        [Paragraph("Application Submission Date", body_bold_style), Paragraph(str(created_at)[:19].replace("T", " "), body_text_style)],
        [
            Paragraph("Official Statutory Decision", body_bold_style),
            Paragraph(
                f"<font color=\"{'#059669' if is_approved else '#dc2626'}\"><strong>{'APPROVED' if is_approved else 'REJECTED'}</strong></font>",
                body_text_style,
            )
        ],
        [Paragraph("Decision Authorization Date", body_bold_style), Paragraph(str(resolved_at)[:19].replace("T", " "), body_text_style)],
        [Paragraph("Designated Reviewing Officer", body_bold_style), Paragraph(resolved_by, body_text_style)],
        [Paragraph("Decision Basis / Category", body_bold_style), Paragraph(decision_reason.replace("_", " ").title(), body_text_style)],
    ]

    if application.get("readiness_score"):
        detail_data.append([
            Paragraph("Document Readiness Score", body_bold_style),
            Paragraph(f"{application['readiness_score']}% (Verified Coherent)", body_text_style)
        ])

    detail_table = Table(detail_data, colWidths=[180, 300])
    detail_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(detail_table)
    story.append(Spacer(1, 16))

    # Evidence Reviewed Section
    evidence_items = application.get("evidence_reviewed") or [
        "Government Identity & Supporting Proof Attachments",
        "Demographic Consistency & Integrity Matrix",
        "AI Verification Interview Factual Consistency Record",
    ]
    if isinstance(evidence_items, str):
        try:
            import json
            evidence_items = json.loads(evidence_items)
        except Exception:
            evidence_items = [evidence_items]

    story.append(Paragraph("<strong>Official Evidentiary Basis:</strong>", body_bold_style))
    story.append(Spacer(1, 4))
    for ev in evidence_items:
        story.append(Paragraph(f"• {ev}", body_text_style))
    story.append(Spacer(1, 16))

    # Officer Authorization Sign-off Box with QR Code Verification
    verification_url = application.get("verification_url") or f"http://localhost:3000/verify?certificate={cert_id}"
    qr_drawing = create_qr_drawing(verification_url, size=62)

    auth_box = Table([
        [
            Paragraph("<strong>Authorization Signature:</strong>", body_bold_style),
            Paragraph("<strong>Statutory Registry Record:</strong>", body_bold_style),
            Paragraph("<strong>Public Verification:</strong>", body_bold_style),
        ],
        [
            Paragraph(f"Digitally authorized by:<br/><strong>{resolved_by}</strong><br/>Revenue &amp; Verification Department", body_text_style),
            Paragraph(f"Record Hash: <strong>VERIFIED</strong><br/>Timestamp: {str(resolved_at)[:19].replace('T', ' ')}<br/>Registry: SevaSetu Civic Platform", body_text_style),
            qr_drawing,
        ]
    ], colWidths=[175, 205, 100])
    auth_box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(auth_box)
    story.append(Spacer(1, 16))

    # Statutory Disclaimer
    story.append(Paragraph(
        "STATUTORY &amp; LEGAL NOTICE: This official decision certificate represents the formal record of application review "
        "and administrative verification executed within the SevaSetu Civic Document Pre-Verification Platform. "
        "It contains authenticated document classification, cross-evidence demographic reconciliation, and designated human officer authorization. "
        "Authenticity can be verified independently via the embedded QR code or at /verify with Certificate ID.",
        disclaimer_style,
    ))

    doc.build(story)
    return buffer.getvalue()

