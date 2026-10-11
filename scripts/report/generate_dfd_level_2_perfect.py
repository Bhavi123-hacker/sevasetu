import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle

# Styling constants
FONT_MAIN = 'DejaVu Sans'
C_BG      = '#FFFFFF'
C_BORDER  = '#1A1A1A'
C_LINE    = '#111111'
C_HEAD_BG = '#F2F2F2'
C_TEXT    = '#111111'

def create_dfd_canvas(w_in=18, h_in=12, title="", subtitle=""):
    fig, ax = plt.subplots(figsize=(w_in, h_in), dpi=300)
    ax.set_xlim(0, 1000)
    ax.set_ylim(0, 700)
    ax.axis('off')

    # Border
    rect = Rectangle((15, 15), 970, 670, fill=False, edgecolor=C_BORDER, linewidth=1.4)
    ax.add_patch(rect)

    # Title Banner
    ax.plot([15, 985], [645, 645], color=C_BORDER, linewidth=1.0)
    ax.text(28, 660, title, fontname=FONT_MAIN, fontsize=11, fontweight='bold', color=C_TEXT, va='center')
    ax.text(970, 660, subtitle, fontname=FONT_MAIN, fontsize=8, color='#555555', ha='right', va='center')

    # Footer
    ax.plot([15, 985], [40, 40], color=C_BORDER, linewidth=0.8)
    ax.text(28, 28, "Project: SevaSetu Civic Pre-Verification Platform  |  Notation: Gane-Sarson / Yourdon DFD Standard",
            fontname=FONT_MAIN, fontsize=7.2, color='#666666', va='center')
    ax.text(970, 28, "Submitted By: Bhavy Garg (24BAI1088) & Swara Reddy (24BAI1109)",
            fontname=FONT_MAIN, fontsize=7.2, fontweight='bold', color='#333333', ha='right', va='center')

    return fig, ax

def draw_process(ax, x, y, w, h, pid, name):
    # Rounded process rectangle (Gane-Sarson / StarUML standard)
    ax.add_patch(FancyBboxPatch((x - w/2, y - h/2), w, h, boxstyle="round,pad=0,rounding_size=8",
                                 facecolor=C_HEAD_BG, edgecolor=C_BORDER, linewidth=1.3, zorder=3))
    # Header separator
    ax.plot([x - w/2, x + w/2], [y + h/2 - 16, y + h/2 - 16], color=C_BORDER, linewidth=0.9, zorder=4)
    # Header label
    ax.text(x, y + h/2 - 8, f"Sub-Process {pid}", fontname=FONT_MAIN, fontsize=7.2, fontweight='bold', ha='center', va='center', zorder=5)
    # Process text
    ax.text(x, y - 6, name, fontname=FONT_MAIN, fontsize=7.5, fontweight='bold', ha='center', va='center', zorder=5)
    return (x, y, w, h)

def draw_entity(ax, x, y, w, h, name, subtitle=""):
    # Double-line rectangular external boundary
    ax.add_patch(Rectangle((x - w/2, y - h/2), w, h, facecolor=C_BG, edgecolor=C_BORDER, linewidth=1.4, zorder=3))
    ax.add_patch(Rectangle((x - w/2 + 3, y - h/2 + 3), w - 6, h - 6, fill=False, edgecolor=C_BORDER, linewidth=0.6, zorder=4))
    if subtitle:
        ax.text(x, y + 6, name, fontname=FONT_MAIN, fontsize=7.5, fontweight='bold', ha='center', va='center', zorder=5)
        ax.text(x, y - 8, subtitle, fontname=FONT_MAIN, fontsize=6.2, fontstyle='italic', color='#555555', ha='center', va='center', zorder=5)
    else:
        ax.text(x, y, name, fontname=FONT_MAIN, fontsize=7.5, fontweight='bold', ha='center', va='center', zorder=5)
    return (x, y, w, h)

def draw_datastore(ax, x, y, w, h, did, name):
    # Open-ended rectangle
    ax.plot([x - w/2, x + w/2, x + w/2, x - w/2], [y + h/2, y + h/2, y - h/2, y - h/2], color=C_BORDER, linewidth=1.3, zorder=3)
    ax.plot([x - w/2 + 32, x - w/2 + 32], [y + h/2, y - h/2], color=C_BORDER, linewidth=0.9, zorder=3)
    ax.text(x - w/2 + 16, y, did, fontname=FONT_MAIN, fontsize=7.2, fontweight='bold', ha='center', va='center', zorder=4)
    ax.text(x - w/2 + 36 + (w - 36)/2, y, name, fontname=FONT_MAIN, fontsize=7.2, fontweight='bold', ha='center', va='center', zorder=4)
    return (x, y, w, h)

def flow(ax, p1, p2, label="", rad=0, label_pos=None):
    ax.annotate("", xy=p2, xytext=p1,
                arrowprops=dict(arrowstyle="->", color=C_LINE, lw=1.1, connectionstyle=f"arc3,rad={rad}"), zorder=2)
    if label:
        mx, my = label_pos if label_pos else ((p1[0] + p2[0])/2, (p1[1] + p2[1])/2 + 4)
        ax.text(mx, my, label, fontname=FONT_MAIN, fontsize=6.4, ha='center', va='center',
                bbox=dict(boxstyle="square,pad=0.25", fc=C_BG, ec=C_BORDER, lw=0.55), zorder=6)

