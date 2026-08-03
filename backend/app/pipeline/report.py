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


def build_report_pdf(application: dict, field_checks: list, audit_events: list) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75 * inch, bottomMargin=0.75 * inch)
    styles = getSampleStyleSheet()
    accent = ParagraphStyle("Accent", parent=styles["Normal"], textColor=colors.HexColor("#0f5c56"))

    story = []

    story.append(Paragraph("SevaSetu — Application Readiness Report", styles["Title"]))
    story.append(Paragraph(f"Generated {datetime.now().strftime('%d %b %Y, %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Application", styles["Heading2"]))
    info_table = Table([
        ["Application ID", application["id"]],
        ["Citizen", application["citizen_name"]],
        ["Service", application["service_type"].replace("_", " ").title()],
        ["Status", application["status"].title()],
    ], colWidths=[150, 350])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 16))

    story.append(Paragraph(f"Readiness Score: {application['readiness_score']}%", styles["Heading2"]))
    reasoning_rows = [["Points", "Reason"]]
    for r in application["score_reasoning"]:
        sign = "+" if r["points"] >= 0 else ""
        reasoning_rows.append([f"{sign}{r['points']}", r["label"]])
    reasoning_table = Table(reasoning_rows, colWidths=[60, 440])
    reasoning_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf3f2")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dde3e1")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(reasoning_table)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Document Checks", styles["Heading2"]))
    for check in field_checks:
        icon = "PASS" if check["status"] == "pass" else "FAIL"
        line = f"[{icon}] {check['field'].replace('_', ' ').title()} — {check['detail']}"
        story.append(Paragraph(line, styles["Normal"]))
    story.append(Spacer(1, 12))

    if application.get("missing_documents"):
        story.append(Paragraph("Missing Documents", styles["Heading2"]))
        for missing_doc in application["missing_documents"]:
            story.append(Paragraph(f"\u2022 {missing_doc.replace('_', ' ').title()}", styles["Normal"]))
        story.append(Spacer(1, 12))

    story.append(Paragraph("Recommendation", styles["Heading2"]))
    story.append(Paragraph(application["recommendation"], accent))
    story.append(Spacer(1, 16))

    if audit_events:
        story.append(Paragraph("Processing Timeline", styles["Heading2"]))
        timeline_rows = [["Time", "Event", "Detail"]]
        for event in audit_events:
            ts = event["created_at"][11:19] if event.get("created_at") else "—"
            timeline_rows.append([ts, event["event_type"], event.get("detail") or ""])
        timeline_table = Table(timeline_rows, colWidths=[70, 150, 280])
        timeline_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf3f2")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dde3e1")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(timeline_table)

    doc.build(story)
    return buffer.getvalue()