def render_dfd_2_perfect():
    fig, ax = create_dfd_canvas(18, 12,
                                "Data Flow Diagram -- Level 2 (Decomposition of Process 2.0: Verification Pipeline)",
                                "Detailed Sub-Process Topology, Entity Boundaries & Data Store Interactions")

    # External Boundaries / Level 1 Inputs & Outputs
    e_intake = draw_entity(ax, 75, 520, 115, 60, "Process 1.0\nCitizen Intake", "(Upstream Process)")
    
    e_officer = draw_entity(ax, 75, 395, 115, 48, "Process 4.0\nOfficer Queue", "(READY_FOR_REVIEW)")
    e_ai_gate = draw_entity(ax, 75, 335, 115, 48, "Process 6.0\nAI Clarification", "(INTERVIEW_ELIGIBLE)")
    e_citizen = draw_entity(ax, 75, 275, 115, 48, "Citizen Applicant\n(Deficiency Alert)", "(Score < 50)")

    # Top Row Sub-Processes (y = 520)
    p21 = draw_process(ax, 240, 520, 140, 55, "2.1", "Binary Magic-Byte &\nMIME Validator")
    p22 = draw_process(ax, 460, 520, 140, 55, "2.2", "Image Resolution &\nLaplacian Blur Analyzer")
    p23 = draw_process(ax, 680, 520, 140, 55, "2.3", "pypdfium2 Pixmap &\nTesseract 5 OCR Engine")
    p24 = draw_process(ax, 900, 520, 140, 55, "2.4", "Keyword Cluster &\nDocument Classifier")

    # Bottom Row Sub-Processes (y = 335)
    p25 = draw_process(ax, 900, 335, 140, 55, "2.5", "Regex Entity &\nDemographic Extractor")
    p26 = draw_process(ax, 680, 335, 140, 55, "2.6", "RapidFuzz Cross-Doc\nConsistency Matcher")
    p27 = draw_process(ax, 460, 335, 140, 55, "2.7", "Rule Penalty Matrix\nReadiness Scorer")
    p28 = draw_process(ax, 240, 335, 140, 55, "2.8", "Triage Decision &\nAudit Hash Appender")

    # Data Stores at the bottom (y = 135)
    ds_audit = draw_datastore(ax, 240, 135, 170, 38, "D4", "audit_events (ledger)")
    ds_apps  = draw_datastore(ax, 460, 135, 170, 38, "D2", "applications")
    ds_docs  = draw_datastore(ax, 790, 135, 210, 38, "D3", "application_documents")

    # ------------------ TOP ROW PIPELINE FLOWS ------------------
    flow(ax, (133, 520), (170, 520), "Raw Uploaded Binary")
    flow(ax, (310, 520), (390, 520), "Verified MIME Stream")
    flow(ax, (530, 520), (610, 520), "Sharpness >= 100.0 (300 DPI)")
    flow(ax, (750, 520), (830, 520), "Raw OCR Text Stream")

    # ------------------ TRANSITION 2.4 to 2.5 ------------------
    flow(ax, (900, 492), (900, 363), "Matched Doc Type (e.g. Aadhaar)")

    # ------------------ BOTTOM ROW PIPELINE FLOWS ------------------
    flow(ax, (830, 335), (750, 335), "Extracted Entities (Name, DOB, Income)")
    flow(ax, (610, 335), (530, 335), "Cross-Match Ratios (>= 85%)")
    flow(ax, (390, 335), (310, 335), "Readiness Score (0-100) & Risk Tier")

    # ------------------ OUTPUT ROUTING FROM 2.8 ------------------
    flow(ax, (170, 345), (133, 395), "Verified Dossier (Score >= 70)", rad=0.08)
    flow(ax, (170, 335), (133, 335), "Clarification Candidate (50-69)")
    flow(ax, (170, 325), (133, 275), "Deficiency Feedback (Score < 50)", rad=-0.08)

    # ------------------ DATA STORE READ / WRITE FLOWS ------------------
    # 2.1 writes binary file
    flow(ax, (240, 492), (720, 154), "Persist Validated File Buffer", rad=-0.28, label_pos=(480, 445))

    # 2.3 writes OCR text to D3
    flow(ax, (680, 492), (790, 154), "Write OCR Text & Token Confidence", rad=-0.12, label_pos=(770, 420))

    # 2.5 writes extracted entities to D3
    flow(ax, (900, 307), (830, 154), "Persist Structured Key-Values", rad=0.1, label_pos=(890, 220))

    # 2.6 reads citizen application form from D2
    flow(ax, (480, 154), (660, 307), "Read Declared Form Demographics", rad=0.12, label_pos=(590, 215))

    # 2.7 writes final readiness score and risk tier to D2
    flow(ax, (460, 307), (460, 154), "Write Readiness Score (0-100) & Risk Tier")

    # 2.8 appends SHA-256 cryptographic audit row to D4
    flow(ax, (240, 307), (240, 154), "Append SHA-256 Chained Audit Event")

    out_path = r"c:\Users\Dell\OneDrive\Desktop\sevasetu-final\design\diagrams\dfd_level_2.png"
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, bbox_inches='tight', pad_inches=0.15)
    plt.close()
    print("SUCCESS! Rendered perfected DFD Level 2 to:", out_path)

if __name__ == "__main__":
    render_dfd_2_perfect()
